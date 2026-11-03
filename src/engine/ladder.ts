/**
 * Escaleras (`ESCALA.MAC`, `acEscala`) y montacargas (`AcAscensor`, `.RAIL`): docs/research/q1-escaleras.md §2-§4c y docs/lectura/obj-contenedores.md §4.
 * La trepada es la del `SimEscalador`: z exacta por ciclo (+2 subiendo, remate +4, bajando −4 y −3), el cuerpo pegado a la pared entre el punto de abajo y el de arriba.
 * shortcut: el giro previo a la escalera (subestado 6) y la rotación son instantáneos; bajar usa ESCALAR_CICLICO en vez de ESCALAR_FIN a velocidad −1 (el animador no
 *           corre al revés); los soldados las usan solo si a pie no hay camino (`Unit.ladders`, unit.ts) y no se porta el daño de 10 al comando con que chocan trepando (`FUN_004F3C70`); el umbral de arranque (subir > 15, bajar > 20) se aplica
 *           al desnivel de la escalera; el montacargas se mueve a STDVEL 8 u/ciclo (MotorRail, el 0,02 de `SETRAIL` no está interpretado) y se activa con la tecla A.
 */
import { asList, asNumbers, asText, find, type Node } from '../formats/clave.ts';
import { groundZ, type SectorMap } from './sectors.ts';
import type { Elem } from './world.ts';

export interface P3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Ladder {
  readonly token: string;
  readonly low: P3;
  readonly high: P3;
  /** `.CAJASELECCION [x y ancho alto]` en píxeles del mapa; null si la escalera no la trae. */
  readonly box: readonly [number, number, number, number] | null;
  /** `ESCALAUSABLEPORBUZO`. */
  readonly diver: boolean;
  /** Desactivada (`MSGA_DESACTIVAR_ESCALA`, p. ej. ESCALA02 al caer CASA04). */
  disabled: boolean;
}

/** Desnivel mínimo para que arranque la trepada de un comando (`MotorAliado`: subir 15, bajar 20). */
export const CLIMB_UP_MIN = 15;
export const CLIMB_DOWN_MIN = 20;

const p3 = (n: Node | undefined): P3 | null => {
  const v = asNumbers(n);
  return v?.length === 3 ? { x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 } : null;
};

/** Escaleras de una misión: elementos de macro ESCALA con su `acEscala`. */
export function parseLadders(elems: readonly Elem[], sectors?: SectorMap | null): Ladder[] {
  const out: Ladder[] = [];
  for (const e of elems) {
    const a = e.actions.find((x) => x.name.toUpperCase() === 'ACESCALA');
    if (!a) continue;
    const low = p3(find(a.params, '.PUNTOBAJO'));
    const high = p3(find(a.params, '.PUNTOALTO'));
    if (!low || !high) continue;
    const b = asNumbers(find(a.params, '.CAJASELECCION'));
    out.push({
      token: e.token,
      low,
      high,
      box: b?.length === 4 ? [b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0] : sectors ? autoBox(low, high, sectors) : null,
      diver: asText(find(e.block, '.ESCALAUSABLEPORBUZO')) === '1',
      disabled: false,
    });
  }
  return out;
}

const COS50 = Math.cos((50 * Math.PI) / 180);
const SIN50 = Math.sin((50 * Math.PI) / 180);
const proj = (p: P3): { x: number; y: number } => ({ x: p.x, y: COS50 * p.y - SIN50 * p.z });

/** FUN_004A7420/004A7950/004A75F0: caja automática sobre la arista entre los dos sectores. */
function autoBox(low: P3, high: P3, map: SectorMap): readonly [number, number, number, number] | null {
  const lower = map.at(low.x, low.y);
  const upper = map.at(high.x, high.y);
  if (!lower || !upper || lower === upper) return null;
  const index = map.sec.sectors.indexOf(lower);
  for (let i = 0; i < upper.verts.length; i++) {
    if (upper.neighbors[i] !== index) continue;
    const a = map.sec.verts[upper.verts[i] ?? -1];
    const b = map.sec.verts[upper.verts[(i + 1) % upper.verts.length] ?? -1];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const t = ((high.x - a.x) * dx + (high.y - a.y) * dy) / (len * len);
    if (t < 0 || t > 1) continue;
    const nx = -dy / len, ny = dx / len;
    const x = a.x + t * dx + nx * 0.1, y = a.y + t * dy + ny * 0.1;
    const height = Math.round(groundZ(upper, x, y) - groundZ(lower, x, y));
    if (height <= 10) continue;
    const p = proj({ x, y, z: high.z - height });
    const left = Math.round(p.x) - 10, top = Math.round(p.y) + 10 - height;
    return ny >= 0 ? [left, top - 40, 40, 40] : [left, top, 20, height];
  }
  return null;
}

/** Escalera bajo el cursor. shortcut: sin caja explícita aproxima la caja automática de FUN_004A75F0 con los extremos. */
export function pickLadder(ladders: readonly Ladder[], px: number, py: number): Ladder | null {
  for (const l of ladders) {
    if (l.box) {
      if (px >= l.box[0] && px <= l.box[0] + l.box[2] && py >= l.box[1] && py <= l.box[1] + l.box[3]) return l;
      continue;
    }
    for (const e of [l.low, l.high]) {
      const q = proj(e);
      if (Math.hypot(px - q.x, py - q.y + 20) < 24) return l;
    }
  }
  return null;
}

/** Estado de una trepada en curso (subestados 7-12 del `MotorAndante`). */
export interface Climb {
  readonly ladder: Ladder;
  dir: 1 | -1;
  phase: 'up' | 'top' | 'out' | 'down' | 'low';
  /** `motor+0x120`: arranca en 40. */
  off: number;
  paused: boolean;
}

export const newClimb = (ladder: Ladder, dir: 1 | -1): Climb => ({ ladder, dir, phase: dir > 0 ? 'up' : 'down', off: 40, paused: false });

/** Da vuelta a la trepada (clic izquierdo más alto o más bajo que el comando con la acción pausada, FUN_005DB5A0). */
export function reverse(c: Climb, dir: 1 | -1): void {
  c.paused = false;
  if (c.dir === dir) return;
  c.dir = dir;
  c.off = 40;
  c.phase = dir > 0 ? 'up' : 'down';
}

/**
 * Un ciclo de trepada: devuelve la nueva z y la fracción 0..1 del recorrido (para el xy pegado a la pared) y si terminó. Sin mutar nada fuera de `c`.
 */
export function stepClimb(c: Climb, z: number): { z: number; done: boolean } {
  const l = c.ladder;
  if (c.paused) return { z, done: false };
  if (c.dir > 0) {
    if (c.phase === 'up') {
      if (z + c.off <= l.high.z + 15) return { z: z + 2, done: false };
      c.phase = 'top';
    }
    if (c.phase === 'top') {
      c.off = Math.max(0, c.off - 4);
      const nz = Math.min(z + 4, l.high.z);
      if (nz >= l.high.z) c.phase = 'out';
      return { z: nz, done: false };
    }
    c.off += 8;
    return { z: l.high.z, done: c.off >= 40 };
  }
  if (c.phase === 'down') {
    if (z - l.low.z > 15) return { z: Math.max(z - 4, l.low.z), done: false };
    c.phase = 'low';
  }
  const nz = Math.max(z - 3, l.low.z);
  return { z: nz, done: nz <= l.low.z };
}

/** Posición xy pegada a la escalera para una z dada. */
export function wallXY(l: Ladder, z: number): { x: number; y: number } {
  const span = l.high.z - l.low.z;
  const f = span === 0 ? 0 : Math.max(0, Math.min(1, (z - l.low.z) / span));
  return { x: l.low.x + (l.high.x - l.low.x) * f, y: l.low.y + (l.high.y - l.low.y) * f };
}

/** Montacargas `.RAIL [ [A] [B] ]` (`AcAscensor`): al activarlo va al extremo más lejano llevando a quienes están sobre él. */
export class Lift {
  readonly a: P3;
  readonly b: P3;
  /** Distancia recorrida desde A (0..largo). */
  s = 0;
  private target: 0 | 1 | null = null;
  private readonly len: number;

  constructor(a: P3, b: P3) {
    this.a = a;
    this.b = b;
    this.len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }

  get pos(): P3 {
    const f = this.len === 0 ? 0 : this.s / this.len;
    return { x: this.a.x + (this.b.x - this.a.x) * f, y: this.a.y + (this.b.y - this.a.y) * f, z: this.a.z + (this.b.z - this.a.z) * f };
  }

  get moving(): boolean {
    return this.target !== null;
  }

  /** `MSGA_ACTIVA_ASCENSOR`: destino = el extremo más lejano del actual (en xy). */
  activate(): void {
    const p = this.pos;
    this.target = Math.hypot(p.x - this.a.x, p.y - this.a.y) >= Math.hypot(p.x - this.b.x, p.y - this.b.y) ? 0 : 1;
  }

  /** Un ciclo a 8 u/ciclo (STDVEL de `MotorRail`); devuelve el desplazamiento de este ciclo. */
  tick(): P3 {
    const before = this.pos;
    if (this.target !== null) {
      const goal = this.target === 0 ? 0 : this.len;
      const d = goal - this.s;
      this.s += Math.sign(d) * Math.min(8, Math.abs(d));
      if (Math.abs(goal - this.s) < 1e-9) this.target = null;
    }
    const after = this.pos;
    return { x: after.x - before.x, y: after.y - before.y, z: after.z - before.z };
  }
}

/** Parsea `.RAIL [ [x y z] [x y z] ]` de la acción AcAscensor de un elemento. */
export function parseLift(e: Elem): Lift | null {
  const a = e.actions.find((x) => x.name.toUpperCase() === 'ACASCENSOR');
  const rail = asList(find(a?.params ?? [], '.RAIL'));
  const pa = p3(rail?.[0]);
  const pb = p3(rail?.[1]);
  return pa && pb ? new Lift(pa, pb) : null;
}
