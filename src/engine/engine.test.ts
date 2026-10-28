import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm, must } from '../testing/builders.ts';
import { AnimError, Animator, frameIndex } from './anim.ts';
import { loadAllies } from './mission.ts';
import { COS50, project, SIN50, unproject, Unit } from './unit.ts';
import { newBody, norm180, norm360, runSpeed, stepBody, WALK_SPEED } from './walk.ts';

const anm = parseAnm(
  bnm([
    { type: 0, slots: [5] },
    ...anmSeq(1, 'ANDAR', 8, 40, 0, 8), // por distancia: 40 u por ciclo, 5 u por paso
    ...anmSeq(1, 'CORRE', 8, 70, 0, 8),
    ...anmSeq(1, 'TIEMPO', 4, 0, 8, 1), // por ticks: 8 ticks por ciclo, 2 por paso
    ...anmSeq(3, 'FIN', 3, 0, 6, 1, ['', 'ANDAR']), // no cíclica: tras 6 ticks pasa a ANDAR
    ...anmSeq(2, 'MUERTE', 2, 0, 4, 1), // no cíclica sin enlaces: queda en el último paso
  ]),
);

describe('frameIndex', () => {
  it('elige el fotograma por ángulo: trunc(ang·n/360 + 0.5), cada uno cubre 45° con n = 8', () => {
    expect([0, 22, 23, 45, 90, 180, 315, 337, 338, 359].map((a) => frameIndex(a, 8))).toEqual([0, 0, 1, 1, 2, 4, 7, 7, 0, 0]);
    expect(frameIndex(-90, 8)).toBe(6);
    expect(frameIndex(450, 8)).toBe(2);
    expect(frameIndex(123, 1)).toBe(0);
  });
});

describe('Animator', () => {
  it('avanza por distancia (a) y reduce módulo el período en las cíclicas', () => {
    const a = new Animator(anm, 'ANDAR');
    expect(a.step).toBe(0);
    a.advance(4.9, 1);
    expect(a.step).toBe(0);
    a.advance(0.2, 1); // 5.1 u -> paso 1
    expect(a.step).toBe(1);
    a.advance(40, 1); // un ciclo entero más: vuelve al mismo paso
    expect(a.step).toBe(1);
  });

  it('avanza por ticks (b) cuando a = 0 y el eje con período 0 no aporta', () => {
    const a = new Animator(anm, 'TIEMPO');
    a.advance(1000, 1); // la distancia no cuenta
    expect(a.step).toBe(0);
    a.advance(0, 2);
    expect(a.step).toBe(1);
    a.advance(0, 6); // 9 ticks -> módulo 8 = 1
    expect(a.step).toBe(0);
  });

  it('en las no cíclicas queda en el último paso o pasa al enlace2', () => {
    const m = new Animator(anm, 'MUERTE');
    m.advance(0, 3);
    expect(m.step).toBe(1);
    m.advance(0, 5); // pasó el período
    expect(m.step).toBe(1);
    expect(m.name).toBe('MUERTE');
    const f = new Animator(anm, 'FIN');
    f.advance(0, 7);
    expect(f.name).toBe('ANDAR'); // enlace2
    expect(f.step).toBe(0);
  });

  it('una no cíclica con enlace2 inexistente se queda en el último paso', () => {
    const a = parseAnm(bnm([{ type: 0, slots: [1] }, ...anmSeq(3, 'X', 2, 0, 2, 1, ['', 'NOEXISTE'])]));
    const x = new Animator(a, 'X');
    x.advance(0, 5);
    expect(x.name).toBe('X');
    expect(x.step).toBe(1);
  });

  it('cambia de secuencia reiniciando los acumuladores y devuelve el fotograma según el ángulo', () => {
    const a = new Animator(anm, 'ANDAR');
    a.advance(12, 1);
    a.set('CORRE');
    expect([a.name, a.step]).toEqual(['CORRE', 0]);
    a.set('CORRE'); // mismo nombre: no reinicia
    a.advance(9, 1);
    a.set('CORRE');
    expect(a.step).toBe(1);
    expect(a.has('ANDAR')).toBe(true);
    expect(a.has('NO')).toBe(false);
    expect(a.frame(90).sprite).toBe('CORRE12.RLE'); // paso 1, dirección 2
    expect(a.frame(0).mirror).toBe(false);
    expect(a.frame(45).mirror).toBe(true);
  });

  it('rechaza secuencias inexistentes y pasos sin fotogramas', () => {
    expect(() => new Animator(anm, 'NO')).toThrow(AnimError);
    const vacio = parseAnm(bnm([{ type: 0, slots: [1] }, { type: 1, slots: [{ s: 'V' }, 1, 0, 0] }, { type: 4, slots: [0] }]));
    expect(() => new Animator(vacio, 'V').frame(0)).toThrow(/sin fotogramas/);
    const sinPasos = parseAnm(bnm([{ type: 0, slots: [1] }, { type: 1, slots: [{ s: 'P' }, 0, 0, 0] }]));
    expect(new Animator(sinPasos, 'P').step).toBe(0);
  });
});

describe('stepBody: caminata del Sim (docs/research/q1-movimiento.md R1)', () => {
  const run = (v: number, n: number): number[] => {
    const b = newBody(0, 0, 0);
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(stepBody(b, { x: 5000, y: 0 }, v).dx);
    return out;
  };

  it('arranca con la rampa 0.8, 0.96, 0.992… de lo pedido y llega a régimen exacto', () => {
    const r = run(WALK_SPEED, 8).map((x) => Math.round(x * 1e4) / 1e4);
    expect(r).toEqual([2, 2.4, 2.48, 2.496, 2.4992, 2.4998, 2.5, 2.5]);
    expect(run(runSpeed('COMANDO'), 4).map((x) => Math.round(x * 1e3) / 1e3)).toEqual([4.8, 5.76, 5.952, 5.99]);
    expect(run(runSpeed('FRANCOT'), 3).map((x) => Math.round(x * 1e3) / 1e3)).toEqual([4, 4.8, 4.96]);
  });

  it('correr: COMANDO y CONDUC 6.0, el resto 5.0', () => {
    expect([runSpeed('COMANDO'), runSpeed('CONDUC'), runSpeed('ESPIA'), runSpeed('X')]).toEqual([6, 6, 5, 5]);
  });

  it('al soltar queda una deriva de 1.85 unidades (motor sin destino: Mover(0,0,0,0,0))', () => {
    const b = newBody(0, 0, 0);
    for (let i = 0; i < 40; i++) stepBody(b, { x: 5000, y: 0 }, WALK_SPEED);
    const x0 = b.x;
    for (let i = 0; i < 12; i++) stepBody(b, null, WALK_SPEED);
    expect(b.x - x0).toBeCloseTo(1.85, 1);
  });

  it('frena para llegar justo en un número entero de ciclos y declara la llegada', () => {
    const b = newBody(0, 0, 0);
    let arrived = false;
    let ciclos = 0;
    while (!arrived && ciclos < 200) {
      arrived = stepBody(b, { x: 100, y: 0 }, WALK_SPEED).arrived;
      ciclos++;
    }
    expect(arrived).toBe(true);
    expect(ciclos).toBeGreaterThan(38);
    expect(ciclos).toBeLessThan(60);
    expect(Math.abs(b.x - 100)).toBeLessThan(3);
  });

  it('el cuerpo gira como máximo 45° por ciclo hacia el rumbo', () => {
    const b = newBody(0, 0, 0);
    stepBody(b, { x: 0, y: 500 }, WALK_SPEED); // rumbo 90°
    expect(b.ang).toBe(45);
    stepBody(b, { x: 0, y: 500 }, WALK_SPEED);
    expect(b.ang).toBe(90);
    const c = newBody(0, 0, 10);
    stepBody(c, { x: 500, y: 0 }, WALK_SPEED); // casi alineado: giro de 10° completo
    expect(c.ang).toBeCloseTo(0, 5);
  });

  it('no actualiza el ángulo objetivo cerca del destino (d² <= 1.5·R²) y limita el paso al radio', () => {
    const b = newBody(0, 0, 0);
    stepBody(b, { x: 5, y: 5 }, WALK_SPEED);
    expect(b.angTarget).toBe(0);
    const f = newBody(0, 0, 0);
    stepBody(f, { x: 5000, y: 0 }, 50); // pide 50 u/ciclo: el Sim lo recorta a 10
    expect(Math.hypot(f.vx, f.vy)).toBeLessThanOrEqual(10 + 1e-9);
  });

  it('normaliza ángulos', () => {
    expect([norm360(-90), norm360(450), norm180(270), norm180(90), norm180(180)]).toEqual([270, 90, -90, 90, -180]);
  });
});

describe('proyección y unidad', () => {
  it('proyecta mundo -> pantalla con cos 50° / sin 50° y la inversa vuelve al punto', () => {
    const p = project(100, 200, 50);
    expect(p.px).toBe(100);
    expect(p.py).toBeCloseTo(COS50 * 200 - SIN50 * 50, 9);
    const q = unproject(p.px, p.py, 50);
    expect(q.x).toBeCloseTo(100, 9);
    expect(q.y).toBeCloseTo(200, 9);
  });

  it('elige ANDAR o CORRE al recibir la orden, camina hasta el destino y avanza la animación por distancia', () => {
    const u = new Unit('COMANDO', anm, 0, 0, 0, 0);
    expect(u.moving).toBe(false);
    u.goTo({ x: 400, y: 0 }, false);
    expect(u.anim.name).toBe('ANDAR');
    for (let i = 0; i < 20; i++) u.tick();
    expect(u.body.x).toBeGreaterThan(40);
    expect(u.anim.step).toBeGreaterThan(0);
    expect(u.moving).toBe(true);
    u.goTo({ x: 400, y: 0 }, true);
    expect(u.anim.name).toBe('CORRE');
    expect(u.running).toBe(true);
    for (let i = 0; i < 400 && u.target; i++) u.tick();
    expect(u.target).toBeNull();
    for (let i = 0; i < 20; i++) u.tick();
    expect(u.moving).toBe(false);
    expect(Math.abs(u.body.x - 400)).toBeLessThan(6);
  });

  it('si el ANM no tiene CORRE usa CORRER, y si no tiene ninguna sigue con ANDAR', () => {
    const soldado = parseAnm(bnm([{ type: 0, slots: [2] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'CORRER', 2, 50, 0, 8)]));
    const u = new Unit('SOLDADO', soldado, 0, 0, 0, 0);
    u.goTo({ x: 10, y: 0 }, true);
    expect(u.anim.name).toBe('CORRER');
    const solo = parseAnm(bnm([{ type: 0, slots: [1] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8)]));
    const v = new Unit('X', solo, 0, 0, 0, 0);
    v.goTo({ x: 10, y: 0 }, true);
    expect(v.anim.name).toBe('ANDAR');
  });
});

describe('loadAllies', () => {
  const MIS = `.MISSION [
    .ELEMENTOS [
      [ .CLASS BICHO .TOKEN LANCHA .ELEMENTOS [
          [ .CLASS BICHOALIADO .TOKEN COMANDO .XYZ [ 10 20 30 ] .ANGULO 135 ]
          [ .CLASS BICHOALIADO .TOKEN FRANCOT .XYZ [ 1 2 3 ] .GRAPH [ .ANIM FRANCO .RENDERVOL [ CILINDRO [ .R 10 ] ] ] ]
          [ .CLASS BICHOALIADO .TOKEN SINPOS ]
      ] ]
      [ .CLASS BICHOALIADO .TOKEN LANCHERO .XYZ [ 4 5 6 ] ]
      [ .CLASS MACRO .TOKEN M1 .XYZ [ 7 8 9 ] ]
    ]
  ]`;

  it('encuentra los aliados, también los anidados dentro de otro elemento', () => {
    const a = loadAllies(MIS);
    expect(a.map((x) => x.token)).toEqual(['COMANDO', 'FRANCOT', 'LANCHERO']);
    expect(a[0]).toEqual({ token: 'COMANDO', x: 10, y: 20, z: 30, angle: 135, anim: 'COMANDO' });
    expect(must(a[1]).anim).toBe('FRANCO');
    expect(must(a[2]).angle).toBe(0);
  });

  it('no baja más de 8 niveles y tolera misiones sin elementos', () => {
    let deep = '[ .CLASS BICHOALIADO .TOKEN X .XYZ [ 1 2 3 ] ]';
    for (let i = 0; i < 10; i++) deep = `[ .CLASS BICHO .ELEMENTOS [ ${deep} ] ]`;
    expect(loadAllies(`.MISSION [ .ELEMENTOS [ ${deep} ] ]`)).toEqual([]);
    expect(loadAllies('.MISSION [ ]')).toEqual([]);
    expect(loadAllies('')).toEqual([]);
  });
});
