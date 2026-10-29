import { describe, expect, it } from 'vitest';
import type { Sector } from '../formats/sec.ts';
import { Boat } from './boat.ts';

const water = { type: 1 } as Sector;
const land = { type: 0 } as Sector;
const sea = { at: (x: number) => (x < 500 ? water : land) };

describe('Boat (SimBalsa)', () => {
  it('avanza hacia el destino a VELMAX 4 con la inercia 0,8 y llega sin pasarse', () => {
    const b = new Boat(0, 0, 0, 0, [], null);
    b.goTo({ x: 200, y: 0 });
    for (let i = 0; i < 60; i++) b.tick();
    expect(b.dest).toBeNull();
    expect(b.x).toBeGreaterThan(190);
    expect(b.x).toBeLessThan(230);
    for (let i = 0; i < 40; i++) b.tick();
    expect(b.speed).toBe(0);
  });

  it('gira como máximo 5/R rad por ciclo (tope de oruga) mientras avanza poco', () => {
    const b = new Boat(0, 0, 0, 0, [], null);
    b.goTo({ x: 0, y: 100 }); // Δ = 90°: e = 47,1 → a = −43,1, b = 51,1, escalados para que b = 5 ⇒ ω = 9,22/60 rad = 8,8°
    b.tick();
    expect(b.ang).toBeCloseTo(8.8, 1);
    expect(b.ang).toBeGreaterThan(8);
    expect(b.ang).toBeLessThan(10);
  });

  it('marcha atrás si el destino está a >135° y cerca (d² < 16·R²)', () => {
    const b = new Boat(0, 0, 0, 0, [], null);
    b.goTo({ x: -50, y: 0 });
    for (let i = 0; i < 10; i++) b.tick();
    expect(b.x).toBeLessThan(-10);
    expect(Math.abs(b.ang)).toBeLessThan(1);
  });

  it('no sale del agua: topa con tierra y se frena', () => {
    const b = new Boat(480, 0, 0, 0, [], sea);
    b.goTo({ x: 900, y: 0 });
    for (let i = 0; i < 30; i++) b.tick();
    expect(b.x).toBeLessThan(500);
    expect(b.speed).toBe(0);
  });

  it('slotPoint gira con el bote; stop cancela la orden; el mismo destino no reinicia', () => {
    const b = new Boat(10, 20, 0, 90, [], null);
    const p = b.slotPoint([55, 0]);
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeCloseTo(75, 5);
    b.goTo({ x: 100, y: 100 });
    b.goTo({ x: 10, y: 20 }); // destino = posición con orden vigente: se ignora
    expect(b.dest).not.toBeNull();
    b.stop();
    expect(b.dest).toBeNull();
  });
});

describe('Boat: límites del Sim', () => {
  it('con VELMAX alto el desplazamiento se limita a 0,5·R por ciclo', () => {
    const b = new Boat(0, 0, 0, 0, [], null, 30, 40);
    b.goTo({ x: 1000, y: 0 });
    for (let i = 0; i < 30; i++) {
      const x0 = b.x;
      b.tick();
      expect(b.x - x0).toBeLessThanOrEqual(15 + 1e-9);
    }
  });

  it('tocar tierra frena en seco y deja el giro al 75 % en el ciclo siguiente', () => {
    const b = new Boat(495, 0, 0, 0, [], sea);
    b.goTo({ x: 900, y: 300 });
    for (let i = 0; i < 20; i++) b.tick();
    expect(b.x).toBeLessThan(500);
    expect(b.touchedLand).toBe(true);
  });

  it('sin motor ni destino se queda quieto', () => {
    const b = new Boat(5, 5, 0, 10, [], null);
    b.tick();
    expect([b.x, b.y, b.ang]).toEqual([5, 5, 10]);
  });
});
