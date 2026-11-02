/** Contrasta los guiones y capas ZOM con el DIR del jugador, sin extraer recursos. */
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseIntro } from '../src/formats/intro.ts';
import { parseZom } from '../src/formats/zom.ts';
import { parseFont } from '../src/formats/font.ts';

const path = process.argv[2];
if (!path) throw new Error('Uso: node --experimental-transform-types tools/verify-intro.ts ruta/WAR_MP.DIR');
const dir = new Uint8Array(readFileSync(path));
const entries = new Map(parseContainer(dir).map((e) => [e.path.toUpperCase(), e]));
const fontEntry = entries.get('DATOS/FONTS/COMANDO.FNT');
if (!fontEntry || !entries.has('DATOS/RECURSOS/BMPS/SYSTEM/MISC/MBRIEFMA.BMP')) throw new Error('Faltan recursos de ficha de misión');
const font = parseFont(entryBytes(dir, fontEntry));
console.log(`COMANDO.FNT: ${font.glyphs.size.toString()} glifos, altura ${font.height.toString()}`);
for (let i = 0; i < 8; i++) {
  const zentry = entries.get(`DATOS/BRIEF_MP/M${i.toString()}.ZOM`);
  const sentry = entries.get(`DATOS/MISIONES/BRIE${i.toString().padStart(4, '0')}.SCR`);
  if (!zentry || !sentry) throw new Error(`Faltan recursos del briefing ${i.toString()}`);
  const z = parseZom(entryBytes(dir, zentry));
  const commands = parseIntro(new TextDecoder('windows-1252').decode(entryBytes(dir, sentry)));
  if (!commands.length || !z.layers.length) throw new Error(`Briefing vacío: ${i.toString()}`);
  console.log(`${i.toString()}: ${commands.length.toString()} instrucciones, ${z.layers.length.toString()} capas ${z.layers.map((l) => `${l.width.toString()}×${l.height.toString()} @ ${l.scaleX.toString()}`).join(', ')}`);
}
