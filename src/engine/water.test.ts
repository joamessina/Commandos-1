import { describe, expect, it } from 'vitest';
import { parseWater, warp, WaterFx, WATER_SIZE, WATER_STRIDE, type WaterDef } from './water.ts';

/** Origen sintético; los valores esperados salen de emular FUN_006491E0 del exe con ese mismo origen (tools/emu_agua*.py). */
const src = Uint8Array.from({ length: 65536 }, (_, p) => (p * 131 + (p >> 8) * 7 + 5) & 255);
const checksum = (b: Uint8Array): number => {
  let s = 0;
  for (let i = 0; i < WATER_STRIDE * WATER_SIZE; i++) s = (s + (i + 1) * (b[i] ?? 0)) % 4294967296;
  return s;
};
const run = (kind: 1 | 2, ph: number, ox: number, oy: number): Uint8Array => {
  const dst = new Uint8Array(WATER_STRIDE * WATER_SIZE + 1);
  warp(src, dst, kind, ph, ox, oy);
  return dst;
};

describe('warp (generador del agua)', () => {
  it.each([
    [2, 3.4, 5.5, -9.7, 3456154940, [23, 30, 30, 154, 43, 145, 148]],
    [2, 200.7, 123.4, 321.9, 3342525684, [133, 140, 140, 8, 222, 225, 9]],
    [2, 0, 0, 0, 3333613870, [5, 12, 12, 136, 162, 2, 130]],
    [1, 100.2, 3.9, -2.5, 3192544348, [192, 199, 199, 60, 237, 84, 68]],
    [1, 300, -7, 11, 3188562892, [59, 66, 66, 190, 7, 65, 184]],
    [1, 0, 0, 0, 3242926400, [5, 12, 12, 136, 141, 2, 137]],
  ] as const)('tipo %i fase %f desp (%f,%f) = salida del exe', (kind, ph, ox, oy, sum, samples) => {
    const dst = run(kind, ph, ox, oy);
    expect(checksum(dst)).toBe(sum);
    expect([0, 1, 257, 258, 5000, 33333, 66047].map((i) => dst[i])).toEqual(samples);
  });

  it('la cola de cada fila copia los 2 primeros píxeles', () => {
    const dst = run(2, 7, 1, 2);
    for (let r = 0; r < WATER_SIZE; r++) expect([dst[r * 258 + 256], dst[r * 258 + 257]]).toEqual([dst[r * 258], dst[r * 258 + 1]]);
  });
});

const M0 = `.MISSION [ .WATER [ .BMP MAR01.BMP .BMPSRC MAR0SRC.BMP .BMPDST MAR0DST.BMP .TYPE 2 .SININC 1.5
  .CENTERX 800 .CENTERY 800 .LENGTH 0.5 .SPEED 0.04 ] ]`;

describe('parseWater', () => {
  it('lee el bloque de la misión 0 (BMPDST, no BMP ni BMPSRC)', () => {
    expect(parseWater(M0)).toEqual({ dst: 'MAR0DST.BMP', type: 2, sininc: 1.5, velinc: 0, anginc: 0, centerX: 800, centerY: 800, length: 0.5, speed: 0.04 });
  });
  it('sin .TYPE el tipo es null; el bloque vacío no es agua; fuera de .MISSION también se encuentra', () => {
    expect(parseWater('.WATER [ .BMPDST A.BMP .VELINC 0.5 .ANGINC 60 .SININC 0.5 ]')).toMatchObject({ dst: 'A.BMP', type: null, velinc: 0.5, sininc: 0.5 });
    expect(parseWater('.MISSION [ .WATER [ ] ]')).toBeNull();
    expect(parseWater('.MISSION [ ]')).toBeNull();
  });
});

describe('WaterFx', () => {
  const idx = src;
  const def = (over: Partial<WaterDef>): WaterDef => ({ dst: 'X.BMP', type: 2, sininc: 1.5, velinc: 0, anginc: 0, centerX: 800, centerY: 800, length: 0.5, speed: 0.04, ...over });
  const expected = (fx: WaterFx, kind: 1 | 2, ph: number, ox: number, oy: number): Uint8Array => {
    const out = new Uint8Array(fx.dst.length);
    warp(fx.src, out, kind, ph, ox, oy);
    return out;
  };

  it('tipo 2: desp += f·(cámara − centro), f = L·cos + L/2; la fase usa SININC desde el primer ciclo', () => {
    const fx = new WaterFx(def({}), idx);
    fx.step({ x: 900, y: 700 }); // cos 0 = 1 → f = 0.75
    expect(fx.dst).toEqual(expected(fx, 2, 1.5, 75, -75));
    fx.step({ x: 900, y: 700 }); // cos 0.04
    const f = Math.fround(Math.fround(Math.fround(Math.cos(Math.fround(0.04))) * 0.5) + 0.25);
    const o = Math.fround(75 + Math.fround(100 * f));
    expect(fx.dst).toEqual(expected(fx, 2, 3, o, Math.fround(-75 - Math.fround(100 * f))));
  });

  it('tipo 2 sin visor no mueve el desplazamiento; sin TYPE usa el generador 1 con desplazamiento 0', () => {
    const a = new WaterFx(def({}), idx);
    a.step(null);
    expect(a.dst).toEqual(expected(a, 2, 1.5, 0, 0));
    const b = new WaterFx(def({ type: null, velinc: 0.5, anginc: 60, sininc: 1 }), idx);
    b.step({ x: 5, y: 5 });
    expect(b.dst).toEqual(expected(b, 1, 1, 0, 0));
  });

  it('tipo 1: desp += (cos, sin)(ANGINC)·VELINC', () => {
    const fx = new WaterFx(def({ type: 1, velinc: 3, anginc: 0, sininc: 1 }), idx);
    fx.step(null);
    fx.step(null);
    expect(fx.dst).toEqual(expected(fx, 1, 2, 6, 0));
  });

  it('copyTo deja el destino sin cola en el índice del sprite', () => {
    const fx = new WaterFx(def({}), idx);
    fx.step(null);
    const out = new Uint8Array(65536);
    fx.copyTo(out);
    expect(out[0]).toBe(fx.dst[0]);
    expect(out[256 * 3 + 7]).toBe(fx.dst[258 * 3 + 7]);
  });
});
