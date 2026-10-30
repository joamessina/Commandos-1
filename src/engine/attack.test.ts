import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Attack, type AttackWorld } from './attack.ts';
import { Soldier } from './soldier.ts';
import { Unit } from './unit.ts';

const anm = parseAnm(bnm([{ type: 0, slots: [7] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(2, 'APUNTAPISTOLA', 1, 0, 5, 8), ...anmSeq(2, 'DISPARAPISTOLA', 1, 0, 5, 8), ...anmSeq(1, 'ATONTADO', 1, 0, 0, 8), ...anmSeq(1, 'ESPOSAS1', 1, 0, 0, 8), ...anmSeq(1, 'LANZARPIEDRA', 1, 0, 0, 8)]));
const mk = (x: number, y = 0, token = 'X'): Unit => new Unit(token, anm, x, y, 0, 0);

interface Log {
  noise: number;
  shots: number;
}
const world = (log: Log): AttackWorld => ({ sectors: null, noise: () => log.noise++, onShot: () => log.shots++ });
const run = (a: Attack, w: AttackWorld, n = 400): void => {
  for (let i = 0; i < n && !a.done; i++) {
    a.tick(w);
    a.unit.tick();
  }
};

describe('Attack', () => {
  it('pistola (40 de daño): se acerca hasta el alcance y dispara con ruido; el soldado de 100 de energía muere al 3.er tiro', () => {
    const s = new Soldier('S', mk(500, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const a = new Attack(mk(0), s, 'PISTOLA');
    run(a, world(log));
    expect(a.done).toBe(true);
    expect(s.dead).toBe(true);
    expect(log).toEqual({ noise: 3, shots: 3 });
    expect(a.unit.body.x).toBeGreaterThan(150); // tuvo que acercarse
    expect(a.unit.anim.name).toBe('DISPARAPISTOLA');
  });

  it('un soldado herido que sobrevive se vuelve a apuntar al agresor', () => {
    const s = new Soldier('S', mk(500, 0, 'S'), null);
    const shooter = mk(300, 0);
    s.hurt('PISTOLA', shooter);
    expect(s.dead).toBe(false);
    expect(s.unit.energy).toBe(60);
    expect(s.order).toBe(8);
  });

  it('mirilla: alcance 1000 y sin ruido; desde lejos mata sin moverse', () => {
    const s = new Soldier('S', mk(900, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const a = new Attack(mk(0), s, 'MIRILLA');
    run(a, world(log));
    expect(s.dead).toBe(true);
    expect(log).toEqual({ noise: 0, shots: 1 });
    expect(a.unit.body.x).toBe(0);
  });

  it('cuchillo: camina hasta pegarse, tarda unos ciclos y mata en silencio', () => {
    const s = new Soldier('S', mk(100, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const a = new Attack(mk(0), s, 'CUCHILLO');
    run(a, world(log));
    expect(s.dead).toBe(true);
    expect(log).toEqual({ noise: 0, shots: 0 });
    expect(a.unit.body.x).toBeGreaterThan(70);
  });

  it('termina si el atacante o el blanco ya están muertos', () => {
    const s = new Soldier('S', mk(50, 0, 'S'), null);
    s.kill();
    const a = new Attack(mk(0), s, 'PISTOLA');
    a.tick(world({ noise: 0, shots: 0 }));
    expect(a.done).toBe(true);
    const u = mk(0);
    const b = new Attack(u, new Soldier('T', mk(10, 0, 'T'), null), 'PISTOLA');
    u.hit(1e9);
    b.tick(world({ noise: 0, shots: 0 }));
    expect(b.done).toBe(true);
  });
});

describe('Attack: munición', () => {
  it('con munición limitada gasta 1 por disparo y al llegar a 0 la acción termina sin disparar más', () => {
    const s = new Soldier('S', mk(200, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const u = mk(0);
    u.ammo['MIRILLA'] = 2;
    s.unit.energy = 1000; // no muere: hacen falta más de 2 tiros
    const a = new Attack(u, s, 'MIRILLA');
    run(a, world(log), 300);
    expect(log.shots).toBe(2);
    expect(u.ammo['MIRILLA']).toBe(0);
    expect(a.done).toBe(true);
  });

  it('puño: un solo golpe atonta 600 ciclos (altura 5, anim ATONTADO, sin daño) y se levanta; en ese tiempo no ve ni oye', () => {
    const s = new Soldier('S', mk(40, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const a = new Attack(mk(0), s, 'PUNO');
    run(a, world(log));
    expect(a.done).toBe(true);
    expect([s.dead, s.stun > 0, s.unit.energy, s.unit.height, log.shots, log.noise]).toEqual([false, true, 100, 5, 0, 0]);
    s.hear(0, 0);
    expect(s.order).toBe(4);
    const w = { commandos: [], sectors: null, rng: () => 0, onShot: () => undefined };
    for (let i = 0; i < 599; i++) s.tick(w);
    expect(s.stun).toBeGreaterThan(0);
    s.tick(w);
    expect([s.stun, s.down, s.unit.height]).toEqual([0, false, 29]);
  });

  it('esposas: el soldado queda esposado para siempre (altura 5, ESPOSAS1) y un puño posterior no lo levanta', () => {
    const s = new Soldier('S', mk(40, 0, 'S'), null);
    const a = new Attack(mk(0), s, 'ESPOSAS');
    run(a, world({ noise: 0, shots: 0 }));
    expect([a.done, s.cuffed, s.down, s.unit.height]).toEqual([true, true, true, 5]);
    s.hurt('PUNO', mk(0));
    const w = { commandos: [], sectors: null, rng: () => 0, onShot: () => undefined };
    for (let i = 0; i < 700; i++) s.tick(w);
    expect([s.cuffed, s.stun, s.unit.height]).toEqual([true, 0, 5]);
  });

  it('un soldado atontado que recibe un tiro de pistola sigue atontado (no apunta) y puede morir', () => {
    const s = new Soldier('S', mk(40, 0, 'S'), null);
    s.hurt('PUNO', mk(0));
    s.hurt('PISTOLA', mk(0));
    expect([s.dead, s.order, s.unit.energy]).toEqual([false, 4, 60]);
    s.hurt('MIRILLA', mk(0));
    expect(s.dead).toBe(true);
  });

  it('piedra: desde 250 u (alcance 300) atonta al soldado sin dañarlo, gasta una de las 100 y no hace ruido ni rastro', () => {
    const s = new Soldier('S', mk(250, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const c = mk(0);
    c.ammo['PIEDRA'] = 100;
    const a = new Attack(c, s, 'PIEDRA');
    run(a, world(log));
    expect([a.done, s.stun > 0, s.unit.energy, c.ammo['PIEDRA'], log.shots, log.noise]).toEqual([true, true, 100, 99, 0, 0]);
  });
});
