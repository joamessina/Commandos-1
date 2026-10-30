/**
 * Grupos de soldados de `.PATRULLAS` (cabo + patrulleros), eventos de misión y zonas de ruido.
 * Fuentes: docs/lectura/policia.md (Cierre 2: parser `FUN_0062B6C0`, fórmula de formación `FUN_004D5650`), mision-intendencia.md, mis-todos.md.
 *  - `.PATRULLAS [ [ .TOKEN .NSOLDIERS .HOME casa .EXITHOME_EVENTS ev|[ev..] .STARTATHOME .RUTADEF [[ .NOMBRE .TIPORUTA .RUTA .VEL ]] .ANIMCABO .ANIMSOLDADO .NCOLUMNS .FORMX .FORMY … ] ]`:
 *    con `.HOME` y `.EXITHOME_EVENTS` el grupo está dentro de la casa y sale al recibir uno de esos eventos; sin `.HOME` empieza en su ruta desde el principio.
 *  - `.SENSORES_SND_ZONA [ [ .ZONA nombre .MENSAJE ev ] ]`: la zona es un grupo con nombre del `.SEC` (lista de sectores); un ruido de peligro dentro de ella lanza el evento.
 *  - Formación en marcha: `n = max(1, min(NCOLUMNS, vivos))`; el patrullero `idx < n` sigue al cabo con lateral `FORMX·(idx − (n−1)/2)` y `FORMY` detrás; los demás siguen al patrullero `idx − n` con lateral 0.
 * shortcut: NSOLDIERS cuenta al cabo (el exe no se comprobó); salen todos a la vez; sin regeneración (`NUMREGENSOLDIERS` de la casa), sin posiciones de ataque ni `NSOLDIERSATTACK`;
 *           el evento sale de cualquier ruido de peligro (disparo de pistola o de soldado) dentro de la zona, no del sensor de sonido real (`FUN_006FFDD0`, no leído); el cabo dispara como cualquier soldado.
 */
import { asList, asNumber, asText, find, parseClave, type Node } from '../formats/clave.ts';
import type { Sec } from '../formats/sec.ts';
import { parseRoutes, type Route } from './patrol.ts';
import type { Difficulty } from './world.ts';

export interface GroupDef {
  readonly token: string;
  readonly n: number;
  /** Casa de la que sale (null = empieza en la ruta). */
  readonly home: string | null;
  readonly exitEvents: readonly string[];
  readonly route: Route | null;
  readonly animCabo: string;
  readonly animSoldier: string;
  readonly columns: number;
  readonly formX: number;
  readonly formY: number;
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
    const route = parseRoutes(['.PATRULLA', asList(find(l, '.RUTADEF')) ?? []], difficulty)[0] ?? null;
    out.push({
      token,
      n: asNumber(find(l, '.NSOLDIERS')) ?? 4,
      home: asText(find(l, '.HOME')) ?? null,
      exitEvents: eventList(find(l, '.EXITHOME_EVENTS')),
      route,
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
