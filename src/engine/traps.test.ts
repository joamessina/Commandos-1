import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Soldier } from './soldier.ts';
import { DECOY_INTERVAL, DECOY_RADIUS, Traps } from './traps.ts';
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

  it('el señuelo encendido hace ruido de radio 300 cada 30 ciclos; apagado calla', () => {
    const t = new Traps();
    const d = t.placeDecoy(50, 70);
    const log: [number, number, number][] = [];
    for (let i = 0; i < DECOY_INTERVAL * 2 + 1; i++) t.tick([], (x, y, r) => log.push([x, y, r]));
    expect(log).toHaveLength(3);
    expect(log[0]).toEqual([50, 70, DECOY_RADIUS]);
    d.on = false;
    for (let i = 0; i < 100; i++) t.tick([], (x, y, r) => log.push([x, y, r]));
    expect(log).toHaveLength(3);
  });
});
