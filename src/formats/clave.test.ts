import { describe, expect, it } from 'vitest';
import { must } from '../testing/builders.ts';
import { asList, asNumber, asNumbers, asText, ClaveError, find, findAll, parseClave } from './clave.ts';

const SRC = `# comentario
.MISSION [
  .MUSICA FASES.WAV   # al final de línea
  .ELEMENTOS [ [ .CLASS BICHO .XYZ [ 1 2 3 ] ] [ .Class MACRO .XYZ [ 4 5.5 -6 ] ] ]
  .Musica OTRA.WAV
]`;

describe('parseClave', () => {
  it('arma el árbol de listas y átomos, ignorando comentarios', () => {
    const root = parseClave(SRC);
    expect(root[0]).toBe('.MISSION');
    const m = must(asList(root[1]));
    expect(asText(find(m, '.MUSICA'))).toBe('FASES.WAV');
    expect(asList(find(m, '.ELEMENTOS'))).toHaveLength(2);
  });

  it('busca claves sin distinguir mayúsculas y devuelve todas las apariciones', () => {
    const m = must(asList(must(parseClave(SRC)[1])));
    expect(findAll(m, '.musica').map(asText)).toEqual(['FASES.WAV', 'OTRA.WAV']);
    expect(find(m, '.NO')).toBeUndefined();
  });

  it('convierte números y listas de números', () => {
    const m = must(asList(must(parseClave(SRC)[1])));
    const el = must(asList(must(asList(find(m, '.ELEMENTOS')))[1]));
    expect(asNumbers(find(el, '.XYZ'))).toEqual([4, 5.5, -6]);
    expect(asNumber('7')).toBe(7);
    expect(asNumber('x')).toBeUndefined();
    expect(asNumber(['7'])).toBeUndefined();
    expect(asNumbers('7')).toBeUndefined();
    expect(asNumbers(['1', 'a'])).toBeUndefined();
    expect(asText(['x'])).toBeUndefined();
    expect(asList('x')).toBeUndefined();
  });

  it('corta en 0x1A y trata [ y ] pegados a otro texto como átomos', () => {
    expect(parseClave('.A 1 \x1a .B [')).toEqual(['.A', '1']);
    expect(parseClave('.A [x ]x')).toEqual(['.A', '[x', ']x']);
  });

  it('rechaza corchetes sin balancear y anidamiento excesivo', () => {
    expect(() => parseClave('.A ]')).toThrow(ClaveError);
    expect(() => parseClave('.A [ [ ]')).toThrow(/sin cerrar/);
    expect(() => parseClave('[ '.repeat(70))).toThrow(/anidamiento/);
  });

  it('rechaza entradas con demasiados tokens', () => {
    expect(() => parseClave('a '.repeat(5_000_001))).toThrow(/demasiados/);
  });
});
