/**
 * Un comando en el mundo: cuerpo (walk.ts) + animador (anim.ts), con el flujo de docs/research/q1-movimiento.md §R1:
 * el clic fija un destino y la animación (ANDAR/CORRE) se elige por nombre; la velocidad la decide el motor
 * (2.5 al andar; correr según personaje), NO la animación. La animación avanza por distancia recorrida sobre el rumbo.
 * Con un SectorMap: suelo = plano del sector, destino y pasos validados (docs/research/q1-movimiento.md §R4); agua ×0.5.
 * shortcut: sin rutas (R3): una pared entre el comando y el destino lo deja empujando contra ella;
 *           sin escaleras/PEscal ni comprobación de arista a arista (FUN_005F62F0), solo del punto de llegada.
 * shortcut: al detenerse la secuencia queda en el paso donde estaba (no se leyó cómo el original elige la pose de reposo),
 *           cuándo mejorar: al leer REPOSO/AGACHARSE y el estado de animación del bicho.
 */
import type { Anm } from '../formats/anm.ts';
import type { Sector } from '../formats/sec.ts';
import { Animator } from './anim.ts';
import { groundZ, isWater, simBlocked, stepOk, validTarget, type SectorMap } from './sectors.ts';
import { newBody, runSpeed, stepBody, WALK_SPEED, type Body, type Vec } from './walk.ts';

export const COS50 = Math.cos((50 * Math.PI) / 180);
export const SIN50 = Math.sin((50 * Math.PI) / 180);

/** Mundo (x,y,z) -> píxel de mapa. Verificado con 19 edificios del mapa 0 (mediana 0,3 px): docs/research/q1-render.md. */
export const project = (x: number, y: number, z: number): { px: number; py: number } => ({ px: x, py: COS50 * y - SIN50 * z });

/** Inversa de `project` para un plano z conocido. */
export const unproject = (px: number, py: number, z: number): Vec => ({ x: px, y: (py + SIN50 * z) / COS50 });

export class Unit {
  readonly body: Body;
  readonly anim: Animator;
  target: Vec | null = null;
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
    this.land();
  }

  /** Ordena caminar (o correr) hasta un punto del mundo. Devuelve false si el destino no es transitable (FUN_0053A250). */
  goTo(p: Vec, run: boolean): boolean {
    if (this.sectors && !validTarget(this.sectors.at(p.x, p.y))) return false;
    this.target = p;
    this.running = run;
    const run1 = ['CORRE', 'CORRER'].find((n) => this.anim.has(n));
    this.anim.set(run && run1 ? run1 : 'ANDAR');
    return true;
  }

  /** Sector y altura del suelo bajo el cuerpo. */
  private land(): void {
    const s = this.sectors?.atZ(this.body.x, this.body.y, this.z) ?? null;
    this.sector = s;
    if (s) this.z = groundZ(s, this.body.x, this.body.y);
  }

  /** ¿Puede pisar (x,y)? Sector transitable y escalón dentro de [-20,+15] respecto del suelo actual. */
  private blocked = (x: number, y: number): boolean => {
    if (!this.sectors) return false;
    const s = this.sectors.atZ(x, y, this.z);
    return !s || simBlocked(s) || (s !== this.sector && !stepOk(groundZ(s, x, y) - this.z));
  };

  /** Un ciclo de lógica (1/20 s). */
  tick(): void {
    const v = this.running ? runSpeed(this.token) : WALK_SPEED;
    const r = stepBody(this.body, this.target, v, isWater(this.sector) ? 0.5 : 1, this.blocked);
    this.land();
    if (r.arrived) this.target = null;
    const rad = (this.body.ang * Math.PI) / 180;
    this.anim.advance(r.dx * Math.cos(rad) + r.dy * Math.sin(rad), 1); // distancia sobre el rumbo (FUN_00591DE0)
  }

  get moving(): boolean {
    return this.target !== null || Math.abs(this.body.vx) + Math.abs(this.body.vy) > 0.001;
  }
}
