import { expect, it } from 'vitest';
import { parseFont } from './font.ts';

it('lee glifos con métricas y detecta el centinela', () => {
  const bytes = new Uint8Array(2 + 24 + 2 + 4);
  const d = new DataView(bytes.buffer);
  d.setUint16(0, 16, true); d.setInt32(2, 2, true); d.setInt32(6, 1, true);
  d.setInt32(10, -1, true); d.setInt32(14, 1, true); d.setInt32(18, 2, true); d.setUint8(22, 65);
  bytes.set([15, 128], 26); d.setInt32(28, 0x12345678, true);
  const font = parseFont(bytes);
  expect(font.height).toBe(16);
  expect(font.glyphs.get(65)).toMatchObject({ width: 2, height: 1, left: -1, right: 1, top: 2, pixels: new Uint8Array([15, 128]) });
  expect(() => parseFont(bytes.subarray(0, 27))).toThrow();
  const invalid = bytes.slice(); new DataView(invalid.buffer).setInt32(2, 9000, true);
  expect(() => parseFont(invalid)).toThrow('inválido');
});
