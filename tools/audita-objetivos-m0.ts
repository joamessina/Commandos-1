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
  console.log('DETECTORES_DECLARADOS', JSON.stringify(elems.filter((elem) => asText(find(elem.block, '.DETECTAEXPLOSION')) === '1').map((elem) => elem.token)));
}
