import { describe, expect, it } from 'vitest';
import { parseSec, SectorFlag, type Sector } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { parseAnm } from '../formats/anm.ts';
import { navFor } from './path.ts';
import { SectorMap } from './sectors.ts';
import { Unit } from './unit.ts';

// Rejilla 3×3 de celdas de 100: celda (cx, cy) = sector cy*3+cx. Vértice (x, y) = y*4+x. Antihorario: 0 abajo, 1 derecha, 2 arriba, 3 izquierda.
const verts: [number, number][] = [];
for (let y = 0; y <= 3; y++) for (let x = 0; x <= 3; x++) verts.push([x * 100, y * 100]);
const id = (cx: number, cy: number): number => cy * 3 + cx;
const quad = (cx: number, cy: number, extra: object = {}): { verts: number[] } => ({
  verts: [cy * 4 + cx, cy * 4 + cx + 1, (cy + 1) * 4 + cx + 1, (cy + 1) * 4 + cx],
  ...extra,
});
const grid = (cell: (cx: number, cy: number) => object = () => ({})): SectorMap => {
  const a: object[] = [];
  const tw1: number[][] = [];
  for (let cy = 0; cy < 3; cy++)
    for (let cx = 0; cx < 3; cx++) {
      a.push(quad(cx, cy, cell(cx, cy)));
      tw1.push([cy > 0 ? id(cx, cy - 1) : -1, cx < 2 ? id(cx + 1, cy) : -1, cy < 2 ? id(cx, cy + 1) : -1, cx > 0 ? id(cx - 1, cy) : -1]);
    }
  return new SectorMap(parseSec(secBytes({ verts, a: a as { verts: number[] }[], tw1 })));
};
const at = (m: SectorMap, x: number, y: number): Sector => {
  const s = m.at(x, y);
  if (!s) throw new Error(`sin sector en ${x.toString()},${y.toString()}`);
  return s;
};
function got<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('se esperaba un valor');
  return v;
}
const walls = (cx: number, cy: number): object => (cx === 1 && cy === 1 ? { flags: SectorFlag.NTrans } : {});

describe('rutas por sectores', () => {
  it('la onda comprueba el relieve de sectores intermedios, con el destino vecino como excepción del exe', () => {
    const m = grid((cx, cy) => (cx === 1 && cy === 1 ? { plane: [0, 0, 100] } : {}));
    const nav = navFor(m);
    const origin = { x: 50, y: 150, z: 40 };
    expect(nav.blastPath(origin, { x: 250, y: 150, z: 40 })).toBe(false);
    expect(nav.blastPath(origin, { x: 250, y: 150, z: 300 })).toBe(true);
    expect(nav.blastPath(origin, { x: 150, y: 150, z: 40 })).toBe(true);
    expect(nav.blastPath(origin, { x: 50.5, y: 150, z: 0 })).toBe(true);
    expect(nav.blastPath({ x: -10, y: 150, z: 40 }, origin)).toBe(false);
    expect(nav.blastPath(origin, { x: 350, y: 150, z: 40 })).toBe(false);
  });
  it('en línea recta por sectores libres: una cadena y solo el destino como punto', () => {
    const m = grid();
    const nav = navFor(m);
    const from = { x: 50, y: 150 };
    const to = { x: 250, y: 150 };
    const steps = got(nav.steps(from, at(m, from.x, from.y), to, at(m, to.x, to.y)));
    expect(steps.map((s) => s.sector)).toEqual([id(0, 1), id(1, 1), id(2, 1)]);
    expect(steps.map((s) => s.edge)).toEqual([1, 1, -1]);
    expect(nav.route(from, at(m, from.x, from.y), to, at(m, to.x, to.y))).toMatchObject([to]);
  });

  it('un sector NTrans en el medio se rodea (A*): los puntos de giro quedan fuera del muro', () => {
    const m = grid(walls);
    const nav = navFor(m);
    const from = { x: 50, y: 150 };
    const to = { x: 250, y: 150 };
    const route = got(nav.route(from, at(m, from.x, from.y), to, at(m, to.x, to.y)));
    expect(route.length).toBeGreaterThan(1);
    expect(route[route.length - 1]).toMatchObject(to);
    let prev = from;
    for (const p of route) {
      for (let t = 0; t <= 1; t += 0.02) {
        const s = m.at(prev.x + (p.x - prev.x) * t, prev.y + (p.y - prev.y) * t);
        expect(s && !(s.flags & SectorFlag.NTrans)).toBeTruthy();
      }
      prev = p;
    }
  });

  it('sin camino (destino encerrado) devuelve null; mismo sector: un solo punto; casi encima: []', () => {
    const m = grid((cx, cy) => (cx === 2 && cy === 2 ? {} : (cx === 1 && cy === 2) || (cx === 2 && cy === 1) ? { flags: SectorFlag.NTrans } : {}));
    const nav = navFor(m);
    const a = { x: 50, y: 50 };
    expect(nav.route(a, at(m, 50, 50), { x: 250, y: 250 }, at(m, 250, 250))).toBeNull();
    expect(nav.route(a, at(m, 50, 50), { x: 80, y: 20 }, at(m, 80, 20))).toMatchObject([{ x: 80, y: 20 }]);
    expect(nav.route(a, at(m, 50, 50), { x: 51, y: 50 }, at(m, 51, 50))).toEqual([]);
    expect(nav.route(a, at(m, 50, 50), { x: 500, y: 500 }, null)).toBeNull();
  });

  it('márgenes del portal: 4 en campo abierto, 11 junto a una pared, 8 + 15 + 22 como anchos mínimos', () => {
    const open = grid();
    const o = navFor(open);
    const p = { x: 50, y: 150 };
    const q = { x: 250, y: 150 };
    const first = got(o.steps(p, at(open, p.x, p.y), q, at(open, q.x, q.y)))[0];
    // el portal x=100, y 100..200 tiene sus dos extremos rodeados de celdas libres a >11 u del borde del mapa
    expect(first).toMatchObject({ w1: 4, w2: 4, bits: 0 });
    const m = grid(walls);
    const w = navFor(m);
    const r = got(w.steps({ x: 50, y: 50 }, at(m, 50, 50), { x: 250, y: 50 }, at(m, 250, 50)))[0];
    expect(r).toMatchObject({ w1: 11, w2: 11, bits: 3 }); // el portal x=100, y 0..100 toca el borde del mapa y el muro central
  });

  it('un escalón de +30 cierra el paso; en pendiente se compara en los extremos de la arista', () => {
    const step = grid((cx, cy) => (cx === 1 && cy === 1 ? { plane: [0, 0, 30] } : {}));
    const n1 = navFor(step);
    const a = { x: 50, y: 150 };
    const b = { x: 250, y: 150 };
    const route = got(n1.route(a, at(step, a.x, a.y), b, at(step, b.x, b.y)));
    expect(route.length).toBeGreaterThan(1); // rodea la celda alta
    // pendiente suave (0.09·x): sube 9 en x=100 y baja 18 en x=200 (dentro de +15 / -20) -> pasa recto
    const slope = grid((cx, cy) => (cx === 1 && cy === 1 ? { plane: [0.09, 0, 0] } : {}));
    expect(got(navFor(slope).route(a, at(slope, a.x, a.y), b, at(slope, b.x, b.y)))).toMatchObject([b]);
    // pendiente fuerte (0.4·x): en x=100 el plano vale 40 -> bloqueada la arista
    const steep = grid((cx, cy) => (cx === 1 && cy === 1 ? { plane: [0.4, 0, 0] } : {}));
    expect(got(navFor(steep).route(a, at(steep, a.x, a.y), b, at(steep, b.x, b.y))).length).toBeGreaterThan(1);
  });

  it('cada punto de ruta trae la altura del suelo del sector donde está (para dibujarla)', () => {
    const m = grid((cx) => (cx === 2 ? { plane: [0, 0, 7] } : {}));
    const a = { x: 50, y: 150 };
    const b = { x: 250, y: 150 };
    const route = got(navFor(m).route(a, at(m, a.x, a.y), b, at(m, b.x, b.y)));
    expect(route).toEqual([{ x: 250, y: 150, z: 7 }]);
  });

  it('SoloAg solo se cruza agachado; agua profunda nunca a pie', () => {
    const low = grid((cx, cy) => (cx === 1 && cy === 1 ? { flags: SectorFlag.SoloAg } : cx === 1 && cy === 0 ? { type: 3 } : {}));
    const nav = navFor(low);
    const a = { x: 50, y: 150 };
    const b = { x: 250, y: 150 };
    const sa = at(low, a.x, a.y);
    const sb = at(low, b.x, b.y);
    expect(got(nav.route(a, sa, b, sb)).length).toBeGreaterThan(1); // de pie lo rodea
    expect(nav.route(a, sa, b, sb, true)).toMatchObject([b]); // agachado pasa recto
  });

  it('el filtro de buceo rodea tierra, permite agua profunda y respeta sectores bloqueados', () => {
    const m = grid((cx, cy) => cx === 1 && cy === 1 ? {} : { type: (cx + cy) % 2 ? 3 : 1 });
    const a = { x: 50, y: 150 };
    const b = { x: 250, y: 150 };
    const nav = navFor(m);
    const route = got(nav.route(a, at(m, a.x, a.y), b, at(m, b.x, b.y), false, true));
    expect(route.length).toBeGreaterThan(1);
    let prev = a;
    for (const p of route) {
      for (let t = 0; t <= 1; t += 0.02) expect([1, 3]).toContain(m.at(prev.x + (p.x - prev.x) * t, prev.y + (p.y - prev.y) * t)?.type);
      prev = p;
    }
    const closed = grid((cx, cy) => cx === 1 ? { type: 1, flags: cy === 1 ? SectorFlag.NTrans : SectorFlag.NCamin } : { type: 1 });
    expect(navFor(closed).route(a, at(closed, a.x, a.y), b, at(closed, b.x, b.y), false, true)).toBeNull();
    expect(nav.steps(a, at(m, 150, 150), b, at(m, b.x, b.y), false, true)).toBeNull();
  });

  it('el marine sigue la ruta acuática hasta el otro lado de un obstáculo', () => {
    const m = grid((cx, cy) => cx === 1 && cy === 1 ? {} : { type: 1 });
    const anm = parseAnm(bnm([{ type: 0, slots: [2] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'BUCEAR', 2, 30, 0, 8)]));
    const u = new Unit('LANCHERO', anm, 50, 150, 0, 0, m);
    u.diving = true;
    expect(u.goTo({ x: 250, y: 150 }, false)).toBe(true);
    expect(u.waypoints.length).toBeGreaterThan(1);
    for (let i = 0; i < 400 && u.target; i++) {
      u.tick();
      expect(u.sector?.type).toBe(1);
    }
    expect(u.target).toBeNull();
    expect(Math.hypot(u.body.x - 250, u.body.y - 150)).toBeLessThan(3);
  });

  it('un sector sin índice en el mapa no tiene ruta', () => {
    const m = grid();
    const other = grid();
    const foreign = at(other, 50, 50);
    expect(navFor(m).steps({ x: 50, y: 50 }, foreign, { x: 250, y: 50 }, at(m, 250, 50))).toBeNull();
    expect(navFor(m)).toBe(navFor(m));
  });

  it('follow: encuentra el sector caminando por los vecinos; null si el punto no está en ninguno', () => {
    const m = grid();
    const nav = navFor(m);
    const home = at(m, 50, 50);
    expect(nav.follow(home, 60, 40)).toBe(home);
    expect(nav.follow(home, 250, 250)).toBe(at(m, 250, 250));
    expect(nav.follow(home, 150, 50)).toBe(at(m, 150, 50));
    expect(nav.follow(home, 500, 500)).toBeNull();
  });
});
