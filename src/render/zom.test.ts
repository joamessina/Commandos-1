import { expect, it } from 'vitest';
import { zoomPixels } from './zom.ts';
import type { ZoomBitmap } from '../formats/zom.ts';

it('resuelve cada tramo con la paleta y coordenadas de su capa', () => {
  const pal = new Uint8Array(512);
  pal[2] = 0; pal[3] = 0xf8;
  const bitmap: ZoomBitmap = { width: 2, height: 1, layers: [{ width: 2, height: 1, scaleX: 1, scaleY: 1, palette: pal, pixels: new Uint8Array([1, 0]) }], rows: [[{ length: 2, layer: 0, x: 0, y: 0 }]] };
  expect(Array.from(zoomPixels(bitmap, 1, 0.5, 1, 2, 1))).toEqual([255, 0, 0, 255, 0, 0, 0, 255]);
});

it('usa el tramo anterior si la capa de detalle excede el umbral de muestreo', () => {
  const red = new Uint8Array(512); red[3] = 0xf8;
  const blue = new Uint8Array(512); blue[2] = 0x1f;
  const bitmap: ZoomBitmap = {
    width: 4, height: 1,
    layers: [
      { width: 4, height: 1, scaleX: 1, scaleY: 1, palette: red, pixels: new Uint8Array([1, 1, 1, 1]) },
      { width: 4, height: 1, scaleX: 2, scaleY: 1, palette: blue, pixels: new Uint8Array([1, 1, 1, 1]) },
    ],
    rows: [[{ length: 2, layer: 0, x: 0, y: 0 }, { length: 2, layer: 1, x: 0, y: 0 }]],
  };
  const broad = zoomPixels(bitmap, 2, 0.5, 1, 4, 1);
  expect(Array.from(broad.slice(8, 12))).toEqual([255, 0, 0, 255]);
  const close = zoomPixels(bitmap, 2, 0.5, 2, 4, 1);
  expect(Array.from(close.slice(8, 12))).toEqual([0, 0, 255, 255]);
});
