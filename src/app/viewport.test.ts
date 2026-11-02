import { expect, it } from 'vitest';
import { canvasPoint } from './viewport.ts';

it('traduce clics en el canvas escalado a la resolución elegida', () => {
  const rect = { left: 80, top: 20, width: 640, height: 360 };
  expect(canvasPoint(400, 200, rect, [1280, 720])).toEqual({ x: 640, y: 360 });
  expect(canvasPoint(720, 380, rect, [1280, 720])).toEqual({ x: 1280, y: 720 });
});
