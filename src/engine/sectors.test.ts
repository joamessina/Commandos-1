import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec, SectorFlag } from '../formats/sec.ts';
import { anmSeq, bnm, must, secBytes } from '../testing/builders.ts';
import { COS50, groundZ, isWater, SectorMap, SIN50, simBlocked, stepOk, validTarget } from './sectors.ts';
import { Unit } from './unit.ts';

// A0 (0..100) con pendiente en x y un piso B0 a z=50; A1 (100..200) intransitable; A2 (200..300) agua; A3 (300..400) agua profunda;
// A4 (400..500) llano; A5 (500..600) 30 más alto; A6 (600..700) solo agachado
const verts: [number, number][] = [];
for (let i = 0; i <= 7; i++) verts.push([i * 100, 0], [i * 100, 100]);
// antihorario: aristas 0 abajo, 1 derecha (vecino i+1), 2 arriba, 3 izquierda (vecino i-1)
const quad = (i: number, extra: object = {}): { verts: number[] } => ({ verts: [i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1], ...extra });
const map = new SectorMap(
  parseSec(
    secBytes({
      verts,
      a: [
        quad(0, { plane: [0.1, 0, 0] }),
        quad(1, { flags: SectorFlag.NTrans }),
        quad(2, { type: 1 }),
        quad(3, { type: 3 }),
        quad(4),
        quad(5, { plane: [0, 0, 30] }),
        quad(6, { flags: SectorFlag.SoloAg }),
      ],
      b: [quad(0, { plane: [0, 0, 50] })],
      tw1: Array.from({ length: 7 }, (_, i) => [-1, i < 6 ? i + 1 : -1, -1, i > 0 ? i - 1 : -1]),
    }),
  ),
);
const sector = (i: number) => must(map.sec.sectors[i]);

describe('SectorMap', () => {
  it('prueba sectores por semiplanos ampliados, incluido el contacto en esquina', () => {
    expect(map.touchesType(210, 50, 10, 0)).toBe(true);
    expect(map.touchesType(211, 50, 10, 0)).toBe(false);
    expect(map.touchesType(109, 109, 10, 0)).toBe(true);
    expect(map.touchesType(111, 111, 10, 0)).toBe(false);
    expect(map.touchesType(290, 50, 10, 3)).toBe(true);
  });
  it('busca por bbox (mín < v ≤ máx) y polígono; fuera de todo = null', () => {
    expect(map.at(150, 50)).toBe(sector(1));
    expect(map.at(200, 50)).toBe(sector(1)); // el borde máximo pertenece al sector de la izquierda
    expect(map.at(300, 50)).toBe(sector(2));
    expect(map.at(700, 50)).toBe(sector(6));
    expect(map.at(0, 50)).toBeNull(); // el borde mínimo no
    expect(map.at(-5, 50)).toBeNull();
    expect(map.at(750, 50)).toBeNull();
  });

  it('la lista B gana solo si el punto está sobre su suelo (B primero)', () => {
    expect(map.at(50, 50)).toBe(sector(7)); // sin z: B primero
    expect(map.atZ(50, 50, 60)?.overlay).toBe(true); // por encima del piso a 50
    expect(map.atZ(50, 50, 10)).toBe(sector(0)); // por debajo: el sector A
    expect(map.atZ(50, 50, 49.5)?.overlay).toBe(true); // plano < z + 1
  });

  it('altura del suelo = plano del sector', () => {
    expect(groundZ(sector(0), 40, 70)).toBeCloseTo(4);
    expect(groundZ(sector(5), 550, 10)).toBe(30);
  });
});

describe('picking del cursor', () => {
  it('un píxel sobre terreno llano da el punto del mundo de ese plano', () => {
    const hit = map.pick(450, COS50 * 60); // sector A4 (400..500), z = 0
    expect(hit?.sector).toBe(sector(4));
    expect(hit?.x).toBe(450);
    expect(hit?.y).toBeCloseTo(60, 6);
    expect(hit?.z).toBeCloseTo(0, 6);
  });

  it('en una cuesta resuelve y con la inclinación del plano (z = 0.1·x)', () => {
    // A0 (0..100) plano z = 0.1·x: en x=40 el suelo está en z=4; el píxel de (40, 70, z=4)
    const hit = map.pick(40, COS50 * 70 - SIN50 * 4);
    expect(hit?.y).toBeCloseTo(70, 6);
    expect(hit?.z).toBeCloseTo(4, 6);
  });

  it('si el rayo cruza dos pisos gana el más alto (el más cercano a la cámara)', () => {
    // A0 a z≈5 y el piso B0 a z=50 cubren la misma zona (0..100); el píxel de (50, 40, z=50) también cae sobre A0 más abajo
    const hit = map.pick(50, COS50 * 40 - SIN50 * 50);
    expect(hit?.sector).toBe(sector(7));
    expect(hit?.z).toBeCloseTo(50, 6);
  });

  it('fuera de todos los sectores devuelve null', () => {
    expect(map.pick(5000, 100)).toBeNull();
    expect(map.pick(450, -5000)).toBeNull();
  });
});

describe('reglas de paso', () => {
  it('validTarget (FUN_0053A250)', () => {
    expect(validTarget(sector(0))).toBe(true);
    expect(validTarget(sector(2))).toBe(true); // agua baja se camina
    expect(validTarget(null)).toBe(false);
    expect(validTarget(sector(1))).toBe(false); // NTrans
    expect(validTarget(sector(3))).toBe(false); // DEEPWATER a pie
    expect(validTarget(sector(6))).toBe(false); // SoloAg de pie
    expect(validTarget(sector(6), { crouched: true })).toBe(true);
    expect(validTarget(sector(0), { water: true })).toBe(false);
    expect(validTarget(sector(3), { water: true })).toBe(true);
    const ncamin = { ...sector(0), flags: SectorFlag.NCamin };
    expect(validTarget(ncamin)).toBe(false);
  });

  it('simBlocked (FUN_0066AD30): NCamin no bloquea', () => {
    expect(simBlocked(null)).toBe(true);
    expect(simBlocked(sector(0))).toBe(false);
    expect(simBlocked(sector(1))).toBe(true);
    expect(simBlocked(sector(3))).toBe(true);
    expect(simBlocked(sector(6))).toBe(true);
    expect(simBlocked(sector(6), { crouched: true })).toBe(false);
    expect(simBlocked({ ...sector(0), flags: SectorFlag.NCamin })).toBe(false);
    expect(simBlocked(sector(0), { water: true })).toBe(true);
    expect(simBlocked(sector(2), { water: true })).toBe(false);
  });

  it('escalón permitido en [-20, +15]', () => {
    expect([-20.1, -20, 0, 15, 15.1].map(stepOk)).toEqual([false, true, true, true, false]);
  });

  it('isWater: tipos 1 y 3', () => {
    expect([sector(0), sector(2), sector(3), null].map(isWater)).toEqual([false, true, true, false]);
  });
});

describe('Unit sobre sectores', () => {
  const anm = parseAnm(bnm([{ type: 0, slots: [1] }, ...anmSeq(1, 'ANDAR', 8, 40, 0, 8)]));
  const unit = (x: number, y: number, z = 0): Unit => new Unit('COMANDO', anm, x, y, z, 0, map);
  const run = (u: Unit, n: number): void => {
    for (let i = 0; i < n; i++) u.tick();
  };

  it('toma la altura del suelo del sector al nacer y al caminar', () => {
    const u = unit(50, 50, 3); // z del .XYZ ignorada: se usa el plano
    expect(u.z).toBeCloseTo(5);
    expect(u.sector).toBe(sector(0));
    u.goTo({ x: 90, y: 50 }, false);
    run(u, 80);
    expect(u.z).toBeCloseTo(9, 0);
  });

  it('rechaza destinos intransitables y no se mueve', () => {
    const u = unit(50, 50);
    expect(u.goTo({ x: 150, y: 50 }, false)).toBe(false);
    expect(u.goTo({ x: 750, y: 50 }, false)).toBe(false);
    expect(u.target).toBeNull();
    expect(u.goTo({ x: 90, y: 50 }, false)).toBe(true);
  });

  it('sin camino por sectores (NTrans, escalón de +30) la orden se rechaza y no se mueve', () => {
    const u = unit(50, 50);
    expect(u.goTo({ x: 250, y: 50 }, false)).toBe(false); // 100..200 es NTrans
    const v = unit(450, 50);
    expect(v.goTo({ x: 590, y: 50 }, false)).toBe(false); // 500..600 está 30 más alto
    expect(v.goTo({ x: 490, y: 50 }, false)).toBe(true);
    expect(u.target).toBeNull();
  });

  it('una orden a menos de 2 u del destino se ignora', () => {
    const u = unit(50, 50);
    expect(u.goTo({ x: 51, y: 50 }, false)).toBe(true);
    expect(u.target).toBeNull();
  });

  it('si el camino se cierra mientras camina, a los 9 ciclos sin avanzar abandona la orden (no re-planifica)', () => {
    const u = unit(10, 50);
    expect(u.goTo({ x: 90, y: 50 }, false)).toBe(true);
    const s0 = sector(0);
    s0.flags |= SectorFlag.NTrans; // el Sim anula cada paso
    run(u, 8);
    expect(u.target).not.toBeNull(); // todavía no cumplió 9 ciclos
    run(u, 8);
    s0.flags &= ~SectorFlag.NTrans;
    expect(u.target).toBeNull();
    expect(u.body.x).toBeCloseTo(10, 0);
  });

  it('en agua camina a la mitad de la velocidad', () => {
    const dry = unit(10, 50);
    const wet = unit(210, 50);
    dry.goTo({ x: 90, y: 50 }, false);
    wet.goTo({ x: 290, y: 50 }, false);
    run(dry, 10);
    run(wet, 10);
    const d = dry.body.x - 10;
    const w = wet.body.x - 210;
    expect(w / d).toBeCloseTo(0.5, 1);
  });

  it('sin mapa de sectores conserva la z del .XYZ y no valida nada', () => {
    const u = new Unit('COMANDO', anm, 150, 50, 7, 0);
    expect(u.z).toBe(7);
    expect(u.goTo({ x: 750, y: 50 }, false)).toBe(true);
    run(u, 10);
    expect(u.body.x).toBeGreaterThan(150);
  });

  it('el lector conserva los grupos con nombre (zonas) del .SEC', () => {
    const sec = parseSec(secBytes({ verts: [[0, 0], [10, 0], [10, 10], [0, 10]], a: [{ verts: [0, 1, 2, 3] }] }));
    expect(sec.groups).toEqual([{ name: '', items: [[0, 0]] }]);
  });
});
