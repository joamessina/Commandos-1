/**
 * Piedra y cajetilla de tabaco: el comando las lanza a un PUNTO (aunque se haga clic en un soldado) y aparecen allí sin vuelo (`FUN_00676460`, `FUN_00676860`/`FUN_0069EA70`).
 * Prueba de alcance de `FUN_00675DC0` (docs/lectura/armas-restantes.md §1, tabaco-control.md): distancia horizontal < 300 la piedra y ≤ 200 la cajetilla, z del destino < z del
 * lanzador + 200, sector de tipo 0/1/2 con `flags & 0xC14 == 0` y rayo libre por los sectores. Fuera de alcance no camina ni gasta nada.
 * La piedra no daña ni atonta: manda `MSGA_PEDRADA` a la víctima y hace el ruido `PEDL` (atención, radio 125). La cajetilla no hace ruido: los `AcBap2`/`AcBanpe2` que la ven van,
 * la recogen y fuman; si dos la ven, gana el más cercano (`CAcTabaco`, `FUN_004B1FD0`) y al otro le llega `NO_VENGAS`.
 * shortcut: la prueba del rayo usa `lineClear` (visión) y no el callback 675810; el enfriamiento de 20 ciclos de la piedra no se aplica (la animación ya dura 8-12).
 *           Cuándo mejorar: al leer 675810/5F69C0.
 */
import type { Sector } from '../formats/sec.ts';
import type { SectorMap } from './sectors.ts';
import { lineClear } from './vision.ts';

export type Throwable = 'PIEDRA' | 'TABACO';

/** Ruido `PEDL` (atención, categoría 2) de la tabla 0x821DE0 / `CAcPiedra`: se emite una sola vez al caer. */
export const STONE_NOISE = 125;
const RISE = 200;

export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** ¿Llega el lanzamiento? (ver cabecera). */
export function canThrow(kind: Throwable, from: Spot, to: Spot & { readonly sector: Sector | null }, sectors: SectorMap | null): boolean {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (kind === 'PIEDRA' ? d >= 300 : d > 200) return false;
  if (to.z >= from.z + RISE) return false;
  const s = to.sector;
  if (sectors && (s === null || s.type > 2 || (s.rawFlags & 0xc14) !== 0)) return false;
  return lineClear(sectors, from.x, from.y, to.x, to.y);
}

/** Quien puede ir a por una cajetilla (el soldado): su posición, si sigue vivo y cómo se le dice que ya no vaya. */
export interface Claimant {
  readonly x: number;
  readonly y: number;
  readonly dead: boolean;
  /** `NO_VENGAS`: otro está más cerca. */
  callOff(): void;
}

export interface Pack {
  readonly x: number;
  readonly y: number;
  taken: boolean;
  claimant: Claimant | null;
}

/** Cajetillas en el suelo. */
export class Packs {
  readonly list: Pack[] = [];

  drop(x: number, y: number): Pack {
    const p: Pack = { x, y, taken: false, claimant: null };
    this.list.push(p);
    return p;
  }

  /** `PUEDO_IR_A_COGERTE`: acepta si nadie va o si el nuevo está más cerca que el que iba (a ese se le avisa `NO_VENGAS`). */
  claim(p: Pack, who: Claimant): boolean {
    if (p.taken) return false;
    const c = p.claimant;
    if (c && c !== who && !c.dead) {
      if (Math.hypot(c.x - p.x, c.y - p.y) <= Math.hypot(who.x - p.x, who.y - p.y)) return false;
      c.callOff();
    }
    p.claimant = who;
    return true;
  }

  /** Recogida: la cajetilla desaparece (`FUN_0069ECD0`). */
  take(p: Pack): void {
    p.taken = true;
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }
}
