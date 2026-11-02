/**
 * Combate de una misión: reparte el ciclo entre soldados y ataques de los comandos, propaga el ruido de los disparos (radio de la tabla de ruidos: pistola 600, fusil 400)
 * y guarda los rastros de disparo para dibujarlos. Reglas en soldier.ts y attack.ts.
 */
import { Attack, type Target, type Weapon } from './attack.ts';
import type { SectorMap } from './sectors.ts';
import { CHAT_CYCLES, CHAT_RANGE, type Shot, type Soldier } from './soldier.ts';
import { Packs, STONE_NOISE } from './throwing.ts';
import type { Unit } from './unit.ts';

/** Rastro de un disparo (se dibuja unos ciclos). */
export interface Tracer extends Shot {
  ttl: number;
  readonly enemy: boolean;
  /** Código de sonido del disparo (tabla del exe, engine/sound-table.ts): `PIPA` pistola, `MIRI` mirilla y arpón, `FUSL` fusil alemán, `NIDO` nido. */
  readonly tag?: string;
}

const SHOT_TAG: Readonly<Partial<Record<Weapon, string>>> = { PISTOLA: 'PIPA', MIRILLA: 'MIRI', ARPON: 'MIRI' };

const TRACER_CYCLES = 4;
const NEST_NOISE = 500;
/** Distancia a la que la piedra alcanza a un soldado como víctima (cilindro de R10 del bicho). */
const STONE_HIT = 14;

export class Battle {
  readonly soldiers: Soldier[];
  readonly commandos: Unit[];
  readonly tracers: Tracer[] = [];
  /** Cajetillas de tabaco en el suelo. */
  readonly packs = new Packs();
  private readonly attacks = new Map<Unit, Attack>();
  private readonly sectors: SectorMap | null;
  private readonly rng: () => number;
  /** Se avisa de cada ruido de peligro (disparo de pistola de un comando o de un soldado) en (x, y): lo usan los sensores de zona (engine/groups.ts). */
  onDanger: ((x: number, y: number) => void) | null = null;
  onMissionEvent: ((event: string) => void) | null = null;

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

  /** Ruido en (x,y): los soldados a menos del radio lo oyen. */
  noise(x: number, y: number, radius: number): void {
    for (const s of this.soldiers) if (Math.hypot(s.unit.body.x - x, s.unit.body.y - y) < radius) s.hear(x, y);
  }

  /** La piedra cae en (x,y) (`CAcPiedra`): ruido de atención `PEDL` y, si cae sobre un soldado, le manda `MSGA_PEDRADA` (sin daño). */
  stone(x: number, y: number, from: Unit): void {
    this.noise(x, y, STONE_NOISE);
    this.soldiers.find((s) => !s.dead && Math.hypot(s.x - x, s.y - y) < STONE_HIT)?.pedrada(from);
  }

  /** Un ciclo lógico (los movimientos de los comandos los hace `Unit.tick` fuera). */
  tick(): void {
    for (const [u, a] of this.attacks) {
      a.tick({
        sectors: this.sectors,
        noise: (x, y, r) => {
          this.noise(x, y, r);
          this.onDanger?.(x, y);
        },
        onShot: (fx, fy, tx, ty, weapon) => this.tracers.push({ fromX: fx, fromY: fy, toX: tx, toY: ty, hit: true, ttl: TRACER_CYCLES, enemy: false, ...(SHOT_TAG[weapon] ? { tag: SHOT_TAG[weapon] } : {}) }),
      });
      if (a.done) this.attacks.delete(u);
    }
    const bodies = [...this.soldiers.filter((s) => s.dead && !s.unit.hidden).map((s) => ({ x: s.x, y: s.y, z: s.unit.z })), ...this.commandos.filter((c) => c.dead && !c.hidden).map((c) => ({ x: c.body.x, y: c.body.y, z: c.z }))];
    // control alemán: el que anda cerca de un controlado se pone a charlar (ECHAR_CHARLA)
    for (const c of this.soldiers) {
      if (!c.controlled || c.dead) continue;
      for (const s of this.soldiers) if (s !== c && Math.hypot(s.x - c.x, s.y - c.y) < CHAT_RANGE) s.chat(c.x, c.y, CHAT_CYCLES);
    }
    for (const s of this.soldiers) {
      s.tick({
        packs: this.packs,
        commandos: this.commandos,
        bodies,
        sectors: this.sectors,
        rng: this.rng,
        onEvent: (event) => this.onMissionEvent?.(event),
        onVoice: (from, voice) => {
          const radius = voice === 'ALRM' ? 300 : 150;
          for (const other of this.soldiers) if (other !== from && Math.hypot(other.x - from.x, other.y - from.y) < radius) other.hear(from.x, from.y);
          if (voice === 'ALRM') this.onDanger?.(from.x, from.y);
        },
        onShot: (from, shot) => {
          this.tracers.push({ ...shot, ttl: TRACER_CYCLES, enemy: true, tag: from.noiseRadius === NEST_NOISE ? 'NIDO' : 'FUSL' }); // radio 500 = nido, 400 = fusil (tabla de ruidos 0x821DE0)
          this.onDanger?.(shot.fromX, shot.fromY);
          for (const o of this.soldiers) if (o !== from && Math.hypot(o.unit.body.x - shot.fromX, o.unit.body.y - shot.fromY) < from.noiseRadius) o.hear(shot.fromX, shot.fromY);
        },
      });
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) if (--(this.tracers[i] as Tracer).ttl <= 0) this.tracers.splice(i, 1);
  }
}
