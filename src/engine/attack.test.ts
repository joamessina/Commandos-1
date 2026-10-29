import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Attack, type AttackWorld } from './attack.ts';
import { Soldier } from './soldier.ts';
import { Unit } from './unit.ts';

const anm = parseAnm(bnm([{ type: 0, slots: [4] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(2, 'APUNTAPISTOLA', 1, 0, 5, 8), ...anmSeq(2, 'DISPARAPISTOLA', 1, 0, 5, 8)]));
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
  it('pistola: se acerca hasta el alcance, apunta, dispara (con ruido) y mata al soldado', () => {
    const s = new Soldier('S', mk(500, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const a = new Attack(mk(0), s, 'PISTOLA');
    run(a, world(log));
    expect(a.done).toBe(true);
    expect(s.dead).toBe(true);
    expect(log).toEqual({ noise: 1, shots: 1 });
    expect(a.unit.body.x).toBeGreaterThan(150); // tuvo que acercarse
    expect(a.unit.anim.name).toBe('DISPARAPISTOLA');
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
