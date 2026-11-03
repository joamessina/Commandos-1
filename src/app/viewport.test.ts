import { expect, it } from 'vitest';
import { canvasPoint, fitScale } from './viewport.ts';

it('traduce clics en el canvas escalado a la resolución elegida', () => {
  const rect = { left: 80, top: 20, width: 640, height: 360 };
  expect(canvasPoint(400, 200, rect, [1280, 720])).toEqual({ x: 640, y: 360 });
  expect(canvasPoint(720, 380, rect, [1280, 720])).toEqual({ x: 1280, y: 720 });
});

it('agranda de a números enteros y solo achica si no entra', () => {
  expect(fitScale(1920, 1000, 640, 480)).toBe(2);
  expect(fitScale(1900, 1080, 960, 540)).toBe(1);
  expect(fitScale(3840, 2160, 1280, 720)).toBe(3);
  expect(fitScale(1280, 720, 1280, 720)).toBe(1);
  expect(fitScale(960, 540, 1280, 720)).toBe(0.75);
  expect(fitScale(1920, 970, 1280, 720, false)).toBeCloseTo(1.347, 3); // con filtro llena la caja aunque no sea entero
});
