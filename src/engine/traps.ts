/**
 * Objetos que el comando coloca desde su inventario: el cepo del zapador (`AuManejacepo`, `ClassAcCepo`) y el señuelo del boina verde (`AuManejaSegnuelo`, `ClassAcSegnuelo`).
 * Reglas del exe (docs/lectura/obj-explosivos.md §4-5, au-jugador.md §9):
 *  - Cepo armado (cilindro R10): un bicho que NO es comando ni arrestado y lo toca recibe el impacto 14 (CEPO, muerte instantánea) y el cepo queda cerrado (anim PILLAR, sonido `CEPO`).
 *    Un comando nunca lo activa.
 *  - Señuelo encendido: registra una fuente de ruido (`DCOY`, radio de oído 300) que se reactualiza cada `INTERVALOSND` ciclos (30 por defecto en el MAC); `MSG_SEGNUELO_ONOFF` lo alterna.
 * shortcut: el señuelo se enciende al soltarlo y el mismo ítem lo alterna (el exe tiene los ítems ACTSENUELOON/OFF aparte); un uso por objeto (no se recoge de nuevo);
 *           sin sonidos; el ruido del señuelo lo oyen los soldados como un disparo lejano (`Soldier.hear`).
 */
import type { Soldier } from './soldier.ts';

/** Radio del cilindro del cepo y de los bichos (`R 10`): se tocan a menos de 20. */
const TOUCH = 20;
/** Radio de oído del sonido `DCOY` (tabla de ruidos 0x821DE0). */
export const DECOY_RADIUS = 300;
/** `INTERVALOSND` por defecto del MAC SEGNUELO. */
export const DECOY_INTERVAL = 30;

export interface Cepo {
  readonly x: number;
  readonly y: number;
  /** true = armado; false = cerrado (ya mató). */
  armed: boolean;
}

export interface Decoy {
  readonly x: number;
  readonly y: number;
  on: boolean;
  /** Ciclos hasta el próximo ruido. */
  wait: number;
}

export class Traps {
  readonly cepos: Cepo[] = [];
  readonly decoys: Decoy[] = [];

  placeCepo(x: number, y: number): Cepo {
    const c = { x, y, armed: true };
    this.cepos.push(c);
    return c;
  }

  placeDecoy(x: number, y: number): Decoy {
    const d = { x, y, on: true, wait: 0 };
    this.decoys.push(d);
    return d;
  }

  /** Un ciclo: los cepos matan al soldado que los toca; los señuelos encendidos emiten ruido cada `DECOY_INTERVAL` ciclos. Devuelve los cepos que se cerraron en este ciclo. */
  tick(soldiers: readonly Soldier[], noise: (x: number, y: number, radius: number) => void): Cepo[] {
    const closed: Cepo[] = [];
    for (const c of this.cepos) {
      if (!c.armed) continue;
      const victim = soldiers.find((s) => !s.dead && Math.hypot(s.x - c.x, s.y - c.y) < TOUCH);
      if (victim) {
        victim.kill();
        c.armed = false;
        closed.push(c);
      }
    }
    for (const d of this.decoys) {
      if (!d.on) continue;
      if (d.wait > 0) d.wait--;
      else {
        noise(d.x, d.y, DECOY_RADIUS);
        d.wait = DECOY_INTERVAL - 1;
      }
    }
    return closed;
  }
}
