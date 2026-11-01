/**
 * Ataque de un comando a un blanco (soldado o barril): se acerca hasta el alcance del arma con el blanco a la vista, apunta y dispara hasta matarlo.
 * Datos del exe: tabla de armas `0x8143C0` (docs/lectura/au-disparar.md) y rutinas de bala del jugador (docs/engine/armas-danio.md §3): PISTOLA alcance 300
 * y daño 40, MIRILLA (rifle del francotirador) 1000 y 100, con sonido solo la pistola (`DISPAROPISTOLA`; la tabla no trae sonido de la mirilla);
 * cuchillo = `FUN_005986A0(.., tipo 7 CUCHILLADA, 120)` al cuadro 6 de la animación, sin ruido (au-jugador.md §0b).
 * Arpón (LANCHERO): alcance 200, un tiro mata (tipo 13, cantidad 100), recarga 60, munición 1 que no baja, sin ruido para la IA (docs/lectura/armas-restantes.md §2).
 * Desde un vehículo (solo MIRILLA, `FUN_00502cb0` con el ítem 0xF activo): el clic dispara al instante un tiro (`FUN_00678110/006780a0` prueban alcance, `0067AA30` dispara con el vehículo como origen del rayo),
 * sin caminar ni apuntar; fuera de alcance o sin línea el disparo se rechaza. shortcut: sin animación de disparo en el vehículo (no leída).
 * Con la mirilla el clic en un punto sin nadie también dispara (`groundTarget`), sin ruido para la IA (`MIRI`, +0x34 = 0).
 * La piedra y la cajetilla no pasan por aquí: caen en un punto (engine/throwing.ts).
 * shortcut: el apuntado tarda `AIM_CYCLES` fijos y entre tiros `SHOT_GAP` (no la duración de las animaciones); el cuchillo golpea tras `KNIFE_CYCLES`;
 *           sin munición limitada salvo la mirilla. Cuándo mejorar: al leer AUDisparar completo.
 */
import { lineClear } from './vision.ts';
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
const AIM_CYCLES = 8;
const SHOT_GAP = 6;
const KNIFE_CYCLES = 12;
const REPATH_EVERY = 10;

/** Algo contra lo que se puede disparar. */
export interface Target {
  readonly x: number;
  readonly y: number;
  readonly dead: boolean;
  /** Recibe el golpe de `from` con `weapon`. */
  hurt(weapon: Weapon, from: Unit): void;
  /** Punto del suelo sin nadie: el tiro sale igual si hay alcance y línea (`FUN_00502cb0` con `*param_2 == 0` → `FUN_00678110` + `FUN_0067AC80`); se rechaza sin caminar y es de un solo tiro. */
  readonly ground?: true;
}

/** Punto del suelo como blanco del francotirador. shortcut: la bala no daña a quien cruce el rayo (el trazado `FUN_006771a0` no se leyó); cuándo mejorar: al leerlo. */
export const groundTarget = (x: number, y: number): Target => ({ x, y, dead: false, ground: true, hurt: () => undefined });

const isDead = (t: Target): boolean => t.dead;

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
    if (u.coolDown > 0) return; // recarga del arma anterior
    const reach = RANGE[this.weapon];
    const clear = MELEE.has(this.weapon) || lineClear(w.sectors, b.x, b.y, tg.x, tg.y);
    if (d > reach || !clear) {
      if (u.boat || tg.ground) {
        this.done = true; // en el vehículo y a un punto del suelo no camina: el disparo se rechaza
        return;
      }
      this.aim = 0;
      if (this.t++ % REPATH_EVERY === 0) {
        const near = MELEE.has(this.weapon) ? 0 : 0.8;
        const k = Math.max(0, d - reach * near) / d;
        u.goTo({ x: b.x + (tg.x - b.x) * k, y: b.y + (tg.y - b.y) * k }, false);
      }
      return;
    }
    u.stop();
    b.ang = norm360((Math.atan2(tg.y - b.y, tg.x - b.x) * 180) / Math.PI);
    const need = MELEE.has(this.weapon) ? KNIFE_CYCLES : u.boat ? 1 : AIM_CYCLES;
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
    if (u.ammo[this.weapon] !== undefined) u.ammo[this.weapon] = (u.ammo[this.weapon] ?? 0) - 1; // gasta 1 por disparo (tabla +0x78)
    tg.hurt(this.weapon, u);
    if (isDead(tg) || u.boat || tg.ground || this.weapon === 'PUNO' || this.weapon === 'ESPOSAS') this.done = true; // hurt() cambia `dead`; el puño y las esposas son de un solo golpe
    else this.aim = need - SHOT_GAP;
  }
}
