/**
 * Consultas sobre los sectores (.SEC): sector en un punto, altura del suelo y reglas de paso. Fuentes (exe de la raíz) y evidencia:
 * docs/research/q1-movimiento.md §R4 — FUN_005F6C60 (sector en x,y), FUN_005F6DB0 (en x,y,z), FUN_0053A250 (destino válido),
 * FUN_0066AD30 (Parachoques del peatón), FUN_0066BFE0 (escalón [-20,+15]).
 * shortcut: búsqueda lineal por bbox + polígono (el original usa un acelerador espacial, FUN_005FBB40) y siempre desde cero
 *           (el original sigue los vecinos desde el sector actual, FUN_005F9E60); cuándo mejorar: si el perfil lo pide.
 */
import { SectorFlag, type Sec, type Sector } from '../formats/sec.ts';

export const TYPE_WATER = 1;
export const TYPE_DEEPWATER = 3;
/** Escalón permitido al cambiar de sector (destino − actual): `0x7991C4` y `0x798DEC`. */
export const STEP_DOWN = -20;
export const STEP_UP = 15;

export interface Mode {
  /** Modo agua/buceo: solo se pisan tipos WATER y DEEPWATER. */
  readonly water?: boolean;
  readonly crouched?: boolean;
}

/** Altura del suelo del sector en (x,y). */
export const groundZ = (s: Sector, x: number, y: number): number => s.a * x + s.b * y + s.c;

export const isWater = (s: Sector | null): boolean => s !== null && (s.type === TYPE_WATER || s.type === TYPE_DEEPWATER);

export class SectorMap {
  readonly sec: Sec;
  constructor(sec: Sec) {
    this.sec = sec;
  }

  /** Sector en (x,y): primero la lista B y luego la A, el primero cuyo bbox (mín < v ≤ máx) y polígono contienen el punto. */
  at(x: number, y: number): Sector | null {
    return this.find(x, y, null);
  }

  /** Igual, pero un sector B solo vale si el punto está sobre su suelo (`plano_B(x,y) < z + 1`): pisos y puentes. */
  atZ(x: number, y: number, z: number): Sector | null {
    return this.find(x, y, z);
  }

  private find(x: number, y: number, z: number | null): Sector | null {
    const { sectors, nA } = this.sec;
    // el original recorre B[0..] y luego A[0..]
    for (let k = 0; k < sectors.length; k++) {
      const s = sectors[(nA + k) % sectors.length];
      if (!s || !(x > s.minX && x <= s.maxX && y > s.minY && y <= s.maxY)) continue;
      if (s.overlay && z !== null && !(groundZ(s, x, y) < z + 1)) continue;
      if (this.contains(s, x, y)) return s;
    }
    return null;
  }

  /**
   * Punto en polígono por cruces de aristas, con los bordes máximos incluidos (igual que el bbox (mín, máx]) para que dos sectores
   * contiguos no dejen un hueco. shortcut: FUN_005F4630 usa cuadrantes y su regla exacta sobre una arista no se leyó.
   */
  private contains(s: Sector, x: number, y: number): boolean {
    let inside = false;
    const n = s.verts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const p = this.sec.verts[s.verts[i] ?? 0];
      const q = this.sec.verts[s.verts[j] ?? 0];
      if (p && q && p.y >= y !== q.y >= y && x <= ((q.x - p.x) * (y - p.y)) / (q.y - p.y) + p.x) inside = !inside;
    }
    return inside;
  }
}

/** ¿Es un destino válido para una orden? (FUN_0053A250): ni NTrans ni NCamin; DEEPWATER no se camina; SoloAg solo agachado. */
export function validTarget(s: Sector | null, mode: Mode = {}): boolean {
  if (!s || s.flags & (SectorFlag.NTrans | SectorFlag.NCamin)) return false;
  if (mode.water) return s.type === TYPE_WATER || s.type === TYPE_DEEPWATER;
  if (s.type === TYPE_DEEPWATER) return false;
  return mode.crouched === true || !(s.flags & SectorFlag.SoloAg);
}

/** ¿Lo bloquea el Sim al pisar? (FUN_0066AD30): sector nulo, NTrans, DEEPWATER a pie, no-agua en modo agua, SoloAg de pie. NCamin NO bloquea. */
export function simBlocked(s: Sector | null, mode: Mode = {}): boolean {
  if (!s || s.flags & SectorFlag.NTrans) return true;
  if (mode.water) return s.type !== TYPE_WATER && s.type !== TYPE_DEEPWATER;
  if (s.type === TYPE_DEEPWATER) return true;
  return mode.crouched !== true && (s.flags & SectorFlag.SoloAg) !== 0;
}

/** Cambio de nivel aceptado al pasar de un sector a otro (FUN_0066BFE0). */
export const stepOk = (dz: number): boolean => dz >= STEP_DOWN && dz <= STEP_UP;
