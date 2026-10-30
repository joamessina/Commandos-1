import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Battle } from './battle.ts';
import { Order, Soldier } from './soldier.ts';
import { Unit } from './unit.ts';

const anm = parseAnm(bnm([{ type: 0, slots: [5] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(1, 'APUNTAR', 1, 0, 0, 8), ...anmSeq(2, 'DISPARAR', 1, 0, 5, 8), ...anmSeq(2, 'MUERTE1', 2, 0, 20, 8)]));
const mk = (x: number, y: number, ang = 0, token = 'X'): Unit => new Unit(token, anm, x, y, 0, ang);

describe('Battle', () => {
  it('un tiro de pistola del comando mata al soldado y alerta a otro que está a <200 u (investiga); rastro unos ciclos', () => {
    const target = new Soldier('A', mk(250, 0, 180, 'A'), null);
    const other = new Soldier('B', mk(60, 100, 90, 'B'), null); // a ~110 u del tirador y de espaldas a él
    const far = new Soldier('C', mk(250, 900, 90, 'C'), null);
    const c = mk(0, 0);
    const b = new Battle([target, other, far], [c], null, () => 0);
    b.attack(c, target, 'PISTOLA');
    expect(b.attacking(c)).toBe(true);
    for (let i = 0; i < 30; i++) {
      b.tick();
      c.tick();
    }
    expect(target.dead).toBe(true);
    expect(b.attacking(c)).toBe(false);
    expect(other.order).not.toBe(Order.Patrol); // lo oyó
    expect(far.order).toBe(Order.Patrol);
    for (let i = 0; i < 5; i++) b.tick();
    expect(b.tracers).toHaveLength(0);
  });

  it('los soldados disparan al comando, el rastro es enemigo, otro soldado cercano lo oye; cancel() corta el ataque; perder = todos muertos', () => {
    const c = mk(300, 0, 180, 'FRANCOT');
    c.energy = 100;
    const a = new Soldier('A', mk(0, 0), null);
    const o = new Soldier('O', mk(0, 120, 0, 'O'), null);
    const b = new Battle([a], [c], null, () => 0);
    expect(b.lost).toBe(false);
    b.attack(c, a, 'MIRILLA');
    b.cancel(c);
    expect(b.attacking(c)).toBe(false);
    let sawTracer = false;
    for (let i = 0; i < 400 && !b.lost; i++) {
      b.tick();
      sawTracer ||= b.tracers.some((t) => t.enemy);
    }
    expect(sawTracer).toBe(true);
    expect(c.dead).toBe(true);
    expect(b.lost).toBe(true);
    expect(new Battle([], [], null).lost).toBe(false);
    const c2 = mk(10, 10);
    const bb = new Battle([a, o], [c2], null, () => 0);
    for (let i = 0; i < 3; i++) bb.tick();
  });

  it('un comando invulnerable (truco Alt+I) no pierde energía ni muere', () => {
    const u = mk(0, 0);
    u.invulnerable = true;
    expect(u.hit(1e9)).toBe(false);
    expect([u.energy, u.dead]).toEqual([100, false]);
    u.invulnerable = false;
    expect(u.hit(1e9)).toBe(true);
    expect(u.dead).toBe(true);
  });
});
