import { describe, expect, it } from 'vitest';
import { parseWad } from '../formats/wad.ts';
import { must, palette, rleParts, wadBytes } from '../testing/builders.ts';
import { spriteRgba } from './sprites.ts';

describe('color de los sprites', () => {
  it('conserva los colores de píxeles FE, las sombras negras y la transparencia', () => {
    const r = rleParts(4, [[0xfe, 2, 1, 0, 1, 2, 0xff, 1]]);
    const wad = parseWad(wadBytes([palette([0, 0xf800, 0x07e0])], [{ name: 'EFECTO.RLE', comp: 4, h: 1, w: 4, b1: r.b1, b2: r.b2, palette: 0 }]));
    expect(Array.from(spriteRgba(must(wad.sprites[0]), wad.palettes[0]))).toEqual([
      255, 0, 0, 128,
      0, 0, 0, 128,
      0, 255, 0, 255,
      0, 0, 0, 0,
    ]);
    expect(Array.from(spriteRgba(must(wad.sprites[0]), wad.palettes[0], true))).toEqual([
      255, 0, 0, 255,
      0, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 0, 0,
    ]);
  });
});
