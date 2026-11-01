/**
 * Grupos de soldados de `.PATRULLAS` (cabo + patrulleros), eventos de misión y zonas de ruido.
 * Fuentes: docs/lectura/policia.md (Cierre 2: parser `FUN_0062B6C0`, fórmula de formación `FUN_004D5650`), mision-intendencia.md, mis-todos.md.
 *  - `.PATRULLAS [ [ .TOKEN .NSOLDIERS .HOME casa .EXITHOME_EVENTS ev|[ev..] .STARTATHOME .RUTADEF [[ .NOMBRE .TIPORUTA .RUTA .VEL ]] .ANIMCABO .ANIMSOLDADO .NCOLUMNS .FORMX .FORMY … ] ]`:
 *    con `.HOME` y `.EXITHOME_EVENTS` el grupo está dentro de la casa y sale al recibir uno de esos eventos; sin `.HOME` empieza en su ruta desde el principio.
 *  - `.SENSORES_SND_ZONA [ [ .ZONA nombre .MENSAJE ev ] ]`: la zona es un grupo con nombre del `.SEC` (lista de sectores); un ruido de peligro dentro de ella lanza el evento.
 *  - Formación en marcha: `n = max(1, min(NCOLUMNS, vivos))`; el patrullero `idx < n` sigue al cabo con lateral `FORMX·(idx − (n−1)/2)` y `FORMY` detrás; los demás siguen al patrullero `idx − n` con lateral 0.
 * shortcut: sin posiciones de ataque o `NSOLDIERSATTACK`;
 *           el evento sale de cualquier ruido de peligro dentro de la zona, no del sensor real; el cabo dispara como cualquier soldado. Mejorar al portar AcpSargento y el sensor.
 */
import { asList, asNumber, asNumbers, asText, find, parseClave, type Node } from '../formats/clave.ts';
import type { Sec } from '../formats/sec.ts';
import type { House } from './house.ts';
import { parseRoutes, type Route } from './patrol.ts';
import type { Difficulty } from './world.ts';

export interface GroupDef {
  readonly token: string;
  readonly n: number;
  readonly regeneratePatrol: boolean;
  readonly startAtHome: boolean;
  readonly position: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly angle: number;
  /** Casa de la que sale (null = empieza en la ruta). */
  readonly home: string | null;
  readonly exitEvents: readonly string[];
  readonly reactEvents: readonly string[];
  readonly route: Route | null;
  readonly routes: readonly Route[];
  readonly animCabo: string;
  readonly animSoldier: string;
  readonly columns: number;
  readonly formX: number;
  readonly formY: number;
}

/** La fábrica `FUN_005A2430` crea un cabo y después `NSOLDIERS` patrulleros. */
export function groupSize(def: Pick<GroupDef, 'n'>): number {
  return def.n + 1;
}

/** `FUN_004D60A0`: como máximo un patrullero recibe la orden de salida cada 20 ciclos. */
export class ExitSchedule {
  private next = 1;
  private lastCycle = -1;

  constructor(private readonly count: number) {}

  get done(): boolean {
    return this.next > this.count;
  }

  step(cycle: number): number | null {
    if (this.done || cycle % 20 !== 0 || cycle === this.lastCycle) return null;
    this.lastCycle = cycle;
    return this.next++;
  }
}

/** `FUN_005A3500`: intenta reponer cada baja hasta agotar la reserva o fallar la creación. */
export function recruitMissing(house: Pick<House, 'recruit'>, missing: number, create: () => boolean): number {
  let recruited = 0;
  while (recruited < missing && house.recruit(create)) recruited++;
  return recruited;
}

/** `FUN_004D4680`: prefiere al de mayor energía fuera de casa. */
export function successor<T extends { readonly dead: boolean; readonly down: boolean; readonly unit: { readonly energy: number; readonly hidden?: boolean } }>(soldiers: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of soldiers) {
    if (s.dead || s.down || s.unit.hidden) continue;
    if (!best || s.unit.energy > best.unit.energy) best = s;
  }
  return best;
}

/** `ev` o `[ ev ev ]` -> lista de códigos de evento. */
export function eventList(n: Node | undefined): string[] {
  if (typeof n === 'string') return [n.toUpperCase()];
  return (asList(n) ?? []).filter((x): x is string => typeof x === 'string').map((x) => x.toUpperCase());
}

export function parseGroups(misText: string, difficulty: Difficulty): GroupDef[] {
  const mis = asList(find(parseClave(misText), '.MISSION')) ?? [];
  const out: GroupDef[] = [];
  for (const g of asList(find(mis, '.PATRULLAS')) ?? []) {
    const l = asList(g);
    const token = l ? asText(find(l, '.TOKEN')) : undefined;
    if (!l || !token) continue;
    const routes = parseRoutes(['.PATRULLA', asList(find(l, '.RUTADEF')) ?? []], difficulty);
    const xyz = asNumbers(find(l, '.XYZ'));
    out.push({
      token,
      n: asNumber(find(l, '.NSOLDIERS')) ?? 4,
      regeneratePatrol: (asNumber(find(l, '.REGENERATEPATROL')) ?? 0) !== 0,
      startAtHome: (asNumber(find(l, '.STARTATHOME')) ?? 0) !== 0,
      position: xyz?.length === 3 ? { x: xyz[0] ?? 0, y: xyz[1] ?? 0, z: xyz[2] ?? 0 } : null,
      angle: asNumber(find(l, '.ANGULO')) ?? 0,
      home: asText(find(l, '.HOME')) ?? null,
      exitEvents: eventList(find(l, '.EXITHOME_EVENTS')),
      reactEvents: eventList(find(l, '.REACT_EVENTS')),
      route: routes[0] ?? null,
      routes,
      animCabo: asText(find(l, '.ANIMCABO')) ?? 'CABO',
      animSoldier: asText(find(l, '.ANIMSOLDADO')) ?? 'ALEGABAR',
      columns: asNumber(find(l, '.NCOLUMNS')) ?? 2,
      formX: asNumber(find(l, '.FORMX')) ?? 40,
      formY: asNumber(find(l, '.FORMY')) ?? 30,
    });
  }
  return out;
}

/** A quién sigue el patrullero `idx` (0 = el primero tras el cabo) y con qué lateral: `leader` −1 = el cabo, si no el patrullero de ese índice. */
export function formationOf(idx: number, columns: number, alive: number, formX: number): { leader: number; lateral: number } {
  const n = Math.max(1, Math.min(columns, alive));
  return idx < n ? { leader: -1, lateral: formX * (idx - (n - 1) / 2) } : { leader: idx - n, lateral: 0 };
}

/** Punto que ocupa el seguidor: `líder + lateral·(cos(a+90°), sen(a+90°)) − atrás·(cos a, sen a)`, con `a` el rumbo del líder (grados). */
export function followPoint(lx: number, ly: number, angleDeg: number, lateral: number, back: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: lx + lateral * Math.cos(a + Math.PI / 2) - back * Math.cos(a), y: ly + lateral * Math.sin(a + Math.PI / 2) - back * Math.sin(a) };
}

export interface ZoneSensor {
  readonly zone: string;
  readonly message: string;
}

export function parseZoneSensors(misText: string): ZoneSensor[] {
  const mis = asList(find(parseClave(misText), '.MISSION')) ?? [];
  const out: ZoneSensor[] = [];
  for (const z of asList(find(mis, '.SENSORES_SND_ZONA')) ?? []) {
    const l = asList(z);
    const zone = l ? asText(find(l, '.ZONA')) : undefined;
    const message = l ? asText(find(l, '.MENSAJE')) : undefined;
    if (zone && message) out.push({ zone: zone.toUpperCase(), message: message.toUpperCase() });
  }
  return out;
}

/** Evento que lanza un ruido de peligro en un sector: busca el sector en las zonas del `.SEC` (grupos con nombre, pares `(lista, sector)`). */
export class ZoneEvents {
  private readonly byZone = new Map<string, Set<number>>();

  constructor(
    sec: Pick<Sec, 'groups'>,
    private readonly sensors: readonly ZoneSensor[],
  ) {
    for (const g of sec.groups) this.byZone.set(g.name.toUpperCase(), new Set(g.items.map((p) => p[1])));
  }

  /** Eventos de las zonas que contienen al sector `sectorIndex` (índice en `Sec.sectors`). */
  at(sectorIndex: number): string[] {
    return this.sensors.filter((s) => this.byZone.get(s.zone)?.has(sectorIndex)).map((s) => s.message);
  }
}
