import { describe, expect, it } from 'vitest';
import { must, palette, rleParts, str, u32, wadBytes, type SpriteSpec } from '../testing/builders.ts';
import { BLEND, bankName, OPAQUE, parseWad, rgb565, TRANSPARENT, WadError } from './wad.ts';

// 3x2: fila 0 = [transp, opaco 5, mezcla 7], fila 1 = 3 opacos (1,2,3)
const ROWS = [[0xff, 1, 1, 5, 0xfe, 1, 7], [3, 1, 2, 3]];
const rle = rleParts(3, ROWS);
const RLE: SpriteSpec = { name: '-Foo.rle', comp: 4, h: 2, w: 3, b1: rle.b1, b2: rle.b2, palette: 0 };
const PAL = palette([0, 0xf800, 0x07e0, 0x001f]);

describe('parseWad', () => {
  it('decodifica un sprite RLE: índices y modos por píxel', () => {
    const w = parseWad(wadBytes([PAL], [RLE]));
    const s = must(w.sprites[0]);
    expect([s.width, s.height, s.rle, s.palette]).toEqual([3, 2, true, 0]);
    expect(Array.from(s.mode)).toEqual([TRANSPARENT, OPAQUE, BLEND, OPAQUE, OPAQUE, OPAQUE]);
    expect(s.index[1]).toBe(5);
    expect(s.index[2]).toBe(7);
    expect(Array.from(s.index.subarray(3))).toEqual([1, 2, 3]);
    expect(w.palettes).toHaveLength(1);
  });

  it('indexa por nombre normalizado y el primero gana', () => {
    const dup: SpriteSpec = { ...RLE, name: 'FOO.RLE' }; // -Foo.rle se registra como FOO.RLE
    const w = parseWad(wadBytes([PAL], [RLE, dup]));
    expect(w.byName.get('FOO.RLE')).toBe(w.sprites[0]);
    expect(bankName('-abc.rle')).toBe('ABC.RLE');
    expect(bankName('--abc.rle')).toBe('-ABC.RLE'); // solo UN guion, como el cargador del exe
  });

  it('decodifica un sprite crudo (alto×(ancho+2)+1 bytes)', () => {
    const raw: SpriteSpec = { name: 'RAW.BMP', comp: 0, h: 2, w: 2, b1: [10, 11, 0, 0, 12, 13, 0, 0, 0], palette: 0 };
    const s = must(parseWad(wadBytes([PAL], [raw])).sprites[0]);
    expect([s.width, s.height, s.rle]).toEqual([2, 2, false]);
    expect(Array.from(s.index)).toEqual([10, 11, 12, 13]);
    expect(Array.from(s.mode)).toEqual([OPAQUE, OPAQUE, OPAQUE, OPAQUE]);
  });

  it('acepta un buffer 3 y lo salta', () => {
    expect(parseWad(wadBytes([PAL], [{ ...RLE, s3: [1, 2, 3] }])).sprites).toHaveLength(1);
  });

  it('rechaza archivos cortos o con paletas absurdas', () => {
    expect(() => parseWad(new Uint8Array(100))).toThrow(WadError);
    const huge = new Uint8Array(420);
    huge.set(u32(9999), 400);
    expect(() => parseWad(huge)).toThrow(/paletas/);
  });

  it('rechaza demasiados sprites', () => {
    const b = [...new Array<number>(400).fill(0), ...u32(0), ...u32(200_000)];
    expect(() => parseWad(new Uint8Array(b))).toThrow(/demasiados/);
  });

  it('rechaza cabecera, buffer 1, buffer 2, cola y paleta fuera de rango', () => {
    const ok = Array.from(wadBytes([PAL], [RLE]));
    const base = 400 + 4 + 525 + 4;
    expect(() => parseWad(new Uint8Array([...ok.slice(0, base + 10)]))).toThrow(/cabecera/);
    const bad1 = ok.slice(); bad1.splice(base + 32, 4, ...u32(100_000));
    expect(() => parseWad(new Uint8Array(bad1))).toThrow(/buffer 1/);
    expect(() => parseWad(new Uint8Array(ok.slice(0, base + 64 + rle.b1.length + 2)))).toThrow(/buffer 2/);
    const bad2 = ok.slice(); bad2.splice(base + 64 + rle.b1.length, 4, ...u32(100_000));
    expect(() => parseWad(new Uint8Array(bad2))).toThrow(/buffer 2/);
    expect(() => parseWad(new Uint8Array(ok.slice(0, ok.length - 2)))).toThrow(/cola/);
    expect(() => parseWad(wadBytes([PAL], [{ ...RLE, palette: 5 }]))).toThrow(/paleta 5/);
  });

  it('rechaza bytes sobrantes', () => {
    expect(() => parseWad(new Uint8Array([...wadBytes([PAL], [RLE]), 0]))).toThrow(/sobrantes/);
  });

  it('rechaza RLE mal formados', () => {
    const w = (b1: number[], b2: number[]): Uint8Array => wadBytes([PAL], [{ ...RLE, b1, b2 }]);
    expect(() => parseWad(w(rle.b1, [1, 2]))).toThrow(/índice RLE corto/);
    expect(() => parseWad(w(rle.b1, [...str('t', 4), ...u32(0, 2, 0, 0)]))).toThrow(/absurdas/);
    expect(() => parseWad(w(rle.b1, [...str('t', 4), ...u32(3, 2, 0)]))).toThrow(/tamaño inesperado/);
    expect(() => parseWad(w(rle.b1, [...str('t', 4), ...u32(3, 2, 99, 0)]))).toThrow(/fuera de rango/);
    const wide = rleParts(3, [[4, 1, 2, 3, 4], [3, 1, 2, 3]]);
    expect(() => parseWad(w(wide.b1, wide.b2))).toThrow(/excede el ancho/);
    const short = rleParts(3, [[2, 1, 2], [3, 1, 2, 3]]);
    expect(() => parseWad(w(short.b1, short.b2))).toThrow(/no cierra/);
  });

  it('rechaza sprites crudos con tamaño o dimensiones inválidas', () => {
    const raw = (h: number, w: number, b1: number[]): Uint8Array => wadBytes([PAL], [{ name: 'R.BMP', comp: 0, h, w, b1, palette: 0 }]);
    expect(() => parseWad(raw(0, 2, [0]))).toThrow(/absurdas/);
    expect(() => parseWad(raw(2, 2, [0, 0]))).toThrow(/tamaño crudo/);
  });
});

describe('rgb565', () => {
  it('convierte como el blitter del exe', () => {
    expect(rgb565(0x00, 0xf8)).toEqual([255, 0, 0]);
    expect(rgb565(0xe0, 0x07)).toEqual([0, 255, 0]);
    expect(rgb565(0x1f, 0x00)).toEqual([0, 0, 255]);
  });
});
