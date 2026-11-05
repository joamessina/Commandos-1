/**
 * Combate de una misión: reparte el ciclo entre soldados y ataques de los comandos, propaga el ruido de los disparos (radio de la tabla de ruidos: pistola 600, fusil 400)
 * y guarda los rastros de disparo para dibujarlos. Reglas en soldier.ts y attack.ts.
 */
import { Attack, type AttackWorld, type Target, type Weapon } from './attack.ts';
import type { SectorMap } from './sectors.ts';
import { CHAT_CYCLES, CHAT_RANGE, type NestImpact, type Shot, type Soldier, type SoldierVoice } from './soldier.ts';
import { Packs, STONE_NOISE } from './throwing.ts';
import type { Unit } from './unit.ts';

/** Rastro de un disparo (se dibuja unos ciclos). */
export interface Tracer extends Shot {
  ttl: number;
  readonly enemy: boolean;
  /** Código de sonido del disparo (tabla del exe, engine/sound-table.ts): `PIPA` pistola, `MIRI` mirilla y arpón, `FUSL` fusil alemán, `NIDO` nido. */
  readonly tag?: string;
}

/** Voz emitida durante el ciclo, con la posición del emisor al producirse. */
export interface VoiceSound {
  readonly tag: SoldierVoice;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface EffectSound { readonly tag: string; readonly x: number; readonly y: number; readonly z: number }
export interface NestPuff extends NestImpact { age: number; hit: boolean }

const SHOT_TAG: Readonly<Partial<Record<Weapon, string>>> = { PISTOLA: 'PIPA', MIRILLA: 'MIRI', ARPON: 'MIRI' };

const TRACER_CYCLES = 4;
const NEST_NOISE = 500;
/** shortcut: 14 aproxima el contacto de la piedra con el cilindro del soldado; mejorar al portar su colisión dinámica. */
const STONE_HIT = 14;

export class Battle {
  readonly soldiers: Soldier[];
  readonly commandos: Unit[];
  readonly tracers: Tracer[] = [];
  readonly nestPuffs: NestPuff[] = [];
  private readonly voices: VoiceSound[] = [];
  private readonly effects: EffectSound[] = [];
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
    const attack = new Attack(unit, target, weapon);
    // shortcut: cada clic de arma de fuego se procesa de inmediato, incluso si llegan varios en el mismo ciclo de 50 ms.
    if (weapon === 'PISTOLA' || weapon === 'MIRILLA' || weapon === 'ARPON') attack.tick(this.attackWorld());
    if (attack.done) this.attacks.delete(unit);
    else this.attacks.set(unit, attack);
  }

  private attackWorld(): AttackWorld {
    return {
      sectors: this.sectors,
      noise: (x, y, r) => { this.noise(x, y, r); this.onDanger?.(x, y); },
      onShot: (fx, fy, tx, ty, weapon) => this.tracers.push({ fromX: fx, fromY: fy, toX: tx, toY: ty, hit: true, ttl: TRACER_CYCLES, enemy: false, ...(SHOT_TAG[weapon] ? { tag: SHOT_TAG[weapon] } : {}) }),
    };
  }

  /** Cancela el ataque en curso de un comando (nueva orden de movimiento, Esc). */
  cancel(unit: Unit): void {
    this.attacks.delete(unit);
  }

  attacking(unit: Unit): boolean {
    return this.attacks.has(unit);
  }

  /** Entrega las voces una sola vez al reproductor, incluso si hay varios ciclos por cuadro. */
  takeVoices(): VoiceSound[] {
    return this.voices.splice(0);
  }

  takeEffects(): EffectSound[] { return this.effects.splice(0); }

  /** Ruido en (x,y): los soldados a menos del radio lo oyen. */
  noise(x: number, y: number, radius: number): void {
    for (const s of this.soldiers) if (Math.hypot(s.unit.body.x - x, s.unit.body.y - y) < radius) s.hear(x, y);
  }

  /** La piedra cae en (x,y) (`CAcPiedra`): ruido de atención `PEDL` y, si cae sobre un soldado, le manda `MSGA_PEDRADA` (sin daño). */
  stone(x: number, y: number, from: Unit, z = 0, water = false): boolean {
    this.noise(x, y, STONE_NOISE);
    const victim = this.soldiers.find((s) => !s.dead && Math.hypot(s.x - x, s.y - y) < STONE_HIT && Math.abs(s.unit.z - z) <= s.unit.height);
    victim?.pedrada(from);
    this.effects.push({ tag: water && !victim ? 'PEDW' : 'PEDL', x, y, z });
    return victim !== undefined;
  }

  /** Un ciclo lógico (los movimientos de los comandos los hace `Unit.tick` fuera). */
  tick(): void {
    for (let i = this.nestPuffs.length - 1; i >= 0; i--) {
      const puff = this.nestPuffs[i];
      if (!puff) continue;
      // shortcut: solo comandos exteriores; falta el árbol y despacho dinámico de 0057D730/00676DE0.
      const victim = !puff.hit && this.commandos.find((c) => !c.dead && !c.hidden && !c.boat && Math.hypot(c.body.x - puff.x, c.body.y - puff.y) < 15 && puff.z <= c.z + c.eye && c.z <= puff.z + 5);
      if (victim) { victim.hit(30); puff.hit = true; }
      if (++puff.age >= 8) this.nestPuffs.splice(i, 1);
    }
    for (const [u, a] of this.attacks) {
      a.tick(this.attackWorld());
      if (a.done) this.attacks.delete(u);
    }
    const bodies = [...this.soldiers.filter((s) => s.dead && !s.unit.hidden).map((s) => ({ x: s.x, y: s.y, z: s.unit.z })), ...this.commandos.filter((c) => c.dead && !c.hidden).map((c) => ({ x: c.body.x, y: c.body.y, z: c.z }))];
    // control alemán: el que anda cerca de un controlado se pone a charlar (ECHAR_CHARLA)
    for (const c of this.soldiers) {
      if (!c.controlled || c.dead) continue;
      for (const s of this.soldiers) if (s !== c && Math.hypot(s.x - c.x, s.y - c.y) < CHAT_RANGE) s.chat(c.x, c.y, CHAT_CYCLES);
    }
    for (const s of this.soldiers) {
      for (let n = s.takeImpactSounds(); n > 0; n--) this.effects.push({ tag: 'HERI', x: s.x, y: s.y, z: s.unit.z });
      for (let n = s.takeStoneVoices(); n > 0; n--) this.effects.push({ tag: 'AL01', x: s.x, y: s.y, z: s.unit.z });
      s.tick({
        packs: this.packs,
        commandos: this.commandos,
        bodies,
        sectors: this.sectors,
        rng: this.rng,
        onEvent: (event) => this.onMissionEvent?.(event),
        onNestImpact: (impact) => { this.nestPuffs.push({ ...impact, age: 0, hit: false }); },
        onVoice: (from, voice) => {
          this.voices.push({ tag: voice, x: from.x, y: from.y, z: from.unit.z });
          if (voice === 'AL07') return;
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
