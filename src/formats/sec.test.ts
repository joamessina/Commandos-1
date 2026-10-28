import { describe, expect, it } from 'vitest';
import { u32, secBytes, must, type SecSpec } from '../testing/builders.ts';
import { parseSec, SecError, SectorFlag } from './sec.ts';

// dos cuadrados contiguos (0..100 y 100..200) y un piso superpuesto (B) sobre el primero
const core = {
  verts: [[0, 0], [100, 0], [100, 100], [0, 100], [200, 0], [200, 100]],
  a: [
    { verts: [0, 1, 2, 3], plane: [0.5, 0, 10] },
    { verts: [1, 4, 5, 2], flags: SectorFlag.NTrans | 0x100 | 0x20, type: 3 },
  ],
  b: [{ verts: [0, 1, 2, 3], plane: [0, 0, 50], flags: 0x100 }],
  tw1: [[-1, 1, -1, -1], [-1, -1, -1, 0]],
} satisfies SecSpec;
const base: SecSpec = { ...core, tw2: [[0, 0, 2, 2]], /* A0.arista0 <-> B0.arista2 */ tw3: [1] };

describe('parseSec', () => {
  const sec = parseSec(secBytes(base));
  const [a0, a1, b0] = [must(sec.sectors[0]), must(sec.sectors[1]), must(sec.sectors[2])];

  it('lee vértices, listas A/B, bbox y tipo', () => {
    expect(sec.verts).toHaveLength(6);
    expect(sec.nA).toBe(2);
    expect(sec.sectors).toHaveLength(3);
    expect([a0.minX, a0.maxX, a0.minY, a0.maxY]).toEqual([0, 100, 0, 100]);
    expect(a0.c).toBe(10);
    expect(a1.type).toBe(3);
    expect(b0.overlay).toBe(true);
  });

  it('aplica la máscara del cargador: NVista solo en NTrans, Inclin si el plano no es horizontal, Superp en B', () => {
    expect(a1.flags & 0x100).toBe(0x100); // NTrans conserva NVista
    expect(a1.flags & 0x20).toBe(0); // Corriente no se conserva
    expect(a1.rawFlags & 0x20).toBe(0x20);
    expect(a0.flags & SectorFlag.Inclin).toBe(SectorFlag.Inclin);
    expect(b0.flags & 0x100).toBe(0); // B no es NTrans: NVista se descarta
    expect(b0.flags & SectorFlag.Superp).toBe(SectorFlag.Superp);
    expect(b0.flags & SectorFlag.Inclin).toBe(0);
  });

  it('enlaza vecinos: TW1 por arista, TW2 con recíproco, TW3 pone Cubierto', () => {
    expect(a0.neighbors).toEqual([2, 1, -1, -1]); // arista 0 pisada por TW2 (-> B0 = índice 2)
    expect(a1.neighbors).toEqual([-1, -1, -1, 0]);
    expect(b0.neighbors).toEqual([-1, -1, 0, -1]); // recíproco
    expect(a1.flags & SectorFlag.Cubierto).toBe(SectorFlag.Cubierto);
    expect(a0.flags & SectorFlag.Cubierto).toBe(0);
  });

  it('acepta un archivo sin TW2 ni TW3', () => {
    const s = parseSec(secBytes(core));
    expect(must(s.sectors[0]).neighbors).toEqual([-1, 1, -1, -1]);
    expect(must(s.sectors[2]).neighbors).toEqual([-1, -1, -1, -1]);
  });

  it('un TW1 con vecino en la lista B se toma como índice de la lista unida', () => {
    const s = parseSec(secBytes({ ...base, tw1: [[2, 1, -1, -1], [-1, -1, -1, 0]] }));
    expect(must(s.sectors[1]).neighbors).toEqual([-1, -1, -1, 0]);
  });
});

describe('parseSec errores', () => {
  const ok = secBytes(base);
  const bad = (b: Uint8Array | number[], msg: RegExp): void => {
    expect(() => parseSec(b instanceof Uint8Array ? b : new Uint8Array(b))).toThrow(msg);
    expect(() => parseSec(b instanceof Uint8Array ? b : new Uint8Array(b))).toThrow(SecError);
  };

  it('sin magia, truncado o con sobrantes', () => {
    bad(new Uint8Array(8), /magia/);
    bad(ok.subarray(0, ok.length - 2), /se corta/);
    bad(new Uint8Array([...secBytes({ ...core, tw2: [] }), 0]), /sobran 1/);
  });

  it('conteos y nombres falsos no reservan memoria', () => {
    bad(new Uint8Array([...ok.subarray(0, 4), ...u32(0x7fffffff)]), /se corta/);
    const nameLen = secBytes({ verts: [[0, 0]], a: [{ verts: [0], name: 'x' }] });
    const forged = nameLen.slice();
    forged[4 + 4 + 8 + 4 + 4 + 12 + 4 + 8 + 4 + 4 - 4] = 0xff; // namelen del sector -> enorme
    forged[4 + 4 + 8 + 4 + 4 + 12 + 4 + 8 + 4 + 4 - 3] = 0xff;
    bad(forged, /demasiado largo|se corta/);
  });

  it('vértice, vecino o enlace fuera de rango', () => {
    bad(secBytes({ ...base, a: [{ verts: [0, 1, 9] }] }), /vértice/);
    bad(secBytes({ ...base, tw1: [[99, -1, -1, -1], [-1, -1, -1, -1]] }), /TW1 fuera/);
    bad(secBytes({ ...base, tw2: [[0, 0, 0, 0]] }), /TW2/); // sB tiene que ser >= nA
    bad(secBytes({ ...base, tw2: [[0, 7, 2, 0]] }), /TW2/);
    bad(secBytes({ ...base, tw3: [2] }), /TW3/); // solo sectores de A
  });

  it('falta TW1', () => {
    bad(secBytes(base, [...Array.from('NOPE', (c) => c.charCodeAt(0))]), /falta TW1/);
  });
});
