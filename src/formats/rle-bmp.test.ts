import { expect, it } from 'vitest';
import { parseRleBitmap } from './rle-bmp.ts';

function bmp(): Uint8Array {
  const b = new Uint8Array(1100);
  const v = new DataView(b.buffer);
  v.setUint16(0, 0x4d42, true); v.setUint32(10, 1094, true); v.setUint32(14, 40, true);
  v.setUint32(18, 2, true); v.setUint32(22, 1, true); v.setUint16(28, 8, true); v.setUint32(30, 4, true);
  b[58] = 255; b[60] = 255;
  v.setUint32(1082, 2, true); v.setUint32(1086, 1, true); v.setUint32(1090, 0, true);
  b.set([2, 1, 1, 0xff, 0, 0], 1094);
  return b.subarray(0, 1097);
}

it('lee el BMP RLE del juego y valida su cabecera y dimensiones', () => {
  const b = bmp();
  const w = parseRleBitmap('A', b);
  expect(Array.from(w.sprites[0]?.index ?? [])).toEqual([1, 1]);
  expect(Array.from(w.palettes[0]?.slice(2, 4) ?? [])).toEqual([31, 248]);
  expect(() => parseRleBitmap('A', b.subarray(0, 20))).toThrow();
  const bad = b.slice(); bad[0] = 0;
  expect(() => parseRleBitmap('A', bad)).toThrow();
  const size = b.slice(); new DataView(size.buffer).setUint32(18, 3, true);
  expect(() => parseRleBitmap('A', size)).toThrow();
});
