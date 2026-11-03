import { expect, it } from 'vitest';
import { filterActive, parseFilterMode } from './filter.ts';

it('el filtro solo actúa si hay modo y la imagen no se achica', () => {
  expect(filterActive('none', 2)).toBe(false);
  expect(filterActive('sharp', 0.68)).toBe(false);
  expect(filterActive('sharp', 1)).toBe(true);
  expect(filterActive('scale2x', 1.35)).toBe(true);
});

it('el modo guardado se lee y lo desconocido vuelve a ninguno', () => {
  expect(parseFilterMode('scale2x')).toBe('scale2x');
  expect(parseFilterMode('sharp')).toBe('sharp');
  expect(parseFilterMode('hq4x')).toBe('none');
  expect(parseFilterMode(null)).toBe('none');
});
