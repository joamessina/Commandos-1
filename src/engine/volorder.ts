/**
 * Orden de dibujo de los volúmenes del mapa (los `POLY` del .VOL): docs/research/q1-orden-dibujo.md (exe `FUN_005D1C40`, `FUN_005D0F90`, `FUN_0062F820`,
 * `FUN_0062EF30`, `FUN_0062EDF0`) y docs/lectura/render.md §8. El juego NO dibuja los volúmenes en el orden del archivo: compara por pares los que se
 * solapan en pantalla y asigna niveles por camino más largo (A antes que B ⇒ nivel(B) ≥ nivel(A)+1); se dibuja por nivel ascendente y, a igual nivel, por orden
 * de inserción (= archivo). Relaciones: polígono contra otro = aristas (lado sur/norte) y alturas (base/techo = cz, cz+alt); cilindro (sin aristas) contra cilindro =
 * altura, y de los pies, y radio.
 * Contorno en pantalla (`FUN_0062DC50`, leído): polígonos de hasta 14 vértices = silueta del prisma, recorrida desde el vértice de mayor x: cadena superior con los
 * vértices levantados por la altura (`−alt·sin 50°` en pantalla) y cadena inferior en la base, con ambos puntos en los vértices de x mínima y máxima (el recorrido sigue
 * el contorno real, cóncavo incluido); más de 14 vértices o cilindros = cuadrilátero (rombo del cilindro). El solape de contornos es el del exe (`FUN_0062DAF0`:
 * vértice dentro del otro o aristas que se cortan).
 * shortcut: el centro y el radio de un polígono son los de su caja y su radio circunscrito (en el exe `+0x34/+0x38` y `+0x8`, no verificado con los datos); la rampa
 *           (`POLYRAMPA`) se trata como techo plano; sin el bit 2 (DibuPoly, no se sabe qué polígonos lo llevan); el cuadrilátero de >14 vértices y el rombo del cilindro
 *           usan la caja/los extremos del prisma (los valores salen de coprocesador oculto en el decompilado); con relaciones cíclicas el resultado depende de `MAX_PASSES`.
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
  /** Contorno en pantalla (`+0x54…`). */
  readonly hull: readonly Pt[];
  readonly dynamic: boolean;
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

/** `FUN_0062D7E0`: ¿está el punto dentro del polígono? (por el signo del producto cruzado con cada arista; cualquier orientación). */
function inside(pt: Pt, poly: readonly Pt[]): boolean {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as Pt;
    const q = poly[(i + 1) % poly.length] as Pt;
    const c = (q.x - p.x) * (pt.y - p.y) - (q.y - p.y) * (pt.x - p.x);
    if (c > 0) pos++;
    else if (c < 0) neg++;
  }
  return pos === 0 || neg === 0;
}

/** `FUN_0062D8C0`: intersección segmento-segmento paramétrica, t ∈ [0,1], u ∈ [0,1). */
function cross(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = q2.x - q1.x;
  const sy = q2.y - q1.y;
  const det = rx * sy - ry * sx;
  if (Math.abs(det) < 1e-9) return false;
  const t = ((q1.x - p1.x) * sy - (q1.y - p1.y) * sx) / det;
  const u = ((q1.x - p1.x) * ry - (q1.y - p1.y) * rx) / det;
  return t >= 0 && t <= 1 && u >= 0 && u < 1;
}

/** `FUN_0062DAF0`: los contornos se solapan si un vértice de uno cae dentro del otro o alguna arista de uno corta una del otro. */
function overlap(a: readonly Pt[], b: readonly Pt[]): boolean {
  if (a.length < 3 || b.length < 3) return true;
  if (a.some((p) => inside(p, b)) || b.some((p) => inside(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) if (cross(a[i] as Pt, a[(i + 1) % a.length] as Pt, b[j] as Pt, b[(j + 1) % b.length] as Pt)) return true;
  }
  return false;
}

/** Silueta del prisma de un polígono de ≤ 14 vértices (FUN_0062DC50): cadena superior levantada y cadena inferior en la base. */
function silhouette(world: readonly Pt[], cz: number, alt: number): Pt[] {
  const n = world.length;
  const base = world.map((p) => proj(p.x, p.y, cz));
  const top = world.map((p) => proj(p.x, p.y, cz + alt));
  let mn = 0;
  let mx = 0;
  for (let i = 1; i < n; i++) {
    if ((world[i] as Pt).x < (world[mn] as Pt).x) mn = i;
    if ((world[i] as Pt).x > (world[mx] as Pt).x) mx = i;
  }
  // de mx a mn en orden de índices (cadena 1) y de mn a mx (cadena 2): la de menor y media en pantalla es la norte (se levanta)
  const chain = (from: number, to: number): number[] => {
    const out = [from];
    for (let i = (from + 1) % n; i !== to; i = (i + 1) % n) out.push(i);
    if (to !== from) out.push(to);
    return out;
  };
  const c1 = chain(mx, mn);
  const c2 = chain(mn, mx);
  const avg = (c: number[]): number => c.reduce((s, i) => s + (base[i] as Pt).y, 0) / c.length;
  const northIsC1 = avg(c1) <= avg(c2);
  const out: Pt[] = [];
  const north = northIsC1 ? c1 : c2;
  const south = northIsC1 ? c2 : c1;
  // base del extremo oeste, norte (levantado) de oeste a este, base del extremo este, sur (base) de este a oeste
  const west = (northIsC1 ? north[north.length - 1] : north[0]) as number;
  const east = (northIsC1 ? north[0] : north[north.length - 1]) as number;
  const northWE = northIsC1 ? [...north].reverse() : north; // oeste → este
  const southEW = northIsC1 ? [...south].reverse() : south; // este → oeste
  out.push(base[west] as Pt);
  for (const i of northWE) out.push(top[i] as Pt);
  out.push(base[east] as Pt);
  for (const i of southEW.slice(1, -1)) out.push(base[i] as Pt);
  return out;
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
  const outline = world.length >= 2 && world.length <= 14 ? silhouette(world, cz, alt) : hull(prism);
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
  return { index, cx, cy, r, base: cz, top: cz + alt, lines, rect: { x0, y0, x1, y1 }, hull: outline, dynamic: false };
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

/** Orden de dibujo estático de los polígonos del VOL (índices de `vol.polys`; los sin tiles no aparecen). */
export const drawOrder = (vol: Vol): number[] => new VolOrder(vol).order;

/** Un elemento dinámico (soldado, comando, objeto, bote): `.RENDERVOL [ CILINDRO [ .R .H ] ]` en (x,y) sobre el suelo `z`. */
export interface Actor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  readonly h: number;
}

function actorInfo(a: Actor, index: number): Info {
  const pts: Pt[] = [];
  for (const [dx, dy] of [[-a.r, 0], [a.r, 0], [0, -a.r], [0, a.r]] as const) pts.push(proj(a.x + dx, a.y + dy, a.z), proj(a.x + dx, a.y + dy, a.z + a.h));
  const hl = hull(pts);
  const xs = hl.map((p) => p.x);
  const ys = hl.map((p) => p.y);
  return {
    index,
    cx: a.x,
    cy: a.y,
    r: a.r,
    base: a.z,
    top: a.z + a.h,
    lines: [],
    rect: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    hull: hl,
    dynamic: true,
  };
}

const rectsCross = (a: Info, b: Info): boolean => !(a.rect.x0 >= b.rect.x1 || b.rect.x0 >= a.rect.x1 || a.rect.y0 >= b.rect.y1 || b.rect.y0 >= a.rect.y1);

/** Resultado de ordenar actores contra los volúmenes: orden de dibujo de los actores y, para cada uno, los polígonos que se dibujan DESPUÉS (encima) de él. */
export interface Placement {
  /** Índices de actores en orden de dibujo. */
  readonly order: number[];
  /** Por actor: índices de `vol.polys` que van después y se solapan con su rectángulo. */
  readonly after: number[][];
}

/**
 * Orden de los volúmenes del mapa y de los elementos dinámicos en una sola lista de niveles (`FUN_005D1C40`): los volúmenes son fijos y se calculan una vez; cada
 * cuadro se anotan las relaciones de los actores contra los volúmenes que tocan en pantalla (los actores se insertan después de los del mapa y entre ellos por la regla
 * cilindro-cilindro).
 */
export class VolOrder {
  /** Orden de dibujo estático (índices de `vol.polys`). */
  readonly order: number[];
  private readonly items: Info[];
  private readonly edges: [number, number][] = [];

  constructor(vol: Vol) {
    this.items = vol.polys.map((p, i) => info(p, i)).filter((x): x is Info => x !== null);
    const n = this.items.length;
    for (let j = 1; j < n; j++) {
      for (let i = 0; i < j; i++) {
        const r = this.rel(this.items[j] as Info, this.items[i] as Info);
        if (r > 0) this.edges.push([j, i]);
        else if (r < 0) this.edges.push([i, j]);
      }
    }
    const level = this.levels(n, this.edges);
    this.order = this.items.map((it, k) => ({ it, k })).sort((p, q) => (level[p.k] ?? 0) - (level[q.k] ?? 0) || p.k - q.k).map((e) => e.it.index);
  }

  private rel(n: Info, b: Info): number {
    if (!rectsCross(n, b) || !overlap(n.hull, b.hull)) return 0;
    return relation(n, b);
  }

  private levels(count: number, edges: readonly [number, number][]): number[] {
    const level = new Array<number>(count).fill(0);
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let changed = false;
      for (const [x, y] of edges) {
        const need = (level[x] ?? 0) + 1;
        if ((level[y] ?? 0) < need && need <= count) {
          level[y] = need;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return level;
  }

  /** Coloca los actores (en el orden en que se insertan) entre los volúmenes. */
  place(actors: readonly Actor[]): Placement {
    const n = this.items.length;
    const infos = actors.map((a, k) => actorInfo(a, n + k));
    const edges = [...this.edges];
    infos.forEach((a, k) => {
      const ai = n + k;
      for (let i = 0; i < n; i++) {
        const r = this.rel(a, this.items[i] as Info);
        if (r > 0) edges.push([ai, i]);
        else if (r < 0) edges.push([i, ai]);
      }
      for (let m = 0; m < k; m++) {
        const r = this.rel(a, infos[m] as Info);
        if (r > 0) edges.push([ai, n + m]);
        else if (r < 0) edges.push([n + m, ai]);
      }
    });
    const level = this.levels(n + actors.length, edges);
    const order = actors.map((_, k) => k).sort((p, q) => (level[n + p] ?? 0) - (level[n + q] ?? 0) || p - q);
    const after = infos.map((a, k) => {
      const lv = level[n + k] ?? 0;
      const out: number[] = [];
      this.items.forEach((it, i) => {
        if ((level[i] ?? 0) > lv && rectsCross(a, it)) out.push(it.index);
      });
      return out;
    });
    return { order, after };
  }
}
