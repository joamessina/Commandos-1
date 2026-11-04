// Cruza los datos de objetivos de la misión real con los sitios que detecta el port.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseVol } from '../src/formats/vol.ts';
import { parseSec, SectorFlag } from '../src/formats/sec.ts';
import { asText, find } from '../src/formats/clave.ts';
import { parseSites } from '../src/engine/demolition.ts';
import { groundZ, SectorMap } from '../src/engine/sectors.ts';
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
  for (const name of ['CASA06A', 'CASA08', 'CASA05']) {
    console.log('CUARTEL_EDIFICIO', name, 'SITIOS', JSON.stringify(sites.filter((site) => site.name === name).map((site) => site.name)));
  }
  const casa = parseVol(volume).polys.find((poly) => poly.name === 'CASA04');
  if (casa && casa.points.length > 0) {
    const centerX = (casa.header[0] ?? 0) + casa.points.reduce((sum, point) => sum + point.x, 0) / casa.points.length;
    const centerY = (casa.header[1] ?? 0) + casa.points.reduce((sum, point) => sum + point.y, 0) / casa.points.length;
    const map = new SectorMap(sec);
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
    }
    if (antenna) {
      let inside = false;
      const points = casa.points.map((point) => ({ x: point.x + (casa.header[0] ?? 0), y: point.y + (casa.header[1] ?? 0) }));
      console.log('CASA04_VERTICES_DISTANCIA_ANTENA', JSON.stringify(points.map((point) => Math.hypot(point.x - antenna.x, point.y - antenna.y))));
      console.log('CASA04_LONGITUDES_ARISTAS', JSON.stringify(points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        return next ? Math.hypot(point.x - next.x, point.y - next.y) : 0;
      })));
      let t = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length];
        const b = points[i];
        if (!a || !b) continue;
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const dx = antenna.x - centerX;
        const dy = antenna.y - centerY;
        let den = dx * ey - dy * ex;
        let edgeNumerator = dx * (centerY - a.y) - dy * (centerX - a.x);
        let rayNumerator = ex * (centerY - a.y) - (centerX - a.x) * ey;
        if (den < 0) { den = -den; edgeNumerator = -edgeNumerator; rayNumerator = -rayNumerator; }
        if (edgeNumerator > 0 && rayNumerator > 0 && edgeNumerator < den && rayNumerator < den) {
          t = Math.max(t, rayNumerator / den);
        }
      }
      const target = { x: centerX + t * (antenna.x - centerX), y: centerY + t * (antenna.y - centerY) };
      const targetSector = map.at(target.x, target.y);
      console.log('CASA04_RAYO_CENTRADO_APROX', JSON.stringify({ t, target, sector: targetSector ? sec.sectors.indexOf(targetSector) : -1 }));
      const source = { x: 1830, y: process.argv.includes('--antes') ? 946 : 956 };
      const engineer = { x: source.x, y: source.y + 21 };
      const engineerSector = map.at(engineer.x, engineer.y);
      console.log('CANDIDATO_ZAPADOR_21', JSON.stringify({ ...engineer,
        sector: engineerSector ? sec.sectors.indexOf(engineerSector) : -1,
        ground: engineerSector ? groundZ(engineerSector, engineer.x, engineer.y) : null,
        flags: engineerSector?.flags ?? null }));
      if (engineerSector) {
        const dx = source.x - engineer.x;
        const dy = source.y - engineer.y;
        for (let i = 0; i < engineerSector.verts.length; i++) {
          const a = sec.verts[engineerSector.verts[i] ?? -1];
          const b = sec.verts[engineerSector.verts[(i + 1) % engineerSector.verts.length] ?? -1];
          if (!a || !b) continue;
          const ax = a.x - engineer.x;
          const ay = a.y - engineer.y;
          const bx = b.x - engineer.x;
          const by = b.y - engineer.y;
          const den = dy * (bx - ax) - dx * (by - ay);
          if (-dx * ay + dy * ax >= 0 && -dx * by + dy * bx < 0 && Math.abs(den) > 0.000001) {
            console.log('CANDIDATO_COLOCACION_SALIDA_APROX', JSON.stringify({ edge: i,
              t: (ay * (bx - ax) - ax * (by - ay)) / den, neighbor: engineerSector.neighbors[i] }));
            break;
          }
        }
      }
      const overlapping = sectoresEnRadio(source.x, source.y);
      console.log('CANDIDATO_SECTORES_RADIO_10_APROX', JSON.stringify(overlapping));
      const antennaFraction = 100 / Math.hypot(source.x - antenna.x, source.y - antenna.y);
      const antennaTarget = { x: antenna.x + antennaFraction * (source.x - antenna.x),
        y: antenna.y + antennaFraction * (source.y - antenna.y) };
      const antennaTargetSector = map.at(antennaTarget.x, antennaTarget.y);
      console.log('ANTENA_RAYO_CANDIDATO_APROX', JSON.stringify({ fraction: antennaFraction, target: antennaTarget,
        sector: antennaTargetSector ? sec.sectors.indexOf(antennaTargetSector) : -1 }));
      const bombSector = map.at(source.x, source.y);
      if (bombSector) {
        const dx = antennaTarget.x - source.x;
        const dy = antennaTarget.y - source.y;
        for (let i = 0; i < bombSector.verts.length; i++) {
          const a = sec.verts[bombSector.verts[i] ?? -1];
          const b = sec.verts[bombSector.verts[(i + 1) % bombSector.verts.length] ?? -1];
          if (!a || !b) continue;
          const ax = a.x - source.x;
          const ay = a.y - source.y;
          const bx = b.x - source.x;
          const by = b.y - source.y;
          const den = dy * (bx - ax) - dx * (by - ay);
          if (-dx * ay + dy * ax >= 0 && -dx * by + dy * bx < 0 && Math.abs(den) > 0.000001) {
            console.log('ANTENA_CANDIDATO_SALIDA_SECTOR_APROX', JSON.stringify({ edge: i,
              t: (ay * (bx - ax) - ax * (by - ay)) / den, neighbor: bombSector.neighbors[i] }));
            break;
          }
        }
      }
      console.log('CASA04_DISTANCIA_MAX_VERTICE_CANDIDATO', Math.max(...points.map((point) => Math.hypot(point.x - source.x, point.y - source.y))));
      let candidateT = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length];
        const b = points[i];
        if (!a || !b) continue;
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const dx = source.x - centerX;
        const dy = source.y - centerY;
        let den = dx * ey - dy * ex;
        let edgeNumerator = dx * (centerY - a.y) - dy * (centerX - a.x);
        let rayNumerator = ex * (centerY - a.y) - (centerX - a.x) * ey;
        if (den < 0) { den = -den; edgeNumerator = -edgeNumerator; rayNumerator = -rayNumerator; }
        if (edgeNumerator > 0 && rayNumerator > 0 && edgeNumerator < den && rayNumerator < den) {
          candidateT = Math.max(candidateT, rayNumerator / den);
        }
      }
      const candidateTarget = { x: centerX + candidateT * (source.x - centerX), y: centerY + candidateT * (source.y - centerY) };
      const candidateSector = map.at(candidateTarget.x, candidateTarget.y);
      console.log('CASA04_RAYO_CANDIDATO_APROX', JSON.stringify({ source, t: candidateT, target: candidateTarget,
        sector: candidateSector ? sec.sectors.indexOf(candidateSector) : -1 }));
      const sourceSector = map.at(source.x, source.y);
      if (sourceSector) {
        const dx = candidateTarget.x - source.x;
        const dy = candidateTarget.y - source.y;
        for (let i = 0; i < sourceSector.verts.length; i++) {
          const a = sec.verts[sourceSector.verts[i] ?? -1];
          const b = sec.verts[sourceSector.verts[(i + 1) % sourceSector.verts.length] ?? -1];
          if (!a || !b) continue;
          const ax = a.x - source.x;
          const ay = a.y - source.y;
          const bx = b.x - source.x;
          const by = b.y - source.y;
          const den = dy * (bx - ax) - dx * (by - ay);
          if (-dx * ay + dy * ax >= 0 && -dx * by + dy * bx < 0 && Math.abs(den) > 0.000001) {
            console.log('CASA04_CANDIDATO_SALIDA_SECTOR_APROX', JSON.stringify({ edge: i,
              t: (ay * (bx - ax) - ax * (by - ay)) / den, neighbor: sourceSector.neighbors[i] }));
            break;
          }
        }
      }
      if (antennaSector && targetSector === antennaSector) {
        const sx = target.x - antenna.x;
        const sy = target.y - antenna.y;
        const vertices = antennaSector.verts.map((index) => sec.verts[index]).filter((point) => point !== undefined);
        let crossing: number | null = null;
        for (let i = 0; i < vertices.length; i++) {
          const a = vertices[i];
          const b = vertices[(i + 1) % vertices.length];
          if (!a || !b) continue;
          const ax = a.x - antenna.x;
          const ay = a.y - antenna.y;
          const bx = b.x - antenna.x;
          const by = b.y - antenna.y;
          const before = -sx * ay + sy * ax;
          const after = -sx * by + sy * bx;
          const den = sy * (bx - ax) - sx * (by - ay);
          if (before >= 0 && after < 0 && Math.abs(den) > 0.000001) {
            crossing = (ay * (bx - ax) - ax * (by - ay)) / den;
            break;
          }
        }
        console.log('CASA04_RAYO_SALIDA_SECTOR_APROX', crossing);
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
