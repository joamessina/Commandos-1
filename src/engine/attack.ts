/**
 * Ataque de un comando a un blanco (soldado o barril): se acerca hasta el alcance del arma con el blanco a la vista, apunta y dispara hasta matarlo.
 * Datos del exe: tabla de armas `0x8143C0` (docs/lectura/au-disparar.md) y rutinas de bala del jugador (docs/engine/armas-danio.md §3): PISTOLA alcance 300
 * y daño 40, MIRILLA (rifle del francotirador) 1000 y 100, con sonido solo la pistola (`DISPAROPISTOLA`; la tabla no trae sonido de la mirilla);
 * cuchillo = `FUN_005986A0(.., tipo 7 CUCHILLADA, 120)` al cuadro 6 de la animación, sin ruido (au-jugador.md §0b).
 * shortcut: el apuntado tarda `AIM_CYCLES` fijos y entre tiros `SHOT_GAP` (no la duración de las animaciones); el cuchillo golpea tras `KNIFE_CYCLES`;
 *           sin munición, ni piedras/granadas. Cuándo mejorar: al leer AUDisparar completo.
 */
import { lineClear } from './vision.ts';
import type { SectorMap } from './sectors.ts';
import type { Unit } from './unit.ts';
import { norm360 } from './walk.ts';

export type Weapon = 'PISTOLA' | 'MIRILLA' | 'CUCHILLO' | 'PUNO' | 'ESPOSAS';

/** Armas de contacto: caminan hasta el blanco (sin línea de tiro) y golpean a `KNIFE_CYCLES`. PUNO = `AuCachiporra` (`MSGA_CACHIPORRAZO` al cuadro 6), ESPOSAS = `AuEsposas` (`MSGA_HAS_SIDO_ESPOSADO`). */
const MELEE: ReadonlySet<Weapon> = new Set<Weapon>(['CUCHILLO', 'PUNO', 'ESPOSAS']);

/** Radio del ruido del disparo de la pistola (`PIPA` en la tabla de ruidos 0x821DE0, docs/engine/percepcion.md §4.3). */
export const PISTOL_NOISE = 600;

export const RANGE: Readonly<Record<Weapon, number>> = { PISTOLA: 300, MIRILLA: 1000, CUCHILLO: 28, PUNO: 28, ESPOSAS: 28 };
export const DAMAGE: Readonly<Record<Weapon, number>> = { PISTOLA: 40, MIRILLA: 100, CUCHILLO: 120, PUNO: 0, ESPOSAS: 0 };
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
}

const isDead = (t: Target): boolean => t.dead;

export interface AttackWorld {
  readonly sectors: SectorMap | null;
  /** Ruido de un disparo en (x,y) con su radio: los soldados a menos de ese radio lo oyen. */
  readonly noise: (x: number, y: number, radius: number) => void;
  /** Rastro visual de un disparo. */
  readonly onShot: (fromX: number, fromY: number, toX: number, toY: number) => void;
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
    const reach = RANGE[this.weapon];
    const clear = MELEE.has(this.weapon) || lineClear(w.sectors, b.x, b.y, tg.x, tg.y);
    if (d > reach || !clear) {
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
    const need = MELEE.has(this.weapon) ? KNIFE_CYCLES : AIM_CYCLES;
    if (this.aim === 0) {
      // PUNO: LANZARPIEDRA (AuCachiporra con el arma 0 del comando, docs/lectura/au-jugador.md §4); ESPOSAS: el comando no trae animación de esposar (shortcut: se queda quieto)
      const a = this.weapon === 'CUCHILLO' ? 'SACACUCHILLO' : this.weapon === 'PUNO' ? 'LANZARPIEDRA' : this.weapon === 'ESPOSAS' ? '' : this.weapon === 'MIRILLA' ? 'APUNTARIFLE' : 'APUNTAPISTOLA';
      if (u.anim.has(a)) u.anim.set(a);
    }
    if (++this.aim < need) return;
    if (!MELEE.has(this.weapon)) {
      const a = this.weapon === 'MIRILLA' ? 'DISPARARIFLE' : 'DISPARAPISTOLA';
      if (u.anim.has(a)) u.anim.set(a);
      w.onShot(b.x, b.y, tg.x, tg.y);
      if (this.weapon === 'PISTOLA') w.noise(b.x, b.y, PISTOL_NOISE);
    }
    if (u.ammo[this.weapon] !== undefined) u.ammo[this.weapon] = (u.ammo[this.weapon] ?? 0) - 1; // gasta 1 por disparo (tabla +0x78)
    tg.hurt(this.weapon, u);
    if (isDead(tg) || this.weapon === 'PUNO' || this.weapon === 'ESPOSAS') this.done = true; // hurt() cambia `dead`; el puño y las esposas son de un solo golpe
    else this.aim = need - SHOT_GAP;
  }
}
