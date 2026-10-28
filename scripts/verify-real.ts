/**
 * Verificación contra la instalación real (no entra en check:*: requiere el juego). Uso:
 *   GAME_DIR="D:\...\Commandos Beyond the Call of Duty\Legacy" npm run verify:real
 * Comprueba: el contenedor cierra con el tamaño del archivo, TODOS los WAD parsean sin bytes sobrantes y
 * los 9 mapas se componen; imprime el md5 de cada mapa para compararlo con `tools/vol_render.py --hash`.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseAnm } from '../src/formats/anm.ts';
import { loadAllies } from '../src/engine/mission.ts';
import { parseVol } from '../src/formats/vol.ts';
import { parseWad } from '../src/formats/wad.ts';
import { composeMap } from '../src/render/map.ts';

const gameDir = process.env['GAME_DIR'];
if (!gameDir) throw new Error('definí GAME_DIR (carpeta Legacy del juego)');

const dir = new Uint8Array(readFileSync(join(gameDir, 'WAR_MP.DIR')));
const entries = parseContainer(dir);
const tableBytes = Math.min(...entries.map((e) => e.offset));
const total = entries.reduce((a, e) => a + e.size, 0);
const sorted = [...entries].sort((a, b) => a.offset - b.offset);
const gaps = sorted.filter((e, i) => i > 0 && (sorted[i - 1]?.offset ?? 0) + (sorted[i - 1]?.size ?? 0) !== e.offset).length;
console.log(`contenedor: ${entries.length.toString()} archivos; tabla ${tableBytes.toString()} + datos ${total.toString()} = ${(tableBytes + total).toString()} (archivo ${dir.length.toString()}); huecos/solapes ${gaps.toString()}`);
if (tableBytes + total !== dir.length || gaps !== 0) throw new Error('el contenedor no cierra');

let wads = 0;
let sprites = 0;
for (const e of entries.filter((x) => x.path.toUpperCase().endsWith('.WAD'))) {
  sprites += parseWad(entryBytes(dir, e)).sprites.length;
  wads++;
}
const mapDir = join(gameDir, 'DATOS', 'recursos', 'bmps', 'map_mp');
const loose = readdirSync(mapDir).filter((f) => /^fase\d{4}\.wad$/i.test(f));
for (const f of loose) {
  sprites += parseWad(new Uint8Array(readFileSync(join(mapDir, f)))).sprites.length;
  wads++;
}
console.log(`WAD: ${wads.toString()} archivos parseados sin bytes sobrantes, ${sprites.toString()} sprites`);

for (const f of loose.sort()) {
  const n = /\d{4}/.exec(f)?.[0] ?? '';
  const ve = entries.find((e) => e.path.toUpperCase() === `DATOS/MISIONES/MAPA${n}.VOL`);
  if (!ve) continue;
  const vol = parseVol(new TextDecoder('latin1').decode(entryBytes(dir, ve)));
  const wad = parseWad(new Uint8Array(readFileSync(join(mapDir, f))));
  const img = composeMap(vol, wad, { skipWater: true });
  const md5 = createHash('md5').update(img.pixels).digest('hex');
  console.log(`MAPA${n} ${img.width.toString()}x${img.height.toString()} polys=${vol.polys.length.toString()} tiles=${vol.polys.reduce((a, p) => a + p.tiles.length, 0).toString()} sin_sprite=${img.missing.toString()} md5=${md5}`);
}

// ANM: los 166 flujos parsean con pasos y conteos coherentes
let anms = 0;
let seqs = 0;
let frames = 0;
for (const e of entries.filter((x) => x.path.toUpperCase().endsWith('.ANM'))) {
  const a = parseAnm(entryBytes(dir, e));
  anms++;
  seqs += a.sequences.size;
  for (const s of a.sequences.values()) for (const st of s.steps) frames += st.length;
}
console.log(`ANM: ${anms.toString()} archivos, ${seqs.toString()} secuencias, ${frames.toString()} fotogramas`);
if (anms !== 166) throw new Error('se esperaban 166 ANM');

// Misiones: los aliados de cada .MIS (la misión 0 los tiene anidados dentro de otro elemento)
for (const e of entries.filter((x) => /MAPA\d{4}\.MIS$/i.test(x.path)).sort((a, b) => a.path.localeCompare(b.path))) {
  const al = loadAllies(new TextDecoder('latin1').decode(entryBytes(dir, e)));
  console.log(`${e.path.slice(-12)}: ${al.length.toString()} aliados ${al.map((x) => x.token).join(',')}`);
}
