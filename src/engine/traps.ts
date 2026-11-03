/**
 * Objetos que el comando coloca desde su inventario: el cepo del zapador (`AuManejacepo`, `ClassAcCepo`) y el señuelo del boina verde (`AuManejaSegnuelo`, `ClassAcSegnuelo`).
 * Reglas del exe (docs/lectura/obj-explosivos.md §4-5, au-jugador.md §9):
 *  - Cepo armado (cilindro R10): un bicho que NO es comando ni arrestado y lo toca recibe el impacto 14 (CEPO, muerte instantánea) y el cepo queda cerrado (anim PILLAR, sonido `CEPO`).
 *    Un comando nunca lo activa.
 *  - Señuelo encendido: registra una fuente de ruido (`DCOY`, radio de oído 300) que se reactualiza cada `INTERVALOSND` ciclos (30 por defecto en el MAC); `MSG_SEGNUELO_ONOFF` lo alterna.
 *    El señuelo nace apagado (`FUN_004A8CB0` deja `+0x28 = 0`) y el interruptor de la mochila lo enciende y apaga (órdenes `ACTIVA`/`DESACTIVA` de `AUManejaSegnuelo`, `FUN_004FCBB0`).
 *  - Ítems de la mochila (`FUN_004FC990`, `FUN_004FCBB0`): 0x2C `IT_SEGNUELO` (el señuelo en la mochila), 0x2D `IT_ACTSENUELOOFF` (interruptor apagado) y 0x2E `IT_ACTSENUELOON` (encendido).
 *    Cada ítem tiene un estado `+0x2C` (1 = se ve, 0 = oculto: `FUN_0068D930` lo pone en 1 y `FUN_0068F410` en 0). Al soltarlo: 0x2C → 0 y 0x2D → 1; al encender: 0x2E → 1 y 0x2D → 0 (al apagar, al revés);
 *    al recogerlo de nuevo: 0x2C → 1 y el interruptor que se veía → 0.
 * shortcut: un solo señuelo por comando (el AU tiene una ranura por `.OBJETOS`); sin sonidos; el ruido del señuelo lo oyen los soldados como un disparo lejano (`Soldier.hear`).
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

  /** Lo deja en el suelo, apagado. */
  placeDecoy(x: number, y: number): Decoy {
    const d = { x, y, on: false, wait: 0 };
    this.decoys.push(d);
    return d;
  }

  /** El comando lo recoge: vuelve a la mochila (`MSGA_ENTRADAENCONTENEDOR` calla su sonido). */
  removeDecoy(d: Decoy): void {
    const i = this.decoys.indexOf(d);
    if (i >= 0) this.decoys.splice(i, 1);
  }

  /** Interruptor de la mochila: enciende o apaga el señuelo puesto en el suelo; null si no hay ninguno. */
  switchDecoy(): Decoy | null {
    const d = this.decoys[this.decoys.length - 1];
    if (!d) return null;
    d.on = !d.on;
    d.wait = 0;
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

/** Ítem del señuelo que se ve en la mochila: el señuelo mismo, o el interruptor (encendido o apagado) cuando está puesto en el suelo. */
export type DecoyItem = 'IT_SEGNUELO' | 'IT_ACTSENUELOOFF' | 'IT_ACTSENUELOON';

/** Cuál de los tres ítems se ve (otro estado = ninguno): puesto en el suelo, el interruptor según esté; si no, el señuelo si queda uno en la mochila. */
export function decoyItem(inBag: boolean, placed: Decoy | null): DecoyItem | null {
  if (placed) return placed.on ? 'IT_ACTSENUELOON' : 'IT_ACTSENUELOOFF';
  return inBag ? 'IT_SEGNUELO' : null;
}
