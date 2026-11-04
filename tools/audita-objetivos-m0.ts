// Cruza los datos de objetivos de la misión real con los sitios que detecta el port.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseVol } from '../src/formats/vol.ts';
import { parseSec } from '../src/formats/sec.ts';
import { asText, find } from '../src/formats/clave.ts';
import { parseSites } from '../src/engine/demolition.ts';
import { SectorMap } from '../src/engine/sectors.ts';
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
    if (antenna) {
      let inside = false;
      const points = casa.points.map((point) => ({ x: point.x + (casa.header[0] ?? 0), y: point.y + (casa.header[1] ?? 0) }));
      console.log('CASA04_VERTICES_DISTANCIA_ANTENA', JSON.stringify(points.map((point) => Math.hypot(point.x - antenna.x, point.y - antenna.y))));
      console.log('CASA04_LONGITUDES_ARISTAS', JSON.stringify(points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        return next ? Math.hypot(point.x - next.x, point.y - next.y) : 0;
      })));
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
