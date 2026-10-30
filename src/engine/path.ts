/**
 * Rutas sobre los sectores (.SEC): port de `TPathTool::buscaCamino` del exe de la raíz. Fuentes y evidencia: docs/research/q1-rutas.md (R3).
 *   FUN_00624B90 buscador (atajo de recta FUN_00624840/FUN_00624530 y A* sobre sectores, costo FUN_00624370, h FUN_00624470, ancho FUN_00624140),
 *   FUN_006112B0/FUN_00611220/FUN_00610D40 filtro a pie, FUN_00577770 búsqueda de pared cerca del extremo de una arista (radio 11),
 *   FUN_00625750 portales recortados, FUN_00625AF0 embudo, FUN_00624050 cadena de pasos.
 * shortcut: el embudo es el estándar (string-pulling con portales recortados); el original usa intervalos angulares (FUN_00674B40/6749B0/674A10,
 *           NO leídos) y además emite un punto por cada portal cruzado (FUN_00625900, colineales): aquí solo los puntos de giro y el destino.
 *           Cuándo mejorar: al leer esas funciones, si una ruta real difiere.
 * shortcut: solo el modo a pie (agua/buceo FUN_00611470 y escaleras con bit 4 no portados); sin límite del pool de nodos (DAT_00874E9C);
 *           los márgenes se recalculan en cada consulta (sin caché). Cuándo mejorar: al portar el bote/buceo; si el perfil lo pide.
 */
import { SectorFlag, type Sector } from '../formats/sec.ts';
import { groundZ, TYPE_DEEPWATER, type SectorMap } from './sectors.ts';
import type { Vec } from './walk.ts';

/** Punto de ruta con la altura del suelo en él (para dibujar la ruta; el movimiento usa solo x, y). */
export interface Waypoint extends Vec {
  z: number;
}

/** Un paso de la cadena de sectores: sector, arista de salida (-1 = último) y márgenes de la arista (w1 extremo 0, w2 extremo 1). */
export interface PathStep {
  readonly sector: number;
  readonly edge: number;
  readonly w1: number;
  readonly w2: number;
  readonly bits: number;
}

/** Radio de búsqueda de paredes (0x7A68CC) y márgenes (0x7A68CC con pared, 0x7941BC sin ella). */
const WALL_RADIUS = 11;
const CLEAR_MARGIN = 4;
/** Subida y bajada máximas entre sectores en el filtro (FUN_00610D40(15, 20)). */
const RISE = 15;
const DROP = 20;
const MAX_BFS = 0x3ff;
/** Una orden a menos de 2 u del destino se ignora (d² < 4.0, 0x7941BC). */
const ALREADY_THERE_D2 = 4;
/** Mitad del largo de arista recortada por extremo cuando la arista mide ≤ 1 (0x7A89C0). */
const TINY_EDGE_CLIP = 0.49;

interface Node {
  sector: number;
  g: number;
  parent: Node | null;
  /** Arista del padre por la que se entró. */
  entry: number;
  w1: number;
  w2: number;
  bits: number;
}

interface Edge {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const side = (a: Vec, b: Vec, c: Vec): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const same = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;

export class Nav {
  private readonly list: readonly Sector[];
  private readonly index = new Map<Sector, number>();
  private readonly cx: number[] = [];
  private readonly cy: number[] = [];
  private readonly cz: number[] = [];
  private readonly seen: Uint32Array;
  private readonly map: SectorMap;
  private stamp = 0;

  constructor(map: SectorMap) {
    this.map = map;
    this.list = map.sec.sectors;
    this.seen = new Uint32Array(this.list.length);
    this.list.forEach((s, i) => {
      this.index.set(s, i);
      let x = 0;
      let y = 0;
      for (const k of s.verts.keys()) {
        const e = this.edge(s, k);
        x += e.x0;
        y += e.y0;
      }
      const n = Math.max(1, s.verts.length);
      this.cx.push(x / n);
      this.cy.push(y / n);
      this.cz.push(groundZ(s, x / n, y / n));
    });
  }

  indexOf(s: Sector): number {
    return this.index.get(s) ?? -1;
  }

  private edge(s: Sector, i: number): Edge {
    const n = s.verts.length;
    const p = this.map.sec.verts[s.verts[i % n] ?? 0];
    const q = this.map.sec.verts[s.verts[(i + 1) % n] ?? 0];
    return { x0: p?.x ?? 0, y0: p?.y ?? 0, x1: q?.x ?? 0, y1: q?.y ?? 0 };
  }

  /** Recta normalizada de la arista (FUN_005F3D00): a·x + b·y + c = distancia con signo, positiva hacia el interior (polígonos antihorarios). */
  private line(e: Edge): { a: number; b: number; c: number } {
    const len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0);
    const a = -(e.y1 - e.y0) / len;
    const b = (e.x1 - e.x0) / len;
    return { a, b, c: -(a * e.x0 + b * e.y0) };
  }

  /**
   * Sector que contiene (x,y) siguiendo los vecinos desde `from` (FUN_005F9E60/FUN_005F6F70): si el punto cae del lado interior de todas las
   * aristas (distancia ≥ 0) es ese sector; si no, prueba primero los vecinos por las aristas que lo dejan afuera y luego por las demás.
   * null si no lo encuentra (el original cae a la búsqueda global).
   */
  follow(from: Sector, x: number, y: number): Sector | null {
    this.stamp++;
    return this.list[this.walk(this.indexOf(from), x, y)] ?? null;
  }

  private walk(si: number, x: number, y: number): number {
    const s = this.list[si];
    if (!s) return -1;
    this.seen[si] = this.stamp;
    const dist = s.verts.map((_, k) => {
      const { a, b, c } = this.line(this.edge(s, k));
      return a * x + b * y + c;
    });
    if (dist.every((d) => d >= 0)) return si;
    for (const outside of [true, false]) {
      for (let k = 0; k < dist.length; k++) {
        const ni = s.neighbors[k] ?? -1;
        if (ni < 0 || this.seen[ni] === this.stamp || (dist[k] ?? 0) < 0 !== outside) continue;
        const r = this.walk(ni, x, y);
        if (r >= 0) return r;
      }
    }
    return -1;
  }

  /** Escalón entre un sector y su vecino por la arista (FUN_00610D40). */
  private stepOk(si: number, ni: number, e: Edge): boolean {
    const s = this.list[si];
    const n = this.list[ni];
    if (!s || !n) return false;
    if (!(s.flags & SectorFlag.Inclin) && !(n.flags & SectorFlag.Inclin)) {
      const zs = this.cz[si] ?? 0;
      const zn = this.cz[ni] ?? 0;
      return !(zs + RISE < zn || zn < zs - DROP);
    }
    const ok = (zs: number, zn: number): boolean => !(zs + RISE < zn || zn < zs - DROP);
    return ok(groundZ(s, e.x0, e.y0), groundZ(n, e.x0, e.y0)) && ok(groundZ(s, e.x1, e.y1), groundZ(n, e.x1, e.y1));
  }

  /** ¿Está bloqueada la arista `e` de `si` para quien camina? (FUN_00611220; el vecino debe existir.) */
  private blocked(si: number, e: number, crouched: boolean): boolean {
    const s = this.list[si];
    const ni = s?.neighbors[e] ?? -1;
    const n = this.list[ni];
    if (!s || !n) return true;
    return !(
      n.type !== TYPE_DEEPWATER &&
      !(n.flags & (SectorFlag.NTrans | SectorFlag.NCamin)) &&
      this.stepOk(si, ni, this.edge(s, e)) &&
      (crouched || !(n.flags & SectorFlag.SoloAg))
    );
  }

  /** ¿Hay una arista bloqueada (o sin vecino) a menos de 11 u del punto, recorriendo los sectores vecinos? (FUN_00577770 + FUN_00610710) */
  private wallNear(start: number, x: number, y: number, crouched: boolean): boolean {
    this.stamp++;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const si = queue[q] ?? 0;
      const s = this.list[si];
      if (!s) continue;
      this.seen[si] = this.stamp;
      for (let k = 0; k < s.verts.length; k++) {
        const e = this.edge(s, k);
        const { a, b, c } = this.line(e);
        const d = a * x + b * y + c;
        if (!(d >= -0.01 && d < WALL_RADIUS)) continue;
        const t0 = (x - e.x0) * b - (y - e.y0) * a;
        const t1 = -(b * (x - e.x1) - a * (y - e.y1));
        if (!((t0 > 0 || d * d + t0 * t0 < WALL_RADIUS ** 2) && (t1 > 0 || d * d + t1 * t1 < WALL_RADIUS ** 2))) continue;
        const ni = s.neighbors[k] ?? -1;
        if (ni < 0 || this.blocked(si, k, crouched)) return true;
        if (this.seen[ni] !== this.stamp && queue.length < MAX_BFS) {
          this.seen[ni] = this.stamp;
          queue.push(ni);
        }
      }
    }
    return false;
  }

  /** Filtro a pie (FUN_006112B0): null si la arista está bloqueada; si no, márgenes por extremo (11 con pared cerca, 4 sin ella). */
  private cross(si: number, k: number, crouched: boolean): { w1: number; w2: number; bits: number } | null {
    const s = this.list[si];
    if (!s || this.blocked(si, k, crouched)) return null;
    const e = this.edge(s, k);
    const near0 = this.wallNear(si, e.x0, e.y0, crouched);
    const near1 = this.wallNear(si, e.x1, e.y1, crouched);
    return { w1: near0 ? WALL_RADIUS : CLEAR_MARGIN, w2: near1 ? WALL_RADIUS : CLEAR_MARGIN, bits: (near1 ? 2 : 0) | (near0 ? 1 : 0) };
  }

  /** (w1+w2)² ≤ largo² (FUN_00624140): el portal es lo bastante ancho. */
  private wideEnough(s: Sector, k: number, w: number): boolean {
    const e = this.edge(s, k);
    return w * w <= (e.x1 - e.x0) ** 2 + (e.y1 - e.y0) ** 2;
  }

  /** Arista por la que el rayo (p, dirección d) sale del sector, y el parámetro t del cruce (FUN_00624530). */
  private exitEdge(s: Sector, p: Vec, d: Vec): { edge: number; t: number } | null {
    const n = s.verts.length;
    const first = this.edge(s, 0);
    let px = first.x0 - p.x;
    let py = first.y0 - p.y;
    let prev = d.y * px - d.x * py;
    for (let i = 0; i < n; i++) {
      const e = this.edge(s, i);
      const qx = e.x1 - p.x;
      const qy = e.y1 - p.y;
      const cur = qx * d.y - qy * d.x;
      if (prev >= 0 && cur < 0) {
        const den = d.y * (qx - px) - d.x * (qy - py);
        return { edge: i, t: Math.abs(den) < 1e-4 ? 0.1 : (py * (qx - px) - px * (qy - py)) / den };
      }
      px = qx;
      py = qy;
      prev = cur;
    }
    return null;
  }

  /**
   * ¿Ve el ojo `a` (x,y,z del ojo) el ojo `b`? (FUN_005F9820): el rayo recorre los sectores arista a arista y en cada cruce debe pasar por encima del suelo más alto
   * de los dos sectores (pendiente exigida = (suelo − z_ojo) / distancia, la mayor de todos los cruces); por eso un borde de acantilado esconde lo que queda al pie.
   * shortcut: usa la salida de arista de FUN_00624530 (no se verificó que FUN_005F5B80 sea idéntica); no mira el flag Ocluso ni los volúmenes (`lineClear` lo hace);
   * si el sector de partida no sirve (posición vieja) o el rayo es vertical, no oculta; un borde sin vecino sí oculta. Cuándo mejorar: al leer FUN_005F5B80 y FUN_005F6C60.
   */
  sight(from: Sector, a: Vec & { z: number }, b: Vec & { z: number }): boolean {
    const d = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-6) return true;
    const slope = (b.z - a.z) / len;
    let need = -1e10;
    let cur = this.indexOf(from);
    for (let guard = 0; guard <= this.list.length; guard++) {
      const s = this.list[cur];
      const hit = s ? this.exitEdge(s, a, d) : null;
      if (!s || !hit || hit.t < 0) return guard === 0;
      if (hit.t > 1) return slope >= need;
      const n = this.list[s.neighbors[hit.edge] ?? -1];
      if (!n) return false;
      const x = a.x + d.x * hit.t;
      const y = a.y + d.y * hit.t;
      need = Math.max(need, (Math.max(groundZ(s, x, y), groundZ(n, x, y)) - a.z) / (hit.t * len + 1e-6));
      if (slope < need) return false;
      cur = s.neighbors[hit.edge] ?? -1;
    }
    return false;
  }

  /** Atajo de línea recta (FUN_00624840): sigue el segmento arista a arista; null si no llega al sector del destino por un camino libre. */
  private straight(start: Vec, from: number, goal: Vec, crouched: boolean): PathStep[] | null {
    const d = { x: goal.x - start.x, y: goal.y - start.y };
    const steps: PathStep[] = [];
    let cur = from;
    for (let guard = 0; guard <= this.list.length; guard++) {
      const s = this.list[cur];
      const hit = s ? this.exitEdge(s, start, d) : null;
      if (!s || !hit || hit.t < 0) return null;
      if (hit.t > 1) {
        steps.push({ sector: cur, edge: -1, w1: 0, w2: 0, bits: 0 });
        return steps;
      }
      const ni = s.neighbors[hit.edge] ?? -1;
      const m = ni < 0 ? null : this.cross(cur, hit.edge, crouched);
      if (!m || !this.wideEnough(s, hit.edge, m.w1 + m.w2)) return null;
      steps.push({ sector: cur, edge: hit.edge, ...m });
      cur = ni;
    }
    return null;
  }

  /** A* sobre sectores (FUN_00624B90): corta al generar el sector destino, por lo que la ruta no es necesariamente la óptima. */
  private search(start: Vec, from: number, goal: Vec, to: number, crouched: boolean): PathStep[] | null {
    const mid = (s: Sector, k: number): Vec => {
      const e = this.edge(s, k);
      return { x: (e.x0 + e.x1) * 0.5, y: (e.y0 + e.y1) * 0.5 };
    };
    const h = (si: number): number => Math.hypot(goal.x - (this.cx[si] ?? 0), goal.y - (this.cy[si] ?? 0));
    const nodes = new Map<number, Node>();
    const first: Node = { sector: from, g: 0, parent: null, entry: -1, w1: 0, w2: 0, bits: 0 };
    nodes.set(from, first);
    // lista abierta ordenada por f = g + h fijada al insertar (no se reordena al mejorar g); ante empate sale primero el más viejo
    const open: { f: number; node: Node }[] = [{ f: h(from), node: first }];
    const push = (node: Node): void => {
      const f = node.g + h(node.sector);
      let i = open.length;
      while (i > 0 && (open[i - 1]?.f ?? 0) > f) i--;
      open.splice(i, 0, { f, node });
    };
    while (open.length > 0) {
      const node = open.shift()?.node;
      const s = node ? this.list[node.sector] : undefined;
      if (!node || !s) break;
      for (let k = 0; k < s.verts.length; k++) {
        const ni = s.neighbors[k] ?? -1;
        if (ni < 0) continue;
        const m = this.cross(node.sector, k, crouched);
        if (!m || !this.wideEnough(s, k, m.w1 + m.w2)) continue;
        const enter = node.parent ? mid(this.list[node.parent.sector] as Sector, node.entry) : start;
        const exit = mid(s, k);
        const g = node.g + Math.hypot(exit.x - enter.x, exit.y - enter.y); // costo de sector (+0x1C) = 1.0 en el cargador
        const fresh: Node = { sector: ni, g, parent: node, entry: k, ...m };
        if (ni === to) return this.chain(fresh);
        const old = nodes.get(ni);
        if (!old) {
          nodes.set(ni, fresh);
          push(fresh);
        } else if (g < old.g) Object.assign(old, fresh); // actualiza sin reordenar ni reabrir
      }
    }
    return null;
  }

  /** Cadena de pasos desde el destino hacia atrás por los padres (FUN_00624050). */
  private chain(end: Node): PathStep[] {
    const out: PathStep[] = [];
    let step: PathStep = { sector: end.sector, edge: -1, w1: 0, w2: 0, bits: 0 };
    for (let n: Node | null = end; n; n = n.parent) {
      out.unshift(step);
      if (n.parent) step = { sector: n.parent.sector, edge: n.entry, w1: n.w1, w2: n.w2, bits: n.bits };
    }
    return out;
  }

  /** Cadena de sectores de `start` a `goal`, o null si no hay camino (buscaCamino -1). */
  steps(start: Vec, from: Sector, goal: Vec, to: Sector, crouched = false): PathStep[] | null {
    const a = this.indexOf(from);
    const b = this.indexOf(to);
    if (a < 0 || b < 0) return null;
    if (a === b) return [{ sector: a, edge: -1, w1: 0, w2: 0, bits: 0 }];
    return this.straight(start, a, goal, crouched) ?? this.search(start, a, goal, b, crouched);
  }

  /** Portal de un paso con los extremos recortados por sus márgenes (FUN_00625750): `right` junto al extremo 0, `left` junto al 1. */
  private portal(step: PathStep): { left: Vec; right: Vec } {
    const e = this.edge(this.list[step.sector] as Sector, step.edge);
    const len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0);
    const t1 = len <= 1 ? TINY_EDGE_CLIP : step.w1 / len;
    const t2 = len <= 1 ? TINY_EDGE_CLIP : step.w2 / len;
    return {
      right: { x: e.x0 * (1 - t1) + e.x1 * t1, y: e.y0 * (1 - t1) + e.y1 * t1 },
      left: { x: e.x1 * (1 - t2) + e.x0 * t2, y: e.y1 * (1 - t2) + e.y0 * t2 },
    };
  }

  /**
   * Puntos de giro y destino de una cadena (embudo sobre los portales recortados). No incluye el punto de partida.
   * La altura de cada punto es la del suelo del sector que deja (el último, la del sector destino).
   */
  waypoints(steps: readonly PathStep[], start: Vec, goal: Vec): Waypoint[] {
    const exits = steps.filter((s) => s.edge >= 0);
    const portals = [{ left: start, right: start }, ...exits.map((s) => this.portal(s)), { left: goal, right: goal }];
    const sectorOf = (i: number): Sector | undefined => this.list[(exits[i - 1] ?? steps[steps.length - 1])?.sector ?? -1];
    const out: Waypoint[] = [];
    let at = 0;
    const emit = (p: Vec): void => {
      const s = sectorOf(at);
      const q = { x: p.x, y: p.y, z: s ? groundZ(s, p.x, p.y) : 0 };
      if (out.length === 0 || !same(out[out.length - 1] as Vec, q)) out.push(q);
    };
    let apex = start;
    let left = start;
    let right = start;
    let li = 0;
    let ri = 0;
    for (let i = 1; i < portals.length; i++) {
      const p = portals[i] as { left: Vec; right: Vec };
      if (side(apex, right, p.right) >= 0) {
        if (same(apex, right) || side(apex, left, p.right) < 0) {
          right = p.right;
          ri = i;
        } else {
          at = li;
          emit(left);
          apex = left;
          right = left;
          ri = li;
          i = li;
          continue;
        }
      }
      if (side(apex, left, p.left) <= 0) {
        if (same(apex, left) || side(apex, right, p.left) > 0) {
          left = p.left;
          li = i;
        } else {
          at = ri;
          emit(right);
          apex = right;
          left = right;
          li = ri;
          i = ri;
        }
      }
    }
    at = portals.length - 1;
    emit(goal);
    return out;
  }

  /**
   * Ruta completa: puntos por los que pasar para ir de `start` (en `from`) a `goal` (en `to`); [] si ya está a menos de 2 u;
   * null si no hay camino o el destino no cae en un sector.
   */
  route(start: Vec, from: Sector, goal: Vec, to: Sector | null, crouched = false): Waypoint[] | null {
    if ((start.x - goal.x) ** 2 + (start.y - goal.y) ** 2 < ALREADY_THERE_D2) return [];
    const steps = to ? this.steps(start, from, goal, to, crouched) : null;
    return steps ? this.waypoints(steps, start, goal) : null;
  }
}

const cache = new WeakMap<SectorMap, Nav>();
/** Un `Nav` por mapa de sectores (calcula centroides una sola vez). */
export function navFor(map: SectorMap): Nav {
  let n = cache.get(map);
  if (!n) cache.set(map, (n = new Nav(map)));
  return n;
}
