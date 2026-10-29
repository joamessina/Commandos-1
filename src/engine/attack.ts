/**
 * Ataque de un comando a un soldado (AuDisparar / AuAcuchillar): se acerca hasta el alcance del arma con el blanco a la vista, apunta y dispara.
 * Datos del exe: tabla de armas `0x8143C0` (docs/lectura/au-disparar.md): PISTOLA alcance 300 y enfriamiento 1 ciclo, MIRILLA (rifle del francotirador)
 * 1000 y 10, con sonido solo la pistola (`DISPAROPISTOLA`; la tabla no trae sonido de la mirilla); cuchillo = `FUN_005986A0(.., tipo 7 CUCHILLADA, 120)` al
 * cuadro 6 de la animación, sin ruido (au-jugador.md §0b).
 * shortcut: el soldado muere de un golpe (energía de alemán por defecto sin leer); el apuntado tarda lo de la animación DESENFUNDA+APUNTA, aquí fijo en
 *           `AIM_CYCLES`; el cuchillo golpea a `KNIFE_RANGE` tras `KNIFE_CYCLES`; sin munición ni piedras/granadas. Cuándo mejorar: al leer AUDisparar completo.
 */
import { lineClear } from './vision.ts';
import type { SectorMap } from './sectors.ts';
import type { Soldier } from './soldier.ts';
import type { Unit } from './unit.ts';
import { norm360 } from './walk.ts';

export type Weapon = 'PISTOLA' | 'MIRILLA' | 'CUCHILLO';

export const RANGE: Readonly<Record<Weapon, number>> = { PISTOLA: 300, MIRILLA: 1000, CUCHILLO: 28 };
const AIM_CYCLES = 8;
const KNIFE_CYCLES = 12;
const REPATH_EVERY = 10;

export interface AttackWorld {
  readonly sectors: SectorMap | null;
  /** Ruido de un disparo en (x,y): los soldados cercanos lo oyen. */
  readonly noise: (x: number, y: number) => void;
  /** Rastro visual de un disparo. */
  readonly onShot: (fromX: number, fromY: number, toX: number, toY: number) => void;
}

export class Attack {
  readonly unit: Unit;
  readonly target: Soldier;
  readonly weapon: Weapon;
  /** true cuando terminó (blanco muerto o disparo hecho). */
  done = false;
  private t = 0;
  private aim = 0;

  constructor(unit: Unit, target: Soldier, weapon: Weapon) {
    this.unit = unit;
    this.target = target;
    this.weapon = weapon;
  }

  private face(x: number, y: number): void {
    const b = this.unit.body;
    b.ang = norm360((Math.atan2(y - b.y, x - b.x) * 180) / Math.PI);
  }

  tick(w: AttackWorld): void {
    const u = this.unit;
    const tg = this.target.unit;
    if (u.dead || tg.dead) {
      this.done = true;
      return;
    }
    const b = u.body;
    const d = Math.hypot(tg.body.x - b.x, tg.body.y - b.y);
    const reach = RANGE[this.weapon];
    const clear = this.weapon === 'CUCHILLO' || lineClear(w.sectors, b.x, b.y, tg.body.x, tg.body.y);
    if (d > reach || !clear) {
      this.aim = 0;
      if (this.t++ % REPATH_EVERY === 0) {
        const near = this.weapon === 'CUCHILLO' ? 0 : 0.8;
        const k = d > 0 ? Math.max(0, d - reach * near) / d : 0;
        u.goTo({ x: b.x + (tg.body.x - b.x) * k, y: b.y + (tg.body.y - b.y) * k }, false);
      }
      return;
    }
    u.stop();
    this.face(tg.body.x, tg.body.y);
    const need = this.weapon === 'CUCHILLO' ? KNIFE_CYCLES : AIM_CYCLES;
    if (this.aim === 0) {
      const a = this.weapon === 'CUCHILLO' ? 'SACACUCHILLO' : this.weapon === 'MIRILLA' ? 'APUNTARIFLE' : 'APUNTAPISTOLA';
      if (u.anim.has(a)) u.anim.set(a);
    }
    if (++this.aim < need) return;
    if (this.weapon !== 'CUCHILLO') {
      const a = this.weapon === 'MIRILLA' ? 'DISPARARIFLE' : 'DISPARAPISTOLA';
      if (u.anim.has(a)) u.anim.set(a);
      w.onShot(b.x, b.y, tg.body.x, tg.body.y);
      if (this.weapon === 'PISTOLA') w.noise(b.x, b.y);
    }
    this.target.kill();
    this.done = true;
  }
}
