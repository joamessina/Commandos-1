// Cruza los datos de objetivos de la misión real con los sitios que detecta el port.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseVol } from '../src/formats/vol.ts';
import { parseSec, SectorFlag, type Sector } from '../src/formats/sec.ts';
import { asText, find } from '../src/formats/clave.ts';
import { Demolition, parseSites } from '../src/engine/demolition.ts';
import { groundZ, SectorMap } from '../src/engine/sectors.ts';
import { navFor } from '../src/engine/path.ts';
import { flatten, loadWorld } from '../src/engine/world.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entries = parseContainer(dir);
const read = (name: string): string | undefined => {
  const entry = entries.find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith(`/${name.toUpperCase()}`));
  return entry ? new TextDecoder('windows-1252').decode(entryBytes(dir, entry)) : undefined;
};
const mission = read('MAPA0000.MIS');
const volume = read('MAPA0000.VOL');
if (!mission || !volume) throw new Error('Falta MAPA0000.MIS o MAPA0000.VOL');
const sectorEntry = entries.find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith('/MAPA0000.SEC'));
if (!sectorEntry) throw new Error('Falta MAPA0000.SEC');
const sec = parseSec(entryBytes(dir, sectorEntry));
type Point = { x: number; y: number };
function salidaSector(sector: Sector, source: Point, target: Point): { edge: number; t: number; neighbor: number | undefined } | null {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  for (let i = 0; i < sector.verts.length; i++) {
    const a = sec.verts[sector.verts[i] ?? -1];
    const b = sec.verts[sector.verts[(i + 1) % sector.verts.length] ?? -1];
    if (!a || !b) continue;
    const ax = a.x - source.x;
    const ay = a.y - source.y;
    const bx = b.x - source.x;
    const by = b.y - source.y;
    const den = dy * (bx - ax) - dx * (by - ay);
    if (-dx * ay + dy * ax >= 0 && -dx * by + dy * bx < 0 && Math.abs(den) > 0.000001) {
      return { edge: i, t: (ay * (bx - ax) - ax * (by - ay)) / den, neighbor: sector.neighbors[i] };
    }
  }
  return null;
}
function contactoPoligono(points: readonly Point[], center: Point, source: Point): number {
  let t = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[i];
    if (!a || !b) continue;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const dx = source.x - center.x;
    const dy = source.y - center.y;
    let den = dx * ey - dy * ex;
    let edgeNumerator = dx * (center.y - a.y) - dy * (center.x - a.x);
    let rayNumerator = ex * (center.y - a.y) - (center.x - a.x) * ey;
    if (den < 0) { den = -den; edgeNumerator = -edgeNumerator; rayNumerator = -rayNumerator; }
    if (edgeNumerator > 0 && rayNumerator > 0 && edgeNumerator < den && rayNumerator < den) {
      t = Math.max(t, rayNumerator / den);
    }
  }
  return t;
}
function distanciaPoligono(points: readonly Point[], source: Point): number {
  let inside = false;
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    if (!a || !b) continue;
    if ((a.y > source.y) !== (b.y > source.y) && source.x < (b.x - a.x) * (source.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((source.x - a.x) * dx + (source.y - a.y) * dy) / lengthSquared)) : 0;
    distance = Math.min(distance, Math.hypot(source.x - (a.x + t * dx), source.y - (a.y + t * dy)));
  }
  return inside ? 0 : distance;
}
function sectoresEnRadio(x: number, y: number): { sector: number; z: number; flags: number; margin: number }[] {
  return sec.sectors.flatMap((sector, index) => {
    if (x + 10 < sector.minX || x - 10 > sector.maxX || y + 10 < sector.minY || y - 10 > sector.maxY) return [];
    const vertices = sector.verts.map((vertex) => sec.verts[vertex]).filter((point) => point !== undefined);
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      if (a && b) area += a.x * b.y - b.x * a.y;
    }
    if (area === 0) return [];
    const distances = vertices.map((a, i) => {
      const b = vertices[(i + 1) % vertices.length];
      if (!b) return Number.NEGATIVE_INFINITY;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      return length > 0 ? Math.sign(area) * (dx * (y - a.y) - dy * (x - a.x)) / length : Number.NEGATIVE_INFINITY;
    });
    const margin = Math.min(...distances);
    return margin >= -10 ? [{ sector: index, z: groundZ(sector, x, y), flags: sector.flags, margin }] : [];
  });
}
for (const difficulty of ['FACIL', 'DIFICIL'] as const) {
  const elems = flatten(loadWorld(mission, { difficulty, macro: (name) => read(`${name}.MAC`) }));
  const { sites, objectives, escape } = parseSites(mission, parseVol(volume), elems);
  console.log('DIFICULTAD', difficulty, 'OBJETIVOS', JSON.stringify(objectives), 'HUIDA', JSON.stringify(escape));
  if (escape) {
    const sector = new SectorMap(sec).at(escape.x, escape.y);
    if (sector) console.log('SECTOR_HUIDA', sec.sectors.indexOf(sector), 'TIPO', sector.type,
      'VERTICES', JSON.stringify(sector.verts.map((index) => sec.verts[index])));
  }
  for (const token of objectives) {
    console.log('OBJETIVO', token, 'SITIOS', JSON.stringify(sites.filter((site) => site.objectives.includes(token)).map((site) => site.name)));
  }
  for (const [part, main] of [['ANTI04B', 'ANTI04A'], ['ANTI04C', 'ANTI04A'], ['ANTI02B', 'ANTI02A']] as const) {
    const secondary = sites.find((site) => site.name === part);
    const primary = sites.find((site) => site.name === main);
    if (secondary?.forwardsTo !== main || !primary?.swaps.some((swap) => swap.poly === part)) throw new Error(`Enlace incompleto de ${part} a ${main}`);
    console.log('OBJETIVO_PIEZA', part, 'REENVIA', main);
  }
  for (const name of ['ANTI04A', 'ANTI01', 'ANTI02A', 'ANTI03', 'ANTI05', 'FARO01', 'EXPL_ANTENA']) {
    const sound = sites.find((site) => site.name === name)?.sound;
    if (!sound || sound.tag !== 'XCA1') throw new Error(`Sonido inesperado de ${name}`);
    console.log('SONIDO_DERRUMBE', name, JSON.stringify(sound));
  }
  for (const name of ['CASA06A', 'CASA08', 'CASA05']) {
    console.log('CUARTEL_EDIFICIO', name, 'SITIOS', JSON.stringify(sites.filter((site) => site.name === name).map((site) => site.name)));
  }
  const casa = parseVol(volume).polys.find((poly) => poly.name === 'CASA04');
  if (casa && casa.points.length > 0) {
    const centerX = (casa.header[0] ?? 0) + casa.points.reduce((sum, point) => sum + point.x, 0) / casa.points.length;
    const centerY = (casa.header[1] ?? 0) + casa.points.reduce((sum, point) => sum + point.y, 0) / casa.points.length;
    const auditSite = sites.find((site) => site.name === 'CASA04');
    if (!auditSite) throw new Error('Falta el detector de CASA04');
    const checkSite = new Demolition([{ ...auditSite, destroyed: false }], [], { soldiers: [], commandos: [] });
    checkSite.explode(centerX, centerY, 1, 'XPLO', 'BOMBA', casa.header[2] ?? 0);
    if (!checkSite.destroyed.has('CASA04')) throw new Error('El centro real de CASA04 no alcanza su detector');
    console.log('CASA04_CENTRO_DENTRO_DETECTOR', true);
    const map = new SectorMap(sec);
    const auditWave = new Demolition(sites.map((site) => ({ ...site, destroyed: false })), [], { soldiers: [], commandos: [] }, 0, { blastNav: navFor(map) });
    auditWave.explode(1830, 946, 250, 'XPLO', 'BOMBA', 355);
    if (!auditWave.destroyed.has('CASA04') || !auditWave.destroyed.has('EXPL_ANTENA')) throw new Error('La muestra de onda no alcanzó los detectores esperados');
    console.log('ONDA_MUESTRA_CASA04_Y_ANTENA', true);
    const antenna = elems.find((elem) => elem.token === 'EXPL_ANTENA');
    const casaSector = map.at(centerX, centerY);
    const antennaSector = antenna ? map.at(antenna.x, antenna.y) : null;
    console.log('CASA04_CENTRO', JSON.stringify([centerX, centerY]), 'CABECERA_VOL', JSON.stringify(casa.header),
      'SECTOR', casaSector ? sec.sectors.indexOf(casaSector) : -1);
    console.log('ANTENA_SECTOR', antennaSector ? sec.sectors.indexOf(antennaSector) : -1);
    if (antenna && antennaSector) console.log('ANTENA_SUELO', groundZ(antennaSector, antenna.x, antenna.y),
      'TIPO', antennaSector.type, 'FLAGS', antennaSector.flags);
    if (antenna) {
      const candidates: { x: number; y: number; z: number; distance: number; sector: number }[] = [];
      for (let dx = -200; dx <= 200; dx += 10) for (let dy = -200; dy <= 200; dy += 10) {
        const x = antenna.x + dx;
        const y = antenna.y + dy;
        const sector = map.at(x, y);
        if (!sector || sector.flags & (SectorFlag.NTrans | SectorFlag.NCamin)) continue;
        const z = groundZ(sector, x, y);
        if (Math.abs(z - antenna.z) > 20) continue;
        candidates.push({ x, y, z, distance: Math.hypot(dx, dy), sector: sec.sectors.indexOf(sector) });
      }
      candidates.sort((a, b) => a.distance - b.distance);
      console.log('ANTENA_SUELO_CANDIDATOS_APROX', JSON.stringify(candidates.slice(0, 5)));
      const level = candidates.filter((candidate) => {
        const heights = sectoresEnRadio(candidate.x, candidate.y);
        return heights.length > 0 && heights.every((item) => Math.abs(item.z - candidate.z) < 20);
      });
      console.log('ANTENA_SUELO_NIVELADO_RADIO_10_APROX', JSON.stringify(level.slice(0, 5)));
      const withoutDeclaredOverlap = level.filter((candidate) => !elems.some((elem) => {
        const lists = find(elem.block, '.LISTAS');
        if (!Array.isArray(lists) || !lists.some((item) => typeof item === 'string' && item.toUpperCase() === 'CHOC')) return false;
        if (asText(find(elem.block, '.NOSOLIDO')) === '1' || elem.radius <= 0) return false;
        return elem.z <= candidate.z + 5 && elem.z + elem.height >= candidate.z &&
          Math.hypot(candidate.x - elem.x, candidate.y - elem.y) < 10 + elem.radius;
      }));
      console.log('ANTENA_NIVELADO_SIN_SOLAPE_DECLARADO_APROX', JSON.stringify(withoutDeclaredOverlap.slice(0, 5)));
      const allPolys = parseVol(volume).polys;
      const withMargin = withoutDeclaredOverlap.filter((candidate) => {
        const own = sectoresEnRadio(candidate.x, candidate.y).find((item) => item.sector === candidate.sector);
        if (!own || own.margin < 12) return false;
        return !allPolys.some((poly) => {
          const z = poly.header[2];
          const h = poly.header[3];
          if (z === undefined || h === undefined || z > candidate.z + 5 || z + h < candidate.z || poly.points.length === 0) return false;
          const points = poly.points.map((point) => ({ x: point.x + (poly.header[0] ?? 0), y: point.y + (poly.header[1] ?? 0) }));
          return distanciaPoligono(points, candidate) < 12;
        });
      });
      console.log('ANTENA_CANDIDATOS_CON_MARGEN_APROX', JSON.stringify(withMargin.slice(0, 5)));
    }
    if (antenna) {
      let inside = false;
      const points = casa.points.map((point) => ({ x: point.x + (casa.header[0] ?? 0), y: point.y + (casa.header[1] ?? 0) }));
      console.log('CASA04_VERTICES_DISTANCIA_ANTENA', JSON.stringify(points.map((point) => Math.hypot(point.x - antenna.x, point.y - antenna.y))));
      console.log('CASA04_LONGITUDES_ARISTAS', JSON.stringify(points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        return next ? Math.hypot(point.x - next.x, point.y - next.y) : 0;
      })));
      const t = contactoPoligono(points, { x: centerX, y: centerY }, antenna);
      const target = { x: centerX + t * (antenna.x - centerX), y: centerY + t * (antenna.y - centerY) };
      const targetSector = map.at(target.x, target.y);
      console.log('CASA04_RAYO_CENTRADO_APROX', JSON.stringify({ t, target, sector: targetSector ? sec.sectors.indexOf(targetSector) : -1 }));
      const source = process.argv.includes('--margen') ? { x: 1940, y: 906 } :
        { x: process.argv.includes('--otro') ? 1870 : 1830, y: process.argv.includes('--antes') ? 946 : 956 };
      const nearbyVolumes = parseVol(volume).polys.flatMap((poly) => {
        const z = poly.header[2];
        const h = poly.header[3];
        if (z === undefined || h === undefined || z > 360 || z + h < 355 || poly.points.length === 0) return [];
        const polyPoints = poly.points.map((point) => ({ x: point.x + (poly.header[0] ?? 0), y: point.y + (poly.header[1] ?? 0) }));
        const distance = distanciaPoligono(polyPoints, source);
        return distance <= 25 ? [{ name: poly.name, z, h, distance }] : [];
      });
      console.log('CANDIDATO_VOLUMENES_CERCANOS_APROX', JSON.stringify(nearbyVolumes));
      const nearbyElements = elems.flatMap((elem) => {
        const distance = Math.hypot(source.x - elem.x, source.y - elem.y);
        if (elem.radius <= 0 || distance > elem.radius + 25 || elem.z > 360 || elem.z + elem.height < 355) return [];
        return [{ token: elem.token, macro: elem.macro, xyz: [elem.x, elem.y, elem.z], radius: elem.radius, height: elem.height,
          distance, lists: find(elem.block, '.LISTAS'), noSolido: find(elem.block, '.NOSOLIDO') }];
      });
      console.log('CANDIDATO_ELEMENTOS_CERCANOS_DECLARADOS', JSON.stringify(nearbyElements));
      const engineer = { x: source.x, y: source.y + 21 };
      const engineerSector = map.at(engineer.x, engineer.y);
      console.log('CANDIDATO_ZAPADOR_21', JSON.stringify({ ...engineer,
        sector: engineerSector ? sec.sectors.indexOf(engineerSector) : -1,
        ground: engineerSector ? groundZ(engineerSector, engineer.x, engineer.y) : null,
        flags: engineerSector?.flags ?? null }));
      console.log('CANDIDATO_ZAPADOR_SOLAPES_DECLARADOS', JSON.stringify(elems.flatMap((elem) => {
        const lists = find(elem.block, '.LISTAS');
        if (!Array.isArray(lists) || !lists.some((item) => typeof item === 'string' && item.toUpperCase() === 'CHOC')) return [];
        if (asText(find(elem.block, '.NOSOLIDO')) === '1' || elem.radius <= 0 || elem.z > 395 || elem.z + elem.height < 355) return [];
        const distance = Math.hypot(engineer.x - elem.x, engineer.y - elem.y);
        return distance < 10 + elem.radius ? [{ token: elem.token, xyz: [elem.x, elem.y, elem.z], distance }] : [];
      })));
      if (engineerSector) console.log('CANDIDATO_COLOCACION_SALIDA_APROX', JSON.stringify(salidaSector(engineerSector, engineer, source)));
      const overlapping = sectoresEnRadio(source.x, source.y);
      console.log('CANDIDATO_SECTORES_RADIO_10_APROX', JSON.stringify(overlapping));
      const antennaFraction = 100 / Math.hypot(source.x - antenna.x, source.y - antenna.y);
      const antennaTarget = { x: antenna.x + antennaFraction * (source.x - antenna.x),
        y: antenna.y + antennaFraction * (source.y - antenna.y) };
      const antennaTargetSector = map.at(antennaTarget.x, antennaTarget.y);
      console.log('ANTENA_RAYO_CANDIDATO_APROX', JSON.stringify({ fraction: antennaFraction, target: antennaTarget,
        sector: antennaTargetSector ? sec.sectors.indexOf(antennaTargetSector) : -1 }));
      const bombSector = map.at(source.x, source.y);
      if (bombSector) console.log('ANTENA_CANDIDATO_SALIDA_SECTOR_APROX', JSON.stringify(salidaSector(bombSector, source, antennaTarget)));
      console.log('CASA04_DISTANCIA_MAX_VERTICE_CANDIDATO', Math.max(...points.map((point) => Math.hypot(point.x - source.x, point.y - source.y))));
      const candidateT = contactoPoligono(points, { x: centerX, y: centerY }, source);
      const candidateTarget = { x: centerX + candidateT * (source.x - centerX), y: centerY + candidateT * (source.y - centerY) };
      const candidateSector = map.at(candidateTarget.x, candidateTarget.y);
      console.log('CASA04_RAYO_CANDIDATO_APROX', JSON.stringify({ source, t: candidateT, target: candidateTarget,
        sector: candidateSector ? sec.sectors.indexOf(candidateSector) : -1 }));
      const sourceSector = map.at(source.x, source.y);
      if (sourceSector) console.log('CASA04_CANDIDATO_SALIDA_SECTOR_APROX', JSON.stringify(salidaSector(sourceSector, source, candidateTarget)));
      if (antennaSector && targetSector === antennaSector) {
        console.log('CASA04_RAYO_SALIDA_SECTOR_APROX', salidaSector(antennaSector, antenna, target)?.t ?? null);
      }
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i];
        const b = points[j];
        if (a && b && ((a.y > antenna.y) !== (b.y > antenna.y)) &&
          antenna.x < (b.x - a.x) * (antenna.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      console.log('ANTENA_DENTRO_POLIGONO_CASA04', inside);
    }
  }
  console.log('DETECTORES_DECLARADOS', JSON.stringify(elems.filter((elem) => asText(find(elem.block, '.DETECTAEXPLOSION')) === '1').map((elem) => elem.token)));
}
