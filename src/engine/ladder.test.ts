import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Lift, parseLadders, parseLift, pickLadder, stepClimb, newClimb, reverse, wallXY, type Ladder } from './ladder.ts';
import { Unit } from './unit.ts';
import { flatten, loadWorld } from './world.ts';

const MAC = `.CLASS BICHO .VARIABLES [ PPUNTOBAJO PPUNTOALTO NCAJASELECCION VESCALAUSABLEPORBUZO ]
.ACCIONES [ [ acEscala [ .PUNTOBAJO $PUNTOBAJO .PUNTOALTO $PUNTOALTO .CAJASELECCION $CAJASELECCION ] ] ]
.ESCALAUSABLEPORBUZO $ESCALAUSABLEPORBUZO`;
const MIS = `.MISSION [ .ELEMENTOS [
  [ .CLASS MACRO .MACRO ESC .TOKEN E1 .PUNTOBAJO [ 0 0 0 ] .PUNTOALTO [ 10 -20 70 ] .CAJASELECCION [ 100 200 20 40 ] .ESCALAUSABLEPORBUZO 1 ]
  [ .CLASS MACRO .MACRO ESC .TOKEN E2 .PUNTOBAJO [ 500 500 0 ] .PUNTOALTO [ 500 500 5 ] ]
  [ .CLASS MACRO .MACRO ESC .TOKEN MAL .PUNTOBAJO [ 1 2 ] ]
  [ .CLASS BICHO .TOKEN LIFT .ACCIONES [ [ AcAscensor [ .RAIL [ [ 0 0 0 ] [ 0 30 40 ] ] ] ] ] ]
  [ .CLASS BICHO .TOKEN SINRAIL .ACCIONES [ [ AcAscensor [ .RAIL [ [ 0 0 0 ] ] ] ] ] ]
] ]`;
const elems = flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: (n) => (n === 'ESC' ? MAC : undefined) }));

describe('parseLadders / pickLadder', () => {
  const ls = parseLadders(elems);
  it('lee puntos, caja y buzo; ignora las incompletas', () => {
    expect(ls.map((l) => l.token)).toEqual(['E1', 'E2']);
    expect(ls[0]).toMatchObject({ box: [100, 200, 20, 40], diver: true, disabled: false });
    expect(ls[1]?.box).toBeNull();
  });
  it('se elige por su caja de selección o cerca de un extremo (proyectado)', () => {
    expect(pickLadder(ls, 110, 220)?.token).toBe('E1');
    expect(pickLadder(ls, 500, 500 * 0.6428 - 0.766 * 0 - 20)?.token).toBe('E2');
    expect(pickLadder(ls, 900, 900)).toBeNull();
  });
});

const L: Ladder = { token: 'L', low: { x: 0, y: 0, z: 0 }, high: { x: 10, y: -20, z: 70 }, box: null, diver: false, disabled: false };

describe('stepClimb', () => {
  it('subir 70 u: +2 por ciclo hasta 25 u antes del tope, remate +4 y salida; ~30 ciclos', () => {
    const c = newClimb(L, 1);
    let z = 0;
    let n = 0;
    let done = false;
    while (!done && n < 200) {
      const r = stepClimb(c, z);
      z = r.z;
      done = r.done;
      n++;
    }
    expect(z).toBe(70);
    expect(n).toBeGreaterThan(25);
    expect(n).toBeLessThan(45);
  });
  it('bajar: −4 hasta 15 u del suelo y remate −3; la pausa congela y reverse() da vuelta', () => {
    const c = newClimb(L, -1);
    let z = 70;
    for (let i = 0; i < 5; i++) z = stepClimb(c, z).z;
    expect(z).toBe(50);
    c.paused = true;
    expect(stepClimb(c, z)).toEqual({ z: 50, done: false });
    reverse(c, 1); // clic más alto: sigue subiendo
    expect(c.paused).toBe(false);
    expect(c.phase).toBe('up');
    expect(stepClimb(c, 50).z).toBe(54); // 50 + 40 > 70 + 15: ya está en el remate (+4)
    reverse(c, 1);
    expect(c.dir).toBe(1);
    let n = 0;
    const d = newClimb(L, -1);
    let zz = 10;
    let done = false;
    while (!done && n++ < 20) {
      const r = stepClimb(d, zz);
      zz = r.z;
      done = r.done;
    }
    expect(zz).toBe(0);
  });
  it('wallXY interpola entre los extremos', () => {
    expect(wallXY(L, 35)).toEqual({ x: 5, y: -10 });
    expect(wallXY({ ...L, high: { ...L.high, z: 0 } }, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe('Lift', () => {
  const lift = parseLift(elems.find((e) => e.token === 'LIFT') as never) as Lift;
  it('parsea el riel; sin riel completo no hay montacargas', () => {
    expect(lift).not.toBeNull();
    expect(parseLift(elems.find((e) => e.token === 'SINRAIL') as never)).toBeNull();
    expect(parseLift(elems.find((e) => e.token === 'E1') as never)).toBeNull();
  });
  it('al activarlo va al extremo más lejano a 8 u/ciclo y vuelve al activarlo otra vez', () => {
    expect(lift.moving).toBe(false);
    lift.activate();
    let n = 0;
    while (lift.moving && n < 100) {
      lift.tick();
      n++;
    }
    expect(lift.pos).toEqual({ x: 0, y: 30, z: 40 });
    expect(n).toBe(Math.ceil(50 / 8)); // largo = √(30²+40²) = 50
    lift.activate();
    while (lift.moving) lift.tick();
    expect(lift.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(lift.tick()).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('Unit.useLadder', () => {
  const anm = parseAnm(bnm([{ type: 0, slots: [5] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(2, 'ESCALAR_EMPIEZA', 1, 0, 4, 8), ...anmSeq(1, 'ESCALAR_CICLICO', 2, 0, 14, 8), ...anmSeq(2, 'ESCALAR_FIN', 2, 0, 16, 8)]));
  it('camina al pie, trepa, llega arriba y queda en el extremo alto; desactivada o muy chata no sirve', () => {
    const u = new Unit('COMANDO', anm, 0, -30, 0, 0);
    expect(u.useLadder({ ...L, disabled: true })).toBe(false);
    expect(u.useLadder({ ...L, high: { x: 0, y: 0, z: 10 } })).toBe(false);
    expect(u.useLadder(L)).toBe(true);
    let n = 0;
    while ((u.climb === null || n < 5) && n < 400) {
      u.tick();
      n++;
      if (u.climb) break;
    }
    expect(u.climb).not.toBeNull();
    expect(u.anim.name).toBe('ESCALAR_EMPIEZA');
    u.pauseClimb();
    const z0 = u.z;
    for (let i = 0; i < 10; i++) u.tick();
    expect(u.z).toBe(z0);
    u.resumeClimb(100);
    for (let i = 0; i < 100 && u.climb; i++) u.tick();
    expect(u.climb).toBeNull();
    expect(u.z).toBe(72);
    expect([u.body.x, u.body.y]).toEqual([10, -20]);
    expect(u.anim.name).toBe('REPOSO');
  });
  it('baja desde arriba y no puede usarla quien va en bote o muerto', () => {
    const u = new Unit('COMANDO', anm, 10, -20, 70, 0);
    expect(u.useLadder(L)).toBe(true);
    for (let i = 0; i < 300 && !u.climb; i++) u.tick();
    expect(u.climb?.dir).toBe(-1);
    for (let i = 0; i < 100 && u.climb; i++) u.tick();
    expect(u.z).toBe(0);
    const d = new Unit('X', anm, 0, 0, 0, 0);
    d.hit(1e9);
    expect(d.useLadder(L)).toBe(false);
  });
});

describe('Unit: sin trepada y montacargas', () => {
  const anm2 = parseAnm(bnm([{ type: 0, slots: [1] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8)]));
  it('pausar o reanudar sin estar trepando no hace nada; sin animaciones de escalar usa la actual; carryBy/settle mueven y reubican', () => {
    const u = new Unit('X', anm2, 0, 0, 0, 0);
    u.pauseClimb();
    u.resumeClimb(10);
    expect(u.climb).toBeNull();
    u.carryBy(1, 2, 3);
    expect([u.body.x, u.body.y, u.z]).toEqual([1, 2, 3]);
    u.settle();
    expect(u.occupied).toBe(false);
    expect(u.useLadder(L)).toBe(true);
    for (let i = 0; i < 400 && !u.climb; i++) u.tick();
    expect(u.anim.name).toBe('ANDAR');
    for (let i = 0; i < 100 && u.climb; i++) u.tick();
    expect(u.climb).toBeNull();
    expect(u.anim.name).toBe('ANDAR');
  });
});
