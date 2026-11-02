/** BMP de 8 bits con compresión 4 del juego: FUN_00647BA0 / FUN_00646530. */
import { decodeRle, WadError, type Wad } from './wad.ts';

export function parseRleBitmap(name: string, bytes: Uint8Array): Wad {
  if (bytes.length < 1078) throw new WadError('BMP RLE corto');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const off = dv.getUint32(10, true);
  if (dv.getUint16(0, true) !== 0x4d42 || dv.getUint32(14, true) !== 40 || dv.getUint16(28, true) !== 8 || dv.getUint32(30, true) !== 4 || off < 1078 || off > bytes.length) throw new WadError('BMP RLE inválido');
  const pal = new Uint8Array(512);
  for (let i = 0; i < 256; i++) {
    const p = 54 + i * 4;
    const rgb = ((bytes[p + 2] ?? 0) >> 3) << 11 | ((bytes[p + 1] ?? 0) >> 2) << 5 | ((bytes[p] ?? 0) >> 3);
    pal[i * 2] = rgb & 255;
    pal[i * 2 + 1] = rgb >> 8;
  }
  const sprite = decodeRle(name, bytes.subarray(off), bytes.subarray(1078, off), 0);
  if (sprite.width !== dv.getUint32(18, true) || sprite.height !== dv.getUint32(22, true)) throw new WadError('BMP RLE dimensiones incompatibles');
  return { palettes: [pal], sprites: [sprite], byName: new Map([[name, sprite]]) };
}
