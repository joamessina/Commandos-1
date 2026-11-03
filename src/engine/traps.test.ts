import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Soldier } from './soldier.ts';
import { DECOY_INTERVAL, DECOY_RADIUS, decoyItem, Traps } from './traps.ts';
import { Unit } from './unit.ts';

const anm = parseAnm(bnm([{ type: 0, slots: [2] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8)]));
const soldier = (x: number, y = 0): Soldier => new Soldier('S', new Unit('S', anm, x, y, 0, 0), null);

describe('Traps', () => {
  it('el cepo armado mata al soldado que lo toca (a menos de 20) y queda cerrado; uno lejano no lo activa', () => {
    const t = new Traps();
    const c = t.placeCepo(100, 0);
    const near = soldier(60);
    const touch = soldier(110);
    expect(t.tick([near], () => undefined)).toEqual([]);
    expect([c.armed, near.dead]).toEqual([true, false]);
    expect(t.tick([near, touch], () => undefined)).toEqual([c]);
    expect([c.armed, touch.dead, near.dead]).toEqual([false, true, false]);
    // cerrado: otro soldado encima ya no muere
    const other = soldier(100);
    expect(t.tick([other], () => undefined)).toEqual([]);
    expect(other.dead).toBe(false);
  });

  it('el señuelo nace apagado y calla; encendido hace ruido de radio 300 cada 30 ciclos y apagado vuelve a callar', () => {
    const t = new Traps();
    const d = t.placeDecoy(50, 70);
    const log: [number, number, number][] = [];
    for (let i = 0; i < 100; i++) t.tick([], (x, y, r) => log.push([x, y, r]));
    expect([d.on, log.length]).toEqual([false, 0]);
    expect(t.switchDecoy()).toBe(d);
    for (let i = 0; i < DECOY_INTERVAL * 2 + 1; i++) t.tick([], (x, y, r) => log.push([x, y, r]));
    expect(log).toHaveLength(3);
    expect(log[0]).toEqual([50, 70, DECOY_RADIUS]);
    expect(t.switchDecoy()?.on).toBe(false);
    for (let i = 0; i < 100; i++) t.tick([], (x, y, r) => log.push([x, y, r]));
    expect(log).toHaveLength(3);
  });

  it('el interruptor actúa sobre el último señuelo puesto; sin ninguno no hace nada; recogerlo lo saca del suelo', () => {
    const t = new Traps();
    expect(t.switchDecoy()).toBeNull();
    const d = t.placeDecoy(0, 0);
    t.removeDecoy(d);
    t.removeDecoy(d); // ya no está: no falla
    expect(t.decoys).toHaveLength(0);
    expect(t.switchDecoy()).toBeNull();
  });

  it('ítem de la mochila: el señuelo si queda uno, el interruptor (apagado o encendido) si está en el suelo, y ninguno si no hay', () => {
    const t = new Traps();
    expect(decoyItem(true, null)).toBe('IT_SEGNUELO');
    expect(decoyItem(false, null)).toBeNull();
    const d = t.placeDecoy(0, 0);
    expect(decoyItem(false, d)).toBe('IT_ACTSENUELOOFF');
    t.switchDecoy();
    expect(decoyItem(false, d)).toBe('IT_ACTSENUELOON');
    expect(decoyItem(true, d)).toBe('IT_ACTSENUELOON'); // puesto en el suelo, el interruptor manda
  });
});
