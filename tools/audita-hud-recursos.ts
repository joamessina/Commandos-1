// Contrasta bancos HUD del DIR raíz; imprime metadatos, nunca assets.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseWad } from '../src/formats/wad.ts';

const bytes = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
let bancos = 0;
let sprites = 0;
let paletas = 0;
let cursores: Set<string> | undefined;
for (const entrada of parseContainer(bytes)) {
  if (!/\/SYSTEM\/(GLOBAL|CARAS|OPCIONES)\/.*\.WAD$/i.test(entrada.path)) continue;
  const datos = entryBytes(bytes, entrada);
  const wad = parseWad(datos);
  if (/GLOBAL\/CURSORES\.WAD$/i.test(entrada.path)) cursores = new Set(wad.sprites.map((s) => s.name.toUpperCase()));
  const nombres = wad.palettes.map((paleta, i) => {
    const nombre = new TextDecoder('windows-1252').decode(datos.subarray(404 + i * 525 + 512, 404 + (i + 1) * 525)).split('\0')[0];
    return `${nombre}:${createHash('sha256').update(paleta).digest('hex').slice(0, 12)}`;
  });
  console.log(entrada.path, 'sprites', wad.sprites.length, 'paletas', nombres.join(','));
  if (/GLOBAL\/\d+X\d+\.WAD$/i.test(entrada.path)) {
    console.log(wad.sprites.map((s) => `${s.name}=${s.width}x${s.height}`).join(' '));
  }
  bancos++;
  sprites += wad.sprites.length;
  paletas += wad.palettes.length;
}
console.log(JSON.stringify({ bancos, sprites, paletas }));
if (!cursores) throw new Error('Falta CURSORES.WAD');
const listado = execFileSync('py', ['tools/audita-hud.py'], { encoding: 'utf8' });
const referencias = [...listado.matchAll(/'([^']+\.(?:BMP|RLE) ?)'/g)].map((m) => m[1] ?? '');
const ausentes = [...new Set(referencias.filter((nombre) => !cursores?.has(nombre.toUpperCase())))];
console.log('REFERENCIAS_CURSOR', referencias.length, 'NOMBRES_AUSENTES', JSON.stringify(ausentes));
