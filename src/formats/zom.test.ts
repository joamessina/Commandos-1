import { describe, expect, it } from 'vitest';
import { parseZom } from './zom.ts';

function fixture(): Uint8Array {
  const data = new Uint8Array(12 + 16 + 512 + 4 + 40);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, 2, true); dv.setUint32(4, 2, true); dv.setUint32(8, 1, true);
  dv.setUint32(12, 2, true); dv.setUint32(16, 2, true); dv.setFloat32(20, 1, true); dv.setFloat32(24, 2, true);
  data.set([1, 2, 3, 4], 540);
  dv.setUint32(544, 1, true); dv.setUint32(548, 2, true);
  dv.setUint32(564, 1, true); dv.setUint32(568, 2, true); dv.setInt32(580, 65536, true);
  return data;
}

describe('ZOM', () => {
  it('lee dimensiones, escalas, paleta y filas de índices', () => {
    const z = parseZom(fixture());
    expect([z.width, z.height]).toEqual([2, 2]);
    expect(z.layers[0]).toMatchObject({ width: 2, height: 2, scaleX: 1, scaleY: 2 });
    expect(Array.from(z.layers[0]?.pixels ?? [])).toEqual([1, 2, 3, 4]);
    expect(z.layers[0]?.palette.length).toBe(512);
    expect(z.rows[1]?.[0]).toEqual({ length: 2, layer: 0, x: 0, y: 65536 });
  });
  it('rechaza truncamiento y dimensiones o escalas inválidas', () => {
    expect(() => parseZom(new Uint8Array(2))).toThrow('truncado');
    expect(() => parseZom(fixture().subarray(0, 543))).toThrow('truncado');
    const bad = fixture();
    new DataView(bad.buffer).setUint32(8, 0, true);
    expect(() => parseZom(bad)).toThrow('Cabecera');
    const badScale = fixture();
    new DataView(badScale.buffer).setFloat32(20, Number.NaN, true);
    expect(() => parseZom(badScale)).toThrow('Capa');
    const badRow = fixture();
    new DataView(badRow.buffer).setUint32(544, 3, true);
    expect(() => parseZom(badRow)).toThrow('Fila');
    const badSpan = fixture();
    new DataView(badSpan.buffer).setUint32(552, 2, true);
    expect(() => parseZom(badSpan)).toThrow('Tramo');
    const shortRow = fixture();
    new DataView(shortRow.buffer).setUint32(548, 1, true);
    expect(() => parseZom(shortRow)).toThrow('incompleta');
    const extra = new Uint8Array(fixture().length + 1);
    extra.set(fixture());
    expect(() => parseZom(extra)).toThrow('sobrantes');
  });
});
