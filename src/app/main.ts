/**
 * Visor de mapa con los comandos animados. El jugador elige SU carpeta raíz del juego: WAR_MP.DIR +
 * DATOS/recursos/bmps/map_mp/Fase000N.wad. Nada se sube ni se hace fetch: todo se lee con la File API.
 * Controles: clic izquierdo = elegir comando / caminar; clic derecho = caminar; Mayús+clic o doble clic derecho = correr;
 * flechas o WASD = mover la cámara; 1-4 = elegir comando; Inicio = centrar en el elegido.
 * El clic se traduce al mundo con el picking del original (sector más alto bajo el píxel), así que se puede ordenar ir a cualquier altura.
 * Rutas: el comando sigue el camino por sectores (A* + embudo, R3); si no hay camino a pie la orden se rechaza y se avisa en la barra de estado.
 * Agua: el mar es un bitmap que el exe reescribe cada ciclo (docs/lectura/agua.md); se anima en una capa propia debajo del resto.
 * shortcut: orden de dibujo por y de los pies (R2 pendiente); sin buceo (los comandos que arrancan en el mar, p. ej. mapa 0000, no pueden moverse);
 *           los controles (derecho = mover) son los del original según el juego conocido, NO leídos del exe todavía.
 */
import { parseAnm, type Anm } from '../formats/anm.ts';
import { entryBytes, parseContainer, type DirEntry } from '../formats/container.ts';
import { parseSec, type Sector } from '../formats/sec.ts';
import { parseVol, type Vol } from '../formats/vol.ts';
import { parseWad, type Wad } from '../formats/wad.ts';
import { Animator } from '../engine/anim.ts';
import { canFire, groundTarget, type Weapon } from '../engine/attack.ts';
import { Battle } from '../engine/battle.ts';
import { BLAST_CYCLES, Demolition, parseSites, type Barrel, type Mine, type PlantedBomb } from '../engine/demolition.ts';
import { destroyLinkedHouses, House, parseHouses } from '../engine/house.ts';
import { Lift, parseLadders, parseLift, pickLadder, type Ladder } from '../engine/ladder.ts';
import { escapeReady } from '../engine/mission.ts';
import { Boat, boatShares, boatSlots, freeSeat } from '../engine/boat.ts';
import { type Cepo, type Decoy, decoyItem, Traps } from '../engine/traps.ts';
import { eventList, ExitSchedule, formationOf, groupSize, type GroupDef, parseGroups, parseZoneSensors, recruitMissing, successor, ZoneEvents } from '../engine/groups.ts';
import { groundZ, isWater, SectorMap, TYPE_WATER } from '../engine/sectors.ts';
import { navFor } from '../engine/path.ts';
import { canThrow, type Pack, type Throwable } from '../engine/throwing.ts';
import { norm360 } from '../engine/walk.ts';
import { parseRoutes } from '../engine/patrol.ts';
import { enemyGun, Order, Soldier } from '../engine/soldier.ts';
import { Alarm } from '../engine/alarm.ts';
import { COMMANDO_ENERGY, project, unproject, Unit } from '../engine/unit.ts';
import { VolOrder, type Actor } from '../engine/volorder.ts';
import { type BagItem, bagItems, bagRect, diveItemVisible, FaceAnim, inRect, photoRect, HUD_BAR, HUD_COLUMN, HUD_MODES, hudScale, overHud, parseInterface, slotAt, viewRect, visibleItems } from '../engine/hud.ts';
import { cursorFor, type CursorMode } from '../engine/cursors.ts';
import { Cursors } from '../render/cursors.ts';
import { Hud, type HudUnit } from '../render/hud.ts';
import { DEFEAT_DELAY, END_TEXT, parsePar, score, type Score } from '../engine/score.ts';
import { rayReach, sees, vistaOf } from '../engine/vision.ts';
import { asList, asNumber, asNumbers, asText, find, parseClave } from '../formats/clave.ts';
import { parseWater, WaterFx } from '../engine/water.ts';
import { flatten, loadWorld, type Difficulty, type Elem } from '../engine/world.ts';
import { composeMap, paintPoly, repaintWater, waterBounds, type Clip, type MapImage, type MapOptions, type Rect } from '../render/map.ts';
import { missionNames, parseCampaign, parseMissionFiles, parseMissionInfo } from '../engine/campaign.ts';
import { Sfx } from '../render/audio.ts';
import { parseFilterMode, ScreenFilter } from '../render/filter.ts';
import { SpriteCache } from '../render/sprites.ts';
import { SPLASH_CYCLES, waterSplash } from '../render/splash.ts';
import { GameSound } from './gamesound.ts';
import { showMenu } from './menu.ts';
import { playIntro, type TacticalIntro } from './intro.ts';
import { showBriefing } from './briefing.ts';
import { showLoading } from './loading.ts';
import { IntroCamera } from '../engine/intro-camera.ts';
import { canvasPoint, fitCanvas, type Resolution } from './viewport.ts';
import type { AnmFrame } from '../formats/anm.ts';

const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el;
};
const dirInput = byId('dir') as HTMLInputElement;
const sfx = new Sfx();
let sound: GameSound | null = null;
const mapSel = byId('map') as HTMLSelectElement;
const waterBox = byId('water') as HTMLInputElement;
const zoomSel = byId('zoom') as HTMLSelectElement;
const diffSel = byId('diff') as HTMLSelectElement;
const filterSel = byId('filter') as HTMLSelectElement;
let screenFilter: ScreenFilter | null = null;
let refitStage: (() => void) | null = null;
try { filterSel.value = parseFilterMode(localStorage.getItem('filter')); } catch { /* sin almacenamiento: queda en ninguno */ }
filterSel.addEventListener('change', () => {
  screenFilter?.setMode(parseFilterMode(filterSel.value));
  refitStage?.();
  try { localStorage.setItem('filter', filterSel.value); } catch { /* no se recuerda la elección */ }
});
const status = byId('status');
const view = byId('view');

interface Loaded {
  readonly dir: Uint8Array;
  readonly entries: ReadonlyMap<string, DirEntry>;
  /** FASE000N -> lector de los bytes del WAD (File del usuario o, en desarrollo, /__game). */
  readonly wads: ReadonlyMap<string, () => Promise<ArrayBuffer>>;
  /** Archivos sueltos de `DATOS/MUSICA/` (en minúsculas) -> lector de sus bytes. */
  readonly music: ReadonlyMap<string, () => Promise<ArrayBuffer>>;
  readonly loose: (path: string) => Promise<Uint8Array | undefined>;
}
interface UnitView {
  readonly unit: Unit;
  readonly sprites: SpriteCache;
  /** Armas que el MIS le da (`AuDisparar .ARMAS`, `AuAcuchillar`). */
  readonly weapons: Weapon[];
  readonly maxEnergy: number;
  /** Tiene `AuBucear` (traje de buzo). */
  readonly canDive: boolean;
  /** `AuManejacepo` / `AuManejaSegnuelo` del MIS: puede colocar cepos / señuelos de su inventario. */
  readonly canCepo: boolean;
  readonly canDecoy: boolean;
}
/** Objeto del inventario de un comando (cepo, señuelo): su elemento del MIS, su gráfico y cuántos quedan. */
interface Kit {
  readonly elem: Elem;
  readonly anm: Anm;
  readonly sprites: SpriteCache;
  left: number;
}
/** Qué se está colocando con el próximo clic. */
type PlaceKind = 'BOMBA' | 'CEPO' | 'SEGNUELO' | 'TABACO';
interface SoldierView {
  readonly soldier: Soldier;
  readonly sprites: SpriteCache;
}
/** Mar animado: capa debajo del mapa y el efecto que reescribe el bitmap de los tiles AGUA. */
interface WaterView {
  readonly canvas: HTMLCanvasElement;
  readonly img: MapImage;
  readonly bounds: Rect;
  readonly fx: WaterFx;
  readonly index: Uint8Array;
  readonly vol: Vol;
  readonly wad: Wad;
  /** Equivale a DAT_00875DA8: el ciclo del agua solo corre si el mar se dibujó desde el anterior. */
  drawn: boolean;
}
/** Elemento del mundo con gráfico (soldado, objeto, el bote): se dibuja con su animador; por ahora sin lógica propia. */
interface Prop {
  readonly elem: Pick<Elem, 'radius' | 'height'>;
  readonly anim: Animator;
  readonly sprites: SpriteCache;
  x: number;
  y: number;
  z: number;
  ang: number;
}
interface Game {
  readonly alarm: Alarm;
  readonly seenAlarmBlasts: WeakSet<object>;
  visionPicking: boolean;
  visionTarget: { soldier: Soldier } | { x: number; y: number; z: number } | null;
  readonly houses: House[];
  readonly tickGroups: () => void;
  /** Nido de ametralladora: su gráfico dispara cuando el artillero dispara. */
  readonly nests: { readonly soldier: Soldier; readonly prop: Prop }[];
  readonly ladders: Ladder[];
  readonly lift: Lift | null;
  readonly demo: Demolition;
  /** Barril del juego -> su gráfico (se oculta al explotar). */
  readonly barrelProps: ReadonlyMap<Barrel, Prop>;
  readonly mineProps: ReadonlyMap<Mine, Prop>;
  readonly blastArt: { readonly anm: Anm; readonly sprites: SpriteCache } | null;
  readonly splashArt: { readonly anm: Anm; readonly sprites: SpriteCache } | null;
  readonly stoneArt: { readonly anm: Anm; readonly sprites: SpriteCache } | null;
  readonly bombArt: { readonly anm: Anm; readonly sprites: SpriteCache } | null;
  readonly stoneEffects: { readonly prop: Prop; left: number }[];
  readonly splashes: { x: number; y: number; age: number }[];
  readonly seenSplashes: WeakSet<object>;
  readonly vol: Vol;
  readonly wad: Wad;
  readonly order: readonly number[];
  /** Orden de volúmenes + personajes (engine/volorder.ts) y los sprites del WAD del mapa para repintar edificios encima de ellos. */
  readonly volOrder: VolOrder;
  readonly mapSprites: SpriteCache;
  mapOpts: MapOptions;
  /** Punto de huida del MIS (`PUNTOHUIDA`): el bote con todos a bordo debe llegar allí. */
  readonly escape: { x: number; y: number } | null;
  won: boolean;
  /** Truco Alt+I (`MSG_INVENCIBLE`). */
  invincible: boolean;
  /** Cursores del mouse (`GLOBAL/CURSORES.WAD`); null si falta el archivo. */
  readonly cursors: Cursors | null;
  readonly battle: Battle;
  readonly soldiers: SoldierView[];
  /** Arma elegida: el clic en un soldado ataca con ella (null = clic mueve). */
  mode: Weapon | null;
  /** El zapador va a plantar la bomba donde se haga clic (B). */
  planting: PlaceKind | null;
  /** Ítem que se usa con el próximo clic sobre un comando (botiquín) o un soldado esposado (control alemán). */
  use: 'BOTIQUIN' | 'CONTROL' | 'MANO' | null;
  /** Soldado esposado que un comando controla (clic = adónde va; botón derecho lo suelta). */
  control: { readonly soldier: Soldier; readonly owner: Unit } | null;
  /** Gráfico (`CAJETILL`) de cada cajetilla en el suelo. */
  readonly packProps: Map<Pack, Prop>;
  readonly packArt: { readonly anm: Anm; readonly sprites: SpriteCache } | null;
  readonly traps: Traps;
  readonly kit: { cepo: Kit | null; decoy: Kit | null };
  /** Gráfico de cada cepo/señuelo colocado. */
  readonly trapProps: Map<Cepo | Decoy, Prop>;
  readonly props: Prop[];
  readonly boat: { readonly boat: Boat; readonly prop: Prop } | null;
  readonly water: WaterView | null;
  readonly map: HTMLCanvasElement;
  readonly units: UnitView[];
  /** Sectores del mapa (picking del cursor); null si el mapa no trae .SEC. */
  readonly sectors: SectorMap | null;
  selected: number;
  camX: number;
  camY: number;
  ticks: number;
  /** HUD de misión (null si faltan sus WAD). */
  readonly hud: Hud | null;
  /** Columna (y mochila) a la izquierda: la tecla º/| la cambia de lado. */
  hudLeft: boolean;
  /** Ítems que se dibujan en la mochila de cada comando (por token). */
  readonly bag: ReadonlyMap<string, readonly BagItem[]>;
  readonly faces: FaceAnim;
  /** Ticks de par por dificultad (`PUNTUACIONES`) y el resultado fijado al terminar la misión. */
  readonly par: { easy: number; hard: number };
  result: { score: Score; text: string; victory: boolean; kills: number } | null;
  /** Ciclo en que murieron todos (el fin se muestra `DEFEAT_DELAY` ciclos después). */
  lostAt: number | null;
  readonly sound: GameSound;
}

let loaded: Loaded | null = null;
let game: Game | null = null;
let stage: HTMLCanvasElement | null = null;
let loopId = 0;
let closeMenu: (() => void) | null = null;
let presenting = false;
let screenSize: Resolution = [640, 480];
function lockControls(): () => void {
  const inputs = [dirInput, mapSel, waterBox, diffSel, zoomSel, byId('dev') as HTMLButtonElement];
  const disabled = inputs.map((input) => input.disabled);
  for (const input of inputs) input.disabled = true;
  return () => { inputs.forEach((input, i) => { input.disabled = disabled[i] ?? false; }); };
}
const keys = new Set<string>();

const say = (msg: string, error = false): void => {
  status.textContent = msg;
  status.className = error ? 'error' : '';
};
let zoomLevel = 1;
const zoom = (): number => zoomLevel;
const ZOOM_MAX = 3.4; // docs/research/q1-camara.md §Cierre

/** Zoom del exe (NUM+/NUM−): paso 0,1 (0,05 por debajo de 1), tope 3,4 y mínimo = el mapa entero en la ventana; la cámara sigue centrada en el mismo punto. */
/** Zona del mundo en el lienzo: con HUD lo que dejan libre la tira superior y la columna derecha; sin él, todo. */
function vp(g: Game | null): Rect {
  const w = stage?.width ?? 0;
  const h = stage?.height ?? 0;
  if (!g?.hud) return { x: 0, y: 0, w, h };
  const k = hudK();
  const r = viewRect(w / k, h / k, g.hudLeft);
  return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
}

/** Factor del HUD en este lienzo (engine/hud.ts `hudScale`). */
const hudK = (): number => (stage ? hudScale(stage.width, stage.height) : 1);

/** Punto (x, y) del lienzo en unidades del HUD y tamaño del lienzo en esas unidades: la geometría de engine/hud.ts se calcula sin escalar. */
function hudSpace(x: number, y: number): { x: number; y: number; w: number; h: number } {
  const k = hudK();
  return { x: x / k, y: y / k, w: (stage?.width ?? 0) / k, h: (stage?.height ?? 0) / k };
}

function overHudAt(g: Game, x: number, y: number): boolean {
  const s = hudSpace(x, y);
  return g.hud !== null && overHud(s.x, s.y, s.w, g.hudLeft);
}

function setZoom(next: number): void {
  const g = game;
  const v = vp(g);
  const min = g && stage ? Math.max(v.w / g.map.width, v.h / g.map.height) : 0.25;
  zoomLevel = Math.round(Math.max(min, Math.min(ZOOM_MAX, next)) * 1000) / 1000;
  let o = zoomSel.querySelector<HTMLOptionElement>('option[data-custom]');
  if (!o) {
    o = document.createElement('option');
    o.dataset['custom'] = '1';
    zoomSel.append(o);
  }
  o.value = String(zoomLevel);
  o.textContent = `${Math.round(zoomLevel * 100).toString()} %`;
  zoomSel.value = o.value;
}

async function onFolder(): Promise<void> {
  const files = Array.from(dirInput.files ?? []);
  const dirs = files.filter((f) => /(^|\/)WAR_MP\.DIR$/i.test(f.webkitRelativePath));
  const dirFile = dirs.reduce<File | undefined>((best, f) => !best || f.webkitRelativePath.length < best.webkitRelativePath.length ? f : best, undefined);
  if (!dirFile) {
    say('No encontré WAR_MP.DIR en esa carpeta. Elegí la carpeta raíz del juego.', true);
    return;
  }
  say('Leyendo WAR_MP.DIR…');
  const dir = new Uint8Array(await dirFile.arrayBuffer());
  const wads = new Map<string, () => Promise<ArrayBuffer>>();
  const music = new Map<string, () => Promise<ArrayBuffer>>();
  const looseFiles = new Map<string, File>();
  const prefix = dirFile.webkitRelativePath.slice(0, -'WAR_MP.DIR'.length);
  for (const f of files) {
    if (!f.webkitRelativePath.startsWith(prefix)) continue;
    const path = f.webkitRelativePath.slice(prefix.length);
    const m = /^DATOS\/recursos\/bmps\/map_mp\/(FASE\d{4})\.WAD$/i.exec(path);
    if (m?.[1]) wads.set(m[1].toUpperCase(), () => f.arrayBuffer());
    const mu = /^DATOS\/musica\/([^/]+)$/i.exec(path);
    if (mu?.[1]) music.set(mu[1].toLowerCase(), () => f.arrayBuffer());
    const relative = /^((?:DATOS|VIDEO)\/.*)$/i.exec(path);
    if (relative?.[1]) looseFiles.set(relative[1].toUpperCase(), f);
  }
  await start(dir, wads, music, async (path) => {
    const f = looseFiles.get(path.toUpperCase());
    return f ? new Uint8Array(await f.arrayBuffer()) : undefined;
  });
}

async function start(dir: Uint8Array, wads: Map<string, () => Promise<ArrayBuffer>>, music: Map<string, () => Promise<ArrayBuffer>>, loose: Loaded['loose']): Promise<void> {
  closeMenu?.();
  closeMenu = null;
  sound?.stop();
  sfx.stopMusic();
  game = null;
  cancelAnimationFrame(loopId);
  const entries = new Map<string, DirEntry>();
  for (const e of parseContainer(dir)) entries.set(e.path.toUpperCase(), e);
  loaded = { dir, entries, wads, music, loose };
  // misiones jugables = las que tienen sus archivos de mapa (volúmenes y banco de gráficos): se leen del propio .MIS
  const text = (path: string): string => { const b = bytes(path); return b ? new TextDecoder('latin1').decode(b) : ''; };
  const playable = missionNames(entries.keys()).filter((name) => {
    const f = parseMissionFiles(text(`DATOS/MISIONES/${name}.MIS`));
    return f.vol !== undefined && entries.has(`DATOS/MISIONES/${f.vol.toUpperCase()}`) && f.wad !== undefined && wads.has(f.wad);
  });
  // orden y nombres de la campaña (MISIONES.DAT + MBnn.STR); el resto (variantes, tutoriales) va al final como extras
  const campaign = parseCampaign(text('DATOS/MISIONES/MISIONES.DAT')).map((n) => `MAPA${n}`).filter((name) => playable.includes(name));
  const maps = [...campaign, ...playable.filter((name) => !campaign.includes(name))];
  const tutorials = ['básico', 'GB', 'SN', 'MA', 'SA', 'DR', 'SP']; // prefijo de las voces de cada .ROL (docs/engine/sonido-parsers.md §1.9)
  mapSel.replaceChildren(...maps.map((name) => {
    const k = campaign.indexOf(name);
    const num = name.slice(4);
    if (k >= 0) {
      const info = parseMissionInfo(text(`DATOS/MISIONES/MB${num.slice(2)}.STR`));
      return new Option(`${(k + 1).toString()}. ${info ? `${info.title} (${info.place})` : name}`, name);
    }
    return new Option(name.startsWith('TUT') ? `Tutorial ${num.slice(0, 2)} (${tutorials[Number(num.slice(0, 2))] ?? '?'})` : `Extra: ${name}`, name);
  }));
  mapSel.disabled = maps.length === 0;
  if (maps.length === 0) {
    say('Encontré WAR_MP.DIR pero ningún Fase000N.wad (carpeta DATOS/recursos/bmps/map_mp).', true);
    return;
  }
  say('Menú: mouse o flechas y Enter. Las opciones oscuras todavía no están implementadas.');
  closeMenu = await showMenu(view, bytes, (difficulty, resolution) => {
    closeMenu = null;
    sfx.stopMusic();
    diffSel.value = difficulty;
    screenSize = resolution;
    mapSel.value = campaign[0] ?? maps[0] ?? '';
    guarded(() => load(true))();
  });
  const currentMenu = closeMenu;
  const readMusic = music.get('menu.wav');
  if (readMusic) {
    const musicBytes = await readMusic();
    const buffer = await sfx.decode(new Uint8Array(musicBytes));
    if (buffer && closeMenu === currentMenu) sfx.playMusic(buffer, true);
  }
}

/** WAD del HUD (GLOBAL, uno por resolución y las CARAS de los comandos de la misión); null si falta alguno de los básicos. */
function loadHud(tokens: readonly string[], bag: ReadonlyMap<string, readonly BagItem[]>): Hud | null {
  const root = 'DATOS/RECURSOS/BMPS/SYSTEM/';
  const wad = (path: string): Wad | null => {
    const b = bytes(root + path);
    return b ? parseWad(b) : null;
  };
  const global = wad('GLOBAL/GLOBAL.WAD');
  const sized = new Map<string, Wad>();
  for (const [w, h] of HUD_MODES) {
    const s = wad(`GLOBAL/${w.toString()}X${h.toString()}.WAD`);
    if (s) sized.set(`${w.toString()}x${h.toString()}`, s);
  }
  const faces = new Map<string, Wad>();
  for (const t of new Set(tokens)) {
    const f = wad(`CARAS/${t}.WAD`);
    if (f) faces.set(t, f);
  }
  const items = new Map<string, Wad>();
  for (const name of new Set([...bag.values()].flat().map((i) => i.wad))) {
    const w = wad(`OPCIONES/${name}.WAD`);
    if (w) items.set(name, w);
  }
  return global && sized.size > 0 ? new Hud(global, sized, faces, items) : null;
}

function loadCursors(): Cursors | null {
  const b = bytes('DATOS/RECURSOS/BMPS/SYSTEM/GLOBAL/CURSORES.WAD');
  const scope = bytes('DATOS/RECURSOS/BMPS/SYSTEM/OPCIONES/MIRILLA.WAD'); // retícula C_MIRILL.RLE
  return b ? new Cursors(parseWad(b), ...(scope ? [parseWad(scope)] : [])) : null;
}

function bytes(path: string): Uint8Array | undefined {
  const e = loaded?.entries.get(path);
  return e && loaded ? entryBytes(loaded.dir, e) : undefined;
}

async function load(introduction = false): Promise<void> {
  if (!loaded || !mapSel.value) return;
  closeMenu?.();
  closeMenu = null;
  cancelAnimationFrame(loopId);
  const loading = showLoading(view, bytes, screenSize);
  // shortcut: porcentajes por etapas del port, no los incrementos de carga originales.
  const progress = async (value: number): Promise<void> => {
    loading(value);
    await new Promise<void>((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); });
  };
  await progress(0);
  const n = mapSel.value;
  const misBytes = bytes(`DATOS/MISIONES/${n}.MIS`);
  const misText = misBytes ? new TextDecoder('latin1').decode(misBytes) : '';
  const files = parseMissionFiles(misText);
  const volBytes = files.vol ? bytes(`DATOS/MISIONES/${files.vol.toUpperCase()}`) : undefined;
  const readWad = files.wad ? loaded.wads.get(files.wad) : undefined;
  if (!volBytes || !readWad) throw new Error(`Faltan archivos de la misión ${n}.`);
  say(`Componiendo ${mapSel.selectedOptions[0]?.text ?? n}…`);
  await progress(0.05);
  const t0 = performance.now();
  const vol = parseVol(new TextDecoder('latin1').decode(volBytes));
  const wad = parseWad(new Uint8Array(await readWad()));
  await progress(0.25);
  const wdef = waterBox.checked ? null : parseWater(misText);
  const wsprite = wdef ? wad.byName.get(wdef.dst.toUpperCase()) : undefined;
  const bounds = wsprite?.width === 256 && wsprite.height === 256 ? waterBounds(vol) : null; // el generador del exe asume 256×256
  const water = wdef && wsprite && bounds ? makeWater(vol, wad, wdef, wsprite.index, bounds) : null;
  const volOrder = new VolOrder(vol); // orden de dibujo del exe (docs/research/q1-orden-dibujo.md), los volúmenes una vez por mapa
  const order = volOrder.order;
  const img = composeMap(vol, wad, { ...(water ? { layer: 'land' as const } : { skipWater: waterBox.checked }), order });
  await progress(0.5);
  const map = document.createElement('canvas');
  map.width = img.width;
  map.height = img.height;
  map.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);

  const units: UnitView[] = [];
  const secBytes = files.sec ? bytes(`DATOS/MISIONES/${files.sec.toUpperCase()}`) : undefined;
  const sec = secBytes ? parseSec(secBytes) : null;
  const sectors = sec ? new SectorMap(sec) : null;
  const macro = (name: string): string | undefined => {
    const b = bytes(`DATOS/MISIONES/${name.toUpperCase()}.MAC`);
    return b ? new TextDecoder('latin1').decode(b) : undefined;
  };
  const elems = flatten(loadWorld(misText, { difficulty: diffSel.value as Difficulty, macro }));
  const ladders = parseLadders(elems, sectors);
  const assets = new Map<string, { anm: Anm; sprites: SpriteCache } | null>();
  const asset = (name: string): { anm: Anm; sprites: SpriteCache } | null => {
    const key = name.toUpperCase();
    if (!assets.has(key)) {
      const a = bytes(`DATOS/RECURSOS/ELEM/${key}.ANM`);
      const w = bytes(`DATOS/RECURSOS/ELEM/${key}.WAD`);
      assets.set(key, a && w ? { anm: parseAnm(a), sprites: new SpriteCache(parseWad(w)) } : null);
    }
    return assets.get(key) ?? null;
  };
  const props: Prop[] = [];
  const soldiers: SoldierView[] = [];
  const routeListeners: { soldier: Soldier; events: readonly string[] }[] = [];
  const nestOf = new Map<Soldier, Elem>();
  let bombCount = 0;
  const barrelProps: { elem: Elem; prop: Prop }[] = [];
  const mineProps: { elem: Elem; prop: Prop }[] = [];
  const kit: { cepo: Kit | null; decoy: Kit | null } = { cepo: null, decoy: null };
  const boats = new Map<Elem, { boat: Boat; prop: Prop }>();
  for (const e of elems) {
    const slots = boatSlots(e);
    if (slots.length === 0 || !e.anim) continue;
    const a = asset(e.anim);
    if (!a) continue;
    const boat = new Boat(e.x, e.y, e.z, e.angle, slots, sectors);
    boat.share = boatShares(e);
    const prop = { elem: e, anim: new Animator(a.anm, a.anm.sequences.has('ANDAR') ? 'ANDAR' : defaultSeq(a.anm)), sprites: a.sprites, x: e.x, y: e.y, z: e.z, ang: e.angle };
    boats.set(e, { boat, prop });
    props.push(prop);
  }
  for (const e of elems) {
    if (e.cls === 'BICHOALIADO') {
      const a = e.anim ? asset(e.anim) : null;
      if (!a) continue;
      const host = e.parent ? boats.get(e.parent) : undefined;
      const unit = new Unit(e.token, a.anm, host ? host.boat.x : e.x, host ? host.boat.y : e.y, host ? host.boat.z : e.z, host ? host.boat.ang : e.angle, sectors);
      unit.energy = COMMANDO_ENERGY[e.token] ?? 100;
      if (e.height > 0) unit.height = e.height;
      // `AcUsaHab .HABILIDAD BALSA` (solo el marino): piloto de la balsa, plaza 0
      const hab = e.actions.find((x) => x.name.toUpperCase() === 'ACUSAHAB')?.params ?? [];
      unit.pilot = JSON.stringify(find(hab, '.HABILIDAD') ?? '').toUpperCase().includes('BALSA');
      if (host) {
        const seat = freeSeat(host.boat.slots.length, new Set(units.filter((u) => u.unit.boat === host.boat).map((u) => u.unit.seatIndex)), unit.pilot);
        if (seat !== null) unit.board(host.boat, seat);
      }
      const weapons: Weapon[] = [];
      const guns = asArmas(e);
      if (guns.includes('PISTOLA')) weapons.push('PISTOLA');
      if (guns.includes('MIRILLA')) weapons.push('MIRILLA');
      if (guns.includes('PIEDRA')) weapons.push('PIEDRA');
      if (guns.includes('ARPON')) weapons.push('ARPON');
      if (e.actions.some((x) => x.name.toUpperCase() === 'AUACUCHILLAR')) weapons.push('CUCHILLO');
      if (e.actions.some((x) => x.name.toUpperCase() === 'AUCACHIPORRA')) weapons.push('PUNO');
      if (e.actions.some((x) => x.name.toUpperCase() === 'AUESPOSAS')) weapons.push('ESPOSAS');
      const aud = e.actions.find((x) => x.name.toUpperCase() === 'AUDISPARAR')?.params ?? [];
      const mun = asNumber(find(aud, '.MUNMIRILLA'));
      if (mun !== undefined) unit.ammo['MIRILLA'] = mun;
      const harpoons = asNumber(find(aud, '.MUNARPON'));
      if (harpoons !== undefined) unit.ammo['ARPON'] = harpoons;
      const rocks = asNumber(find(aud, '.PIEDRAS'));
      if (rocks !== undefined) unit.ammo['PIEDRA'] = rocks;
      const uses = asNumber(find(e.actions.find((x) => x.name.toUpperCase() === 'AUBOTIQUIN')?.params ?? [], '.USOS'));
      if (uses !== undefined) unit.medkits = uses * 2; // `FUN_004E8B50`: contador = USOS·2, una cura por unidad
      units.push({ unit, sprites: a.sprites, weapons, maxEnergy: unit.energy, canDive: e.actions.some((x) => x.name.toUpperCase() === 'AUBUCEAR'), canCepo: e.actions.some((x) => x.name.toUpperCase() === 'AUMANEJACEPO'), canDecoy: e.actions.some((x) => x.name.toUpperCase() === 'AUMANEJASEGNUELO') });
    } else if (e.bando === 'ALEMAN' && e.anim && e.actions.some((x) => /^ac(bap|banpe|metrallero)/i.test(x.name))) {
      const a = asset(e.anim);
      if (!a) continue;
      const nestHost = e.actions.some((x) => x.name.toUpperCase() === 'ACMETRALLERO') ? e.parent : null;
      const unit = new Unit(e.token, a.anm, nestHost?.x ?? e.x, nestHost?.y ?? e.y, nestHost?.z ?? e.z, nestHost?.angle ?? e.angle, sectors);
      if (e.height > 0) unit.height = e.height;
      unit.ladders = ladders; // los soldados usan escaleras al buscar ruta (BUSCADOR_IRA)
      const pat = e.actions.find((x) => x.name.toUpperCase() === 'ACPATRULLA');
      const routes = pat ? parseRoutes(pat.params, diffSel.value as Difficulty) : [];
      const route = routes[0] ?? null;
      const nest = e.actions.some((x) => x.name.toUpperCase() === 'ACMETRALLERO');
      const vig = e.actions.find((x) => x.name.toUpperCase() === 'ACVIGILAR')?.params ?? [];
      const sweep = asNumber(find(vig, '.ANGBARRIDO'));
      const sweepPeriod = asNumber(find(vig, '.DEMORA'));
      const bap2 = e.actions.find((x) => /^ac(bap|banpe)2$/i.test(x.name));
      const investigateSpeed = asNumber(find(bap2?.params ?? [], '.VELDEJARPATRULLA'));
      const soldier = new Soldier(e.token, unit, route, {
        ...vistaOf(e.block),
        gun: enemyGun(asText(find(e.actions.find((x) => x.name.toUpperCase() === 'ACDISPARAR')?.params ?? [], '.TIPOARMA'))),
        alternateRoutes: routes.slice(1),
        waitRouteEvent: (asNumber(find(pat?.params ?? [], '.ESPERAEVENTO')) ?? 0) !== 0,
        ...(e.actions.some((x) => /^ac(bap|banpe)1$/i.test(x.name)) ? { brain: 'base' as const } : {}),
        ...(bap2 ? { brain: 'route' as const } : {}),
        ...(investigateSpeed === undefined ? {} : { investigateSpeed }),
        smokes: e.actions.some((x) => /^ac(bap2|banpe2)$/i.test(x.name)), // solo AcBap2/AcBanpe2 van a por la cajetilla
        tobacco: (asNumber(find(e.block, '.TENGOTABACO')) ?? 1) !== 0,
        ...(nest ? { fixed: true, noise: 500 } : {}),
        // AcBap1/AcBanpe1 = la base: mira el estímulo y no camina hasta él (AcBap2/AcBanpe2 sí)
        ...(e.actions.some((x) => /^ac(bap1|banpe1)$/i.test(x.name)) ? { walks: false } : {}),
        ...(sweep === undefined ? {} : { sweep }),
        ...(sweepPeriod === undefined ? {} : { sweepPeriod }),
        elliptical: asNumber(find(vig, '.VISTAELIPTICA')) !== 0,
      });
      soldiers.push({ soldier, sprites: a.sprites });
      const events = eventList(find(e.block, '.REACTIVIDADES'));
      if (events.length) routeListeners.push({ soldier, events });
      if (nest && e.parent?.anim) nestOf.set(soldier, e.parent);
    } else if (e.parent?.cls === 'BICHOALIADO') {
      // lo que cuelga de un comando es su inventario (las 4 bombas del ARTIFIC), no un objeto del mapa
      if (e.macro?.toUpperCase() === 'BOMBAACT') bombCount++;
      const kitOf = e.macro?.toUpperCase() === 'CEPO' ? 'cepo' : e.macro?.toUpperCase() === 'SEGNUELO' ? 'decoy' : null;
      const ka = kitOf && e.anim ? asset(e.anim) : null;
      if (kitOf && ka) {
        const k = kit[kitOf];
        if (k) k.left++;
        else kit[kitOf] = { elem: e, anm: ka.anm, sprites: ka.sprites, left: 1 };
      }
    } else if (e.anim && !boats.has(e)) {
      const a = asset(e.anim);
      if (!a) continue;
      const prop = { elem: e, anim: new Animator(a.anm, defaultSeq(a.anm)), sprites: a.sprites, x: e.x, y: e.y, z: e.z, ang: e.angle };
      props.push(prop);
      if (e.macro?.toUpperCase() === 'BARRIL') barrelProps.push({ elem: e, prop });
      if (e.macro?.toUpperCase() === 'MINASUB') mineProps.push({ elem: e, prop });
    }
  }
  const mainBoat = [...boats.values()][0] ?? null;
  const first = units[0]?.unit;
  const p = first ? project(first.body.x, first.body.y, first.z) : { px: img.width / 2, py: img.height / 2 };
  const battle = new Battle(soldiers.map((s) => s.soldier), units.map((u) => u.unit), sectors);
  const iface = parseInterface(misText);
  // IT_TABACO sale `.DISPONIBLE NO` hasta que el comando roba un cigarrillo (contador `ficha+0x8E0`): `hudUnit` lo oculta mientras tabaco = 0.
  // Los interruptores del señuelo también: se muestran según el estado del señuelo (`decoyItem`), no por `.DISPONIBLE`.
  const dynamic = new Set(['IT_TABACO', 'IT_ACTSENUELOOFF', 'IT_ACTSENUELOON']);
  const bag = bagItems(new Map([...iface].map(([t, c]) => [t, { items: c.items.map((i) => (dynamic.has(i.token) ? { ...i, available: true } : i)) }])));
  for (const u of units) if (iface.get(u.unit.token)?.items.some((i) => i.token === 'IT_TABACO' && i.available)) u.unit.tobacco = 1;
  const { sites, objectives, escape, kills } = parseSites(misText, vol, elems);
  const demo = new Demolition(sites, objectives, { soldiers: battle.soldiers, commandos: battle.commandos }, bombCount, { sectors, kills, blastNav: sectors ? navFor(sectors) : null, boat: mainBoat?.boat ?? null });
  const barrelMap = new Map<Barrel, Prop>();
  const mineMap = new Map<Mine, Prop>();
  for (const e of elems) if (e.macro?.toUpperCase() === 'MINASUB') {
    const mine = demo.addMine(e.x, e.y, e.z);
    const prop = mineProps.find((p) => p.elem === e)?.prop;
    if (prop) mineMap.set(mine, prop);
  }
  for (const b of barrelProps) barrelMap.set(demo.addBarrel(b.elem.token, b.elem.x, b.elem.y, b.elem.z, b.elem.height), b.prop);
  const nests = [...nestOf].flatMap(([s, el]) => {
    const prop = props.find((x) => x.elem === el);
    return prop ? [{ soldier: s, prop }] : [];
  });
  const houses = parseHouses(elems);
  // Grupos de `.PATRULLAS` (cabo + patrulleros) y eventos de zona de ruido (engine/groups.ts): los de casa salen con el evento, los libres empiezan en su ruta
  const groups = parseGroups(misText, diffSel.value as Difficulty);
  for (const def of groups) {
    if (!def.startAtHome || !def.home) continue;
    houses.find((h) => h.token.toUpperCase() === def.home?.toUpperCase())?.addGarrison(groupSize(def));
  }
  const spawned = new Set<string>();
  const pendingGroups = new Map<string, GroupDef>();
  const groupLeaders = new Map<string, Soldier>();
  const groupTicks: (() => void)[] = [];
  const spawnGroup = (def: GroupDef): void => {
    if (spawned.has(def.token)) return;
    const house = def.home ? houses.find((h) => h.token.toUpperCase() === def.home?.toUpperCase()) : undefined;
    if (house?.destroyed) return;
    const p0 = def.route?.points[0];
    // shortcut: sin XYZ usa el primer punto de ruta; mejorar al confirmar el valor inicial de la definición en el exe.
    const at = house ? house.exit : def.position ?? (p0 ? { x: p0.x, y: p0.y, z: p0.z } : null);
    if (!at) return;
    spawned.add(def.token);
    const made: Soldier[] = [];
    const make = (i: number, pos: { x: number; y: number; z: number }): boolean => {
      const a = asset(i === 0 ? def.animCabo : def.animSoldier);
      if (!a) return false;
      const f = i === 0 ? null : formationOf(i - 1, def.columns, def.n, def.formX);
      const follow = f ? { leader: () => { const lead = made[f.leader + 1]; return !lead || lead.dead ? null : { x: lead.x, y: lead.y, ang: lead.unit.body.ang, speed: lead.unit.speed }; }, lateral: f.lateral, back: def.formY } : undefined;
      const unit = new Unit(`${def.token}_${i.toString()}`, a.anm, pos.x, pos.y, pos.z, def.angle, sectors);
      unit.ladders = ladders;
      const s = new Soldier(`${def.token}_${i.toString()}_${soldiers.length.toString()}`, unit, i === 0 ? def.route : null, { gun: enemyGun(i === 0 ? def.gunCabo : def.gunSoldier), sweep: def.sweep, sweepPeriod: def.sweepPeriod, ...(follow ? { follow } : { alternateRoutes: def.routes.slice(1) }) });
      made[i] = s;
      if (i === 0) groupLeaders.set(def.token, s);
      soldiers.push({ soldier: s, sprites: a.sprites });
      battle.soldiers.push(s);
      return true;
    };
    if (!make(0, at)) { spawned.delete(def.token); return; }
    if (house && def.startAtHome) house.leaveGarrison();
    const exit = house && def.startAtHome ? new ExitSchedule(def.n) : null;
    if (!exit) for (let i = 1; i < groupSize(def); i++) if (!make(i, at)) break;
    // shortcut: el turno de salida usa el ciclo de misión; el exe usa el contador del sargento. Mejorar al portar su reloj y ocupantes ocultos.
    // shortcut: la sucesión es inmediata, reinicia la ruta y excluye incapacitados o soldados dentro de casa; mejorar al portar SPECIALRUN y la migración completa.
    // shortcut: el cabo usa la orden de investigar para volver al cuartel; mejorar al portar AcpSargento completo.
    let returning = false;
    let retired = false;
    groupTicks.push(() => {
        if (retired) return;
        if (house?.destroyed) { retired = true; return; }
        if (exit && !exit.done) {
          const i = exit.step(game?.ticks ?? 0);
          if (i !== null && make(i, at)) house?.leaveGarrison();
          return;
        }
        let leader = made[0];
        if (!leader) return;
        if (leader.dead) {
          const next = successor(made.slice(1));
          if (!next) {
            if (!made.every((s) => s.dead)) return;
            retired = true;
            groupLeaders.delete(def.token);
            if (house && def.regeneratePatrol) house.recruitPatrol(def.n, (n) => {
              if (!asset(def.animCabo) || (n > 0 && !asset(def.animSoldier))) return false;
              const replacement = { ...def, n };
              spawned.delete(def.token);
              // shortcut: STARTATHOME conserva el grupo como definición pendiente, sin instancias ocultas; mejorar al portar ocupantes alemanes.
              if (def.startAtHome) {
                house.addGarrison(groupSize(replacement));
                pendingGroups.set(def.token, replacement);
              }
              else spawnGroup(replacement);
              return true;
            });
            return;
          }
          const index = made.indexOf(next);
          made[index] = leader;
          made[0] = next;
          next.promote(def.route, def.routes.slice(1));
          groupLeaders.set(def.token, next);
          leader = next;
          returning = false;
        }
        if (!house || leader.down || leader.controlled || house.regen <= 0) return;
        const alive = made.slice(1).filter((s) => !s.dead).length;
        const missing = def.n - alive;
        if (missing <= 0) { returning = false; return; }
        if (leader.target || leader.order === Order.Aim || leader.order === Order.Shoot) { returning = false; return; }
        if (returning && leader.order !== Order.Investigate) returning = false;
        if (!returning) {
          if (alive !== 0 && alive >= missing) return;
          if (leader.order !== Order.Patrol && leader.order !== Order.Return) return;
          leader.hear(house.entry.x, house.entry.y);
          returning = true;
        }
        if (Math.hypot(leader.x - house.entry.x, leader.y - house.entry.y) >= 2) {
          if (!leader.unit.target) returning = false;
          return;
        }
        recruitMissing(house, missing, () => {
          const i = made.findIndex((s, index) => index > 0 && s.dead);
          return i > 0 && make(i, house.entry);
        });
        returning = false;
    });
  };
  const raise = (event: string): void => {
    for (const listener of routeListeners) if (listener.events.includes(event)) listener.soldier.triggerRoute(event);
    for (const initial of groups) {
      const def = pendingGroups.get(initial.token) ?? initial;
      if (def.reactEvents.includes(event)) groupLeaders.get(def.token)?.triggerRoute(event);
      if (def.home && def.exitEvents.includes(event)) {
        spawnGroup(def);
        if (spawned.has(def.token)) pendingGroups.delete(def.token);
      }
    }
  };
  battle.onMissionEvent = raise; // shortcut: solo entrega a rutas y salidas de grupos; mejorar al portar otros receptores de misión.
  for (const def of groups) if (!def.home && def.exitEvents.length === 0) spawnGroup(def);
  const alarm = new Alarm();
  if (sec && sectors) {
    const zones = new ZoneEvents(sec, parseZoneSensors(misText));
    battle.onDanger = (x, y) => {
      const s = sectors.at(x, y);
      if (s) for (const ev of zones.at(sec.sectors.indexOf(s))) { alarm.trigger(); raise(ev); }
    };
  }
  sound?.stop();
  sound = new GameSound(sfx, { effect: (name) => bytes(`DATOS/RECURSOS/SONIDO/WAVE/${name.toUpperCase()}`), music: async (name) => { const r = loaded?.music.get(name.toLowerCase()); return r ? new Uint8Array(await r()) : undefined; } }, project);
  game = { alarm, seenAlarmBlasts: new WeakSet(), visionPicking: false, visionTarget: null, houses, tickGroups: () => { for (const tick of groupTicks) tick(); }, nests, ladders, lift: elems.map(parseLift).find((l): l is Lift => l !== null) ?? null, demo, barrelProps: barrelMap, mineProps: mineMap, blastArt: asset('EXPLOS1'), splashArt: asset('DISPFALL'), stoneArt: asset('CAEPIED'), bombArt: asset('CARTUCHO'), stoneEffects: [], splashes: [], seenSplashes: new WeakSet(), vol, wad, order, volOrder, mapSprites: new SpriteCache(wad), mapOpts: {}, escape, won: false, invincible: false, traps: new Traps(), kit, trapProps: new Map(), cursors: loadCursors(), hud: loadHud(units.map((u) => u.unit.token), bag), bag, hudLeft: false, faces: new FaceAnim(), par: parsePar(misText), result: null, lostAt: null, sound, battle, soldiers, mode: null, planting: null, use: null, control: null, packProps: new Map(), packArt: asset('CAJETILL'), props, boat: mainBoat, water, map, units, sectors, selected: 0, camX: p.px, camY: p.py, ticks: 0 };
  // Solo desarrollo (para probar armas y acciones sin morir): arranca invencible; Alt+I lo alterna como en el original.
  if (import.meta.env.DEV) setInvincible(game, true);
  (window as unknown as { __game: unknown }).__game = { vol, wad, game };
  await progress(1);
  if (introduction) {
    const mission = asList(find(parseClave(misText), '.MISSION')) ?? [];
    const filesBlock = asList(find(mission, '.DATOSFICHEROSMISION')) ?? [];
    const introFile = asText(find(filesBlock, '.INTROSCRIPT'));
    const scriptBytes = introFile ? bytes(`DATOS/MISIONES/${introFile.toUpperCase()}`) : undefined;
    if (scriptBytes) {
      const loadedGame = loaded;
      presenting = true;
      const unlock = lockControls();
      try {
        const start = asNumbers(find(mission, '.XY'));
        const startX = start?.[0] ?? p.px;
        const startY = start?.[1] ?? p.py;
        try { await playIntro(view, new TextDecoder('windows-1252').decode(scriptBytes), bytes, loadedGame.loose, introCamera(game, elems, screenSize), say, screenSize); }
        finally {
          zoomLevel = 1; zoomSel.value = '1';
          game.camX = startX; game.camY = startY;
          camV.x = 0; camV.y = 0; cursor.inside = false; keys.clear();
        }
      } finally {
        presenting = false;
        unlock();
      }
    }
  }
  setupStage();
  sound.init(misText).catch(() => undefined); // sin ambiente ni música si algo falla (no frena la misión)
  say(`${mapSel.selectedOptions[0]?.text ?? n}: ${img.width.toString()}×${img.height.toString()} px, ${units.length.toString()} comandos (${Math.round(performance.now() - t0).toString()} ms). Clic izquierdo = ordenar, doble clic = correr; derecho = cancelar o arrastrar para elegir.${import.meta.env.DEV ? ' Comandos invencibles (Alt+I), Ctrl+X teletransporta, Ctrl+Alt+N termina la misión.' : ''}`);
}

/** `.ARMAS [ … ]` de la acción AuDisparar de un comando. */
const asArmas = (e: Elem): string[] => {
  const p = e.actions.find((x) => x.name.toUpperCase() === 'AUDISPARAR')?.params ?? [];
  const i = p.findIndex((n) => typeof n === 'string' && n.toUpperCase() === '.ARMAS');
  const l = p[i + 1];
  return i >= 0 && Array.isArray(l) ? l.filter((n): n is string => typeof n === 'string').map((n) => n.toUpperCase()) : [];
};

/** Secuencia en reposo de un gráfico: REPOSO si existe; si no, la primera (shortcut: la pose real la elige cada acción, no leída para objetos). */
const defaultSeq = (anm: Anm): string => (anm.sequences.has('REPOSO') ? 'REPOSO' : (anm.sequences.keys().next().value as string));

/** Vuelve a componer el mapa con los volúmenes destruidos (se llama al explotar algo). */
function recompose(g: Game): void {
  g.demo.dirty = false;
  const st = g.demo.mapState();
  g.mapOpts = { rename: st.rename, ruined: st.ruined };
  const img = composeMap(g.vol, g.wad, { order: g.order, ...(g.water ? { layer: 'land' as const } : { skipWater: waterBox.checked }), rename: st.rename, ruined: st.ruined });
  g.map.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);
}

/** Fija el resultado (FINM al ganar; ALMU `DEFEAT_DELAY` ciclos después de morir el último comando) con la puntuación del exe (engine/score.ts). */
function settle(g: Game): void {
  if (g.result) return;
  if (g.battle.lost) g.lostAt ??= g.ticks;
  if (!g.won && (g.lostAt === null || g.ticks - g.lostAt < DEFEAT_DELAY)) return;
  const lost = g.units.reduce((s, u) => s + (u.unit.dead ? u.maxEnergy : u.maxEnergy - u.unit.energy), 0);
  const par = diffSel.value === 'FACIL' ? g.par.easy : g.par.hard;
  g.result = { score: score(g.lostAt ?? g.ticks, par, lost, g.units.length), text: g.won ? END_TEXT.FINM : END_TEXT.ALMU, victory: g.won, kills: g.soldiers.filter((s) => s.soldier.dead).length };
}

/** Victoria: todos los objetivos, todos los comandos a bordo y la Zodiac en el sector de huida (Intend00). */
function checkWin(g: Game): void {
  settle(g);
  const b = g.boat?.boat;
  if (g.won || !b || !g.escape || !g.demo.objectivesDone) return;
  if (escapeReady(g.units.map((u) => u.unit), b, g.escape, g.sectors)) g.won = true;
}

/** Escaleras y montacargas por ciclo: ESCALA02 se desactiva al caer CASA04 (Intend00) y el montacargas lleva a quien está encima. */
function tickWorld(g: Game): void {
  for (const l of g.ladders) if (l.token === 'ESCALA02') l.disabled = g.demo.destroyed.has('CASA04');
  const lift = g.lift;
  if (!lift?.moving) return;
  const p = lift.pos;
  const riders = g.units.filter((u) => !u.unit.dead && !u.unit.climb && Math.hypot(u.unit.body.x - p.x, u.unit.body.y - p.y) < 40 && Math.abs(u.unit.z - p.z) < 25);
  const d = lift.tick();
  for (const u of riders) u.unit.carryBy(d.x, d.y, d.z);
  const stillMoving = (): boolean => lift.moving; // tick() puede haberlo detenido
  if (!stillMoving()) for (const u of riders) u.unit.settle();
}

function makeWater(vol: Vol, wad: Wad, def: NonNullable<ReturnType<typeof parseWater>>, index: Uint8Array, bounds: Rect): WaterView {
  const img = composeMap(vol, wad, { layer: 'water' });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);
  return { canvas, img, bounds, fx: new WaterFx(def, index), index, vol, wad, drawn: true };
}

/** Un ciclo del agua (FUN_006BED80): cámara = centro de la ventana en píxeles de mapa. */
function stepWater(g: Game, w: WaterView): void {
  w.drawn = false;
  w.fx.step({ x: g.camX, y: g.camY });
  w.fx.copyTo(w.index);
  const z = zoom();
  const vw = vp(g).w / z;
  const vh = vp(g).h / z;
  const clip = { x: Math.max(0, Math.floor(g.camX - vw / 2)), y: Math.max(0, Math.floor(g.camY - vh / 2)), w: Math.ceil(vw) + 1, h: Math.ceil(vh) + 1 };
  repaintWater(w.img, w.vol, w.wad, clip);
  const x = Math.min(clip.x, w.img.width - 1);
  const y = Math.min(clip.y, w.img.height - 1);
  // shortcut: solo se sube a la capa lo que está en pantalla; lo demás se pone al día al entrar en vista (mismo criterio que el flag del exe)
  w.canvas.getContext('2d')?.putImageData(new ImageData(w.img.pixels, w.img.width, w.img.height), 0, 0, x, y, Math.min(clip.w, w.img.width - x), Math.min(clip.h, w.img.height - y));
}

function setupStage(): void {
  if (!stage) {
    stage = document.createElement('canvas');
    stage.style.cssText = 'margin:auto';
    screenFilter = new ScreenFilter(stage);
    screenFilter.setMode(parseFilterMode(filterSel.value));
    stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    stage.addEventListener('mousedown', onMouse);
    stage.addEventListener('mouseup', onRightUp);
    stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const step = zoomLevel < 1 || (e.deltaY > 0 && zoomLevel <= 1) ? 0.05 : 0.1;
        setZoom(zoomLevel + (e.deltaY < 0 ? step : -step));
      },
      { passive: false },
    );
    stage.addEventListener('mousemove', (e) => {
      if (!stage) return;
      const point = canvasPoint(e.clientX, e.clientY, stage.getBoundingClientRect(), [stage.width, stage.height]);
      cursor.x = point.x;
      cursor.y = point.y;
      cursor.inside = true;
    });
    stage.addEventListener('mouseleave', () => {
      cursor.inside = false;
    });
  }
  view.replaceChildren(stage);
  screenFilter?.attach(view);
  refitStage = fitCanvas(stage, view, () => parseFilterMode(filterSel.value) === 'none'); // con filtro el juego llena la ventana sin pasos enteros
  resize();
  cancelAnimationFrame(loopId);
  let last = performance.now();
  let acc = 0;
  const TICK = 50; // 20 ciclos/s (MAXFPS = 0x14)
  const frame = (now: number): void => {
    const g = game;
    if (!g) return;
    const dt = now - last;
    acc = Math.min(acc + dt, 500);
    last = now;
    while (acc >= TICK) {
      if (!g.battle.lost && !g.won) g.battle.tick();
      if (!g.battle.lost && !g.won) g.tickGroups();
      for (const s of g.splashes) s.age++;
      for (let i = g.splashes.length - 1; i >= 0; i--) if ((g.splashes[i]?.age ?? SPLASH_CYCLES) >= SPLASH_CYCLES) g.splashes.splice(i, 1);
      for (const bl of g.demo.blasts) if (!g.seenSplashes.has(bl) && isWater(g.sectors?.at(bl.x, bl.y) ?? null)) {
        g.seenSplashes.add(bl);
        g.splashes.push({ x: bl.x, y: bl.y, age: 0 });
      }
      g.demo.tick();
      for (const bl of g.demo.blasts) if (!g.seenAlarmBlasts.has(bl)) { g.seenAlarmBlasts.add(bl); g.battle.onDanger?.(bl.x, bl.y); }
      g.alarm.tick();
      const selected = g.units[g.selected];
      if (g.mode && selected && !weaponAvailable(selected, g.mode)) g.mode = null;
      g.sound.tick({ alarmVolume: g.alarm.volume, camX: g.camX, camY: g.camY, tracers: g.battle.tracers, blasts: g.demo.blasts, voices: g.battle.takeVoices(), effects: [...g.battle.takeEffects(), ...g.demo.takeEffects()], end: g.result ? (g.result.victory ? 'win' : 'lose') : null });
      destroyLinkedHouses(g.houses, g.demo.destroyed);
      tickWorld(g);
      for (const h of g.houses) h.tick();
      for (const n of g.nests) {
        n.prop.ang = n.soldier.unit.body.ang;
        const want = n.soldier.nestFiring ? 'DISPARA' : 'NODISPARA';
        if (n.prop.anim.has(want)) n.prop.anim.set(want);
      }
      for (const [pk, pr] of g.packProps) {
        if (!pk.taken) continue;
        g.props.splice(g.props.indexOf(pr), 1); // la recogió un soldado
        g.packProps.delete(pk);
      }
      const ctl = g.control;
      if (ctl && (ctl.owner.dead || ctl.soldier.dead)) endControl(g);
      g.demo.tickMines(g.boat?.boat ?? null, g.units.map((u) => u.unit));
      g.traps.tick(g.soldiers.map((s) => s.soldier), (x, y, r) => {
        g.battle.noise(x, y, r);
      });
      for (const c of g.traps.cepos) if (!c.armed) g.trapProps.get(c)?.anim.advance(0, 1); // PILLAR: el cepo se cierra
      if (g.boat?.boat.punctured && g.boat.prop.anim.has('PINCHAR')) g.boat.prop.anim.set('PINCHAR');
      if (g.demo.dirty) recompose(g);
      checkWin(g);
      g.boat?.boat.tick();
      for (const u of g.units) u.unit.tick();
      if (g.boat) {
        g.boat.prop.x = g.boat.boat.x;
        g.boat.prop.y = g.boat.boat.y;
        g.boat.prop.ang = g.boat.boat.ang;
      }
      for (const p of g.props) if (p.anim.cyclic) p.anim.advance(0, 1); // BANDERA, BOYA: secuencias cíclicas por tiempo (shortcut: `.STARTFRAME` sin leer su efecto, todas en la misma fase)
      for (let i = g.stoneEffects.length - 1; i >= 0; i--) {
        const fx = g.stoneEffects[i];
        if (!fx) continue;
        fx.prop.anim.advance(0, 1);
        if (--fx.left <= 0) { g.props.splice(g.props.indexOf(fx.prop), 1); g.stoneEffects.splice(i, 1); }
      }
      if (g.water?.drawn) stepWater(g, g.water);
      g.faces.tick(g.units.length, g.selected);
      g.ticks++;
      acc -= TICK;
    }
    scrollCamera(g, dt / TICK);
    draw(g);
    screenFilter?.present();
    loopId = requestAnimationFrame(frame);
  };
  loopId = requestAnimationFrame(frame);
}

/** Cursor sobre el lienzo (para el scroll por borde). */
const cursor = { x: 0, y: 0, inside: false };
const camV = { x: 0, y: 0 };
const EDGE = 24; // shortcut: el exe pide el píxel exacto del borde (cx == 0, cx ≥ ancho−2; q1-camara.md), inviable en una ventana

/**
 * Scroll de la cámara (docs/research/q1-camara.md §Scroll): paso n = 16 (Mayús 32, Ctrl 4); con una dirección pulsada el impulso es n·0,1875 por ciclo hasta
 * un tope n·1,5; sin impulso la velocidad decae ×0,7 por ciclo y se corta a 0 por debajo de 1. `cycles` = ciclos de 1/20 s transcurridos.
 * shortcut: el exe corre esto 1 vez por cuadro de la interfaz; aquí se reparte por tiempo para que no dependa de los Hz del monitor.
 */
function scrollCamera(g: Game, cycles: number): void {
  const n0 = keys.has('shift') ? 32 : keys.has('control') ? 4 : 16;
  const n = zoom() < 1 ? Math.trunc(n0 / zoom()) : n0; // con zoom < 1 el paso es ftol(n / zoom) (FUN_006B2EE0): la velocidad en pantalla no cae
  let ix = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  let iy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  if (ix === 0 && iy === 0 && cursor.inside && stage) {
    ix = (cursor.x >= stage.width - EDGE ? 1 : 0) - (cursor.x <= EDGE ? 1 : 0);
    iy = (cursor.y >= stage.height - EDGE ? 1 : 0) - (cursor.y <= EDGE ? 1 : 0);
  }
  const axis = (v: number, i: number): number => {
    if (i === 0) {
      const d = v * 0.7 ** cycles;
      return Math.abs(d) < 1 ? 0 : d;
    }
    return Math.max(-n * 1.5, Math.min(n * 1.5, v + i * n * 0.1875 * cycles));
  };
  camV.x = axis(camV.x, ix);
  camV.y = axis(camV.y, iy);
  g.camX += camV.x * cycles;
  g.camY += camV.y * cycles;
}

function resize(): void {
  if (!stage) return;
  if (stage.width !== screenSize[0]) stage.width = screenSize[0];
  if (stage.height !== screenSize[1]) stage.height = screenSize[1];
}

/** Cámara del recorrido táctico: posiciones y aceleración de FUN_005B0540 / FUN_005C9BC0. */
function introCamera(g: Game, elems: readonly Elem[], resolution: Resolution): TacticalIntro {
  const camera = new IntroCamera(g.camX, g.camY);
  const target = (arg: string): { x: number; y: number } | null => {
    // shortcut: [x y] se toma como píxel de mapa; falta portar la resolución por sector de FUN_004E1E70.
    const screen = /^\[\s*([-\d.]+)\s+([-\d.]+)/.exec(arg);
    if (screen?.[1] && screen[2]) return { x: Number(screen[1]), y: Number(screen[2]) };
    const token = /^B\s+(\S+)/.exec(arg)?.[1];
    const elem = token ? elems.find((e) => e.token.toUpperCase() === token.toUpperCase()) : undefined;
    if (!elem) return null;
    const p = project(elem.x, elem.y, elem.z);
    return { x: p.px, y: p.py };
  };
  const clamp = (p: { x: number; y: number }): { x: number; y: number } => {
    const halfW = resolution[0] / (2 * camera.scale);
    const halfH = resolution[1] / (2 * camera.scale);
    return { x: Math.max(halfW, Math.min(g.map.width - halfW, p.x)), y: Math.max(halfH, Math.min(g.map.height - halfH, p.y)) };
  };
  return {
    draw(canvas) {
      const previous = stage;
      stage = canvas; g.camX = camera.x; g.camY = camera.y; zoomLevel = camera.scale;
      try { draw(g, true); } finally { stage = previous; }
      camera.x = g.camX; camera.y = g.camY;
    },
    setPos(arg) { const p = target(arg); if (p) { const q = clamp(p); camera.setPos(q.x, q.y); } },
    setZoom(value) { camera.setZoom(value); },
    goto(arg) {
      const p = target(arg);
      if (p) { const q = clamp(p); camera.goto(q.x, q.y, /@([LMNR])/.exec(arg)?.[1] ?? 'N'); }
    },
    zoom(arg) { const m = /^\s*([\d.]+)\s*([LMNR])?/.exec(arg); if (m?.[1]) camera.zoom(Number(m[1]), m[2] ?? 'N'); },
    moving: () => camera.moving,
    zooming: () => camera.zooming,
    // shortcut: durante el briefing no avanzan la simulación ni el agua; verificar los receptores de FUN_0056D790.
    tick: () => { camera.tick({ width: resolution[0], height: resolution[1], mapWidth: g.map.width, mapHeight: g.map.height }); },
    stop: () => { camera.stop(); },
  };
}

async function openBriefing(): Promise<void> {
  if (!game || !stage || presenting) return;
  const missionData = bytes(`DATOS/MISIONES/${mapSel.value}.MIS`);
  if (!missionData) return;
  const mission = asList(find(parseClave(new TextDecoder('windows-1252').decode(missionData)), '.MISSION')) ?? [];
  const briefing = asList(find(mission, '.BRIEFING')) ?? [];
  const filename = asText(find(briefing, '.TEXTOS'));
  const data = filename ? bytes(`DATOS/MISIONES/${filename.toUpperCase()}`) : undefined;
  if (!data) { say('Esta misión no tiene ficha de objetivos.', true); return; }
  presenting = true;
  const unlock = lockControls();
  cancelAnimationFrame(loopId);
  try { await showBriefing(view, stage.width, stage.height, bytes, new TextDecoder('windows-1252').decode(data)); }
  finally { presenting = false; unlock(); setupStage(); }
}

let cursorKey = '';

/** ¿Hay un soldado vivo bajo el cursor? (mismo acierto que el clic de `onMouse`). */
function overTarget(g: Game): boolean {
  const z = zoom();
  const v = vp(g);
  const mx = g.camX - v.w / z / 2 + (cursor.x - v.x) / z;
  const my = g.camY - v.h / z / 2 + (cursor.y - v.y) / z;
  return g.soldiers.some((s) => {
    if (s.soldier.dead) return false;
    const u = s.soldier.unit;
    const p = project(u.body.x, u.body.y, u.z);
    return Math.abs(mx - p.px) < 14 && my > p.py - 40 && my < p.py + 8;
  });
}

const SCOPE = 'C_MIRILL.RLE';

/**
 * Retícula de la mirilla (`FUN_005CA590` → `FUN_005D6160`, docs/lectura/hud-consumidores.md): el exe la dibuja sobre la escena y el círculo de su interior se redibuja; con el cursor
 * `CUR_MIRA` (24, `DAT_008405bc = 1`) se copia entero y con `CUR_NMIRA` (25, fuera de alcance, `= 0`) se copia con `& 0xF800` (solo el canal rojo del RGB565), que deja la escena
 * en un rojo suave donde todavía se ve adónde se apunta. shortcut: el radio del círculo es el de la retícula (47) y falta la deformación de lente (la tabla `DAT_00853a98` no se leyó).
 */
function drawScope(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.mode !== 'MIRILLA' || !cursor.inside || !stage || !g.cursors) return;
  if (overHudAt(g, cursor.x, cursor.y)) return;
  const sprite = g.cursors.canvasOf(SCOPE);
  if (!sprite) return;
  const cx = Math.round(cursor.x);
  const cy = Math.round(cursor.y);
  const r = Math.floor(sprite.width / 2);
  const x0 = Math.max(0, cx - r);
  const y0 = Math.max(0, cy - r);
  const w = Math.min(stage.width, cx + r + 1) - x0;
  const h = Math.min(stage.height, cy + r + 1) - y0;
  if (w > 0 && h > 0 && !scopeInRange(g)) {
    const img = ctx.getImageData(x0, y0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x0 + x - cx) ** 2 + (y0 + y - cy) ** 2 > r * r) continue;
        const i = (y * w + x) * 4;
        d[i] = (d[i] ?? 0) & 0xf8; // canal rojo de RGB565
        d[i + 1] = 0;
        d[i + 2] = 0;
      }
    }
    ctx.putImageData(img, x0, y0);
  }
  ctx.drawImage(sprite, cx - r, cy - r);
}

/** ¿Se puede disparar la mirilla al punto bajo el cursor? (alcance de la mirilla y línea libre; un soldado o barril apuntan a su posición). */
function scopeInRange(g: Game, weapon: 'MIRILLA' | 'ARPON' = 'MIRILLA'): boolean {
  const sel = g.units[g.selected]?.unit;
  if (!sel || !stage) return true;
  const z = zoom();
  const v = vp(g);
  const mx = g.camX - v.w / z / 2 + (cursor.x - v.x) / z;
  const my = g.camY - v.h / z / 2 + (cursor.y - v.y) / z;
  const near = (px: number, py: number): boolean => Math.abs(mx - px) < 14 && my > py - 40 && my < py + 8;
  const foe = g.soldiers.find((s) => !s.soldier.dead && near(project(s.soldier.x, s.soldier.y, s.soldier.unit.z).px, project(s.soldier.x, s.soldier.y, s.soldier.unit.z).py));
  const barrel = [...g.barrelProps].find(([b, pr]) => !b.dead && Math.abs(mx - project(pr.x, pr.y, pr.z).px) < 14 && Math.abs(my - project(pr.x, pr.y, pr.z).py + 10) < 20)?.[0];
  // shortcut: el área de selección usa el rectángulo genérico de objetos, falta la máscara de selección del sprite original.
  const mine = [...g.mineProps].find(([m, pr]) => !m.dead && Math.abs(mx - project(pr.x, pr.y, pr.z).px) < 14 && Math.abs(my - project(pr.x, pr.y, pr.z).py + 10) < 20)?.[0];
  const spot = foe || barrel || mine ? null : g.sectors?.pick(mx, my);
  const target = foe?.soldier ?? barrel ?? mine ?? (spot ? groundTarget(spot.x, spot.y, spot.z) : null);
  return target !== null && canFire(sel, target, weapon, g.sectors);
}

/** Cursor del mouse según el arma elegida (engine/cursors.ts); en el HUD vuelve a la flecha. */
function updateCursor(g: Game): void {
  if (!stage || !g.cursors) return;
  const v = g.units[g.selected];
  const s = hudSpace(cursor.x, cursor.y);
  const hudOver = g.hud !== null && (overHud(s.x, s.y, s.w, g.hudLeft) || inRect(s.x, s.y, bagRect(s.w, s.h, g.hudLeft)) || (v !== undefined && g.hud.itemAt(s.x, s.y, s.w, s.h, hudUnit(v, g), g.hudLeft) !== null));
  const mode: CursorMode | null = hudOver ? null : g.visionPicking ? 'OJO' : g.planting === 'TABACO' ? 'TABACO' : g.use ?? g.mode;
  const planting = !hudOver && g.planting !== null && g.planting !== 'TABACO';
  const applicable = mode !== null && cursor.inside && (mode === 'ARPON' ? scopeInRange(g, 'ARPON') : overTarget(g));
  const spec = cursorFor(mode, planting, applicable, g.ticks);
  const scope = spec.sprite === SCOPE; // la retícula la dibuja `drawScope` sobre la escena (efecto de lente del exe), no el cursor del sistema
  const key = scope ? 'scope' : `${spec.sprite}|${spec.hot}|${spec.x?.toString() ?? ''}|${spec.y?.toString() ?? ''}`;
  if (key === cursorKey && stage.style.cursor) return;
  cursorKey = key;
  stage.style.cursor = scope ? 'none' : g.cursors.cssFor(spec);
}

function draw(g: Game, briefing = false): void {
  const ctx = stage?.getContext('2d');
  if (!stage || !ctx) return;
  const z = zoom();
  const v = briefing ? { x: 0, y: 0, w: stage.width, h: stage.height } : vp(g);
  const vw = v.w / z;
  const vh = v.h / z;
  g.camX = Math.max(vw / 2, Math.min(g.map.width - vw / 2, g.camX));
  g.camY = Math.max(vh / 2, Math.min(g.map.height - vh / 2, g.camY));
  const ox = g.camX - vw / 2;
  const oy = g.camY - vh / 2;
  ctx.imageSmoothingEnabled = !Number.isInteger(z); // con zoom no entero el vecino más cercano da bloques de ancho irregular
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stage.width, stage.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ctx.translate(v.x, v.y);
  ctx.scale(z, z);
  ctx.translate(-ox, -oy);
  if (g.water) {
    const b = g.water.bounds;
    if (b.x < ox + vw && b.x + b.w > ox && b.y < oy + vh && b.y + b.h > oy) g.water.drawn = true;
    ctx.drawImage(g.water.canvas, 0, 0);
  }
  ctx.drawImage(g.map, 0, 0);
  if (g.lift) {
    // montacargas (sin sprite en los datos: una plataforma) en su posición actual
    const q = project(g.lift.pos.x, g.lift.pos.y, g.lift.pos.z);
    ctx.fillStyle = '#3b3f46';
    ctx.fillRect(q.px - 22, q.py - 10, 44, 20);
    ctx.strokeStyle = g.lift.moving ? '#c9a24a' : '#888';
    ctx.strokeRect(q.px - 22 + 0.5, q.py - 10 + 0.5, 43, 19);
  }
  if (g.visionTarget) for (const entry of g.soldiers) {
    const s = entry.soldier;
    if (s.dead) continue;
    const t = g.visionTarget;
    if ('soldier' in t ? t.soldier === s : sees({ x: s.x, y: s.y, z: s.unit.z, eye: s.unit.eye, sector: s.unit.sector, heading: s.unit.body.ang + s.headAngle, range: s.reach, angle: s.aperture }, { ...t, radius: 0, low: false }, g.sectors)) drawCone(ctx, g, s);
  }
  // Personajes y objetos entre los volúmenes del mapa (FUN_005D1C40): se ordenan juntos y, si un edificio va después, se repinta encima.
  interface Drawable {
    actor: Actor;
    rect: Clip | null;
    paint: () => void;
  }
  const drawables: Drawable[] = [];
  const off = (px: number, py: number): boolean => px < ox - 150 || px > ox + vw + 150 || py < oy - 150 || py > oy + vh + 150;
  const add = (actor: Actor, sprites: SpriteCache, frame: AnmFrame, px: number, py: number, before?: () => void): void => {
    drawables.push({
      actor,
      rect: sprites.bounds(frame, px, py),
      paint: () => {
        before?.();
        if (!sprites.draw(ctx, frame, px, py)) {
          ctx.fillStyle = '#f0f';
          ctx.fillRect(px - 4, py - 30, 8, 30);
        }
      },
    });
  };
  for (const pr of g.props) {
    const { px, py } = project(pr.x, pr.y, pr.z);
    if (off(px, py)) continue;
    if ([...g.barrelProps].some(([b, bp]) => bp === pr && b.dead)) continue;
    if ([...g.mineProps].some(([m, mp]) => mp === pr && m.done)) continue;
    const isBoat = pr === g.boat?.prop;
    add({ x: pr.x, y: pr.y, z: pr.z, r: isBoat ? 30 : pr.elem.radius || 10, h: isBoat ? 0.01 : pr.elem.height || 20 }, pr.sprites, pr.anim.frame(pr.ang), px, py);
  }
  g.units.forEach((u, i) => {
    if (u.unit.hidden) return;
    const { px, py } = project(u.unit.body.x, u.unit.body.y, u.unit.z);
    // los que van en el bote se pintan justo encima de él (RENDERVOL del bote: H 0,01)
    add({ x: u.unit.body.x, y: u.unit.body.y, z: u.unit.z + (u.unit.boat ? 0.02 : 0), r: 10, h: 40 }, u.sprites, u.unit.anim.frame(u.unit.body.ang), px, py, () => {
      if (i !== g.selected) return;
      ctx.strokeStyle = '#c9a24a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
  for (const s of g.soldiers) {
    const u = s.soldier.unit;
    const { px, py } = project(u.body.x, u.body.y, u.z);
    if (off(px, py) || u.hidden) continue;
    add({ x: u.body.x, y: u.body.y, z: u.z, r: 10, h: s.soldier.dead ? 0.5 : 40 }, s.sprites, u.anim.frame(u.body.ang), px, py);
  }
  const placed = g.volOrder.place(drawables.map((d) => d.actor));
  for (const k of placed.order) {
    const d = drawables[k];
    if (!d) continue;
    d.paint();
    if (d.rect) for (const pi of placed.after[k] ?? []) {
      const poly = g.vol.polys[pi];
      if (poly) paintPoly(ctx, poly, g.wad, (sp) => g.mapSprites.canvasFor(sp), d.rect, g.mapOpts);
    }
  }
  for (const bm of g.demo.planted) {
    const q = project(bm.x, bm.y, bm.z);
    const frame = g.bombArt?.anm.sequences.get('DEJABOMBA')?.steps[0]?.[0];
    if (frame) g.bombArt.sprites.draw(ctx, frame, q.px, q.py);
  }
  for (const bl of g.demo.blasts) {
    const sector = g.sectors?.at(bl.x, bl.y);
    const q = project(bl.x, bl.y, sector ? groundZ(sector, bl.x, bl.y) : 0);
    if (isWater(sector ?? null)) continue;
    if (!g.blastArt?.anm.sequences.has('EXPLOSION1')) continue;
    const anim = new Animator(g.blastArt.anm, 'EXPLOSION1');
    anim.advance(0, BLAST_CYCLES - bl.ttl);
    g.blastArt.sprites.draw(ctx, anim.frame(0), q.px, q.py);
  }
  for (const splash of g.splashes) {
    const sector = g.sectors?.at(splash.x, splash.y);
    const q = project(splash.x, splash.y, sector ? groundZ(sector, splash.x, splash.y) : 0);
    if (splash.age < 15 && g.splashArt?.anm.sequences.has('FALLOCANONAGUA')) {
      const anim = new Animator(g.splashArt.anm, 'FALLOCANONAGUA');
      anim.advance(0, splash.age);
      g.splashArt.sprites.draw(ctx, anim.frame(0), q.px, q.py);
    }
    for (const drop of waterSplash(splash.x, splash.y, splash.age)) {
      ctx.fillStyle = drop.color;
      ctx.fillRect(Math.round(q.px + drop.x), Math.round(q.py + drop.y), 1, 1);
    }
  }
  if (g.splashArt?.anm.sequences.has('ANDAR')) {
    for (const puff of g.battle.nestPuffs) {
      const anim = new Animator(g.splashArt.anm, 'ANDAR');
      anim.advance(0, puff.age);
      const q = project(puff.x, puff.y, puff.z);
      g.splashArt.sprites.draw(ctx, anim.frame(0), q.px, q.py);
    }
  }
  for (const tr of g.battle.tracers) {
    if (tr.enemy) continue;
    const a = project(tr.fromX, tr.fromY, 25);
    const b = project(tr.toX, tr.toY, 25);
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }
  const t = g.units[g.selected]?.unit;
  if (t?.target) {
    const q = project(t.target.x, t.target.y, t.target.z);
    ctx.strokeStyle = '#c9a24a';
    ctx.beginPath();
    const here = project(t.body.x, t.body.y, t.z);
    ctx.moveTo(here.px, here.py);
    for (const w of t.waypoints) {
      const p = project(w.x, w.y, w.z);
      ctx.lineTo(p.px, p.py);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.px, q.py, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (briefing) return;
  if (g.hud) {
    const k = hudK();
    ctx.save();
    ctx.scale(k, k);
    g.hud.draw(ctx, stage.width / k, stage.height / k, g.units.map((u) => hudUnit(u, g)), g.selected, (i) => g.faces.of(i), g.hudLeft, litItems(g), g.alarm.volume > 0);
    ctx.restore();
  }
  updateCursor(g);
  drawHud(ctx, g);
  drawScope(ctx, g);
  if (t) {
    ctx.fillStyle = '#d9dde3';
    ctx.font = '12px system-ui';
    ctx.fillText(`${t.token}  x=${t.body.x.toFixed(0)} y=${t.body.y.toFixed(0)}  ${t.anim.name}[${t.anim.step.toString()}]  v=${Math.hypot(t.body.vx, t.body.vy).toFixed(2)} u/ciclo  ciclo ${g.ticks.toString()}`, 10, stage.height - 10);
  }
}

/**
 * Cono de visión del soldado sobre el SUELO (cada punto con la altura del terreno bajo él) y cortado en el primer sector Ocluso, igual que `sees`. Dos zonas como en
 * `Vista01` (percepcion.md §3.2-3.3): la larga, hasta el alcance completo (800), donde lo ven a uno de pie; y la corta, a la MITAD (`AC = A4·0,5`), donde lo ven
 * también agachado o arrastrándose. Fuera de la corta, quien esté agachado no es visto. Verdes (la zona corta, más oscura).
 */
function drawCone(ctx: CanvasRenderingContext2D, g: Game, s: Soldier): void {
  const u = s.unit;
  const head = u.body.ang + s.headAngle;
  const half = s.aperture / 2;
  // Un solo cono: las dos zonas comparten las mismas rayas (cortadas por oclusión) y el cono es plano, en el plano del soldado (z de sus pies), con aristas rectas, y
  // solo se corta donde la vista se bloquea de verdad (nada de seguir el relieve de abajo, que lo deformaba).
  const rays: { k: number; a: number; d: number }[] = [];
  for (let k = -half; k <= half + 1e-9; k += 5) {
    const a = ((head + k) * Math.PI) / 180;
    rays.push({ k, a, d: rayReach(g.sectors, u.body.x, u.body.y, a, s.reach, u.z) });
  }
  const at = (a: number, r: number): { px: number; py: number } => {
    const x = u.body.x + Math.cos(a) * r;
    const y = u.body.y + Math.sin(a) * r;
    return project(x, y, u.z);
  };
  const edge = (ray: { a: number; d: number }, r0: number, r1: number): { px: number; py: number }[] => {
    const top = Math.min(r1, ray.d);
    const out: { px: number; py: number }[] = [];
    for (let r = r0; r < top; r += 25) out.push(at(ray.a, r));
    out.push(at(ray.a, top));
    return out;
  };
  const zone = (r0: number, r1: number, fill: string, line: string): void => {
    const first = rays[0];
    const last = rays[rays.length - 1];
    if (!first || !last) return;
    const pts = [...edge(first, r0, r1), ...rays.slice(1, -1).map((ray) => at(ray.a, Math.min(r1, ray.d))), ...edge(last, r0, r1).reverse() ];
    if (r0 > 0) pts.push(...rays.slice(1, -1).reverse().map((ray) => at(ray.a, Math.min(r0, ray.d))));
    ctx.fillStyle = fill;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  zone(s.reach * 0.5, s.reach, 'rgba(110,200,80,.20)', 'rgba(110,200,80,.55)');
  zone(0, s.reach * 0.5, 'rgba(30,140,50,.32)', 'rgba(30,140,50,.8)');
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.font = '12px system-ui';
  const top = g.hud ? HUD_BAR * hudK() + 8 : 0; // con HUD, los textos van bajo la tira superior
  const rows = g.hud ? 0 : g.units.length;
  (g.hud ? [] : g.units).forEach((u, i) => {
    const x = 10;
    const y = 10 + i * 34;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, y, 190, 30);
    if (i === g.selected) {
      ctx.strokeStyle = '#c9a24a';
      ctx.strokeRect(x + 0.5, y + 0.5, 189, 29);
    }
    ctx.fillStyle = u.unit.dead ? '#e0826f' : '#d9dde3';
    ctx.fillText(`${(i + 1).toString()} ${u.unit.token}${u.unit.dead ? ' (muerto)' : u.unit.inHouse ? ` (en ${u.unit.inHouse})` : u.unit.diving ? ' (buceando)' : u.unit.boat ? ' (en el bote)' : u.unit.crouched ? ' (agachado)' : ''}`, x + 6, y + 13);
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 18, 176, 6);
    ctx.fillStyle = u.unit.energy / u.maxEnergy > 0.4 ? '#6cc070' : '#e0826f';
    ctx.fillRect(x + 6, y + 18, (176 * u.unit.energy) / u.maxEnergy, 6);
  });
  const sel = g.units[g.selected];
  ctx.fillStyle = '#d9dde3';
  const shortcuts = sel ? ([['PISTOLA', 'F pistola'], ['MIRILLA', 'R fusil'], ['CUCHILLO', 'C cuchillo']] as const).filter(([w]) => weaponAvailable(sel, w)).map(([, label]) => label) : [];
  const modeText = g.mode === 'ARPON' && sel && sel.unit.coolDown > 0 ? `ARPON (recargando ${(sel.unit.coolDown / 20).toFixed(1)} s)` : (g.mode ?? 'ninguna (clic = mover)');
  ctx.fillText(`Arma: ${g.planting ? `${g.planting.toLowerCase()} (clic donde ponerlo)` : modeText} · ${[...shortcuts, 'G agacharse', ...(sel?.canDive ? ['N bucear'] : []), 'Esc cancelar', 'E bote', 'V ojo'].join(' · ')}`, 10, top + 14 + rows * 34);
  if (sel) {
    const hud = hudUnit(sel, g);
    ctx.fillText(`Disponibles: ${sel.weapons.filter((w) => weaponAvailable(sel, w)).map((w) => (sel.unit.ammo[w] === undefined ? w : `${w} (${Math.max(0, sel.unit.ammo[w] ?? 0).toString()})`)).join(', ') || '—'} · Objetos: ${visibleItems(hud.items, hud.inVehicle, hud.diving).map((i) => i.wad).join(', ') || '—'}`, 10, top + 30 + rows * 34);
  }
  const right = ctx.canvas.width - (g.hud && !g.hudLeft ? HUD_COLUMN * hudK() : 0);
  let oy = top + 14;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(right - 210, top + 8, 200, 20 + g.demo.objectives.size * 15 + 18);
  ctx.fillStyle = '#c9a24a';
  ctx.fillText('Objetivos', right - 202, oy + 6);
  for (const [name, done] of g.demo.objectives) {
    oy += 15;
    ctx.fillStyle = done ? '#6cc070' : '#d9dde3';
    ctx.fillText(`${done ? '✔' : '○'} ${name}`, right - 202, oy + 6);
  }
  ctx.fillStyle = '#d9dde3';
  ctx.fillText(`Bombas: ${g.demo.bombs.toString()} (B planta, X detona) · plantadas ${g.demo.planted.length.toString()}`, right - 202, oy + 24);
  if (g.demo.boatSunk) {
    ctx.fillStyle = '#e0826f';
    ctx.fillText('¡El Zodiac tocó una mina y se hundió!', 10, top + 46 + rows * 34);
  }
  if (g.result) drawResult(ctx, g.result);
}

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Pantalla de resultados (la de `0x570510` no se leyó fila a fila: textos de GLOBAL.STR y estrellas de tiempo, energía y rango de la misión). */
function drawResult(ctx: CanvasRenderingContext2D, r: NonNullable<Game['result']>): void {
  const w = Math.min(640, ctx.canvas.width - 40);
  const x = (ctx.canvas.width - w) / 2;
  const y = ctx.canvas.height / 2 - 120;
  ctx.fillStyle = 'rgba(0,0,0,.82)';
  ctx.fillRect(x, y, w, 240);
  ctx.textAlign = 'center';
  ctx.fillStyle = r.victory ? '#6cc070' : '#e0826f';
  ctx.font = '20px system-ui';
  ctx.fillText(r.text, x + w / 2, y + 44, w - 30);
  ctx.fillStyle = '#d9dde3';
  ctx.font = '18px system-ui';
  const m = Math.floor(r.score.seconds / 60).toString();
  const s = (r.score.seconds % 60).toString().padStart(2, '0');
  [`Tiempo ${m}:${s}    ${stars(r.score.time)}`, `Energía    ${stars(r.score.energy)}`, `Rango de la misión: ${r.score.rank.toString()} / 3`, `Enemigos abatidos: ${r.kills.toString()}`].forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + 90 + i * 34);
  });
  ctx.textAlign = 'start';
}

/** ManejaBomba (docs/lectura/au-jugador.md): camina hasta el sitio, anima PONEBOMBA (11 ciclos) y entonces deja la bomba. */
function plantBomb(g: Game, u: Unit, spot: { x: number; y: number; sector: Parameters<Unit['goTo']>[2] }): boolean {
  return u.doAt(
    spot,
    () => {
      u.playOnce('PONEBOMBA', () => {
        say(g.demo.plant(u.body.x, u.body.y, u.z) ? 'Bomba plantada. X para detonar.' : 'No te quedan bombas.');
      });
    },
    spot.sector,
  );
}

/** shortcut: selección por el rectángulo del sprite; mejorar al portar el picking de volúmenes. */
function bombAt(g: Game, x: number, y: number): PlantedBomb | null {
  const art = g.bombArt;
  const frame = art?.anm.sequences.get('DEJABOMBA')?.steps[0]?.[0];
  if (!art || !frame) return null;
  return g.demo.planted.find((bomb) => {
    const p = project(bomb.x, bomb.y, bomb.z);
    const r = art.sprites.bounds(frame, p.px, p.py);
    return r !== null && x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  }) ?? null;
}

function recoverBomb(g: Game, u: Unit, bomb: PlantedBomb): void {
  if (u.token !== 'ARTIFIC') { say('Solo el zapador puede recoger esa bomba.'); return; }
  g.battle.cancel(u);
  u.stop();
  const sector = g.sectors?.atZ(bomb.x, bomb.y, bomb.z) ?? null;
  if (!u.doAt(bomb, () => {
    if (!g.demo.planted.includes(bomb)) return;
    u.body.ang = norm360((Math.atan2(bomb.y - u.body.y, bomb.x - u.body.x) * 180) / Math.PI);
    u.playOnce('PONEBOMBA', () => { if (g.demo.recover(bomb)) say('Bomba recogida.'); }, 0, true);
  }, sector)) say('No hay camino hasta esa bomba.');
}

/** shortcut: selección por el rectángulo del sprite del señuelo (como `bombAt`); mejorar al portar el picking de volúmenes. */
function decoyAt(g: Game, x: number, y: number): Decoy | null {
  return g.traps.decoys.find((d) => {
    const prop = g.trapProps.get(d);
    if (!prop) return false;
    const p = project(prop.x, prop.y, prop.z);
    const r = prop.sprites.bounds(prop.anim.frame(prop.ang), p.px, p.py);
    return r !== null && x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  }) ?? null;
}

/**
 * Recoger el señuelo con la mano (`AUCoger` bit 4 → `MSG_SOY_UN_SEGNUELO` → `AuManejaSegnuelo`: camina, gira y anima `PONEBOMBA` a la inversa); vuelve a la mochila: reaparece el ítem del señuelo
 * y el interruptor se oculta (`FUN_004FC990` estado 3).
 */
function recoverDecoy(g: Game, u: Unit, decoy: Decoy): void {
  const view = g.units.find((x) => x.unit === u);
  if (!view?.canDecoy || !g.kit.decoy) { say('Solo el boina verde puede recoger ese señuelo.'); return; }
  const kit = g.kit.decoy;
  g.battle.cancel(u);
  u.stop();
  const sector = g.sectors?.atZ(decoy.x, decoy.y, g.trapProps.get(decoy)?.z ?? u.z) ?? null;
  if (!u.doAt(decoy, () => {
    if (!g.traps.decoys.includes(decoy)) return;
    u.body.ang = norm360((Math.atan2(decoy.y - u.body.y, decoy.x - u.body.x) * 180) / Math.PI);
    u.playOnce('PONEBOMBA', () => {
      if (!g.traps.decoys.includes(decoy)) return;
      g.traps.removeDecoy(decoy);
      const prop = g.trapProps.get(decoy);
      if (prop) g.props.splice(g.props.indexOf(prop), 1);
      g.trapProps.delete(decoy);
      kit.left++;
      say('Señuelo recogido: está otra vez en la mochila.');
    }, 0, true);
  }, sector)) say('No hay camino hasta ese señuelo.');
}

/** Punto (en píxeles de la ventana) donde se apretó el botón derecho: arrastrar dibuja el rectángulo de selección (FUN_005BA260/5BA2F0/0069AAD0). */
let rightDown: { x: number; y: number } | null = null;

/**
 * Botón derecho (docs/research/q1-controles.md): apretar anota el punto; al soltar, si el rectángulo mide < 3 px es `BOTON2VIRTUAL` = parar/cancelar la acción en curso del
 * elegido; si no, selección por rectángulo. shortcut: la selección es de un solo comando (el primero dentro del rectángulo); el exe selecciona varios (`MULTIPLE…`).
 */
function onRightUp(e: MouseEvent): void {
  const g = game;
  const d = rightDown;
  rightDown = null;
  if (!g || !stage || !d || e.button !== 2) return;
  const point = canvasPoint(e.clientX, e.clientY, stage.getBoundingClientRect(), [stage.width, stage.height]);
  const x1 = point.x;
  const y1 = point.y;
  if (Math.hypot(x1 - d.x, y1 - d.y) < 3) {
    if (g.control) {
      endControl(g);
      say('Soltaste al alemán: queda esposado donde está.');
      return;
    }
    if (g.mode || g.planting || g.use || g.visionPicking || g.visionTarget) {
      // el botón derecho también baja el arma o ítem en la mano (la mirilla, la piedra, el botiquín…), como Esc
      g.mode = null;
      g.planting = null;
      g.use = null;
      g.visionPicking = false;
      g.visionTarget = null;
      return;
    }
    const u = g.units[g.selected]?.unit;
    if (!u || u.dead) return;
    g.battle.cancel(u);
    if (u.diving) {
      say(u.toggleDive() ? `${u.token}: no se puede salir en agua profunda (acercate a la orilla).` : `${u.token} sale del agua.`);
      return;
    }
    if (u.climb) {
      u.pauseClimb(); // MSG_BOTON2VIRTUAL trepando: queda congelado a esa altura
      say(`${u.token}: pausado en la escalera (clic más alto sube, más bajo baja).`);
      return;
    }
    u.stop();
    if (u.boat && u.pilot) u.boat.stop(); // MSG_BOTON2VIRTUAL solo lo atiende quien tiene `bicho+0x138` (el piloto)
    say(`${u.token}: orden cancelada.`);
    return;
  }
  const z = zoom();
  const v = vp(g);
  const toMap = (sx: number, sy: number): { x: number; y: number } => ({ x: g.camX - v.w / z / 2 + (sx - v.x) / z, y: g.camY - v.h / z / 2 + (sy - v.y) / z });
  const a = toMap(Math.min(d.x, x1), Math.min(d.y, y1));
  const b = toMap(Math.max(d.x, x1), Math.max(d.y, y1));
  const idx = g.units.findIndex((u) => {
    const p = project(u.unit.body.x, u.unit.body.y, u.unit.z);
    return !u.unit.dead && p.px >= a.x && p.px <= b.x && p.py >= a.y && p.py <= b.y + 40;
  });
  if (idx >= 0) g.selected = idx;
}

/**
 * Trucos de la tabla de atajos del exe (`.data` 0x837000: modificador, tecla, nombre, id): Ctrl+X = Teletransportación (`MSG_TELEPORTSELECCIONADO`: el comando elegido, o su vehículo,
 * va a la posición del cursor), Alt+I = Invencibilidad de los comandos (`MSG_INVENCIBLE`, alterna), Ctrl+Alt+N = termina la misión.
 */
function setInvincible(g: Game, on: boolean): void {
  g.invincible = on;
  for (const u of g.units) u.unit.invulnerable = on;
}

function teleportAction(g: Game): void {
  const v = g.units[g.selected];
  if (!v || v.unit.dead || !cursor.inside || !stage) return;
  const z = zoom();
  const vw = vp(g);
  const mx = g.camX - vw.w / z / 2 + (cursor.x - vw.x) / z;
  const my = g.camY - vw.h / z / 2 + (cursor.y - vw.y) / z;
  const spot = g.sectors ? g.sectors.pick(mx, my) : { ...unproject(mx, my, v.unit.z), sector: null };
  if (!spot) {
    say('Ese punto está fuera de los sectores del mapa.');
    return;
  }
  g.battle.cancel(v.unit);
  if (v.unit.boat) v.unit.boat.place(spot.x, spot.y, v.unit.z);
  else v.unit.place(spot.x, spot.y, v.unit.body.ang);
  say(`${v.unit.token}: teletransportado${v.unit.boat ? ' con el bote' : ''}.`);
}

/** Los tres ítems del señuelo: él en la mochila y su interruptor apagado y encendido (se ve uno a la vez, `decoyItem`). */
const DECOY_ITEMS: ReadonlySet<string> = new Set(['IT_SEGNUELO', 'IT_ACTSENUELOOFF', 'IT_ACTSENUELOON']);
const WEAPON_OF_WAD: Readonly<Record<string, Weapon>> = { ARPON: 'ARPON', PISTOLA: 'PISTOLA', MIRILLA: 'MIRILLA', CUCHILLO: 'CUCHILLO', PUNO: 'PUNO', ESPOSAS: 'ESPOSAS', PIEDRA: 'PIEDRA' };

/** Datos del comando para el HUD (caras, mochila, balas). */
function weaponAvailable(v: UnitView, w: Weapon): boolean {
  return !v.unit.dead && !v.unit.diving && (!v.unit.boat || w === 'MIRILLA') && v.weapons.includes(w) && (v.unit.ammo[w] === undefined || (v.unit.ammo[w] ?? 0) > 0);
}

function hudUnit(v: UnitView, g: Game): HudUnit {
  const u = v.unit;
  const underfoot = g.sectors?.underfoot(u.sector, u.body.x, u.body.y, 10, u.diving ? { water: true } : {}) ?? (u.sector ? [u.sector] : []);
  const diveAvailable = diveItemVisible(u.boat !== null, underfoot.length > 0 && underfoot.every((s) => s.type === TYPE_WATER));
  // señuelo (AUManejaSegnuelo): un solo ítem a la vez entre el señuelo y su interruptor; sin la habilidad se deja el señuelo como estaba
  const decoy = v.canDecoy ? decoyItem((g.kit.decoy?.left ?? 1) > 0, g.traps.decoys[g.traps.decoys.length - 1] ?? null) : 'IT_SEGNUELO';
  return { token: u.token, energy: u.energy, max: v.maxEnergy, dead: u.dead, items: (g.bag.get(u.token) ?? []).filter((i) => (i.token !== 'IT_TABACO' || u.tobacco > 0) && (!DECOY_ITEMS.has(i.token) || i.token === decoy) && (i.wad !== 'BOTIQUIN' || u.medkits > 0) && (i.wad !== 'MIRILLA' || weaponAvailable(v, 'MIRILLA')) && (i.wad !== 'TRAJEBU' || diveAvailable) && (!u.diving || i.wad === 'TRAJEBU')), inVehicle: u.boat !== null, diving: u.diving, bullets: !u.diving && v.weapons.includes('MIRILLA') ? Math.max(0, u.ammo['MIRILLA'] ?? 0) : 0 };
}

function armWeapon(g: Game, w: Weapon): void {
  const u = g.units[g.selected];
  if (u && weaponAvailable(u, w)) {
    const draw = w === 'PISTOLA' ? 'DESENFUNDAPISTOLA' : w === 'MIRILLA' ? 'DESENFUNDARIFLE' : w === 'ARPON' ? 'DESENFUNDAARPON' : '';
    // shortcut: no se sincroniza la espera de desenfundado con todas las órdenes; completar la máquina de AUDisparar.
    if (g.mode !== w && !u.unit.boat && draw && u.unit.anim.has(draw)) u.unit.anim.set(draw);
    g.mode = w;
    g.use = null;
    g.planting = null;
    if (w === 'PUNO' || w === 'ESPOSAS') say(`${u.unit.token}: ${w === 'PUNO' ? 'puño' : 'esposas'} listo, clic en un soldado (Esc cancela).`);
    if (w === 'PIEDRA') say(`${u.unit.token}: piedra lista, clic en un punto a menos de 300 (solo hace ruido y avisa; no daña ni atonta).`);
    if (w === 'ARPON') say(`${u.unit.token}: arpón listo (alcance 200, un tiro mata, recarga 60 ciclos).`);
  } else say(`${u?.unit.token ?? ''} no tiene ${w.toLowerCase()}.`);
}

function bombAction(g: Game): void {
  const cur = g.units[g.selected]?.unit;
  if (!cur || cur.dead || cur.boat) return;
  if (cur.token !== 'ARTIFIC') say(`${cur.token} no sabe manejar bombas (solo el zapador, ARTIFIC).`);
  else if (g.demo.bombs <= 0) say('No te quedan bombas.');
  else {
    g.planting = 'BOMBA';
    g.mode = null;
    say('Clic donde plantar la bomba (Esc cancela). X detona.');
  }
}

function diveAction(g: Game): void {
  const cur = g.units[g.selected]?.unit;
  if (!cur || cur.dead) return;
  if (!g.units[g.selected]?.canDive) say(`${cur.token} no tiene traje de buzo (solo el LANCHERO).`);
  else if (cur.boat) say(cur.diveOut() ? `${cur.token} se tira al agua (buceando). N o clic derecho para salir.` : 'El bote debe estar parado y con agua a mano.');
  else if (cur.diving) say(cur.toggleDive() ? 'No se puede salir en agua profunda: acercate a la orilla.' : `${cur.token} sale del agua.`);
  else say(cur.toggleDive() ? `${cur.token} bucea. N o clic derecho para salir.` : 'Solo se puede empezar a bucear en el agua.');
}

/** Ítem CEPO (`AuManejacepo`): el próximo clic en el suelo lo coloca. */
function cepoAction(g: Game): void {
  const v = g.units[g.selected];
  if (!v || v.unit.dead || v.unit.boat) return;
  if (!v.canCepo || !g.kit.cepo) say(`${v.unit.token} no lleva cepos.`);
  else if (g.kit.cepo.left <= 0) say('No te quedan cepos.');
  else {
    g.planting = 'CEPO';
    g.mode = null;
    say('Clic donde poner el cepo (Esc cancela). Solo mata a un alemán o animal que lo pise.');
  }
}

/**
 * Ítems del señuelo (`AuManejaSegnuelo`): `IT_SEGNUELO` lo coloca (queda apagado); el interruptor (`IT_ACTSENUELOOFF`/`ON`, que aparece en la mochila al soltarlo) lo enciende y apaga
 * al instante (órdenes `ACTIVA`/`DESACTIVA`, `FUN_004FCBB0`).
 */
function decoyAction(g: Game, token: string): void {
  const v = g.units[g.selected];
  if (!v || v.unit.dead || v.unit.boat) return;
  if (token !== 'IT_SEGNUELO') {
    const d = g.traps.switchDecoy();
    if (d) say(d.on ? 'Señuelo encendido: hace ruido y atrae a los soldados.' : 'Señuelo apagado.');
  } else if (!v.canDecoy || !g.kit.decoy) say(`${v.unit.token} no lleva señuelos.`);
  else if (g.kit.decoy.left <= 0) say('No te quedan señuelos.');
  else {
    g.planting = 'SEGNUELO';
    g.mode = null;
    say('Clic donde dejar el señuelo (Esc cancela).');
  }
}

/** Coloca el cepo/señuelo: camina al sitio, anima PONEBOMBA si el comando la tiene (docs/lectura/au-jugador.md §9) y lo deja en el suelo. */
function placeTrap(g: Game, u: Unit, spot: { x: number; y: number; sector: Parameters<Unit['goTo']>[2] }, kind: 'CEPO' | 'SEGNUELO'): boolean {
  const kit = kind === 'CEPO' ? g.kit.cepo : g.kit.decoy;
  if (!kit || kit.left <= 0) return false;
  return u.doAt(
    spot,
    () => {
      u.playOnce('PONEBOMBA', () => {
        if (kit.left <= 0) return;
        kit.left--;
        const anim = new Animator(kit.anm, kind === 'CEPO' ? 'PILLAR' : 'SEGNUELO');
        const prop: Prop = { elem: kit.elem, anim, sprites: kit.sprites, x: u.body.x, y: u.body.y, z: u.z, ang: 0 };
        g.props.push(prop);
        g.trapProps.set(kind === 'CEPO' ? g.traps.placeCepo(u.body.x, u.body.y) : g.traps.placeDecoy(u.body.x, u.body.y), prop);
        say(kind === 'CEPO' ? 'Cepo colocado.' : 'Señuelo colocado, apagado: el interruptor de la mochila lo enciende. Con la mano se recoge.');
      });
    },
    spot.sector,
  );
}

/** Punto del mundo donde cae un lanzamiento: sector y altura del suelo ahí. */
interface ThrowSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sector: Sector | null;
}

/**
 * Piedra o cajetilla (engine/throwing.ts): gira, anima LANZARPIEDRA y la suelta en el punto; fuera de alcance no camina ni gasta nada.
 * shortcut: el giro es instantáneo (el exe gira hasta ±5° en 4 ciclos) y suelta al terminar la animación.
 */
function throwAt(g: Game, u: Unit, kind: Throwable, spot: ThrowSpot): void {
  if (!canThrow(kind, { x: u.body.x, y: u.body.y, z: u.z }, spot, g.sectors)) {
    say(`${u.token}: fuera de alcance (${kind === 'PIEDRA' ? '300' : '200'}) o sin paso hasta ese punto.`);
    return;
  }
  g.battle.cancel(u);
  u.stop();
  u.body.ang = norm360((Math.atan2(spot.y - u.body.y, spot.x - u.body.x) * 180) / Math.PI);
  u.playOnce('LANZARPIEDRA', () => {
    if (kind === 'PIEDRA') {
      const water = isWater(spot.sector);
      const hit = g.battle.stone(spot.x, spot.y, u, spot.z, water);
      const art = g.stoneArt;
      const name = water ? 'CAERAGUA' : 'CAERTIERRA';
      if (!hit && art?.anm.sequences.has(name)) {
        const anim = new Animator(art.anm, name);
        const prop: Prop = { elem: { radius: 0, height: 0 }, anim, sprites: art.sprites, x: spot.x, y: spot.y, z: spot.z, ang: 0 };
        g.props.push(prop);
        g.stoneEffects.push({ prop, left: Math.max(1, anim.period(name)) });
      }
      return;
    }
    if (u.tobacco <= 0) return;
    u.tobacco = 0;
    const pk = g.battle.packs.drop(spot.x, spot.y);
    if (!g.packArt) return;
    const prop: Prop = { elem: { radius: 3, height: 2 }, anim: new Animator(g.packArt.anm, defaultSeq(g.packArt.anm)), sprites: g.packArt.sprites, x: spot.x, y: spot.y, z: spot.z, ang: 0 };
    g.props.push(prop);
    g.packProps.set(pk, prop);
  }, kind === 'PIEDRA' ? 1 : 0);
}

/** Ítem TABACO: el próximo clic en el suelo lanza la cajetilla (`AuTabaco`, alcance 200). */
function tobaccoAction(g: Game): void {
  const v = g.units[g.selected];
  if (!v || v.unit.dead || v.unit.boat) return;
  if (v.unit.tobacco <= 0) say(`${v.unit.token} no tiene tabaco: se lo puede robar a un alemán muerto.`);
  else {
    g.planting = 'TABACO';
    g.mode = null;
    g.use = null;
    say('Clic donde tirar la cajetilla (alcance 200; Esc cancela). Los soldados que la vean van a buscarla.');
  }
}

/** Ítem BOTIQUIN (`AUBotiquin`): el próximo clic sobre un comando herido (o sobre uno mismo) lo cura +34. */
function medkitAction(g: Game): void {
  const u = g.units[g.selected]?.unit;
  if (!u || u.dead || u.boat) return;
  if (u.medkits <= 0) say(`${u.token} no tiene curas.`);
  else {
    g.use = 'BOTIQUIN';
    g.mode = null;
    g.planting = null;
    say(`Clic en el comando a curar (${u.medkits.toString()} curas; Esc cancela).`);
  }
}

function treat(g: Game, healer: Unit, patient: UnitView): void {
  g.use = null;
  const t = patient.unit;
  if (t.dead || t.energy >= patient.maxEnergy) {
    say(`${t.token} no necesita curas.`);
    return;
  }
  const cure = (): void => {
    healer.playOnce('JERINGA', () => {
      if (healer.treat(t, patient.maxEnergy)) say(`${healer.token} cura a ${t.token}: ${t.energy.toString()}/${patient.maxEnergy.toString()} (quedan ${healer.medkits.toString()}).`);
    });
  };
  g.battle.cancel(healer);
  if (t === healer) cure();
  else if (!healer.doAt({ x: t.body.x, y: t.body.y }, cure, t.sector)) say('No hay camino a pie hasta ese comando.');
}

/** Ítem CONTROLA (`AuTomarControlAleman`): el próximo clic sobre un alemán esposado lo pone bajo control. */
function controlAction(g: Game): void {
  const u = g.units[g.selected]?.unit;
  if (!u || u.dead || u.boat) return;
  g.use = 'CONTROL';
  g.mode = null;
  g.planting = null;
  say('Clic en un alemán esposado para controlarlo (Esc cancela). Se mueve dentro de 400 de vos; botón derecho lo suelta.');
}

function beginControl(g: Game, owner: Unit, s: Soldier): void {
  g.use = null;
  if (g.control) endControl(g);
  if (!s.control(owner)) {
    say('Solo se puede controlar a un alemán esposado.');
    return;
  }
  g.battle.cancel(owner);
  owner.stop();
  g.control = { soldier: s, owner };
  say('Controlás al alemán: clic = adónde va (radio 400); acercarlo a otros soldados los distrae; botón derecho lo suelta.');
}

function endControl(g: Game): void {
  g.control?.soldier.releaseControl();
  g.control = null;
}

/** Cadáver alemán con tabaco bajo el cursor (mismo acierto que el clic sobre un soldado). */
function corpseAt(g: Game, mx: number, my: number): Soldier | undefined {
  return g.soldiers.find((v) => {
    if (!v.soldier.dead || !v.soldier.tobacco) return false;
    const p = project(v.soldier.x, v.soldier.y, v.soldier.unit.z);
    return Math.abs(mx - p.px) < 14 && my > p.py - 40 && my < p.py + 8;
  })?.soldier;
}

/** `AuCogeTabacoDeMuerto`: camina hasta el cuerpo y coge el cigarrillo al instante, sin animación (tabaco-control.md). */
function stealTobacco(g: Game, u: Unit, s: Soldier): void {
  g.battle.cancel(u);
  const ok = u.doAt({ x: s.x, y: s.y }, () => {
    if (s.takeTobacco()) {
      u.tobacco = 1;
      say(`${u.token} le sacó un cigarrillo al muerto.`);
    }
  }, s.unit.sector);
  if (!ok) say('No hay camino a pie hasta ese cuerpo.');
}

function detonateAction(g: Game): void {
  if (g.demo.detonate() === 0) say('No hay bombas plantadas.');
}

function liftAction(g: Game): void {
  const cur = g.units[g.selected]?.unit;
  if (!g.lift || !cur) return;
  const p = g.lift.pos;
  if (Math.hypot(cur.body.x - p.x, cur.body.y - p.y) < 40 && Math.abs(cur.z - p.z) < 25) g.lift.activate();
  else say('Ponete sobre el montacargas para activarlo.');
}

/** Clic sobre un ítem de la mochila: dispara la acción que el juego ya tiene; los demás ítems todavía no hacen nada. */
function useItem(g: Game, it: BagItem): void {
  const w = WEAPON_OF_WAD[it.wad];
  if (w) armWeapon(g, w);
  else if (it.wad === 'TRAJEBU') diveAction(g);
  else if (it.wad === 'CARTUCHO') bombAction(g);
  else if (it.wad === 'ACTIVADO') detonateAction(g);
  else if (it.wad === 'CEPO') cepoAction(g);
  else if (it.wad === 'SENUELO') decoyAction(g, it.token);
  else if (it.wad === 'TABACO') tobaccoAction(g);
  else if (it.wad === 'BOTIQUIN') medkitAction(g);
  else if (it.wad === 'CONTROLA') controlAction(g);
  // shortcut: AuCoger recoge bombas y tabaco de cadáveres; completar las demás categorías al portar sus receptores.
  else if (it.wad === 'MANO') { g.use = 'MANO'; g.mode = null; g.planting = null; say('Mano: elegí un objeto disponible.'); }
  else say(`${it.token}: todavía no está implementado.`);
}

/** Ítems iluminados (`ILUMINAITEM`): el arma o acción activa y el que está bajo el cursor. */
function litItems(g: Game): Set<string> {
  const lit = new Set<string>();
  const v = g.units[g.selected];
  if (!v || !g.hud || !stage) return lit;
  if (g.mode) lit.add(g.mode);
  if (g.planting === 'BOMBA') lit.add('CARTUCHO');
  if (g.planting === 'CEPO') lit.add('CEPO');
  if (g.planting === 'SEGNUELO') lit.add('SENUELO');
  if (g.planting === 'TABACO') lit.add('TABACO');
  if (g.use === 'BOTIQUIN') lit.add('BOTIQUIN');
  if (g.use === 'CONTROL') lit.add('CONTROLA');
  if (g.use === 'MANO') lit.add('MANO');
  if (v.unit.diving) lit.add('TRAJEBU');
  if (cursor.inside) {
    const s = hudSpace(cursor.x, cursor.y);
    const it = g.hud.itemAt(s.x, s.y, s.w, s.h, hudUnit(v, g), g.hudLeft);
    if (it) lit.add(it.wad);
  }
  return lit;
}

/** Clic en la mochila del comando elegido: la foto lo baja del bote, un ítem lo usa. Devuelve true si el clic era de la mochila. */
function bagClick(g: Game, sx: number, sy: number): boolean {
  const v = g.units[g.selected];
  if (!g.hud || !stage || !v || v.unit.dead) return false;
  const s = hudSpace(sx, sy);
  const it = g.hud.itemAt(s.x, s.y, s.w, s.h, hudUnit(v, g), g.hudLeft);
  if (it) { useItem(g, it); return true; }
  if (inRect(s.x, s.y, photoRect(s.w, s.h, g.hudLeft))) {
    // la foto grande solo existe en un vehículo (a pie los botones `IT_CARA_*` están ocultos, flag `+0x124` = 1)
    if (v.unit.boat) {
      g.battle.cancel(v.unit);
      say(v.unit.disembark() ? `${v.unit.token} baja del bote.` : 'El bote debe estar parado y con una orilla a mano para bajar.');
      return true;
    }
  }
  return inRect(s.x, s.y, bagRect(s.w, s.h, g.hudLeft));
}

function onMouse(e: MouseEvent): void {
  const g = game;
  if (!g || !stage) return;
  const point = canvasPoint(e.clientX, e.clientY, stage.getBoundingClientRect(), [stage.width, stage.height]);
  const z = zoom();
  const v = vp(g);
  const sx = point.x;
  const sy = point.y;
  if (e.button === 0 && bagClick(g, sx, sy)) return;
  if (overHudAt(g, sx, sy)) {
    // clic sobre el HUD: la cara de un comando lo selecciona; el resto de la tira y la columna aún no hacen nada
    const h = hudSpace(sx, sy);
    const slot = e.button === 0 ? slotAt(h.x, h.y, g.units.length) : -1;
    if (slot >= 0) g.selected = slot;
    return;
  }
  const mx = g.camX - v.w / z / 2 + (sx - v.x) / z;
  const my = g.camY - v.h / z / 2 + (sy - v.y) / z;
  const hit = g.units.findIndex((u) => {
    const p = project(u.unit.body.x, u.unit.body.y, u.unit.z);
    return Math.abs(mx - p.px) < 14 && my > p.py - 40 && my < p.py + 8;
  });
  const sel = g.units[g.selected]?.unit;
  const foe = g.soldiers.find((s) => {
    if (s.soldier.dead) return false;
    const u = s.soldier.unit;
    const p = project(u.body.x, u.body.y, u.z);
    return Math.abs(mx - p.px) < 14 && my > p.py - 40 && my < p.py + 8;
  });
  const barrel = [...g.barrelProps].find(([b, pr]) => !b.dead && Math.abs(mx - project(pr.x, pr.y, pr.z).px) < 14 && Math.abs(my - project(pr.x, pr.y, pr.z).py + 10) < 20)?.[0];
  const mine = [...g.mineProps].find(([m, pr]) => !m.dead && Math.abs(mx - project(pr.x, pr.y, pr.z).px) < 14 && Math.abs(my - project(pr.x, pr.y, pr.z).py + 10) < 20)?.[0];
  if (e.button === 2) {
    rightDown = { x: sx, y: sy };
    return;
  }
  const ladder = pickLadder(g.ladders, mx, my);
  const spotAt = (): ThrowSpot | null => {
    const hitSpot = g.sectors ? g.sectors.pick(mx, my) : null;
    if (hitSpot) return hitSpot;
    return g.sectors ? null : { ...unproject(mx, my, sel?.z ?? 0), z: sel?.z ?? 0, sector: null };
  };
  if (e.button === 0 && g.visionPicking) {
    const spot = foe ? null : spotAt();
    g.visionTarget = foe ? { soldier: foe.soldier } : spot ? { x: spot.x, y: spot.y, z: spot.z } : null;
    g.visionPicking = false;
    return;
  }
  const live = e.button === 0 && sel && !sel.dead && !sel.boat;
  if (live && g.control && !g.mode && !g.planting && !g.use) {
    // controlás al alemán: el clic lo manda a él (anillo de radio 400 alrededor del comando)
    const to = foe ? { x: foe.soldier.x, y: foe.soldier.y } : spotAt();
    if (to && !g.control.soldier.controlGo(to, 'sector' in to ? to.sector : undefined)) say('El alemán no puede ir ahí.');
    return;
  }
  if (live && g.planting === 'TABACO') {
    g.planting = null;
    const to = spotAt();
    if (to) throwAt(g, sel, 'TABACO', to);
    return;
  }
  if (live && g.mode === 'PIEDRA' && g.units[g.selected]?.weapons.includes('PIEDRA')) {
    // la piedra cae en un punto aunque se haga clic en un soldado (engine/throwing.ts)
    const to: ThrowSpot | null = foe ? { x: foe.soldier.x, y: foe.soldier.y, z: foe.soldier.unit.z, sector: foe.soldier.unit.sector } : spotAt();
    if (to) throwAt(g, sel, 'PIEDRA', to);
    return;
  }
  if (live && g.use === 'BOTIQUIN') {
    const patient = g.units[hit];
    if (patient) treat(g, sel, patient);
    else say('Clic sobre el comando a curar (Esc cancela).');
    return;
  }
  if (live && g.use === 'CONTROL') {
    if (foe) beginControl(g, sel, foe.soldier);
    else say('Clic sobre un alemán esposado (Esc cancela).');
    return;
  }
  const corpse = corpseAt(g, mx, my);
  if (live && g.use === 'MANO') {
    const bomb = bombAt(g, mx, my);
    const decoy = decoyAt(g, mx, my);
    if (bomb) { g.use = null; recoverBomb(g, sel, bomb); }
    else if (decoy) { g.use = null; recoverDecoy(g, sel, decoy); }
    else if (corpse && sel.tobacco <= 0) { g.use = null; stealTobacco(g, sel, corpse); }
    else say('No hay un objeto que pueda recoger ahí.');
    return;
  }
  if (live && corpse && !g.mode && !g.planting && sel.tobacco <= 0 && hit < 0) {
    stealTobacco(g, sel, corpse);
    return;
  }
  const home = g.houses.find((h) => {
    const p = project(h.x, h.y, h.z);
    return mx >= p.px + h.box.x && mx <= p.px + h.box.x + h.box.w && my >= p.py + h.box.y && my <= p.py + h.box.y + h.box.h;
  });
  if (e.button === 0 && home && !g.mode && !g.planting && sel && !sel.dead && !sel.boat && !sel.climb && !sel.hidden && hit < 0) {
    g.battle.cancel(sel);
    // AcUsaHabitaculo: camina a la entrada y entra (queda oculto); en un cuartel es mortal (30 cada 5 ciclos)
    if (!sel.doAt(home.entry, () => {
      home.enter(sel);
      say(home.barracks ? `${sel.token} entró a un CUARTEL: ¡lo están matando!` : `${sel.token} entró a ${home.token}. Clic en el suelo para salir.`);
    })) say('No hay camino a pie hasta esa casa.');
    return;
  }
  if (e.button === 0 && sel?.hidden && sel.inHouse) {
    // sale por el punto de salida y camina adonde se hizo clic
    const h = g.houses.find((x) => x.token === sel.inHouse);
    const spot = g.sectors?.pick(mx, my);
    if (h?.leave(sel) && spot) sel.goTo(spot, false, spot.sector);
    return;
  }
  if (e.button === 0 && sel?.climb) {
    // trepando (pausado o no): +1 si el punto está más alto que el comando, −1 si más bajo (FUN_004F3C70)
    const spot = g.sectors?.pick(mx, my);
    sel.resumeClimb(spot ? spot.z : sel.z + (ladder && ladder.high.z > sel.z ? 1 : -1));
  } else if (e.button === 0 && ladder && !g.mode && !g.planting && sel && !sel.dead && !sel.boat && hit < 0) {
    g.battle.cancel(sel);
    if (!sel.useLadder(ladder)) say(ladder.disabled ? 'Esa escalera quedó inutilizable.' : `${sel.token}: no puede usar esa escalera desde acá.`);
  } else if (e.button === 0 && g.planting && g.planting !== 'TABACO' && sel && !sel.dead && !sel.boat) {
    const kind = g.planting;
    g.planting = null;
    const spot = g.sectors ? g.sectors.pick(mx, my) : { ...unproject(mx, my, sel.z), sector: null };
    g.battle.cancel(sel);
    if (!spot || !(kind === 'BOMBA' ? plantBomb(g, sel, spot) : placeTrap(g, sel, spot, kind))) say('No hay camino a pie hasta ese punto.');
  } else if (e.button === 0 && hit >= 0) g.selected = hit;
  else if (e.button === 0 && (g.mode === 'PISTOLA' || g.mode === 'MIRILLA') && barrel && sel && !sel.dead && (!sel.boat || g.mode === 'MIRILLA') && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, barrel, g.mode);
  else if (e.button === 0 && (g.mode === 'PISTOLA' || g.mode === 'MIRILLA' || g.mode === 'ARPON') && mine && sel && !sel.dead && (!sel.boat || g.mode === 'MIRILLA') && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, mine, g.mode);
  else if (e.button === 0 && g.mode && foe && sel && !sel.dead && (!sel.boat || g.mode === 'MIRILLA') && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, foe.soldier, g.mode); // en el vehículo solo la mirilla (MSG_ITEM_ACTIVADO 0xF)
  else if (e.button === 0 && (g.mode === 'MIRILLA' || g.mode === 'PISTOLA' || g.mode === 'ARPON') && sel && !sel.dead && !sel.diving && (!sel.boat || g.mode === 'MIRILLA') && g.units[g.selected]?.weapons.includes(g.mode)) {
    // FUN_004F0E50: también se puede ordenar un disparo a un punto del terreno.
    const spot = g.sectors?.pick(mx, my);
    if (!spot) say('Ese punto está fuera de los sectores del mapa.');
    else g.battle.attack(sel, groundTarget(spot.x, spot.y, spot.z), g.mode);
  }
  else if (sel && !sel.dead && e.button === 0) {
    g.battle.cancel(sel);
    const run = e.detail >= 2 || e.shiftKey; // doble clic izquierdo = BOTON1DBLCLK: AuGoTo corre (FUN_004F68A0); Mayús queda como atajo extra
    
    // el cursor apunta al sector más alto que cruza el rayo del píxel (FUN_005F5590), no a un plano fijo
    const hit = g.sectors ? g.sectors.pick(mx, my) : { ...unproject(mx, my, sel.z), sector: null }; // sin .SEC: plano fijo del comando
    if (!hit) say('Ese punto está fuera de los sectores del mapa.');
    else if (sel.boat) {
      // En el bote: clic en agua = el bote va ahí; clic en tierra con el bote parado = el comando baja y camina.
      if (isWater(hit.sector)) {
        if (sel.pilot) sel.boat.goTo(hit);
        else say(`${sel.token} va de pasajero: la balsa solo la maneja el marino (LANCHERO).`);
      }
      else if (!sel.disembark()) say(`${sel.token}: el bote debe estar parado y con una orilla a mano para bajar.`);
      else if (!sel.goTo(hit, run, hit.sector)) say(`${sel.token}: bajó, pero no hay camino a pie hasta ese punto.`);
    } else if (!sel.goTo(hit, run, hit.sector)) say(`${sel.token}: no hay camino a pie hasta ese punto.`);
  }
}

const guarded = (fn: () => Promise<void>) => () => {
  fn().catch((e: unknown) => {
    say(e instanceof Error ? `Error: ${e.message}` : 'Error desconocido', true);
  });
};

if (import.meta.env.DEV) {
  // Solo desarrollo: usa la carpeta de GAME_DIR que sirve vite.config.ts (no existe en el build).
  const dev = byId('dev');
  dev.hidden = false;
  dev.addEventListener('click', guarded(async () => {
    say('Leyendo WAR_MP.DIR desde GAME_DIR…');
    const dir = new Uint8Array(await (await fetch('/__game/WAR_MP.DIR')).arrayBuffer());
    const names = (await (await fetch('/__game/__list')).json()) as string[];
    const wads = new Map<string, () => Promise<ArrayBuffer>>();
    for (const f of names) {
      const m = /(FASE\d{4})\.WAD$/i.exec(f);
      if (m?.[1]) wads.set(m[1].toUpperCase(), async () => (await fetch(`/__game/DATOS/recursos/bmps/map_mp/${f}`)).arrayBuffer());
    }
    const music = new Map<string, () => Promise<ArrayBuffer>>();
    for (const f of ['menu.wav', 'fases.wav', 'fases02.wav', 'mcomplet.wav', 'muerte.wav']) music.set(f, async () => (await fetch(`/__game/DATOS/musica/${f}`)).arrayBuffer());
    await start(dir, wads, music, async (path) => {
      const response = await fetch(`/__game/${path}`);
      return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined;
    });
  }));
}
dirInput.addEventListener('change', guarded(onFolder));
mapSel.addEventListener('change', guarded(load));
waterBox.addEventListener('change', guarded(load));
diffSel.addEventListener('change', guarded(load));
zoomSel.addEventListener('change', () => {
  setZoom(Number(zoomSel.value));
});
window.addEventListener('resize', resize);
window.addEventListener('pointerdown', () => {
  sfx.unlock(); // el navegador solo deja sonar tras un gesto
});
window.addEventListener('keydown', () => {
  sfx.unlock();
});
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  const g = game;
  if (!g || presenting) return;
  if (e.altKey && e.code === 'KeyB') {
    e.preventDefault();
    guarded(openBriefing)();
    return;
  }
  if (e.ctrlKey && !e.altKey && e.code === 'KeyX') {
    e.preventDefault();
    teleportAction(g);
    return;
  }
  if (e.altKey && !e.ctrlKey && e.code === 'KeyI') {
    e.preventDefault();
    setInvincible(g, !g.invincible);
    say(g.invincible ? 'Comandos invencibles (Alt+I lo quita).' : 'Comandos vulnerables.');
    return;
  }
  if (e.ctrlKey && e.altKey && e.code === 'KeyN') {
    e.preventDefault();
    g.won = true;
    say('Misión terminada (Ctrl+Alt+N).');
    return;
  }
  if (k >= '1' && k <= '9' && g.units[Number(k) - 1]) g.selected = Number(k) - 1;
  if (e.code === 'Backquote' && g.hud) {
    // la tecla a la izquierda del 1 (º/|) pasa la columna, la libreta y la mochila al otro lado
    e.preventDefault();
    g.hudLeft = !g.hudLeft;
  }
  if (k === 'f' || k === 'r' || k === 'c') armWeapon(g, k === 'f' ? 'PISTOLA' : k === 'r' ? 'MIRILLA' : 'CUCHILLO');
  if (k === 'escape') {
    g.visionPicking = false;
    g.visionTarget = null;
    g.mode = null;
    g.planting = null;
    g.use = null;
  }
  if (k === 'g') {
    const cu = g.units[g.selected]?.unit;
    if (cu && !cu.dead) {
      if (cu.boat) say('En el bote no se puede uno agachar.');
      else {
        g.battle.cancel(cu);
        cu.stop();
        say(`${cu.token}: ${cu.toggleCrouch() ? 'agachado (los enemigos te ven solo de cerca)' : 'de pie'}.`);
      }
    }
  }
  const cur = g.units[g.selected]?.unit;
  if (k === 'b') bombAction(g);
  if (k === 'n') diveAction(g);
  if (k === 'x') detonateAction(g);
  if (k === 'l') liftAction(g);
  if (k === 'e' && cur && !cur.dead && !cur.boat && g.boat) {
    const bt = g.boat.boat;
    const seat = freeSeat(bt.slots.length, new Set(g.units.filter((u) => u.unit.boat === bt).map((u) => u.unit.seatIndex)), cur.pilot);
    if (bt.punctured) say('La balsa está pinchada: no se puede subir.');
    else if (Math.hypot(bt.x - cur.body.x, bt.y - cur.body.y) > 120 || bt.speed >= 0.01) say('Acercate al bote (a menos de 120) y con el bote parado.');
    else if (seat === null) say(cur.pilot ? 'La plaza del piloto está ocupada.' : 'No hay plaza de pasajero libre.');
    else {
      g.battle.cancel(cur);
      cur.board(bt, seat);
    }
  }
  if (k === 'v') { g.visionPicking = true; g.visionTarget = null; g.mode = null; g.use = null; g.planting = null; }
  if (k === 'home') {
    const u = g.units[g.selected]?.unit;
    if (u) {
      const p = project(u.body.x, u.body.y, u.z);
      g.camX = p.px;
      g.camY = p.py;
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});
