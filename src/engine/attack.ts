/**
 * Ataque de un comando a un blanco: cada orden produce un disparo o golpe; las armas de fuego no se acercan automáticamente.
 * Datos del exe: tabla de armas `0x8143C0` (docs/lectura/au-disparar.md) y rutinas de bala del jugador (docs/engine/armas-danio.md §3): PISTOLA alcance 300
 * y daño 40, MIRILLA (rifle del francotirador) 1000 y 100, con sonido solo la pistola (`DISPAROPISTOLA`; la tabla no trae sonido de la mirilla);
 * cuchillo = `FUN_005986A0(.., tipo 7 CUCHILLADA, 120)` al cuadro 6 de la animación, sin ruido (au-jugador.md §0b).
 * Arpón (LANCHERO): alcance 200, un tiro mata (tipo 13, cantidad 100), recarga 60, munición 1 que no baja, sin ruido para la IA (docs/lectura/armas-restantes.md §2).
 * Desde un vehículo (solo MIRILLA, `FUN_00502cb0` con el ítem 0xF activo): el clic dispara al instante un tiro (`FUN_00678110/006780a0` prueban alcance, `0067AA30` dispara con el vehículo como origen del rayo),
 * sin caminar ni apuntar; fuera de alcance o sin línea el disparo se rechaza. shortcut: sin animación de disparo en el vehículo (no leída).
 * Pistola, mirilla y arpón admiten un clic en un punto sin nadie (`FUN_004F0E50`); la mirilla no hace ruido para la IA (`MIRI`, +0x34 = 0).
 * La piedra y la cajetilla no pasan por aquí: caen en un punto (engine/throwing.ts).
 * shortcut: el cuchillo golpea tras `KNIFE_CYCLES`;
 *           sin munición limitada salvo la mirilla. Cuándo mejorar: al leer AUDisparar completo.
 */
import { lineClear } from './vision.ts';
import { navFor } from './path.ts';
import type { SectorMap } from './sectors.ts';
import type { Unit } from './unit.ts';
import { norm360 } from './walk.ts';

export type Weapon = 'PISTOLA' | 'MIRILLA' | 'CUCHILLO' | 'PUNO' | 'ESPOSAS' | 'PIEDRA' | 'ARPON';

/** Armas de contacto: caminan hasta el blanco (sin línea de tiro) y golpean a `KNIFE_CYCLES`. PUNO = `AuCachiporra` (`MSGA_CACHIPORRAZO` al cuadro 6), ESPOSAS = `AuEsposas` (`MSGA_HAS_SIDO_ESPOSADO`). */
const MELEE: ReadonlySet<Weapon> = new Set<Weapon>(['CUCHILLO', 'PUNO', 'ESPOSAS']);

/** Radio del ruido del disparo de la pistola (`PIPA` en la tabla de ruidos 0x821DE0, docs/engine/percepcion.md §4.3). */
export const PISTOL_NOISE = 600;

export const RANGE: Readonly<Record<Weapon, number>> = { PISTOLA: 300, MIRILLA: 1000, CUCHILLO: 28, PUNO: 28, ESPOSAS: 28, PIEDRA: 300, ARPON: 200 };
export const DAMAGE: Readonly<Record<Weapon, number>> = { PISTOLA: 40, MIRILLA: 100, CUCHILLO: 120, PUNO: 0, ESPOSAS: 0, PIEDRA: 0, ARPON: 100 };
/** Recarga del arpón: 60 ciclos (tabla de recargas, docs/lectura/armas-restantes.md); el resto de las armas no tiene espera propia aquí. */
export const ARPON_RELOAD = 60;
const KNIFE_CYCLES = 12;
const REPATH_EVERY = 10;

/** Algo contra lo que se puede disparar. */
export interface Target {
  readonly x: number;
  readonly y: number;
  readonly dead: boolean;
  readonly unit?: Unit;
  readonly z?: number;
  readonly eye?: number;
  /** Recibe el golpe de `from` con `weapon`. */
  hurt(weapon: Weapon, from: Unit): void;
  /** Punto del suelo sin nadie: se rechaza sin caminar si está fuera de alcance o sin línea. */
  readonly ground?: true;
}

/** Punto del suelo como blanco. shortcut: la bala no daña a quien cruce el rayo; mejorar al portar `FUN_006771a0`. */
export const groundTarget = (x: number, y: number, z?: number): Target => ({ x, y, ...(z === undefined ? {} : { z }), dead: false, ground: true, hurt: () => undefined });

/** FUN_00677560/00677710: alcance 3D a un bicho y horizontal a un punto; FUN_006771A0 comprueba la trayectoria. */
export function canFire(unit: Unit, target: Target, weapon: Weapon, sectors: SectorMap | null): boolean {
  const b = unit.body;
  const startZ = unit.z + unit.eye;
  const endZ = target.unit ? target.unit.z + target.unit.eye : target.z === undefined ? startZ : target.z + (target.eye ?? 0);
  const dz = target.ground ? 0 : endZ - startZ;
  const reach = RANGE[weapon] + (target.ground ? 0 : 0.1);
  if (Math.hypot(target.x - b.x, target.y - b.y, dz) >= reach) return false;
  if (!lineClear(sectors, b.x, b.y, target.x, target.y, unit.z)) return false;
  // shortcut: nav.sight aproxima los portales y no comprueba los volúmenes de FUN_0063E820.
  return !sectors || !unit.sector || navFor(sectors).sight(unit.sector, { x: b.x, y: b.y, z: startZ }, { x: target.x, y: target.y, z: endZ });
}

export interface AttackWorld {
  readonly sectors: SectorMap | null;
  /** Ruido de un disparo en (x,y) con su radio: los soldados a menos de ese radio lo oyen. */
  readonly noise: (x: number, y: number, radius: number) => void;
  /** Rastro visual de un disparo. */
  readonly onShot: (fromX: number, fromY: number, toX: number, toY: number, weapon: Weapon) => void;
}

export class Attack {
  readonly unit: Unit;
  readonly target: Target;
  readonly weapon: Weapon;
  /** true cuando terminó (blanco destruido o atacante muerto). */
  done = false;
  private t = 0;
  private aim = 0;

  constructor(unit: Unit, target: Target, weapon: Weapon) {
    this.unit = unit;
    this.target = target;
    this.weapon = weapon;
  }

  tick(w: AttackWorld): void {
    const u = this.unit;
    const tg = this.target;
    if (u.dead || tg.dead) {
      this.done = true;
      return;
    }
    const b = u.body;
    const d = Math.hypot(tg.x - b.x, tg.y - b.y);
    if ((u.ammo[this.weapon] ?? 1) <= 0) {
      this.done = true; // sin munición (estado 1 de AUDisparar: munición 0 → termina)
      return;
    }
    if (this.weapon === 'ARPON' && u.coolDown > 0) return; // recarga propia del arpón
    const reach = RANGE[this.weapon];
    if (!MELEE.has(this.weapon) && !canFire(u, tg, this.weapon, w.sectors)) { this.done = true; return; }
    if (MELEE.has(this.weapon) && d > reach) {
      if (u.boat || tg.ground) {
        this.done = true; // en el vehículo y a un punto del suelo no camina: el disparo se rechaza
        return;
      }
      this.aim = 0;
      if (this.t++ % REPATH_EVERY === 0) {
        u.goTo({ x: tg.x, y: tg.y }, false);
      }
      return;
    }
    u.stop();
    b.ang = norm360((Math.atan2(tg.y - b.y, tg.x - b.x) * 180) / Math.PI);
    const need = MELEE.has(this.weapon) ? KNIFE_CYCLES : 1;
    if (this.aim === 0 && !u.boat) {
      // PUNO: LANZARPIEDRA (AuCachiporra con el arma 0 del comando, docs/lectura/au-jugador.md §4); ESPOSAS: el comando no trae animación de esposar (shortcut: se queda quieto)
      const a = this.weapon === 'CUCHILLO' ? 'SACACUCHILLO' : this.weapon === 'PUNO' ? 'LANZARPIEDRA' : this.weapon === 'ESPOSAS' ? '' : this.weapon === 'MIRILLA' ? 'APUNTARIFLE' : this.weapon === 'ARPON' ? 'APUNTAARPON' : 'APUNTAPISTOLA';
      if (u.anim.has(a)) u.anim.set(a);
    }
    if (++this.aim < need) return;
    if (!MELEE.has(this.weapon)) {
      const a = this.weapon === 'MIRILLA' ? 'DISPARARIFLE' : this.weapon === 'ARPON' ? 'DISPARAARPON' : 'DISPARAPISTOLA';
      if (u.anim.has(a) && !u.boat) u.anim.set(a);
      w.onShot(b.x, b.y, tg.x, tg.y, this.weapon);
      if (this.weapon === 'PISTOLA') w.noise(b.x, b.y, PISTOL_NOISE);
      if (this.weapon === 'ARPON') u.coolDown = ARPON_RELOAD;
    }
    if (this.weapon === 'MIRILLA' && u.ammo[this.weapon] !== undefined) u.ammo[this.weapon] = (u.ammo[this.weapon] ?? 0) - 1;
    tg.hurt(this.weapon, u);
    this.done = true;
  }
}
