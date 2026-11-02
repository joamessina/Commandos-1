/** Contrasta los recursos usados por el menú con el DIR real, sin extraerlos al repositorio. */
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseWad } from '../src/formats/wad.ts';

const path = process.argv[2];
if (!path) throw new Error('Uso: node --experimental-transform-types tools/verify-menu.ts ruta/WAR_MP.DIR');
const dir = new Uint8Array(readFileSync(path));
const entries = new Map(parseContainer(dir).map((e) => [e.path.toUpperCase(), e]));
const read = (name: string): Uint8Array => {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Falta ${name}`);
  return entryBytes(dir, entry);
};
const strings = new TextDecoder('windows-1252').decode(read('DATOS/MISIONES/GLOBAL.STR'));
for (const key of ['MMEN', 'NGAM', 'SPMP', 'SKIL', 'EASY', 'HARD', 'OPTI', 'VOPT', 'OVI1', 'OVI2', 'OVI3', 'OVI4', 'EXIT']) {
  if (!new RegExp(`^${key}\\s+`, 'm').test(strings)) throw new Error(`Falta clave ${key}`);
}
for (const name of ['COMANDO', 'COMANDP']) {
  const wad = parseWad(read(`DATOS/FONTS/${name}.WAD`));
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    const glyph = /\d/.test(c) ? c.padStart(8, '0') : c;
    if (!wad.byName.has(`${glyph}.RLE`)) throw new Error(`Falta ${glyph} en ${name}`);
  }
  console.log(`${name}: ${wad.sprites.length.toString()} sprites`);
}
for (const n of [640, 800, 1024]) {
  const data = read(`DATOS/RECURSOS/BMPS/SYSTEM/MISC/MENU${n.toString()}.BMP`);
  const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (header.getUint16(0, true) !== 0x4d42 || header.getInt32(18, true) !== n) throw new Error(`BMP inválido: MENU${n.toString()}`);
  console.log(`MENU${n.toString()}: ${header.getInt32(18, true).toString()}×${header.getInt32(22, true).toString()}, ${header.getUint16(28, true).toString()} bits`);
}
console.log('Cadenas y recursos del menú encontrados.');
