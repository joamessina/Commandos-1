/**
 * `Vista01` (docs/engine/percepcion.md §3.2-3.3, exe `0x61B7C0` radios y semiplanos, `0x61B380` rango, `0x61B490` ángulo):
 * un elemento E es visto si está dentro del alcance (la mitad si E está agachado o buceando) y dentro del cono, con el radio de E como margen,
 * y nada oculta el rayo. Defectos del MAC: alcance 800, apertura total 70°, de día la luz global es 1 (A4 = A0, sin zona intermedia).
 * shortcut: la oclusión real (`0x5F9820` recorre sectores/portales y `0x63E200` los volúmenes) no se leyó a fondo; aquí el rayo se muestrea cada
 *           8 u y se corta en un sector con el flag Ocluso (0x10), sin mirar alturas ni volúmenes; sin luz/noche. Cuándo mejorar: al leer 0x5F9820.
 */
import { asList, asNumber, find, type Node } from '../formats/clave.ts';
import { SectorFlag } from '../formats/sec.ts';
import { groundZ, type SectorMap } from './sectors.ts';

const RAD = Math.PI / 180;

/** Un sector Ocluso solo tapa la vista si su suelo no queda por debajo de los pies del observador en más de esto (la roca de abajo no tapa a quien mira desde una torre). */
const OCCLUDER_DROP = 15;

export interface Viewer {
  readonly x: number;
  readonly y: number;
  /** Altura del suelo del observador; sin ella (pruebas) cualquier sector Ocluso tapa. */
  readonly z?: number;
  /** Centro del cono en grados de mundo (rumbo del cuerpo + giro de cabeza). */
  readonly heading: number;
  /** Alcance (`+0x64`). */
  readonly range?: number;
  /** Apertura total (`+0x68`). */
  readonly angle?: number;
}

export interface Seen {
  readonly x: number;
  readonly y: number;
  /** Radio del cilindro de E (`+0x54`): margen del test de ángulo. */
  readonly radius: number;
  /** Agachado o buceando: alcance a la mitad. */
  readonly low: boolean;
}

/** `.ORGANOS [ .VISTA [ Vista01 [ .MOD n .ANG a ] ] ]` de un bloque expandido: `.MOD` guarda `2·n` en el órgano (percepcion.md §3.1); sin claves, los defectos (800, 70°). */
export function vistaOf(block: readonly Node[]): { range?: number; angle?: number } {
  const vista = asList(find(asList(find(block, '.ORGANOS')) ?? [], '.VISTA')) ?? [];
  const params = asList(vista[1]) ?? [];
  const mod = asNumber(find(params, '.MOD'));
  const ang = asNumber(find(params, '.ANG'));
  return { ...(mod === undefined ? {} : { range: mod * 2 }), ...(ang === undefined ? {} : { angle: ang }) };
}

export const DEFAULT_RANGE = 800;
export const DEFAULT_ANGLE = 70;

/** ¿Está E dentro del cono de V (alcance y ángulo)? Sin oclusión. */
export function inCone(v: Viewer, e: Seen): boolean {
  const range = v.range ?? DEFAULT_RANGE;
  const dx = e.x - v.x;
  const dy = e.y - v.y;
  const d2 = dx * dx + dy * dy;
  const reach = e.low ? range * 0.5 : range;
  if (d2 > reach * reach) return false;
  const half = (v.angle ?? DEFAULT_ANGLE) / 2;
  const a1 = (v.heading - half) * RAD;
  const a2 = (v.heading + half) * RAD;
  const r = e.radius;
  const n1 = dx * -Math.sin(a1) + dy * Math.cos(a1);
  const n2 = dx * Math.sin(a2) + dy * -Math.cos(a2);
  const n3 = dx * ((Math.cos(a1) + Math.cos(a2)) / 2) + dy * ((Math.sin(a1) + Math.sin(a2)) / 2);
  return n1 > -r && n2 > -r && n3 > 0;
}

const blocks = (s: Parameters<typeof groundZ>[0], x: number, y: number, z: number | undefined): boolean => z === undefined || groundZ(s, x, y) > z - OCCLUDER_DROP;

/** ¿Pasa el rayo de (ax,ay) a (bx,by) sin cruzar un sector Ocluso (ignorando el del observador y el del blanco)? */
export function lineClear(sectors: SectorMap | null, ax: number, ay: number, bx: number, by: number, z?: number): boolean {
  if (!sectors) return true;
  const own = sectors.at(ax, ay);
  const goal = sectors.at(bx, by);
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < n; i++) {
    const s = sectors.at(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
    const x = ax + ((bx - ax) * i) / n;
    const y = ay + ((by - ay) * i) / n;
    if (s && s !== own && s !== goal && (s.flags & SectorFlag.Ocluso) !== 0 && blocks(s, x, y, z)) return false;
  }
  return true;
}

/** Vista completa: cono y rayo despejado. */
export const sees = (v: Viewer, e: Seen, sectors: SectorMap | null): boolean => inCone(v, e) && lineClear(sectors, v.x, v.y, e.x, e.y, v.z);

/** Hasta dónde llega un rayo desde (x,y) con rumbo `ang` (rad) antes de entrar en un sector Ocluso o de llegar a `range` (el mismo corte que `lineClear`). */
export function rayReach(sectors: SectorMap | null, x: number, y: number, ang: number, range: number, z?: number): number {
  if (!sectors) return range;
  const own = sectors.at(x, y);
  for (let d = 8; d < range; d += 8) {
    const px = x + Math.cos(ang) * d;
    const py = y + Math.sin(ang) * d;
    const s = sectors.at(px, py);
    if (s && s !== own && (s.flags & SectorFlag.Ocluso) !== 0 && blocks(s, px, py, z)) return d;
  }
  return range;
}
