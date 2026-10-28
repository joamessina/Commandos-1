/**
 * Un comando en el mundo: cuerpo (walk.ts) + animador (anim.ts), con el flujo de docs/research/q1-movimiento.md §R1:
 * el clic fija un destino y la animación (ANDAR/CORRE) se elige por nombre; la velocidad la decide el motor
 * (2.5 al andar; correr según personaje), NO la animación. La animación avanza por distancia recorrida sobre el rumbo.
 * shortcut: al detenerse la secuencia queda en el paso donde estaba (no se leyó cómo el original elige la pose de reposo),
 *           cuándo mejorar: al leer REPOSO/AGACHARSE y el estado de animación del bicho.
 */
import type { Anm } from '../formats/anm.ts';
import { Animator } from './anim.ts';
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

  constructor(
    readonly token: string,
    anm: Anm,
    x: number,
    y: number,
    /** Altura del suelo en el punto (hoy fija: shortcut, sin sectores .SEC). */
    readonly z: number,
    angle: number,
  ) {
    this.body = newBody(x, y, angle);
    this.anim = new Animator(anm, 'ANDAR');
  }

  /** Ordena caminar (o correr) hasta un punto del mundo. */
  goTo(p: Vec, run: boolean): void {
    this.target = p;
    this.running = run;
    const run1 = ['CORRE', 'CORRER'].find((n) => this.anim.has(n));
    this.anim.set(run && run1 ? run1 : 'ANDAR');
  }

  /** Un ciclo de lógica (1/20 s). */
  tick(): void {
    const v = this.running ? runSpeed(this.token) : WALK_SPEED;
    const r = stepBody(this.body, this.target, v);
    if (r.arrived) this.target = null;
    const rad = (this.body.ang * Math.PI) / 180;
    this.anim.advance(r.dx * Math.cos(rad) + r.dy * Math.sin(rad), 1); // distancia sobre el rumbo (FUN_00591DE0)
  }

  get moving(): boolean {
    return this.target !== null || Math.abs(this.body.vx) + Math.abs(this.body.vy) > 0.001;
  }
}
