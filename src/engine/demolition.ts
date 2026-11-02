/**
 * Explosivos y destrucción (docs/lectura/obj-explosivos.md, docs/engine/armas-danio.md §6): barril (radio 100, EXPLOSIONMENOR), bomba del zapador con detonador
 * (radio 250, BOMBA, instantánea porque BOMBAACT trae `RETARDO 0`), y los volúmenes del mapa que se destruyen (`.AUTOEXPCASAS`, `acExplotaCasa` con
 * `.CAMBIATILES`): por defecto `th[BOMBA]=th[EXPLOSIONMENOR]=1`, o sea una explosión que alcance basta. El ruido de la explosión (`XPLO`/`EBAR`) lo oyen los
 * soldados a 1200 u. Cambio de tiles: `CAMBIATILES [ .MAPA X .TILES [ a b … ] ]` son pares «sprite → sprite» (`NADA` = quitarlo; verificado contra
 * ANTENA/CASA04/FARO01); sin `.TILES` el volumen pasa a ruinas (los tiles con guion `-RUINA…` se muestran sin él y el resto se quita).
 * shortcut: el daño de área mata a todo el que esté dentro del radio (sin la fórmula de FUN_00571FE0 ni caída con la distancia), sin cráteres, sin
 *           temblor de cámara ni partículas (un círculo), la bomba se planta al instante donde está el zapador (sin PONEBOMBA ni caminar) y los umbrales
 *           `.IMPACTOS` distintos de 1 no se leen. Cuándo mejorar: al leer FUN_00571FE0 y AuManejaBomba.
 */
import { asList, asNumbers, asText, find, parseClave, type Node } from '../formats/clave.ts';
import type { Vol } from '../formats/vol.ts';
import type { Target, Weapon } from './attack.ts';
import type { Boat } from './boat.ts';
import type { SectorMap } from './sectors.ts';
import type { Soldier } from './soldier.ts';
import type { Unit } from './unit.ts';
import type { Elem } from './world.ts';

export const BARREL_RADIUS = 100;
export const BOMB_RADIUS = 250;
const NOISE_RADIUS = 1200; // XPLO / EBAR en la tabla de ruidos (0x821DE0)
const BLAST_CYCLES = 12;

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Qué hacer con un volumen al destruirse: pares de renombre de tiles, o null = ruinas. */
export interface Swap {
  readonly poly: string;
  readonly pairs: ReadonlyMap<string, string> | null;
}

export interface Site {
  readonly name: string;
  readonly rect: Rect;
  readonly swaps: readonly Swap[];
  /** Objetivos de la misión que esto cumple al destruirse. */
  readonly objectives: readonly string[];
  destroyed: boolean;
}

export interface Blast {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tag: 'XPLO' | 'EBAR';
  ttl: number;
}

const dist2Rect = (r: Rect, x: number, y: number): number => {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dy = Math.max(r.y0 - y, 0, y - r.y1);
  return dx * dx + dy * dy;
};

function pairsOf(n: Node | undefined): Map<string, string> | null {
  const l = asList(n);
  if (!l || l.length === 0) return null;
  const m = new Map<string, string>();
  for (let i = 0; i + 1 < l.length; i += 2) m.set(String(l[i]).toUpperCase(), String(l[i + 1]).toUpperCase());
  return m;
}

/** Caja de un polígono del VOL (puntos relativos al centro de la cabecera). */
function polyRect(vol: Vol, name: string): Rect | null {
  const p = vol.polys.find((q) => q.name === name);
  if (!p || p.points.length === 0) return null;
  const cx = p.header[0] ?? 0;
  const cy = p.header[1] ?? 0;
  const xs = p.points.map((q) => cx + q.x);
  const ys = p.points.map((q) => cy + q.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Sitios destructibles de una misión: cada `.AUTOEXPCASAS [ [ .MAP X (.TILES …) ] ]` y cada elemento con `acExplotaCasa` (su cilindro de colisión es la caja;
 * `.CAMBIATILES` dice qué volúmenes cambian). Los objetivos son los tokens de `.OBJETIVOS [ [ .OBJETIVO t ] ]`.
 */
export function parseSites(misText: string, vol: Vol, elems: readonly Elem[]): { sites: Site[]; objectives: string[]; escape: { x: number; y: number } | null; kills: Map<string, KillZone[]> } {
  const mission = asList(find(parseClave(misText), '.MISSION')) ?? [];
  const sites: Site[] = [];
  for (const e of asList(find(mission, '.AUTOEXPCASAS')) ?? []) {
    const l = asList(e) ?? [];
    const name = asText(find(l, '.MAP'));
    const rect = name ? polyRect(vol, name) : null;
    if (name && rect) sites.push({ name, rect, swaps: [{ poly: name, pairs: pairsOf(find(l, '.TILES')) }], objectives: [name], destroyed: false });
  }
  for (const el of elems) {
    const a = el.actions.find((x) => x.name.toUpperCase() === 'ACEXPLOTACASA');
    if (!a) continue;
    const swaps: Swap[] = [];
    for (const c of asList(find(a.params, '.CAMBIATILES')) ?? []) {
      const cl = asList(c) ?? [];
      const poly = asText(find(cl, '.MAPA'));
      if (poly) swaps.push({ poly, pairs: pairsOf(find(cl, '.TILES')) });
    }
    const r = Math.max(el.radius, 1);
    sites.push({ name: el.token, rect: { x0: el.x - r, y0: el.y - r, x1: el.x + r, y1: el.y + r }, swaps, objectives: swaps.map((s) => s.poly), destroyed: false });
  }
  const objectives: string[] = [];
  const info = asList(find(mission, '.INTENDENCIAINFO')) ?? [];
  for (const o of asList(find(info, '.OBJETIVOS')) ?? []) {
    const t = asText(find(asList(o) ?? [], '.OBJETIVO'));
    if (t) objectives.push(t);
  }
  const esc = asNumbers(find(info, '.PUNTOHUIDA'));
  const kills = new Map<string, KillZone[]>();
  for (const m of asList(find(info, '.MATABICHOSSECTOR')) ?? []) {
    const ml = asList(m) ?? [];
    const token = asText(find(ml, '.TOKEN'));
    if (!token) continue;
    const zones: KillZone[] = [];
    for (const s of asList(find(ml, '.SECTORS')) ?? []) {
      const sl = asList(s) ?? [];
      const p = asNumbers(find(sl, '.XYZ'));
      if (p?.length === 3) zones.push({ x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0, vanish: asText(find(sl, '.DESAPARECE')) === '1' });
    }
    kills.set(token, zones);
  }
  return { sites, objectives, escape: esc && esc.length >= 2 ? { x: esc[0] ?? 0, y: esc[1] ?? 0 } : null, kills };
}

/** Barril explosivo (`AcBarrilExpl`): estalla con un disparo (DISPARO está en su lista) o con otra explosión. */
export class Barrel implements Target {
  readonly token: string;
  readonly x: number;
  readonly y: number;
  dead = false;
  private readonly owner: Demolition;

  constructor(owner: Demolition, token: string, x: number, y: number) {
    this.owner = owner;
    this.token = token;
    this.x = x;
    this.y = y;
  }

  hurt(weapon: Weapon): void {
    if (weapon === 'PISTOLA' || weapon === 'MIRILLA') this.owner.blowBarrel(this);
  }
}

/** Mina submarina (`MINASUB`: cilindro R 17, POTENCIAMINA 10000, RADIOACCIONMINA 20; `AcMina`, docs/lectura/obj-explosivos.md §1). */
export interface Mine {
  readonly x: number;
  readonly y: number;
  /** Ciclos que faltan para explotar tras ser pisada (null = armada sin pisar). */
  fuse: number | null;
  done: boolean;
}

const MINE_R = 17;
const MINE_BLAST = 20; // RADIOACCIONMINA
const MINE_FUSE = 20; // la mina disparada explota 1 s después (+0x18 > 0x13)

/** Zona de `MATABICHOSSECTOR`: al morir el elemento disparador (su token) mueren los bichos del sector bajo (x,y,z) (`FUN_0059D490`, impacto 1 / 1000); con `DESAPARECE` el cuerpo desaparece. */
export interface KillZone {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vanish: boolean;
}

export interface People {
  readonly soldiers: readonly Soldier[];
  readonly commandos: readonly Unit[];
}

export class Demolition {
  readonly sites: Site[];
  readonly barrels: Barrel[] = [];
  readonly planted: { x: number; y: number }[] = [];
  readonly mines: Mine[] = [];
  /** El Zodiac se hundió con una mina: sus ocupantes murieron. */
  boatSunk = false;
  readonly blasts: Blast[] = [];
  readonly objectives: Map<string, boolean>;
  /** Bombas que le quedan al zapador. */
  bombs: number;
  /** El mapa cambió (hay que recomponerlo). */
  dirty = false;
  /** Tokens de lo ya destruido (sitios y sus objetivos): lo consultan otras reglas (p. ej. la escalera ESCALA02 se desactiva con CASA04). */
  readonly destroyed = new Set<string>();
  private readonly people: People;
  private readonly sectors: Pick<SectorMap, 'atZ' | 'at'> | null;
  private readonly kills: ReadonlyMap<string, readonly KillZone[]>;
  private readonly queue: { x: number; y: number; r: number; tag: Blast['tag'] }[] = [];

  constructor(sites: Site[], objectives: readonly string[], people: People, bombs = 0, opts: { sectors?: Pick<SectorMap, 'atZ' | 'at'> | null; kills?: ReadonlyMap<string, readonly KillZone[]> } = {}) {
    this.sectors = opts.sectors ?? null;
    this.kills = opts.kills ?? new Map();
    this.sites = sites;
    this.objectives = new Map(objectives.map((o) => [o, false]));
    this.people = people;
    this.bombs = bombs;
  }

  addMine(x: number, y: number): void {
    this.mines.push({ x, y, fuse: null, done: false });
  }

  /**
   * Minas: un cuerpo con masa > PESOACT (60; el Zodiac pesa 400) que toque el cilindro (R 17 + el del bote) la dispara y explota 20 ciclos después con
   * potencia 10000: lo que esté dentro del radio de la mina o a bordo del bote muere y el bote se hunde.
   * shortcut: pisan minas el bote y el buzo (la masa del comando no se leyó: el exe exige masa > PESOACT; a pie no la pisa nadie); la mina no se activa por impactos.
   */
  tickMines(boat: Boat | null, riders: readonly Unit[]): void {
    for (const m of this.mines) {
      if (m.done) continue;
      if (m.fuse === null) {
        if (boat && !this.boatSunk && Math.hypot(boat.x - m.x, boat.y - m.y) < MINE_R + boat.radius) m.fuse = MINE_FUSE;
        // un buzo que la toca recibe el impacto EXPLOSIONMENOR de 10000 (muere en el acto) y la mina explota 20 ciclos después
        for (const u of riders) {
          if (u.diving && !u.dead && Math.hypot(u.body.x - m.x, u.body.y - m.y) < MINE_R + 10) {
            u.wound(1e9);
            m.fuse = MINE_FUSE;
          }
        }
        continue;
      }
      if (--m.fuse > 0) continue;
      m.done = true;
      this.explode(m.x, m.y, MINE_BLAST);
      if (boat && !this.boatSunk && Math.hypot(boat.x - m.x, boat.y - m.y) < MINE_BLAST + boat.radius + 20) {
        this.boatSunk = true;
        boat.puncture();
        for (const u of riders) if (u.boat === boat) u.wound(1e9);
      }
    }
  }

  addBarrel(token: string, x: number, y: number): Barrel {
    const b = new Barrel(this, token, x, y);
    this.barrels.push(b);
    return b;
  }

  /** Planta una bomba (AuManejaBomba, sin la animación) donde está el zapador. */
  plant(x: number, y: number): boolean {
    if (this.bombs <= 0) return false;
    this.bombs--;
    this.planted.push({ x, y });
    return true;
  }

  /** Activa el detonador: explotan todas las bombas plantadas. */
  detonate(): number {
    const n = this.planted.length;
    for (const b of this.planted.splice(0)) this.explode(b.x, b.y, BOMB_RADIUS);
    return n;
  }

  blowBarrel(b: Barrel): void {
    if (b.dead) return;
    b.dead = true;
    this.explode(b.x, b.y, BARREL_RADIUS, 'EBAR');
  }

  /** Explosión en (x,y): mata a las personas dentro del radio, encadena barriles y bombas, destruye sitios y avisa a los soldados. */
  explode(x: number, y: number, radius: number, tag: Blast['tag'] = 'XPLO'): void {
    this.queue.push({ x, y, r: radius, tag });
    while (this.queue.length > 0) {
      const e = this.queue.shift();
      if (e) this.blast(e.x, e.y, e.r, e.tag);
    }
  }

  private blast(x: number, y: number, r: number, tag: Blast['tag']): void {
    this.blasts.push({ x, y, radius: r, tag, ttl: BLAST_CYCLES });
    for (const s of this.people.soldiers) if (!s.dead && Math.hypot(s.x - x, s.y - y) <= r) s.kill();
    for (const c of this.people.commandos) if (!c.dead && Math.hypot(c.body.x - x, c.body.y - y) <= r) c.wound(1e9);
    for (const b of this.barrels) {
      if (b.dead || Math.hypot(b.x - x, b.y - y) > r) continue;
      b.dead = true;
      this.queue.push({ x: b.x, y: b.y, r: BARREL_RADIUS, tag: 'EBAR' });
    }
    for (let i = this.planted.length - 1; i >= 0; i--) {
      const p = this.planted[i];
      if (p && Math.hypot(p.x - x, p.y - y) <= r) {
        this.planted.splice(i, 1);
        this.queue.push({ x: p.x, y: p.y, r: BOMB_RADIUS, tag: 'XPLO' });
      }
    }
    for (const s of this.sites) {
      if (s.destroyed || dist2Rect(s.rect, x, y) > r * r) continue;
      s.destroyed = true;
      this.dirty = true;
      this.destroyed.add(s.name);
      for (const o of s.objectives) {
        this.destroyed.add(o);
        if (this.objectives.has(o)) this.objectives.set(o, true);
        this.fireKills(o);
      }
      this.fireKills(s.name);
    }
    for (const s of this.people.soldiers) if (!s.dead && Math.hypot(s.x - x, s.y - y) <= NOISE_RADIUS) s.hear(x, y);
  }

  /** MATABICHOSSECTOR (`FUN_0059D490`): al destruirse `token` mueren los de los sectores listados. */
  private fireKills(token: string): void {
    for (const z of this.kills.get(token) ?? []) {
      const sec = this.sectors?.atZ(z.x, z.y, z.z) ?? this.sectors?.at(z.x, z.y) ?? null;
      if (!sec) continue;
      for (const s of this.people.soldiers) {
        if (s.unit.sector !== sec) continue;
        s.kill();
        if (z.vanish) s.unit.hidden = true;
      }
      for (const c of this.people.commandos) {
        if (c.sector !== sec || c.boat) continue;
        c.hit(1e9);
        if (z.vanish) c.hidden = true;
      }
    }
  }

  /** Estado del mapa para recomponerlo: renombres de tiles por volumen y volúmenes en ruinas. */
  mapState(): { rename: Map<string, ReadonlyMap<string, string>>; ruined: Set<string> } {
    const rename = new Map<string, ReadonlyMap<string, string>>();
    const ruined = new Set<string>();
    for (const s of this.sites) {
      if (!s.destroyed) continue;
      for (const w of s.swaps) {
        if (w.pairs) rename.set(w.poly, w.pairs);
        else ruined.add(w.poly);
      }
    }
    return { rename, ruined };
  }

  /** Todos los objetivos cumplidos. */
  get objectivesDone(): boolean {
    return [...this.objectives.values()].every(Boolean);
  }

  /** Un ciclo: apaga las explosiones viejas. */
  tick(): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) if (--(this.blasts[i] as Blast).ttl <= 0) this.blasts.splice(i, 1);
  }
}
