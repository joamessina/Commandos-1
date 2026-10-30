/**
 * Combate de una misión: reparte el ciclo entre soldados y ataques de los comandos, propaga el ruido de los disparos (a menos de 200 u, `SONIDO_PELIGRO`)
 * y guarda los rastros de disparo para dibujarlos. Reglas en soldier.ts y attack.ts.
 */
import { Attack, type Target, type Weapon } from './attack.ts';
import type { SectorMap } from './sectors.ts';
import { GUNSHOT_RADIUS, type Shot, type Soldier } from './soldier.ts';
import type { Unit } from './unit.ts';

/** Rastro de un disparo (se dibuja unos ciclos). */
export interface Tracer extends Shot {
  ttl: number;
  readonly enemy: boolean;
}

const TRACER_CYCLES = 4;

export class Battle {
  readonly soldiers: Soldier[];
  readonly commandos: Unit[];
  readonly tracers: Tracer[] = [];
  private readonly attacks = new Map<Unit, Attack>();
  private readonly sectors: SectorMap | null;
  private readonly rng: () => number;

  constructor(soldiers: Soldier[], commandos: Unit[], sectors: SectorMap | null, rng: () => number = Math.random) {
    this.soldiers = soldiers;
    this.commandos = commandos;
    this.sectors = sectors;
    this.rng = rng;
  }

  /** Todos los comandos muertos = misión perdida. */
  get lost(): boolean {
    return this.commandos.length > 0 && this.commandos.every((c) => c.dead);
  }

  /** Ordena un ataque (reemplaza el que tuviera). */
  attack(unit: Unit, target: Target, weapon: Weapon): void {
    this.attacks.set(unit, new Attack(unit, target, weapon));
  }

  /** Cancela el ataque en curso de un comando (nueva orden de movimiento, Esc). */
  cancel(unit: Unit): void {
    this.attacks.delete(unit);
  }

  attacking(unit: Unit): boolean {
    return this.attacks.has(unit);
  }

  private noise(x: number, y: number): void {
    for (const s of this.soldiers) if (Math.hypot(s.unit.body.x - x, s.unit.body.y - y) < GUNSHOT_RADIUS) s.hear(x, y);
  }

  /** Un ciclo lógico (los movimientos de los comandos los hace `Unit.tick` fuera). */
  tick(): void {
    for (const [u, a] of this.attacks) {
      a.tick({
        sectors: this.sectors,
        noise: (x, y) => {
          this.noise(x, y);
        },
        onShot: (fx, fy, tx, ty) => this.tracers.push({ fromX: fx, fromY: fy, toX: tx, toY: ty, hit: true, ttl: TRACER_CYCLES, enemy: false }),
      });
      if (a.done) this.attacks.delete(u);
    }
    for (const s of this.soldiers) {
      s.tick({
        commandos: this.commandos,
        sectors: this.sectors,
        rng: this.rng,
        onShot: (from, shot) => {
          this.tracers.push({ ...shot, ttl: TRACER_CYCLES, enemy: true });
          for (const o of this.soldiers) if (o !== from && Math.hypot(o.unit.body.x - shot.fromX, o.unit.body.y - shot.fromY) < GUNSHOT_RADIUS) o.hear(shot.fromX, shot.fromY);
        },
      });
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) if (--(this.tracers[i] as Tracer).ttl <= 0) this.tracers.splice(i, 1);
  }
}
