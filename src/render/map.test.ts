import { describe, expect, it } from 'vitest';
import { parseVol } from '../formats/vol.ts';
import { parseWad } from '../formats/wad.ts';
import { palette, rleParts, wadBytes } from '../testing/builders.ts';
import { composeMap } from './map.ts';

// sprite 2x2: [opaco idx1, mezcla idx0] / [opaco idx2, transparente]
const r = rleParts(2, [[1, 1, 0xfe, 1, 0], [1, 2, 0xff, 1]]);
const wad = parseWad(wadBytes([palette([0, 0xf800, 0x07e0])], [{ name: 'S.RLE', comp: 4, h: 2, w: 2, b1: r.b1, b2: r.b2, palette: 0 }]));
const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

const px = (img: Uint8ClampedArray, w: number, x: number, y: number): number[] => Array.from(img.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));
const vol = (tile: string, name = 'A'): ReturnType<typeof parseVol> => parseVol(`MAPDIMXY 4,3\nPOLY "${name}",0,0,0,0,0,1\nTILE ${tile}`);

describe('composeMap', () => {
  it('pinta opaco, mezcla 50 % sobre el fondo y respeta la transparencia', () => {
    const m = composeMap(vol('1,0,2,2,0,0,0,"S.RLE","   "'), wad);
    expect(px(m.pixels, 4, 1, 0)).toEqual(RED);
    expect(px(m.pixels, 4, 2, 0)).toEqual([0, 0, 0, 255]); // 50 % de negro = negro
    expect(px(m.pixels, 4, 1, 1)).toEqual(GREEN);
    expect(px(m.pixels, 4, 2, 1)).toEqual([0, 0, 0, 255]); // transparente
    expect(m.missing).toBe(0);
  });

  it('aplica espejos X e Y', () => {
    const m = composeMap(vol('0,0,2,2,0,0,0,"S.RLE","XY"'), wad);
    expect(px(m.pixels, 4, 1, 1)).toEqual(RED); // (0,0) -> (1,1)
    expect(px(m.pixels, 4, 1, 0)).toEqual(GREEN); // (0,1) -> (1,0)
  });

  it('recorta con sx módulo el ancho y descarta lo que sale del mapa o del sprite', () => {
    const m = composeMap(vol('3,2,2,2,3,-1,0,"S.RLE","   "'), wad); // sx=3 % 2 = 1, sy=-1 se salta, ancho recortado a 1
    expect(px(m.pixels, 4, 3, 2)).toEqual([0, 0, 0, 255]);
    const out = composeMap(vol('-5,-5,2,2,0,0,0,"S.RLE","   "'), wad);
    expect(Array.from(out.pixels).filter((v, i) => i % 4 !== 3 && v !== 0)).toHaveLength(0);
  });

  it('cuenta los sprites ausentes y omite el agua si se pide', () => {
    expect(composeMap(vol('0,0,1,1,0,0,0,"NO.RLE","   "'), wad).missing).toBe(1);
    const sinAgua = composeMap(vol('0,0,2,2,0,0,0,"S.RLE","   "', 'AGUA'), wad, { skipWater: true });
    expect(px(sinAgua.pixels, 4, 0, 0)).toEqual([0, 0, 0, 255]);
    const conAgua = composeMap(vol('0,0,2,2,0,0,0,"S.RLE","   "', 'AGUA'), wad);
    expect(px(conAgua.pixels, 4, 0, 0)).toEqual(RED);
  });

  it('usa el recorte tal cual en sprites crudos', () => {
    const raw = parseWad(wadBytes([palette([0, 0xf800, 0x07e0])], [{ name: 'R.BMP', comp: 0, h: 1, w: 2, b1: [1, 2, 0, 0, 0], palette: 0 }]));
    const m = composeMap(vol('0,0,2,1,0,0,0,"R.BMP","   "'), raw);
    expect(px(m.pixels, 4, 0, 0)).toEqual(RED);
    expect(px(m.pixels, 4, 1, 0)).toEqual(GREEN);
  });
});
