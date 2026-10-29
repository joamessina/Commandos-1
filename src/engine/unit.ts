/**
 * Un comando en el mundo: cuerpo (walk.ts) + animador (anim.ts), con el flujo de docs/research/q1-movimiento.md §R1:
 * el clic fija un destino y la animación (ANDAR/CORRE) se elige por nombre; la velocidad la decide el motor
 * (2.5 al andar; correr según personaje), NO la animación. La animación avanza por distancia recorrida sobre el rumbo.
 * Con un SectorMap: suelo = plano del sector, destino y pasos validados (docs/research/q1-movimiento.md §R4); agua ×0.5.
 * Rutas (R3, docs/research/q1-rutas.md): `goTo` pide a `Nav` la cadena de sectores (atajo recto o A*) y camina por sus puntos de giro; sin camino la orden se rechaza.
 * Atasco: 9 ciclos sin avanzar (FUN_00629EF0) y la orden se abandona (TPathTool::abandona, FUN_006281A0: para el motor y, si faltan menos de 10 u al
 * destino, la da por cumplida; si no, resetea. NO re-planifica). shortcut: sin escaleras/PEscal (bit 4) ni agua/buceo en la ruta.
 * shortcut: al detenerse la secuencia queda en el paso donde estaba (no se leyó cómo el original elige la pose de reposo),
 *           cuándo mejorar: al leer REPOSO/AGACHARSE y el estado de animación del bicho.
 */
import type { Anm } from '../formats/anm.ts';
import type { Sector } from '../formats/sec.ts';
import { Animator } from './anim.ts';
import { navFor, type Nav } from './path.ts';
import { COS50, groundZ, isWater, SIN50, simBlocked, stepOk, validTarget, type SectorMap } from './sectors.ts';
import { newBody, runSpeed, stepBody, WALK_SPEED, type Body, type Vec } from './walk.ts';

export { COS50, SIN50 };

/** Mundo (x,y,z) -> píxel de mapa. Verificado con 19 edificios del mapa 0 (mediana 0,3 px): docs/research/q1-render.md. */
export const project = (x: number, y: number, z: number): { px: number; py: number } => ({ px: x, py: COS50 * y - SIN50 * z });

/** Inversa de `project` para un plano z conocido. */
export const unproject = (px: number, py: number, z: number): Vec => ({ x: px, y: (py + SIN50 * z) / COS50 });

/** Ciclos seguidos sin avanzar que disparan un nuevo plan (FUN_00629EF0: `param_1[5] < 9`). */
const STUCK_CYCLES = 9;

/** Punto del mundo con la altura del suelo en él. */
export interface Vec3 extends Vec {
  z: number;
}

export class Unit {
  readonly body: Body;
  readonly anim: Animator;
  /** Destino final de la orden vigente (con la altura del suelo ahí, para dibujarlo). */
  target: Vec3 | null = null;
  /** Puntos que faltan hasta `target` (el primero es al que va el cuerpo). */
  private path: Vec3[] = [];
  private stuck = 0;
  private readonly nav: Nav | null;
  running = false;
  /** Sector que pisa (null sin mapa de sectores o fuera de todos). */
  sector: Sector | null = null;

  constructor(
    readonly token: string,
    anm: Anm,
    x: number,
    y: number,
    /** Altura del suelo en el punto: la del plano del sector si hay mapa de sectores; si no, la del `.XYZ` (shortcut: suelo plano). */
    public z: number,
    angle: number,
    private readonly sectors: SectorMap | null = null,
  ) {
    this.body = newBody(x, y, angle);
    this.anim = new Animator(anm, 'ANDAR');
    this.nav = sectors ? navFor(sectors) : null;
    this.land();
  }

  /**
   * Ordena caminar (o correr) hasta un punto del mundo. Devuelve false si el destino no es transitable (FUN_0053A250).
   * `to` = sector del destino: quien da la orden lo recibe del picking del cursor (SectorMap.pick, FUN_00628470 lo toma como parámetro).
   * shortcut: sin `to`, sale de atZ con la z del comando; cuándo mejorar: si algún llamador no pasa por el cursor.
   */
  goTo(p: Vec, run: boolean, to: Sector | null = this.sectors?.atZ(p.x, p.y, this.z) ?? null): boolean {
    if (this.sectors && !validTarget(to)) return false;
    const goalZ = to ? groundZ(to, p.x, p.y) : this.z;
    let path: Vec3[] = [{ ...p, z: goalZ }];
    if (this.nav) {
      const route = this.sector ? this.nav.route(this.body, this.sector, p, to) : null;
      if (!route) return false;
      if (route.length === 0) return true; // ya está a menos de 2 u: la orden se ignora
      path = route;
    }
    this.path = path;
    this.stuck = 0;
    this.target = { ...p, z: goalZ };
    this.running = run;
    const run1 = ['CORRE', 'CORRER'].find((n) => this.anim.has(n));
    this.anim.set(run && run1 ? run1 : 'ANDAR');
    return true;
  }

  /**
   * Sector en (x,y): siguiendo los vecinos del actual (FUN_005F9E60, así se sube a un puente o piso B que la vecindad enlaza);
   * si no, búsqueda global con z. shortcut: el original cae a FUN_005F6C60 (sin z); atZ evita elegir un B que está por encima.
   */
  private sectorAt(x: number, y: number): Sector | null {
    return (this.sector && this.nav?.follow(this.sector, x, y)) || (this.sectors?.atZ(x, y, this.z) ?? null);
  }

  /** Sector y altura del suelo bajo el cuerpo. */
  private land(): void {
    const s = this.sectorAt(this.body.x, this.body.y);
    this.sector = s;
    if (s) this.z = groundZ(s, this.body.x, this.body.y);
  }

  /** ¿Puede pisar (x,y)? Sector transitable y escalón dentro de [-20,+15] respecto del suelo actual. */
  private blocked = (x: number, y: number): boolean => {
    if (!this.sectors) return false;
    const s = this.sectorAt(x, y);
    return !s || simBlocked(s) || (s !== this.sector && !stepOk(groundZ(s, x, y) - this.z));
  };

  /** Un ciclo de lógica (1/20 s). */
  tick(): void {
    const v = this.running ? runSpeed(this.token) : WALK_SPEED;
    const wp = this.path[0] ?? null;
    const r = stepBody(this.body, wp, v, isWater(this.sector) ? 0.5 : 1, this.blocked);
    this.land();
    if (wp && r.arrived) {
      this.path.shift();
      if (this.path.length === 0) this.target = null;
    } else if (wp) this.watchStuck(r.dx, r.dy);
    const rad = (this.body.ang * Math.PI) / 180;
    this.anim.advance(r.dx * Math.cos(rad) + r.dy * Math.sin(rad), 1); // distancia sobre el rumbo (FUN_00591DE0)
  }

  /** Cuenta ciclos sin avanzar y, al llegar a 9, abandona la orden (cumplida si faltan < 10 u, reseteada si no: en ambos casos el comando se queda). */
  private watchStuck(dx: number, dy: number): void {
    this.stuck = dx * dx + dy * dy < 1e-4 ? this.stuck + 1 : 0;
    if (this.stuck < STUCK_CYCLES) return;
    this.stuck = 0;
    this.path = [];
    this.target = null;
  }

  /** Puntos que faltan hasta el destino (para dibujar la ruta). */
  get waypoints(): readonly Vec3[] {
    return this.path;
  }

  get moving(): boolean {
    return this.target !== null || Math.abs(this.body.vx) + Math.abs(this.body.vy) > 0.001;
  }
}
