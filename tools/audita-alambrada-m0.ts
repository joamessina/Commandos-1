// Revisa las referencias nominales a alambradas sin extraer los archivos originales.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseVol } from '../src/formats/vol.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
const vol = entradas.find((e) => e.path.replaceAll('\\', '/').toUpperCase().endsWith('/MAPA0000.VOL'));
if (!vol) throw new Error('No se encontró MAPA0000.VOL');
const mapa = parseVol(new TextDecoder('windows-1252').decode(entryBytes(datos, vol)));
const coincidencias = mapa.polys.flatMap((p) => p.tiles.filter((t) => /ALAM|VALLA/i.test(t.sprite))
  .map((t) => ({ volumen: p.name, sprite: t.sprite })));
console.log('VOLUMENES', mapa.polys.length, 'TILES CON NOMBRE ALAM/VALLA', coincidencias.length);
for (const coincidencia of coincidencias) console.log(JSON.stringify(coincidencia));
