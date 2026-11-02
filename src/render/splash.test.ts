import { describe, expect, it } from 'vitest';
import { waterSplash } from './splash.ts';

describe('salpicadura de agua', () => {
  it('emite hasta cinco partículas por ciclo y se extingue', () => {
    expect(waterSplash(200, 300, -1)).toEqual([]);
    expect(waterSplash(200, 300, 0)).toHaveLength(5);
    expect(waterSplash(200, 300, 1)).toHaveLength(10);
    expect(waterSplash(200, 300, 3)).toHaveLength(16);
    expect(waterSplash(200, 300, 30)).toEqual([]);
  });

  it('mantiene el mismo patrón para el mismo evento y dispersa gotas hacia arriba', () => {
    const drops = waterSplash(200, 300, 5);
    expect(drops).toEqual(waterSplash(200, 300, 5));
    expect(drops.some((d) => d.x < 0)).toBe(true);
    expect(drops.some((d) => d.x > 0)).toBe(true);
    expect(drops.some((d) => d.y < 0)).toBe(true);
  });
});
