import { describe, expect, it } from 'vitest';
import { ARROW, cursorFor } from './cursors.ts';

describe('cursorFor', () => {
  it('sin arma es la flecha; con arma muestra el sprite del arma, y el puño cambia sobre un blanco', () => {
    expect(cursorFor(null, false, false)).toEqual(ARROW);
    expect(cursorFor('PISTOLA', false, false)).toEqual({ sprite: 'C_PIPA.RLE', hot: 'center' });
    expect(cursorFor('CUCHILLO', false, true).sprite).toBe('C_FACA.RLE');
    expect(cursorFor('PUNO', false, false).sprite).toBe('C_PGOLPE.RLE');
    expect(cursorFor('PUNO', false, true).sprite).toBe('C_GOLPE.RLE');
    expect(cursorFor('ESPOSAS', false, false).sprite).toBe('C_ESPOS.RLE');
    expect(cursorFor('PIEDRA', false, false).sprite).toBe('C_PIEDRA.RLE');
    expect(cursorFor('MIRILLA', false, false).sprite).toBe('C_MIRILL.RLE');
  });

  it('plantar una bomba usa el cursor del explosivo, aunque haya un arma elegida', () => {
    expect(cursorFor('PISTOLA', true, false).sprite).toBe('C_PETA.RLE');
  });
});
