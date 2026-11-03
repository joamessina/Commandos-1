import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { Lift, parseLadders, parseLift, pickLadder, stepClimb, newClimb, reverse, wallXY, type Ladder } from './ladder.ts';
import { Unit } from './unit.ts';
import { SectorMap } from './sectors.ts';
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
    expect(pickLadder(ls, 0, -20)).toBeNull();
    expect(pickLadder(ls, 500, 500 * 0.6428 - 0.766 * 0 - 20)?.token).toBe('E2');
    expect(pickLadder(ls, 900, 900)).toBeNull();
  });
  it('calcula la caja automática con la arista y altura de los sectores', () => {
    const vertices: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100], [100, 200], [0, 200]];
    const sec = parseSec(secBytes({ verts: vertices, a: [{ verts: [0, 1, 2, 3], plane: [0, 0, 65] }, { verts: [3, 2, 4, 5] }], tw1: [[-1, -1, 1, -1], [0, -1, -1, -1]] }));
    const mis = `.MISSION [ .ELEMENTOS [ [ .CLASS MACRO .MACRO ESC .TOKEN E .PUNTOBAJO [ 50 120 0 ] .PUNTOALTO [ 50 80 65 ] ] ] ]`;
    const items = flatten(loadWorld(mis, { difficulty: 'FACIL', macro: () => MAC }));
    const ladders = parseLadders(items, new SectorMap(sec));
    expect(ladders[0]?.box).toEqual([40, 9, 20, 65]);
    expect(pickLadder(ladders, 50, 30)?.token).toBe('E');
    expect(pickLadder(ladders, 70, 30)).toBeNull();
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

describe('Unit: la escalera en la ruta de un soldado', () => {
  // piso de arriba (y < 100, z 65) y de abajo (y > 100, z 0) unidos por una pared de 65: a pie no hay paso, la escalera va de (50,120,0) a (50,80,65)
  const verts: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100], [100, 200], [0, 200]];
  const sectors = new SectorMap(parseSec(secBytes({ verts, a: [{ verts: [0, 1, 2, 3], plane: [0, 0, 65] }, { verts: [3, 2, 4, 5] }], tw1: [[-1, -1, 1, -1], [0, -1, -1, -1]] })));
  const rung: Ladder = { token: 'L', low: { x: 50, y: 120, z: 0 }, high: { x: 50, y: 80, z: 65 }, box: null, diver: false, disabled: false };
  const anm = parseAnm(bnm([{ type: 0, slots: [2] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8)]));
  const soldier = (y: number, z: number, ladders: readonly Ladder[]): Unit => {
    const u = new Unit('S', anm, 50, y, z, 0, sectors);
    u.ladders = ladders;
    return u;
  };
  const up = { x: 50, y: 20, z: 65 };
  const down = { x: 50, y: 180, z: 0 };

  /** Camina hasta que la orden termina; devuelve las direcciones de trepada vistas y comprueba que la orden seguía viva mientras trepaba. */
  const walk = (u: Unit): number[] => {
    const dirs: number[] = [];
    for (let i = 0; i < 1000 && u.target !== null; i++) {
      u.tick();
      if (u.climb) {
        expect(u.target).not.toBeNull();
        if (dirs[dirs.length - 1] !== u.climb.dir) dirs.push(u.climb.dir);
      }
    }
    return dirs;
  };

  it('sin camino a pie sube: va al pie, trepa con la orden viva y sigue hasta el destino de arriba', () => {
    const u = soldier(180, 0, [rung]);
    expect(u.goTo(up, false)).toBe(true);
    expect(walk(u)).toEqual([1]);
    expect(u.target).toBeNull();
    expect(u.z).toBe(65);
    expect(Math.hypot(u.body.x - up.x, u.body.y - up.y)).toBeLessThan(3);
  });

  it('desde arriba baja por la misma escalera', () => {
    const u = soldier(40, 65, [rung]);
    expect(u.goTo(down, false)).toBe(true);
    expect(walk(u)).toEqual([-1]);
    expect(u.z).toBe(0);
    expect(Math.hypot(u.body.x - down.x, u.body.y - down.y)).toBeLessThan(3);
  });

  it('sin escaleras, con la escalera desactivada o sin desnivel no hay camino', () => {
    expect(soldier(180, 0, []).goTo(up, false)).toBe(false);
    expect(soldier(180, 0, [{ ...rung, disabled: true }]).goTo(up, false)).toBe(false);
    expect(soldier(180, 0, [{ ...rung, high: { ...rung.high, z: 0 } }]).goTo(up, false)).toBe(false);
  });

  it('al pie de la escalera trepa de inmediato; stop() cancela el plan antes de trepar', () => {
    const foot = soldier(120, 0, [rung]);
    expect(foot.goTo(up, false)).toBe(true);
    expect(foot.climb?.dir).toBe(1);
    const far = soldier(180, 0, [rung]);
    far.goTo(up, false);
    far.stop();
    for (let i = 0; i < 300; i++) far.tick();
    expect(far.climb).toBeNull();
    expect(far.target).toBeNull();
  });

  it('con otro destino alcanzable a pie no la usa', () => {
    const u = soldier(180, 0, [rung]);
    expect(u.goTo({ x: 20, y: 150, z: 0 }, false)).toBe(true);
    expect(walk(u)).toEqual([]);
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
