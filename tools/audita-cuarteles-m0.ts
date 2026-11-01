// Cruza patrullas y cuarteles de la misión real sin extraer recursos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave } from '../src/formats/clave.ts';
import { parseHouses } from '../src/engine/house.ts';
import { flatten, loadWorld } from '../src/engine/world.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
const leer = (nombre: string): string | undefined => {
  const e = entradas.find((x) => x.path.toUpperCase().endsWith('/' + nombre.toUpperCase()));
  return e ? new TextDecoder('windows-1252').decode(entryBytes(datos, e)) : undefined;
};
const mis = leer('MAPA0000.MIS');
if (!mis) throw new Error('No aparece MAPA0000.MIS');
for (const key of ['EVENTO', 'ESPERAEVENTO', 'ENLAZAR', 'VELOCIDADTRAMO']) {
  const matches = [...mis.matchAll(new RegExp(`\\.${key}\\s+([^\\s\\]]+)`, 'gi'))].map((m) => m[1]);
  console.log('CLAVE', key, JSON.stringify(matches));
}
const raiz = asList(find(parseClave(mis), '.MISSION')) ?? [];
for (const p of asList(find(raiz, '.PATRULLAS')) ?? []) console.log('PATRULLA', JSON.stringify(p));
const elems = flatten(loadWorld(mis, { difficulty: 'FACIL', macro: (name) => leer(name + '.MAC') }));
for (const h of parseHouses(elems)) console.log('CASA', h.token, 'REGEN', h.regen, 'ENTRADA', h.entry, 'SALIDA', h.exit);
