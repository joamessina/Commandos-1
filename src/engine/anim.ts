/**
 * Animador de secuencias ANM. Reglas leídas en el exe (FUN_004E28D0, FUN_004E1050, FUN_004E0F60;
 * docs/engine/graficos-mapa.md §1):
 *  - la instancia acumula distancia (`a`, locomoción) y tiempo (`b`, en ticks de 1/20 s)
 *  - paso = (trunc(n·t/b) + trunc(n·d/a)) mod n; un período 0 no aporta
 *  - cíclica: el acumulado se reduce módulo el período; no cíclica: al llegar al período queda en el último paso
 *    y, si tiene `enlace2`, pasa a esa secuencia
 *  - fotograma dentro del paso: idx = trunc(ang·n/360 + 0.5), n = fotogramas del paso
 * shortcut: no se implementa el avance "anclado" (animales: LEON…) ni la marcha atrás de los enlaces, cuándo mejorar: al llegar a los animales.
 */
import type { Anm, AnmFrame, AnmSequence } from '../formats/anm.ts';

export class AnimError extends Error {}

/** Fotograma de un paso con `n` fotogramas para un ángulo de mundo en grados (0 = +x, 90 = +y). */
export function frameIndex(angleDeg: number, n: number): number {
  if (n <= 1) return 0;
  let a = angleDeg % 360;
  if (a < 0) a += 360;
  let idx = Math.trunc((a * n) / 360 + 0.5);
  if (idx >= n) idx -= n;
  return idx;
}

const wrap = (x: number, period: number): number => ((x % period) + period) % period;

export class Animator {
  private seq: AnmSequence;
  private accDist = 0;
  private accTime = 0;
  private finished = false;

  constructor(
    private readonly anm: Anm,
    name: string,
  ) {
    this.seq = this.get(name);
  }

  private get(name: string): AnmSequence {
    const s = this.anm.sequences.get(name);
    if (!s) throw new AnimError(`secuencia inexistente: ${name}`);
    return s;
  }

  get name(): string {
    return this.seq.name;
  }

  has(name: string): boolean {
    return this.anm.sequences.has(name);
  }

  /** Cambia de secuencia y reinicia los acumuladores (no hace nada si ya es la actual). */
  set(name: string): void {
    if (name === this.seq.name) return;
    this.seq = this.get(name);
    this.accDist = 0;
    this.accTime = 0;
    this.finished = false;
  }

  /** Avanza: `dDist` unidades de mapa recorridas sobre el rumbo y `dTime` ticks (el juego pasa 1 por ciclo). */
  advance(dDist: number, dTime: number): void {
    const s = this.seq;
    this.accDist += dDist;
    this.accTime += dTime;
    if (s.cyclic) {
      if (s.a > 0) this.accDist = wrap(this.accDist, s.a);
      if (s.b > 0) this.accTime = wrap(this.accTime, s.b);
      return;
    }
    if ((s.a > 0 && this.accDist >= s.a) || (s.b > 0 && this.accTime >= s.b)) {
      if (s.link2 !== '' && this.anm.sequences.has(s.link2)) {
        this.seq = this.get(s.link2);
        this.accDist = 0;
        this.accTime = 0;
        this.finished = false;
      } else this.finished = true;
    }
  }

  /** Índice del paso actual. */
  get step(): number {
    const s = this.seq;
    const n = s.steps.length;
    if (n === 0) return 0;
    if (!s.cyclic) {
      if (this.finished) return n - 1;
      if (this.accDist <= 0 && this.accTime <= 0) return 0;
    }
    const t = s.b > 0 ? Math.trunc((n * this.accTime) / s.b) : 0;
    const d = s.a > 0 ? Math.trunc((n * this.accDist) / s.a) : 0;
    return wrap(t + d, n);
  }

  /** Fotograma a dibujar para el ángulo de mundo dado. */
  frame(angleDeg: number): AnmFrame {
    const frames = this.seq.steps[this.step];
    if (!frames || frames.length === 0) throw new AnimError(`${this.seq.name}: paso sin fotogramas`);
    const f = frames[Math.min(frameIndex(angleDeg, frames.length), frames.length - 1)];
    if (!f) throw new AnimError(`${this.seq.name}: fotograma inexistente`);
    return f;
  }
}
