/**
 * Explosivos y destrucción (docs/lectura/obj-explosivos.md, docs/engine/armas-danio.md §6): barril (radio 100, EXPLOSIONMENOR), bomba del zapador con detonador
 * (radio 250, BOMBA, instantánea porque BOMBAACT trae `RETARDO 0`), y los volúmenes del mapa que se destruyen (`.AUTOEXPCASAS`, `acExplotaCasa` con
 * `.CAMBIATILES`): por defecto `th[BOMBA]=th[EXPLOSIONMENOR]=1`, o sea una explosión que alcance basta. El ruido de la explosión (`XPLO`/`EBAR`) lo oyen los
 * soldados a 1200 u. Cambio de tiles: `CAMBIATILES [ .MAPA X .TILES [ a b … ] ]` son pares «sprite → sprite» (`NADA` = quitarlo; verificado contra
 * ANTENA/CASA04/FARO01); sin `.TILES` el volumen pasa a ruinas (los tiles con guion `-RUINA…` se muestran sin él y el resto se quita).
 * shortcut: el daño de área mata a todo el que esté dentro del radio (sin la fórmula de FUN_00571FE0 ni caída con la distancia), sin cráteres, sin
 *           temblor de cámara ni partículas, la bomba se planta al instante donde está el zapador (sin PONEBOMBA ni caminar) y los umbrales
 *           `.IMPACTOS` distintos de 1 no se leen. Cuándo mejorar: al leer FUN_00571FE0 y AuManejaBomba.
 */
import { asList, asNumbers, asText, find, parseClave, type Node } from '../formats/clave.ts';
import type { Vol } from '../formats/vol.ts';
import type { Target, Weapon } from './attack.ts';
import type { Boat } from './boat.ts';
import type { Nav } from './path.ts';
import type { SectorMap } from './sectors.ts';
import type { Soldier } from './soldier.ts';
import type { Unit } from './unit.ts';
import type { Elem } from './world.ts';

export const BARREL_RADIUS = 100;
export const BOMB_RADIUS = 250;
const NOISE_RADIUS = 1200; // XPLO / EBAR en la tabla de ruidos (0x821DE0)
export const BLAST_CYCLES = 20; // EXPLOS1/EXPLOSION1, duración temporal del ANM

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
  /** Volumen secundario que reenvía el impacto al edificio principal (`AcTransmiteImpacto`). */
  readonly forwardsTo?: string;
  readonly bombOnly?: boolean;
  readonly z?: number;
  readonly height?: number;
  readonly shape?: { readonly points: readonly { readonly x: number; readonly y: number }[] } | { readonly x: number; readonly y: number; readonly radius: number };
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

/** 00529FE0: el círculo solapa el interior, una arista o un vértice del polígono. */
function siteOverlap(site: Site, x: number, y: number, r: number): boolean {
  const shape = site.shape;
  if (!shape) return dist2Rect(site.rect, x, y) <= r * r;
  if ('radius' in shape) return Math.hypot(shape.x - x, shape.y - y) < shape.radius + r;
  let inside = true;
  for (let i = 0; i < shape.points.length; i++) {
    const a = shape.points[i];
    const b = shape.points[(i + 1) % shape.points.length];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const side = ((x - a.x) * dy - (y - a.y) * dx) / length;
    if (side > 0) inside = false;
    const projection = (x - a.x) * dx + (y - a.y) * dy;
    if (side >= 0 && side <= r && projection > 0 && projection < length * length) return true;
    if ((x - a.x) ** 2 + (y - a.y) ** 2 < r * r) return true;
  }
  return inside;
}

function polyShape(poly: Vol['polys'][number]): NonNullable<Site['shape']> {
  const x = poly.header[0] ?? 0, y = poly.header[1] ?? 0;
  return poly.points.length ? { points: poly.points.map((point) => ({ x: x + point.x, y: y + point.y })) } : { x, y, radius: poly.radio ?? 0 };
}

/** Intersección de la primera pasada de `00571E50`: cilindro de radio y altura r desde la fuente. */
function areaOverlaps(x: number, y: number, z: number, r: number, target: { readonly x: number; readonly y: number; readonly z: number; readonly radius: number; readonly height: number }): boolean {
  return r > 0 && target.z <= z + r && z <= target.z + target.height && Math.hypot(target.x - x, target.y - y) < r + target.radius;
}

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
  if (!p) return null;
  const cx = p.header[0] ?? 0;
  const cy = p.header[1] ?? 0;
  if (p.points.length === 0) return p.radio === null ? null : { x0: cx - p.radio, y0: cy - p.radio, x1: cx + p.radio, y1: cy + p.radio };
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
  const strong = new Set((asList(find(mission, '.CASASFUERTES')) ?? []).map((node) => asText(find(asList(node) ?? [], '.MAP'))).filter((name): name is string => name !== undefined));
  const sites: Site[] = [];
  for (const e of asList(find(mission, '.AUTOEXPCASAS')) ?? []) {
    const l = asList(e) ?? [];
    const name = asText(find(l, '.MAP'));
    const rect = name ? polyRect(vol, name) : null;
    const poly = vol.polys.find((p) => p.name === name);
    if (name && rect && poly) sites.push({ name, rect, shape: polyShape(poly), z: poly.header[2] ?? 0, height: poly.header[3] ?? 0, swaps: [{ poly: name, pairs: pairsOf(find(l, '.TILES')) }], objectives: [name], bombOnly: strong.has(name), destroyed: false });
  }
  // 005278A0 crea detectores para CASA y reenvía los sufijos distintos de A al edificio principal.
  for (const poly of vol.polys) {
    const match = /^(CASA\d+)(.*)$/i.exec(poly.name);
    if (!match || match[2]?.toUpperCase() === 'EXP1' || sites.some((site) => site.name === poly.name)) continue;
    const rect = polyRect(vol, poly.name);
    if (!rect) continue;
    const suffix = match[2]?.toUpperCase() ?? '';
    if (suffix !== '' && suffix !== 'A') {
      sites.push({ name: poly.name, rect, shape: polyShape(poly), z: poly.header[2] ?? 0, height: poly.header[3] ?? 0, swaps: [], objectives: [], forwardsTo: `${match[1] ?? ''}A`, destroyed: false });
      continue;
    }
    const base = match[1] ?? '';
    const swaps = vol.polys.filter((p) => {
      const part = new RegExp(`^${base}(.*)$`, 'i').exec(p.name)?.[1]?.toUpperCase();
      return part !== undefined && part !== 'EXP1';
    }).map((p) => ({ poly: p.name, pairs: null }));
    sites.push({ name: poly.name, rect, shape: polyShape(poly), z: poly.header[2] ?? 0, height: poly.header[3] ?? 0, swaps, objectives: [poly.name], bombOnly: strong.has(base), destroyed: false });
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
    sites.push({ name: el.token, rect: { x0: el.x - r, y0: el.y - r, x1: el.x + r, y1: el.y + r }, shape: { x: el.x, y: el.y, radius: r }, z: el.z, height: el.height, swaps, objectives: [el.token], destroyed: false });
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

  constructor(owner: Demolition, token: string, x: number, y: number, readonly z = 0, readonly eye = 0) {
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
  readonly z: number;
  /** Ciclos que faltan para explotar tras ser pisada (null = armada sin pisar). */
  fuse: number | null;
  done: boolean;
}

const MINE_R = 17;
const MINE_H = 95;
const MINE_BLAST = 20; // RADIOACCIONMINA
const MINE_FUSE = 1; // FUN_00483160 pone +0x18=20; FUN_00483BB0 detona en el siguiente ciclo

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

export interface PlantedBomb { readonly x: number; readonly y: number; readonly z: number }

export class Demolition {
  readonly sites: Site[];
  readonly barrels: Barrel[] = [];
  readonly planted: PlantedBomb[] = [];
  readonly mines: Mine[] = [];
  /** El Zodiac quedó pinchado después de recibir el impacto de una mina. */
  boatSunk = false;
  private mineHitBoat: Boat | null = null;
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
  private readonly blastNav: Pick<Nav, 'blastPath'> | null;
  private readonly kills: ReadonlyMap<string, readonly KillZone[]>;
  private readonly queue: { x: number; y: number; z: number; r: number; tag: Blast['tag']; kind: 'BOMBA' | 'EXPLOSIONMENOR' }[] = [];

  constructor(sites: Site[], objectives: readonly string[], people: People, bombs = 0, opts: { sectors?: Pick<SectorMap, 'atZ' | 'at'> | null; kills?: ReadonlyMap<string, readonly KillZone[]>; blastNav?: Pick<Nav, 'blastPath'> | null } = {}) {
    this.sectors = opts.sectors ?? null;
    this.blastNav = opts.blastNav ?? null;
    this.kills = opts.kills ?? new Map();
    this.sites = sites;
    this.objectives = new Map(objectives.map((o) => [o, false]));
    this.people = people;
    this.bombs = bombs;
  }

  addMine(x: number, y: number, z = 0): Mine {
    const mine = { x, y, z, fuse: null, done: false };
    this.mines.push(mine);
    return mine;
  }

  /**
   * Minas: un cuerpo con masa ≥ PESOACT (60; el Zodiac pesa 400) que toque el cilindro la dispara y explota al ciclo siguiente con
   * potencia 10000; el impacto de contacto se entrega inmediatamente al bicho tocado y el bote lo reparte según AcPilotaje.
   * shortcut: solo se detectan la Zodiac y los cuatro aliados de M0 (todos con masa 100); faltan otros bichos y el despacho espacial completo.
   */
  tickMines(boat: Boat | null, riders: readonly Unit[]): void {
    if (this.mineHitBoat?.punctured) this.boatSunk = true;
    this.mineHitBoat = null;
    for (const m of this.mines) {
      if (m.done) continue;
      if (m.fuse === null) {
        if (boat && !this.boatSunk && boat.z <= m.z + MINE_H && m.z <= boat.z + 40 && Math.hypot(boat.x - m.x, boat.y - m.y) < MINE_R + boat.radius) {
          boat.impact(10000);
          this.mineHitBoat = boat;
          m.fuse = MINE_FUSE;
        }
        // El aliado que la toca recibe el impacto EXPLOSIONMENOR de 10000.
        for (const u of riders) {
          if (!u.boat && !u.hidden && !u.dead && u.z <= m.z + MINE_H && m.z <= u.z + u.eye && Math.hypot(u.body.x - m.x, u.body.y - m.y) < MINE_R + 10) {
            u.wound(1e9);
            m.fuse = MINE_FUSE;
          }
        }
        continue;
      }
      if (--m.fuse > 0) continue;
      m.done = true;
      this.explode(m.x, m.y, MINE_BLAST, 'XPLO', 'EXPLOSIONMENOR', m.z);
      if (boat && !this.boatSunk && boat.z <= m.z + MINE_BLAST && m.z <= boat.z + 40 && Math.hypot(boat.x - m.x, boat.y - m.y) < MINE_BLAST + boat.radius) {
        // shortcut: falta el trazado de sectores y volúmenes para la onda de 00571A10.
        boat.impact(10000);
        this.mineHitBoat = boat;
      }
    }
  }

  addBarrel(token: string, x: number, y: number, z = 0, eye = 0): Barrel {
    const b = new Barrel(this, token, x, y, z, eye);
    this.barrels.push(b);
    return b;
  }

  /** Planta una bomba (AuManejaBomba, sin la animación) donde está el zapador. */
  plant(x: number, y: number, z = 0): boolean {
    if (this.bombs <= 0) return false;
    this.bombs--;
    this.planted.push({ x, y, z });
    return true;
  }

  /** FUN_004FAA60/004FA800: solo se devuelve una carga que todavía está plantada. */
  recover(bomb: PlantedBomb): boolean {
    const index = this.planted.indexOf(bomb);
    if (index < 0) return false;
    this.planted.splice(index, 1);
    this.bombs++;
    return true;
  }

  /** Activa el detonador: explotan todas las bombas plantadas. */
  detonate(): number {
    const n = this.planted.length;
    for (const b of this.planted.splice(0)) this.explode(b.x, b.y, BOMB_RADIUS, 'XPLO', 'BOMBA', b.z);
    return n;
  }

  blowBarrel(b: Barrel): void {
    if (b.dead) return;
    b.dead = true;
    this.explode(b.x, b.y, BARREL_RADIUS, 'EBAR', 'EXPLOSIONMENOR', b.z);
  }

  /** Explosión en (x,y): mata a las personas dentro del radio, encadena barriles y bombas, destruye sitios y avisa a los soldados. */
  explode(x: number, y: number, radius: number, tag: Blast['tag'] = 'XPLO', kind: 'BOMBA' | 'EXPLOSIONMENOR' = tag === 'EBAR' ? 'EXPLOSIONMENOR' : 'BOMBA', z = 0): void {
    this.queue.push({ x, y, z, r: radius, tag, kind });
    while (this.queue.length > 0) {
      const e = this.queue.shift();
      if (e) this.blast(e.x, e.y, e.z, e.r, e.tag, e.kind);
    }
  }

  private blast(x: number, y: number, z: number, r: number, tag: Blast['tag'], kind: 'BOMBA' | 'EXPLOSIONMENOR'): void {
    this.blasts.push({ x, y, radius: r, tag, ttl: BLAST_CYCLES });
    // shortcut: falta distribuir impactos a vehículos y trazar los detectores de edificios por 005BC080.
    const reaches = (px: number, py: number, top: number): boolean => this.blastNav?.blastPath({ x, y, z: z + 40 }, { x: px, y: py, z: top }) ?? true;
    for (const s of this.people.soldiers) if (!s.dead && !s.unit.hidden && areaOverlaps(x, y, z, r, { x: s.x, y: s.y, z: s.unit.z, radius: 10, height: s.unit.eye }) && reaches(s.x, s.y, s.unit.z + s.unit.eye)) s.kill();
    for (const c of this.people.commandos) if (!c.dead && !c.hidden && !c.boat && areaOverlaps(x, y, z, r, { x: c.body.x, y: c.body.y, z: c.z, radius: 10, height: c.eye }) && reaches(c.body.x, c.body.y, c.z + c.eye)) c.wound(tag === 'EBAR' ? 20000 : 10000);
    // AcMina 00483160: cualquier impacto dispara una mina armada; explota en su próxima actualización.
    for (const m of this.mines) if (!m.done && m.fuse === null && areaOverlaps(x, y, z, r, { x: m.x, y: m.y, z: m.z, radius: MINE_R, height: MINE_H }) && reaches(m.x, m.y, m.z + MINE_H)) m.fuse = MINE_FUSE;
    for (const b of this.barrels) {
      if (b.dead || !areaOverlaps(x, y, z, r, { x: b.x, y: b.y, z: b.z, radius: 10, height: b.eye }) || !reaches(b.x, b.y, b.z + b.eye)) continue;
      b.dead = true;
      this.queue.push({ x: b.x, y: b.y, z: b.z, r: BARREL_RADIUS, tag: 'EBAR', kind: 'EXPLOSIONMENOR' });
    }
    for (let i = this.planted.length - 1; i >= 0; i--) {
      const p = this.planted[i];
      if (p && areaOverlaps(x, y, z, r, { x: p.x, y: p.y, z: p.z, radius: 10, height: 5 }) && reaches(p.x, p.y, p.z + 5)) {
        this.planted.splice(i, 1);
        this.queue.push({ x: p.x, y: p.y, z: p.z, r: BOMB_RADIUS, tag: 'XPLO', kind: 'BOMBA' });
      }
    }
    for (const s of this.sites) {
      // shortcut: falta el recorrido hasta el borde del detector de 005B9470.
      if (!siteOverlap(s, x, y, r)) continue;
      if (s.z !== undefined && s.height !== undefined && (s.z > z + r / 2 || s.z + s.height < z - r / 2)) continue;
      const target = s.forwardsTo ? this.sites.find((site) => site.name === s.forwardsTo) : s;
      if (!target || target.destroyed || (target.bombOnly && kind !== 'BOMBA')) continue;
      target.destroyed = true;
      this.dirty = true;
      this.destroyed.add(target.name);
      for (const o of target.objectives) {
        this.destroyed.add(o);
        if (this.objectives.has(o)) this.objectives.set(o, true);
        this.fireKills(o);
      }
      this.fireKills(target.name);
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
