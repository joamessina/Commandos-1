import { describe, expect, it } from 'vitest';
import { anmSeq, bnm, must, type BnmRec } from '../testing/builders.ts';
import { AnmError, parseAnm } from './anm.ts';

const ok = (recs: BnmRec[], count = 1): Uint8Array => bnm([{ type: 0, slots: [count] }, ...recs]);
const e = (recs: BnmRec[]): Uint8Array => bnm(recs);
const seq1 = (pasos: number): BnmRec => ({ type: 1, slots: [{ s: 'X' }, pasos, 0, 0] });
const spr: BnmRec = { type: 5, slots: [{ s: 'A' }, 0, 0, 0] };

describe('parseAnm', () => {
  it('lee secuencias, pasos, fotogramas con espejo y períodos a/b', () => {
    const a = parseAnm(ok(anmSeq(1, 'ANDAR', 3, 35, 0, 8)));
    const s = must(a.sequences.get('ANDAR'));
    expect([s.cyclic, s.a, s.b, s.steps.length, must(s.steps[0]).length]).toEqual([true, 35, 0, 3, 8]);
    expect(must(must(s.steps[1])[3])).toMatchObject({ sprite: 'ANDAR13.RLE', hx: -13, hy: -30, mirror: true });
    expect(must(must(s.steps[1])[2]).mirror).toBe(false);
  });

  it('distingue cíclica, no cíclica y encadenada con sus enlaces', () => {
    const a = parseAnm(ok([...anmSeq(2, 'MUERTE', 2, 0, 20, 1), ...anmSeq(3, 'FIN', 1, 0, 4, 1, ['ANDAR', 'OTRA'])], 2));
    expect(must(a.sequences.get('MUERTE')).cyclic).toBe(false);
    expect(must(a.sequences.get('FIN'))).toMatchObject({ link1: 'ANDAR', link2: 'OTRA', cyclic: false });
  });

  it('acepta SIZESPRITE, hotspots, anclajes y pasos de 0 fotogramas', () => {
    const recs: BnmRec[] = [
      { type: 1, slots: [{ s: 'X' }, 2, 1, 1] },
      { type: 7, slots: [2] },
      { type: 4, slots: [1] },
      { type: 6, slots: [{ s: 'A.RLE' }, -1, -2, 16, 39, 1] },
      { type: 8, slots: [3, 4, 5] },
      { type: 4, slots: [0] },
      { type: 9, slots: [] },
      { type: 10, slots: [1, 2] },
      { type: 11, slots: [1, 2] },
    ];
    const s = must(parseAnm(ok(recs)).sequences.get('X'));
    expect(must(must(s.steps[0])[0])).toMatchObject({ sprite: 'A.RLE', mirror: true, hotspots: [{ x: 3, y: 4, k: 5 }] });
    expect(s.steps[1]).toEqual([]);
    expect(s.anchored).toBe(true);
  });

  it('cuenta las secuencias aunque se repita un nombre (la primera gana)', () => {
    const a = parseAnm(ok([...anmSeq(1, 'NEW', 1, 0, 1, 1), ...anmSeq(1, 'NEW', 1, 0, 9, 1)], 2));
    expect(must(a.sequences.get('NEW')).b).toBe(1);
  });

  it('rechaza archivos sin magia, truncados o con bytes sobrantes', () => {
    expect(() => parseAnm(new Uint8Array(4))).toThrow(AnmError);
    expect(() => parseAnm(bnm([{ type: 0, slots: [1] }], { noEnd: true }))).toThrow(/se corta/);
    expect(() => parseAnm(bnm([], { tail: [0] }))).toThrow(/sobrantes/);
    const cut = new Uint8Array([0x42, 0x4e, 0x4d, 0x20, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0, 0, 0, 0xff]);
    expect(() => parseAnm(cut)).toThrow(/pasa del fin/);
  });

  it('rechaza punteros inválidos y cadenas sin terminar', () => {
    const rec = bnm([{ type: 1, slots: [{ s: 'AB' }, 0, 0, 0] }]);
    const bad = new Uint8Array(rec);
    new DataView(bad.buffer).setInt32(4 + 8, 99, true); // ranura 0 -> offset 99
    expect(() => parseAnm(bad)).toThrow(/fuera de rango/);
    const noNul = new Uint8Array(rec);
    noNul[4 + 8 + 16 + 2] = 0x41; // pisa el NUL final de la cadena
    expect(() => parseAnm(noNul)).toThrow(/sin terminar/);
  });

  it('rechaza tipos y estructuras incoherentes', () => {
    expect(() => parseAnm(e([{ type: 99, slots: [] }]))).toThrow(/desconocido/);
    expect(() => parseAnm(e([{ type: 4, slots: [1] }]))).toThrow(/fuera de una secuencia/);
    expect(() => parseAnm(e([spr]))).toThrow(/fuera de una secuencia/);
    expect(() => parseAnm(e([{ type: 7, slots: [1] }]))).toThrow(/fuera de una secuencia/);
    expect(() => parseAnm(e([{ type: 9, slots: [] }]))).toThrow(/fuera de una secuencia/);
    expect(() => parseAnm(e([seq1(1), spr]))).toThrow(/fuera de un paso/);
    expect(() => parseAnm(e([seq1(2), { type: 4, slots: [2] }, { type: 4, slots: [1] }]))).toThrow(/incompleto/);
    expect(() => parseAnm(e([seq1(1), { type: 4, slots: [2] }, spr]))).toThrow(/incompleto/);
    expect(() => parseAnm(e([seq1(1), { type: 4, slots: [999] }]))).toThrow(/absurdo/);
    expect(() => parseAnm(e([seq1(5)]))).toThrow(/pasos/);
    expect(() => parseAnm(e([{ type: 8, slots: [1, 2, 3] }]))).toThrow(/sin fotograma/);
    expect(() => parseAnm(e([seq1(0), { type: 7, slots: [6] }]))).toThrow(/NHOTSPOTS/);
  });

  it('rechaza conteos y tipos de ranura incorrectos', () => {
    expect(() => parseAnm(ok(anmSeq(1, 'A', 1, 0, 0, 1), 2))).toThrow(/se declararon 2/);
    expect(() => parseAnm(e([{ type: 1, slots: [1, 1, 0, 0] }]))).toThrow(/debía ser texto/);
    expect(() => parseAnm(e([{ type: 1, slots: [{ s: 'X' }, { s: 'Y' }, 0, 0] }]))).toThrow(/debía ser un número/);
    const hs: BnmRec[] = [seq1(1), { type: 4, slots: [1] }, spr, ...Array.from({ length: 6 }, (): BnmRec => ({ type: 8, slots: [0, 0, 0] }))];
    expect(() => parseAnm(e(hs))).toThrow(/más de 5/);
  });
});
