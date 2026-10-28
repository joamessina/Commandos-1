import { describe, expect, it } from 'vitest';
import { must, rec, str, u32 } from '../testing/builders.ts';
import { ContainerError, entryBytes, parseContainer } from './container.ts';

const FIN = rec('DIRECTOR.FIN', 0xff, 0xffffffff, 0xffffffff);

/** raíz DATOS -> lista en 44: [A.TXT (3 B), SUB (dir, lista en 176), FIN] ; lista 176: [B.TXT, FIN]. */
function sample(): Uint8Array {
  const table = [
    ...rec('DATOS', 1, 0, 44),
    ...rec('A.TXT', 0, 3, 0), // offset parchado abajo
    ...rec('SUB', 1, 0, 176),
    ...FIN,
    ...rec('B.TXT', 0, 2, 0),
    ...FIN,
  ];
  const dataStart = table.length;
  const buf = new Uint8Array(dataStart + 5);
  buf.set(table);
  new DataView(buf.buffer).setUint32(44 + 40, dataStart, true);
  new DataView(buf.buffer).setUint32(176 + 40, dataStart + 3, true);
  buf.set([1, 2, 3, 9, 8], dataStart);
  return buf;
}

describe('parseContainer', () => {
  it('recorre directorios anidados y devuelve tamaño y offset de cada archivo', () => {
    const buf = sample();
    const es = parseContainer(buf);
    expect(es.map((e) => e.path)).toEqual(['DATOS/A.TXT', 'DATOS/SUB/B.TXT']);
    expect(Array.from(entryBytes(buf, must(es[0])))).toEqual([1, 2, 3]);
    expect(Array.from(entryBytes(buf, must(es[1])))).toEqual([9, 8]);
  });

  it('rechaza un archivo más corto que un registro', () => {
    expect(() => parseContainer(new Uint8Array(10))).toThrow(ContainerError);
  });

  it('rechaza una lista que se apunta a sí misma (ciclo)', () => {
    const t = new Uint8Array([...rec('DATOS', 1, 0, 44), ...rec('X', 1, 0, 44), ...FIN]);
    expect(() => parseContainer(t)).toThrow(/repetida/);
  });

  it('rechaza una lista fuera de la tabla', () => {
    const t = new Uint8Array(rec('DATOS', 1, 0, 9999));
    expect(() => parseContainer(t)).toThrow(/fuera de rango/);
  });

  it('rechaza una tabla truncada (sin DIRECTOR.FIN)', () => {
    const t = new Uint8Array([...rec('DATOS', 1, 0, 44), ...rec('A', 0, 0, 0)]);
    expect(() => parseContainer(t)).toThrow(/fuera de rango/);
  });

  it('rechaza un archivo cuyo rango excede el contenedor', () => {
    const t = new Uint8Array([...rec('DATOS', 1, 0, 44), ...rec('A', 0, 1000, 0), ...FIN]);
    expect(() => parseContainer(t)).toThrow(/A fuera de rango/);
  });

  it('rechaza anidamiento excesivo', () => {
    const recs: number[][] = [rec('DATOS', 1, 0, 44)];
    for (let i = 0; i < 70; i++) recs.push(rec(`D${i.toString()}`, 1, 0, 44 * (2 * i + 3)), FIN);
    expect(() => parseContainer(new Uint8Array(recs.flat()))).toThrow(/anidamiento/);
  });

  it('rechaza demasiados registros', () => {
    const files = Array.from({ length: 100_001 }, () => rec('F', 0, 0, 0)).flat();
    expect(() => parseContainer(new Uint8Array([...rec('DATOS', 1, 0, 44), ...files]))).toThrow(/demasiados/);
  });

  it('lee nombres sin terminador de 32 caracteres', () => {
    const name = 'N'.repeat(32);
    const t = new Uint8Array([...rec('DATOS', 1, 0, 44), ...[...str(name, 32), 0, 0, 0, 0, ...u32(0, 0)], ...FIN]);
    expect(parseContainer(t)[0]?.path).toBe(`DATOS/${name}`);
  });
});
