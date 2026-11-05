import { describe, expect, it } from 'vitest';
import { bombShake } from './shake.ts';

describe('temblor de bomba', () => {
  it('interpola la curva del ejecutable durante diez ciclos', () => {
    expect(Array.from({ length: 11 }, (_, i) => bombShake(i))).toEqual([0, 1.5, 2, 3, 4.25, 2, 0.6666666666666667, 0, 0, 0, 0]);
    expect(bombShake(-1)).toBe(0);
    expect(bombShake(11)).toBe(0);
  });
});
