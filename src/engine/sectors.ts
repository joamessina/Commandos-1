/**
 * Consultas sobre los sectores (.SEC): sector en un punto, altura del suelo y reglas de paso. Fuentes (exe de la raíz) y evidencia:
 * docs/research/q1-movimiento.md §R4 — FUN_005F6C60 (sector en x,y), FUN_005F6DB0 (en x,y,z), FUN_0053A250 (destino válido),
 * FUN_0066AD30 (Parachoques del peatón), FUN_0066BFE0 (escalón [-20,+15]).
 * Picking del cursor: FUN_005F7D50 -> FUN_005F5590 traza el rayo del píxel contra el plano de cada sector (FUN_005F51A0/FUN_005F52E0) y se
 * queda con el de menor t, o sea el más cercano a la cámara = el de mayor z. `pick` hace lo mismo.
 * shortcut: búsqueda lineal por bbox + polígono (el original usa un acelerador espacial, FUN_005FBB40) y siempre desde cero
 *           (el original sigue los vecinos desde el sector actual, FUN_005F9E60); cuándo mejorar: si el perfil lo pide.
 */
import { SectorFlag, type Sec, type Sector } from '../formats/sec.ts';

/** cos 50° y sin 50°: la cámara del juego (docs/research/q1-render.md); mundo -> pantalla es px = x, py = COS50·y − SIN50·z. */
export const COS50 = Math.cos((50 * Math.PI) / 180);
export const SIN50 = Math.sin((50 * Math.PI) / 180);

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

  /** Sectores pisados, contactos vecinos antes del sector central (0057B660/005DB1E0/005D6E80). */
  underfoot(center: Sector | null, x: number, y: number, radius: number, mode: Mode = {}): Sector[] {
    if (!center) return [];
    const queue = [center];
    const visited = new Set<Sector>(queue);
    const result: Sector[] = [];
    for (let i = 0; i < queue.length && i < 1023; i++) {
      const sector = queue[i];
      if (!sector) continue;
      for (let edge = 0; edge < sector.verts.length; edge++) {
        const a = this.sec.verts[sector.verts[edge] ?? -1];
        const b = this.sec.verts[sector.verts[(edge + 1) % sector.verts.length] ?? -1];
        const neighbor = this.sec.sectors[sector.neighbors[edge] ?? -1];
        if (!a || !b || !neighbor) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const length2 = dx * dx + dy * dy;
        if (length2 === 0) continue;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2));
        const px = a.x + t * dx, py = a.y + t * dy;
        if (Math.hypot(x - px, y - py) > radius) continue;
        if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        // shortcut: 0066ADF0 también contempla cintas y excepciones por la altura de extremos; mejorar con el registro completo de contacto.
        if (!simBlocked(neighbor, mode) && stepOk(groundZ(neighbor, px, py) - groundZ(sector, px, py)) && !result.includes(neighbor) && result.length < 8) result.push(neighbor);
      }
    }
    if (!result.includes(center) && result.length < 8) result.push(center);
    return result;
  }

  /** `00576190`: prueba semiplanos ampliados de sectores base del tipo pedido. */
  touchesType(x: number, y: number, radius: number, type: number): boolean {
    return this.sec.sectors.slice(0, this.sec.nA).some((s) => {
      if (s.type !== type || x + radius < s.minX || x - radius > s.maxX || y + radius < s.minY || y - radius > s.maxY) return false;
      return s.verts.every((index, i) => {
        const a = this.sec.verts[index];
        const b = this.sec.verts[s.verts[(i + 1) % s.verts.length] ?? -1];
        if (!a || !b) return false;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        return length === 0 || (dx * (y - a.y) - dy * (x - a.x)) / length >= -radius;
      });
    });
  }

  /** Sector en (x,y): primero la lista B y luego la A, el primero cuyo bbox (mín < v ≤ máx) y polígono contienen el punto. */
  at(x: number, y: number): Sector | null {
    return this.find(x, y, null);
  }

  /** Igual, pero un sector B solo vale si el punto está sobre su suelo (`plano_B(x,y) < z + 1`): pisos y puentes. */
  atZ(x: number, y: number, z: number): Sector | null {
    return this.find(x, y, z);
  }

  /**
   * Punto del mundo bajo un píxel del mapa (px, py): en cada sector se resuelve y = (py + SIN50·(a·px + c)) / (COS50 − SIN50·b)
   * (px = x y py = COS50·y − SIN50·z sobre el plano z = a·x + b·y + c) y gana el de mayor z. null si ningún sector lo cubre.
   * shortcut: recorre todos los sectores (el original mira la celda de 128 u del acelerador, FUN_005F4B90), y desempata por orden de lista.
   */
  pick(px: number, py: number): { x: number; y: number; z: number; sector: Sector } | null {
    let best: { x: number; y: number; z: number; sector: Sector } | null = null;
    for (const s of this.sec.sectors) {
      const den = COS50 - SIN50 * s.b;
      if (Math.abs(den) < 1e-3) continue; // plano casi paralelo al rayo
      const y = (py + SIN50 * (s.a * px + s.c)) / den;
      if (!(px >= s.minX && px <= s.maxX && y >= s.minY && y <= s.maxY) || !this.contains(s, px, y)) continue;
      const z = groundZ(s, px, y);
      if (!best || z > best.z) best = { x: px, y, z, sector: s };
    }
    return best;
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
