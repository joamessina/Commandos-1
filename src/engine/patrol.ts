/**
 * Rutas de `acPatrulla` (docs/lectura/patrulla.md): lectura de `.PATRULLA [ [ .RUTA … .VEL … .TIPORUTA … .NOMBRE … ] ]` y el recorrido
 * punto a punto con las fases de llegada (girar a `ANGULO`, esperar `ESPERA` ciclos) y los tipos de ruta.
 * shortcut: sin contenedores (`CONT`/`CASA`) ni su espera de salida al cambiar de ruta. Cuándo mejorar: al portar habitáculos completos.
 */
import { asList, asNumber, asNumbers, asText, find, type Node } from '../formats/clave.ts';
import type { Difficulty } from './world.ts';

/** `TIPORUTA`: LOOP 0 · JUMP 2 · EXIT 3 · STOPPED 4 · cualquier otro texto (PINGPONG…) 1 = ida y vuelta; sin clave = 0. */
export const RouteType = { Loop: 0, PingPong: 1, Jump: 2, Exit: 3, Stopped: 4 } as const;
export type RouteType = (typeof RouteType)[keyof typeof RouteType];

export interface RoutePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Ciclos de espera al llegar. */
  readonly wait: number;
  /** Grados a los que gira al llegar (0 = no gira). */
  readonly angle: number;
  /** Velocidad del tramo hacia este punto (hereda la de la ruta). */
  readonly vel: number;
  /** Evento de misión emitido después de esperar en el punto. */
  readonly event?: string;
  /** Punto donde se admite un cambio de ruta pendiente. */
  readonly link?: boolean;
}

export interface Route {
  readonly name: string;
  readonly type: RouteType;
  readonly points: readonly RoutePoint[];
}

const DEFAULT_VEL = 1.5; // 0x793E4C

function routeType(t: string | undefined): RouteType {
  if (t === undefined) return RouteType.Loop;
  switch (t.toUpperCase()) {
    case 'LOOP':
      return RouteType.Loop;
    case 'JUMP':
      return RouteType.Jump;
    case 'EXIT':
      return RouteType.Exit;
    case 'STOPPED':
      return RouteType.Stopped;
    default:
      return RouteType.PingPong;
  }
}

/**
 * Rutas de los parámetros de una acción `acPatrulla`. `NOMBRE` con prefijo `FACIL_`/`DIFICIL_` solo vale con esa dificultad
 * (el nombre guardado es sin prefijo); sin prefijo vale siempre.
 */
export function parseRoutes(params: readonly Node[], difficulty: Difficulty): Route[] {
  const out: Route[] = [];
  for (const r of asList(find(params, '.PATRULLA')) ?? []) {
    const rt = asList(r);
    if (!rt) continue;
    let name = asText(find(rt, '.NOMBRE')) ?? '';
    const m = /^(FACIL|DIFICIL)_(.*)$/i.exec(name);
    if (m) {
      if ((m[1] ?? '').toUpperCase() !== difficulty) continue;
      name = m[2] ?? '';
    }
    const vel = asNumber(find(rt, '.VEL')) ?? DEFAULT_VEL;
    const points: RoutePoint[] = [];
    for (const p of asList(find(rt, '.RUTA')) ?? []) {
      const pl = asList(p);
      const xyz = asNumbers(find(pl ?? [], '.XYZ'));
      if (!pl || xyz?.length !== 3) continue;
      const event = asText(find(pl, '.EVENTO'));
      const link = asNumber(find(pl, '.ENLAZAR'));
      points.push({
        x: xyz[0] ?? 0,
        y: xyz[1] ?? 0,
        z: xyz[2] ?? 0,
        wait: asNumber(find(pl, '.ESPERA')) ?? 0,
        angle: asNumber(find(pl, '.ANGULO')) ?? 0,
        vel: asNumber(find(pl, '.VELOCIDADTRAMO')) ?? vel,
        ...(event ? { event: event.toUpperCase() } : {}),
        ...(link ? { link: true } : {}),
      });
    }
    out.push({ name, type: routeType(asText(find(rt, '.TIPORUTA'))), points });
  }
  return out;
}

/** Qué hace el recorrido en este ciclo (el soldado lo traduce a órdenes de motor). */
export type PatrolStep =
  | { readonly kind: 'goto'; readonly point: RoutePoint }
  | { readonly kind: 'face'; readonly angle: number }
  | { readonly kind: 'wait' }
  | { readonly kind: 'jump'; readonly point: RoutePoint }
  | { readonly kind: 'event'; readonly event: string }
  | { readonly kind: 'idle' };

/**
 * Recorrido de una ruta (`FUN_0048E530` + `FUN_0048DF00` + `FUN_0048C500`): ir al punto → al llegar, girar a ANGULO → esperar ESPERA ciclos →
 * siguiente punto según el tipo. `arrive()` lo llama el soldado cuando el motor alcanzó el destino.
 */
export class Patrol {
  private idx = 0;
  private previous = 0;
  private dir = 1;
  private phase: 'go' | 'face' | 'wait' | 'event' | 'done' = 'go';
  private wait = 0;
  private sent = false;
  route: Route;
  private readonly routes: readonly Route[];
  private waitingForEvent: boolean;
  private requested: Route | null = null;

  constructor(route: Route, alternatives: readonly Route[] = [], waitEvent = false) {
    this.route = route;
    this.routes = [route, ...alternatives];
    this.waitingForEvent = waitEvent;
    if (route.points.length === 0) this.phase = 'done';
  }

  /** `MSGA_TRIGGER_REACT`: solicita la ruta cuyo nombre coincide con el evento. */
  trigger(event: string): boolean {
    if (this.phase === 'done' && this.route.type === RouteType.Exit) return false;
    const candidates = this.routes.filter((r) => r.name.toUpperCase() === event.toUpperCase());
    const next = candidates[candidates.length - 1];
    if (!next || (next === this.route && !this.waitingForEvent)) return false;
    this.requested = next;
    return true;
  }

  get target(): RoutePoint | null {
    return this.route.points[this.idx] ?? null;
  }

  private movingPoint(): RoutePoint | null {
    const point = this.target;
    if (!point) return null;
    if (this.route.type !== RouteType.PingPong || this.dir >= 0) return point;
    const previous = this.route.points[this.previous];
    return previous ? { ...point, vel: previous.vel } : point;
  }

  /** Orden de motor pendiente de enviar de nuevo (p. ej. tras una reacción que interrumpió el camino). */
  resend(): void {
    this.sent = false;
    if (this.phase === 'face' || this.phase === 'wait') this.phase = 'go';
  }

  /** Un ciclo: devuelve lo que hay que hacer. `arrived` = el motor llegó al destino. */
  step(arrived: boolean): PatrolStep {
    if (this.requested && (this.waitingForEvent || (this.target?.link && (arrived || this.phase !== 'go')))) {
      this.route = this.requested;
      this.requested = null;
      this.waitingForEvent = false;
      this.idx = 0;
      this.previous = 0;
      this.dir = 1;
      this.phase = 'go';
      this.sent = false;
    }
    if (this.waitingForEvent) return { kind: 'idle' };
    const pt = this.target;
    if (!pt || this.phase === 'done') return { kind: 'idle' };
    if (this.phase === 'event') return this.advance();
    if (this.phase === 'go') {
      if (!this.sent) {
        this.sent = true;
        return { kind: 'goto', point: this.movingPoint() ?? pt };
      }
      if (!arrived) return { kind: 'wait' };
      this.phase = pt.angle !== 0 ? 'face' : 'wait';
      this.wait = pt.wait;
      return pt.angle !== 0 ? { kind: 'face', angle: pt.angle } : this.step(true);
    }
    if (this.phase === 'face') {
      this.phase = 'wait';
      return { kind: 'face', angle: pt.angle };
    }
    if (this.wait > 0) {
      this.wait--;
      return { kind: 'wait' };
    }
    if (pt.event) {
      this.phase = 'event';
      return { kind: 'event', event: pt.event };
    }
    return this.advance();
  }

  /** `FUN_0048C500`: siguiente punto según el tipo de ruta. */
  private advance(): PatrolStep {
    const n = this.route.points.length;
    this.previous = this.idx;
    this.idx += this.dir;
    if (this.idx >= n || this.idx < 0) {
      switch (this.route.type) {
        case RouteType.Loop:
          this.idx = 0;
          break;
        case RouteType.PingPong:
          this.dir = -this.dir;
          this.idx = Math.max(0, Math.min(n - 1, this.idx + 2 * this.dir));
          break;
        case RouteType.Jump: {
          this.idx = Math.min(1, n - 1);
          this.phase = 'go';
          this.sent = false; // se teletransporta al punto 0 y el ciclo siguiente va hacia el 1
          const p0 = this.route.points[0];
          if (p0) return { kind: 'jump', point: p0 };
          break;
        }
        case RouteType.Exit:
        case RouteType.Stopped:
          this.idx = Math.max(0, Math.min(n - 1, this.idx - this.dir));
          this.phase = 'done';
          return { kind: 'idle' };
      }
    }
    this.phase = 'go';
    this.sent = true;
    const pt = this.movingPoint();
    return pt ? { kind: 'goto', point: pt } : { kind: 'idle' };
  }
}
