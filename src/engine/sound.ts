/**
 * Reglas del sonido (docs/lectura/sonido.md §1–§5), sin audio: atenuación por distancia en pantalla, ambiente del `.MIS` y música por misión.
 *  - Atenuación (`FUN_0067EFA0`): `d` = distancia en pantalla entre la fuente y el centro de la cámara, `R = 800`; `vol = base·(1 − d/R)`, `pan = Δx/R`, mudo si `d ≥ R`;
 *    Miles recibe `round(vol·127)` y `round(pan·63 + 63)` (`FUN_0067C940`).
 *  - Ambiente (`FUN_00682A60` lee, `FUN_00682970` tick, `FUN_00682280` espera): cada fuente suena de inmediato (cuenta atrás inicial 0) y luego cada `dur + DELAY ± DELAY/2` ciclos
 *    (`dur` = duración del WAV en ciclos de 50 ms, aleatorio con el LCG de `FUN_006453C0`); un `.BUCLADO` se arranca una sola vez. Con `POS 0 0 0` suena sin atenuación (`FUN_00682560`).
 * shortcut: el volumen final es `base·atenuación·VOLEFECTOS`; no se leyó si el exe multiplica la categoría además de la base 0,75 en los sonidos posicionales de gameplay (S2.2 solo lo
 *           confirma para el bucle). Cuándo mejorar: al contrastar con el volumen real del juego en marcha.
 */
import { asList, asNumber, asNumbers, asText, find, parseClave } from '../formats/clave.ts';

/** Radio de atenuación audible en unidades de pantalla (`0x7AEBA8`). */
export const HEAR_RADIUS = 800;
/** Volumen base de todos los sonidos de gameplay (`0x793240`) y de `VOLEFECTOS`/`VOLMUSICA` por defecto (`Comando.cfg`). */
export const BASE_VOLUME = 0.75;

export interface Mix {
  /** 0..1, ya redondeado al escalón de 7 bits de Miles. */
  readonly volume: number;
  /** −1 (izquierda)..1 (derecha), redondeado al escalón de 6 bits de Miles. */
  readonly pan: number;
}

/** Volumen y pan de una fuente a (`dx`, `dy`) del centro de la cámara en pantalla; null si está fuera del radio (no suena). */
export function attenuate(dx: number, dy: number, base: number): Mix | null {
  const d = Math.hypot(dx, dy);
  if (d >= HEAR_RADIUS) return null;
  const pan = Math.max(-1, Math.min(1, dx / HEAR_RADIUS));
  return { volume: Math.round(base * (1 - d / HEAR_RADIUS) * 127) / 127, pan: (Math.round(pan * 63 + 63) - 63) / 63 };
}

/** LCG de `FUN_006453C0`: `s = s·0x343FD + 0x269EC3`, devuelve `(s >> 16) & 0x7FFF`. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 0x343fd) + 0x269ec3) >>> 0;
    return (s >>> 16) & 0x7fff;
  };
}

/** Ciclos hasta la próxima vez que suena una fuente sin bucle (`FUN_00682280`): `dur + DELAY ± rand%(round(DELAY/2)+1)`, el signo según la paridad de un primer azar. */
export function ambientWait(dur: number, delay: number, rand: () => number): number {
  const h = Math.round(delay * 0.5) + 1;
  return (rand() & 1) !== 0 ? dur - (rand() % h) + delay : dur + delay + (rand() % h);
}

/** Una entrada de `.INTENDENCIAINFO .AMBIENTE`. */
export interface AmbientDef {
  readonly tag: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly volume: number;
  readonly delay: number;
  readonly loop: boolean;
}

/** Entradas válidas del ambiente: `.SOUNDID` de exactamente 4 letras (si no, se ignora), `.POS` por defecto 0 0 0, `.VOLUMEN` 0, `.DELAY` 1, `.BUCLADO` ≠ 0 = continuo. */
export function parseAmbient(misText: string): AmbientDef[] {
  const mission = asList(find(parseClave(misText), '.MISSION')) ?? [];
  const info = asList(find(mission, '.INTENDENCIAINFO')) ?? [];
  const out: AmbientDef[] = [];
  for (const n of asList(find(info, '.AMBIENTE')) ?? []) {
    const e = asList(n);
    const tag = asText(find(e ?? [], '.SOUNDID'));
    if (!e || tag === undefined || tag.length !== 4) continue;
    const pos = asNumbers(find(e, '.POS')) ?? [];
    out.push({ tag: tag.toUpperCase(), x: pos[0] ?? 0, y: pos[1] ?? 0, z: pos[2] ?? 0, volume: asNumber(find(e, '.VOLUMEN')) ?? 0, delay: asNumber(find(e, '.DELAY')) ?? 1, loop: (asNumber(find(e, '.BUCLADO')) ?? 0) !== 0 });
  }
  return out;
}

/** `.MUSICA` de la misión (archivo de `DATOS/MUSICA/`), o null si no tiene (MAPA0009, MAPF0001, TUT00). */
export function parseMusic(misText: string): string | null {
  const mission = asList(find(parseClave(misText), '.MISSION')) ?? [];
  return asText(find(mission, '.MUSICA')) ?? null;
}

/** ¿La fuente tiene posición (suena atenuada)? Con `POS 0 0 0` suena a volumen pleno. */
export const isPositional = (d: AmbientDef): boolean => d.x !== 0 || d.y !== 0 || d.z !== 0;

/** Estado de una fuente de ambiente. */
export class AmbientSource {
  readonly def: AmbientDef;
  private readonly cycles: number;
  private readonly rand: () => number;
  private wait = 0;
  private started = false;

  /** `cycles` = duración del WAV en ciclos de 50 ms (`FUN_0067DDC0 / 0x32`). */
  constructor(def: AmbientDef, cycles: number, rand: () => number) {
    this.def = def;
    this.cycles = cycles;
    this.rand = rand;
  }

  /** Un ciclo (`FUN_00682970`): 'play' = suena ahora, 'loop' = arranca el sonido continuo (una sola vez), null = nada. */
  tick(): 'play' | 'loop' | null {
    if (this.def.loop) {
      if (this.started) return null;
      this.started = true;
      return 'loop';
    }
    if (this.wait > 0) {
      this.wait--;
      return null;
    }
    this.wait = ambientWait(this.cycles, this.def.delay, this.rand);
    return 'play';
  }
}
