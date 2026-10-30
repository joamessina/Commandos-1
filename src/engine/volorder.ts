/**
 * Orden de dibujo de los volúmenes del mapa (los `POLY` del .VOL): docs/research/q1-orden-dibujo.md (exe `FUN_005D1C40`, `FUN_005D0F90`, `FUN_0062F820`,
 * `FUN_0062EF30`, `FUN_0062EDF0`) y docs/lectura/render.md §8. El juego NO dibuja los volúmenes en el orden del archivo: compara por pares los que se
 * solapan en pantalla y asigna niveles por camino más largo (A antes que B ⇒ nivel(B) ≥ nivel(A)+1); se dibuja por nivel ascendente y, a igual nivel, por orden
 * de inserción (= archivo). Relaciones: polígono contra otro = aristas (lado sur/norte) y alturas (base/techo = cz, cz+alt); cilindro (sin aristas) contra cilindro =
 * altura, y de los pies, y radio.
 * shortcut: el contorno en pantalla (`+0x50`, FUN_0062DC50, no leído) se aproxima por el casco convexo del prisma proyectado (z = cz y z = cz+alt); el centro y
 *           el radio de un polígono son los de su caja y su radio circunscrito (en el exe `+0x34/+0x38` y `+0x8`); la rampa (`POLYRAMPA`) se trata como techo
 *           plano; sin el bit 2 (DibuPoly, no se sabe qué polígonos lo llevan); con relaciones cíclicas el resultado depende del límite de pasadas (`MAX_PASSES`).
 *           Cuándo mejorar: al leer FUN_0062DC50 y los bits de `vol+4`.
 */
import type { Poly, Vol } from '../formats/vol.ts';
import { COS50, SIN50 } from './sectors.ts';

interface Line {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

interface Info {
  readonly index: number;
  /** Centro de referencia (caja de los puntos de mundo o (cx,cy) en un cilindro). */
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly base: number;
  readonly top: number;
  readonly lines: readonly Line[];
  /** Rectángulo en pantalla de los tiles y contorno (casco convexo). */
  readonly rect: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
  readonly hull: readonly Pt[];
}

const MAX_PASSES = 64;

const proj = (x: number, y: number, z: number): Pt => ({ x, y: COS50 * y - SIN50 * z });

function hull(pts: readonly Pt[]): Pt[] {
  const p = [...pts].sort((u, v) => u.x - v.x || u.y - v.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2] as Pt, lower[lower.length - 1] as Pt, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2] as Pt, upper[upper.length - 1] as Pt, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** ¿Se solapan dos polígonos convexos? (SAT; equivale a "algún vértice dentro o aristas que se cruzan" de FUN_0062DAF0 para formas convexas). */
function overlap(a: readonly Pt[], b: readonly Pt[]): boolean {
  if (a.length < 3 || b.length < 3) return true;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i] as Pt;
      const q = poly[(i + 1) % poly.length] as Pt;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      let a0 = Infinity;
      let a1 = -Infinity;
      let b0 = Infinity;
      let b1 = -Infinity;
      for (const v of a) {
        const d = v.x * nx + v.y * ny;
        a0 = Math.min(a0, d);
        a1 = Math.max(a1, d);
      }
      for (const v of b) {
        const d = v.x * nx + v.y * ny;
        b0 = Math.min(b0, d);
        b1 = Math.max(b1, d);
      }
      if (a1 < b0 || b1 < a0) return false;
    }
  }
  return true;
}

function info(poly: Poly, index: number): Info | null {
  if (poly.tiles.length === 0) return null;
  const [hx = 0, hy = 0, cz = 0, alt = 0] = poly.header;
  const world = poly.points.map((p) => ({ x: hx + p.x, y: hy + p.y }));
  let cx = hx;
  let cy = hy;
  let r = poly.radio ?? 0;
  let lines: Line[] = [];
  let base: Pt[] = [{ x: hx - r, y: hy }, { x: hx + r, y: hy }, { x: hx, y: hy - r }, { x: hx, y: hy + r }];
  if (world.length >= 2) {
    const xs = world.map((p) => p.x);
    const ys = world.map((p) => p.y);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    r = Math.max(...world.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    base = world;
    let area = 0;
    for (let i = 0; i < world.length; i++) {
      const p = world[i] as Pt;
      const q = world[(i + 1) % world.length] as Pt;
      area += p.x * q.y - q.x * p.y;
    }
    // recta de cada arista con (a,b) hacia afuera: a=(y2−y1)/L, b=−(x2−x1)/L (antihorario en el sistema del exe); se orienta por el área
    const sgn = area >= 0 ? 1 : -1;
    lines = world.map((p, i) => {
      const q = world[(i + 1) % world.length] as Pt;
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const a = (sgn * (q.y - p.y)) / len;
      const b = (-sgn * (q.x - p.x)) / len;
      return { a, b, c: -(a * p.x + b * p.y) };
    });
  }
  const prism: Pt[] = [];
  for (const p of base) prism.push(proj(p.x, p.y, cz), proj(p.x, p.y, cz + alt));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const t of poly.tiles) {
    x0 = Math.min(x0, t.x);
    y0 = Math.min(y0, t.y);
    x1 = Math.max(x1, t.x + t.w);
    y1 = Math.max(y1, t.y + t.h);
  }
  return { index, cx, cy, r, base: cz, top: cz + alt, lines, rect: { x0, y0, x1, y1 }, hull: hull(prism) };
}

/** `FUN_0062EF30(P, Q)`: relación vista desde el polígono P (+1 = P se dibuja antes que Q, −1 = después, 0 = sin relación). */
function relPoly(p: Info, q: Info): number {
  let outside = false;
  let last = 0;
  let v = 0;
  let conflict = false;
  for (const l of p.lines) {
    const d = l.a * q.cx + l.b * q.cy + l.c;
    if (d > 0) {
      outside = true;
      if (last !== -1) last = l.b >= 0 ? 1 : -1;
    }
    if (d > q.r) {
      const s = l.b >= 0 ? 1 : -1;
      if (v !== 0 && v !== s) conflict = true;
      v = s;
    }
  }
  if (conflict) v = 0;
  let h = 0;
  if (q.base > p.top) h = 1;
  else if (q.top < p.base) h = -1;
  if (v !== 0) return h !== 0 && h !== v ? 0 : v;
  if (h !== 0) return h;
  if (!outside) return q.r < p.r ? -1 : 1;
  return last;
}

/** `FUN_0062EDF0(A, B)`: cilindro contra cilindro (altura, `y` de los pies, radio). +1 = A antes que B. */
function relCyl(a: Info, b: Info): number {
  if (a.top <= b.base) return 1;
  if (a.base < b.top) {
    const d = b.cy - a.cy;
    if (d > 0) return 1;
    if (d < 0) return -1;
    return a.r < b.r ? 1 : -1;
  }
  return -1;
}

/** `FUN_0062F820(A, B)`: +1 = A se dibuja antes que B. */
function relation(a: Info, b: Info): number {
  if (a.lines.length >= 2) return relPoly(a, b);
  if (b.lines.length >= 2) return -relPoly(b, a);
  return relCyl(a, b);
}

/**
 * Orden de dibujo de los polígonos del VOL: índices de `vol.polys` (los sin tiles no aparecen). Se inserta en orden de archivo; para cada pareja que se
 * solapa y tiene relación se anota «X antes que Y»; los niveles son el camino más largo y el desempate el orden de archivo.
 */
export function drawOrder(vol: Vol): number[] {
  const items = vol.polys.map((p, i) => info(p, i)).filter((x): x is Info => x !== null);
  const edges: [number, number][] = []; // [antes, después] (posiciones en `items`)
  for (let j = 1; j < items.length; j++) {
    const n = items[j] as Info;
    for (let i = 0; i < j; i++) {
      const b = items[i] as Info;
      if (n.rect.x0 >= b.rect.x1 || b.rect.x0 >= n.rect.x1 || n.rect.y0 >= b.rect.y1 || b.rect.y0 >= n.rect.y1) continue;
      if (!overlap(n.hull, b.hull)) continue;
      const r = relation(n, b);
      if (r > 0) edges.push([j, i]);
      else if (r < 0) edges.push([i, j]);
    }
  }
  const level = new Array<number>(items.length).fill(0);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const [x, y] of edges) {
      const need = (level[x] ?? 0) + 1;
      if ((level[y] ?? 0) < need && need <= items.length) {
        level[y] = need;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return items.map((it, k) => ({ it, k })).sort((p, q) => (level[p.k] ?? 0) - (level[q.k] ?? 0) || p.k - q.k).map((e) => e.it.index);
}
