import { expect, it } from 'vitest';
import { IntroCamera } from './intro-camera.ts';

it('acelera hasta el destino y detiene la cámara al llegar', () => {
  const c = new IntroCamera(0, 0);
  c.goto(100, 0, 'L');
  c.tick(); expect(c.x).toBe(1.75);
  c.tick(); expect(c.x).toBe(5.25);
  for (let i = 0; i < 30 && c.moving; i++) c.tick();
  expect(c.x).toBe(100); expect(c.moving).toBe(false);
});

it('usa pasos de zoom distintos encima de uno y respeta parada e inválidos', () => {
  const c = new IntroCamera(0, 0);
  c.zoom(1.1, 'N'); c.tick(); expect(c.scale).toBeCloseTo(1.015);
  c.tick(); expect(c.scale).toBeCloseTo(1.045);
  c.stop(); expect(c.zooming).toBe(false);
  c.setZoom(-1); expect(c.scale).toBeCloseTo(1.045);
  c.zoom(0, 'N'); expect(c.zooming).toBe(false);
  c.setPos(7, 8); expect([c.x, c.y]).toEqual([7, 8]);
});
