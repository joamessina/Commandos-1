/**
 * Puntuación de fin de misión (docs/engine/ui-misiones-guardado.md §3.2-3.4): estrellas de tiempo (`FUN_0063CAA0`) y de energía (`FUN_0063CA00/0063CC00`),
 * rango de la misión (`FUN_0063CC40`) y los textos de fin (GLOBAL.STR: `FINM`, `ALMU`).
 * shortcut: el daño acumulado (`Intend+0xBAC`, ranura 13) se calcula como energía perdida de cada comando (los muertos pierden toda) y el divisor es
 *           NUMALIADOS × 200 como dice la lectura (hipótesis de los 200); el rango de campaña (`FUN_0063CD20`) y los títulos de rango no se leyeron.
 */
import { asList, asNumber, find, parseClave } from '../formats/clave.ts';

/** Ticks de par por defecto (`Intend+0x954/+0x958` antes de leer `PUNTUACIONES`). */
export const DEFAULT_PAR = { easy: 4000, hard: 3000 } as const;

/** Ciclos por segundo (MAXFPS = 0x14). */
export const TICKS_PER_SECOND = 20;

/** Textos de GLOBAL.STR de los códigos de fin de misión. */
export const END_TEXT = {
  FINM: 'CONGRATULATIONS, you have successfully accomplished the mission',
  ALMU: 'ALL YOUR MEN HAVE DIED OR HAVE BEEN CAPTURED.',
} as const;

/** Ciclos que pasan entre que mueren todos los comandos y se muestra el fin (`[0x11fa] = 100`). */
export const DEFEAT_DELAY = 100;

/** `.INTENDENCIAINFO .PUNTUACIONES [ .PAR_TICKS_FACIL n .PAR_TICKS_DIFICIL n ]`; lo que falta usa los valores por defecto. */
export function parsePar(misText: string): { easy: number; hard: number } {
  const info = asList(find(asList(find(parseClave(misText), '.MISSION')) ?? [], '.INTENDENCIAINFO')) ?? [];
  const p = asList(find(info, '.PUNTUACIONES')) ?? [];
  return { easy: asNumber(find(p, '.PAR_TICKS_FACIL')) ?? DEFAULT_PAR.easy, hard: asNumber(find(p, '.PAR_TICKS_DIFICIL')) ?? DEFAULT_PAR.hard };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Estrellas de tiempo, 0..3: `3 − floor(t/par − 0,5)` recortado (3 si t/par < 1,5; 0 si ≥ 3,5). */
export const timeStars = (ticks: number, par: number): number => clamp(3 - Math.floor(ticks / par - 0.5), 0, 3);

/** Estrellas de energía, 0..3: `3 − recorte(trunc(clamp(perdida/(aliados·200), 0, 1)·4))`. */
export const energyStars = (lost: number, allies: number): number => clamp(3 - clamp(Math.trunc(clamp(lost / (allies * 200), 0, 1) * 4), 0, 3), 0, 3);

export interface Score {
  readonly seconds: number;
  readonly time: number;
  readonly energy: number;
  /** `floor((tiempo + energía) / 2)`, 0..3. */
  readonly rank: number;
}

/** Resultado de la misión con el contador de ciclos, el par de la dificultad jugada, la energía perdida total y el número de aliados. */
export function score(ticks: number, par: number, lost: number, allies: number): Score {
  const time = timeStars(ticks, par);
  const energy = energyStars(lost, allies);
  return { seconds: Math.floor(ticks / TICKS_PER_SECOND), time, energy, rank: Math.floor((time + energy) / 2) };
}
