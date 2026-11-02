import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { Attack, canFire, groundTarget, type AttackWorld } from './attack.ts';
import { SectorMap } from './sectors.ts';
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
  it('pistola: fuera de alcance no camina ni dispara; cada clic válido produce un tiro', () => {
    const s = new Soldier('S', mk(500, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    const a = new Attack(mk(0), s, 'PISTOLA');
    run(a, world(log));
    expect(a.done).toBe(true);
    expect(s.dead).toBe(false);
    expect(log).toEqual({ noise: 0, shots: 0 });
    expect(a.unit.body.x).toBe(0);
    s.unit.body.x = 250;
    run(new Attack(a.unit, s, 'PISTOLA'), world(log));
    expect(log).toEqual({ noise: 1, shots: 1 });
    run(new Attack(a.unit, s, 'PISTOLA'), world(log));
    run(new Attack(a.unit, s, 'PISTOLA'), world(log));
    expect(s.dead).toBe(true);
    expect(log).toEqual({ noise: 3, shots: 3 });
    expect(a.unit.body.x).toBe(0);
    expect(a.unit.anim.name).toBe('DISPARAPISTOLA');
  });

  it('el alcance a un soldado incluye altura de ambos ojos, pero el punto usa distancia horizontal', () => {
    const u = mk(0);
    const s = new Soldier('S', mk(190, 0, 'S'), null);
    s.unit.z = 100;
    expect(canFire(u, s, 'ARPON', null)).toBe(false);
    expect(canFire(u, groundTarget(190, 0, 100), 'ARPON', null)).toBe(true);
    s.unit.z = 50;
    expect(canFire(u, s, 'ARPON', null)).toBe(true);
    expect(canFire(u, groundTarget(201, 0, 0), 'ARPON', null)).toBe(false);
  });

  it('dispara sin caminar dentro de la tolerancia del alcance a un soldado', () => {
    const u = mk(0);
    const s = new Soldier('S', mk(200.05, 0, 'S'), null);
    const log = { noise: 0, shots: 0 };
    run(new Attack(u, s, 'ARPON'), world(log));
    expect(log.shots).toBe(1);
    expect(u.body.x).toBe(0);
    expect(canFire(mk(0), new Soldier('T', mk(200.11), null), 'ARPON', null)).toBe(false);
  });

  it('la trayectoria 3D no atraviesa el borde alto del muelle', () => {
    const verts: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100], [200, 0], [200, 100]];
    const sec = parseSec(secBytes({ verts, a: [{ verts: [0, 1, 2, 3], plane: [0, 0, 65] }, { verts: [1, 4, 5, 2], type: 1 }], tw1: [[-1, 1, -1, -1], [-1, -1, -1, 0]] }));
    const m = new SectorMap(sec);
    const u = new Unit('LANCHERO', anm, 120, 50, 0, 180, m);
    const s = new Soldier('S', new Unit('S', anm, 80, 50, 65, 0, m), null);
    expect(canFire(u, s, 'ARPON', m)).toBe(false);
    u.body.x = 170;
    expect(canFire(u, s, 'ARPON', m)).toBe(true);
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

  it('mirilla a un punto sin nadie: dispara un solo tiro sin ruido y sin moverse; fuera de alcance se rechaza sin disparar ni caminar', () => {
    const log = { noise: 0, shots: 0 };
    const near = new Attack(mk(0), groundTarget(900, 0), 'MIRILLA');
    run(near, world(log));
    expect([near.done, log, near.unit.body.x]).toEqual([true, { noise: 0, shots: 1 }, 0]);
    const far = new Attack(mk(0), groundTarget(1500, 0), 'MIRILLA');
    run(far, world(log));
    expect([far.done, log.shots, far.unit.body.x]).toEqual([true, 1, 0]);
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
    expect(log.shots).toBe(1);
    run(new Attack(u, s, 'MIRILLA'), world(log));
    run(new Attack(u, s, 'MIRILLA'), world(log));
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
});
