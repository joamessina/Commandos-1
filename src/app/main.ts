/**
 * Visor de mapa con los comandos animados. El jugador elige SU carpeta del juego (Legacy): WAR_MP.DIR +
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
import { parseSec } from '../formats/sec.ts';
import { parseVol, type Vol } from '../formats/vol.ts';
import { parseWad, type Wad } from '../formats/wad.ts';
import { Animator } from '../engine/anim.ts';
import type { Weapon } from '../engine/attack.ts';
import { Battle } from '../engine/battle.ts';
import { Demolition, parseSites, type Barrel } from '../engine/demolition.ts';
import { Lift, parseLadders, parseLift, pickLadder, type Ladder } from '../engine/ladder.ts';
import { Boat, boatSlots } from '../engine/boat.ts';
import { isWater, SectorMap } from '../engine/sectors.ts';
import { parseRoutes } from '../engine/patrol.ts';
import { Order, Soldier } from '../engine/soldier.ts';
import { COMMANDO_ENERGY, project, unproject, Unit } from '../engine/unit.ts';
import { VolOrder, type Actor } from '../engine/volorder.ts';
import { rayReach, vistaOf } from '../engine/vision.ts';
import { asNumber, find } from '../formats/clave.ts';
import { parseWater, WaterFx } from '../engine/water.ts';
import { flatten, loadWorld, type Difficulty, type Elem } from '../engine/world.ts';
import { composeMap, paintPoly, repaintWater, waterBounds, type Clip, type MapImage, type MapOptions, type Rect } from '../render/map.ts';
import { SpriteCache } from '../render/sprites.ts';
import type { AnmFrame } from '../formats/anm.ts';

const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el;
};
const dirInput = byId('dir') as HTMLInputElement;
const mapSel = byId('map') as HTMLSelectElement;
const waterBox = byId('water') as HTMLInputElement;
const zoomSel = byId('zoom') as HTMLSelectElement;
const diffSel = byId('diff') as HTMLSelectElement;
const status = byId('status');
const view = byId('view');

interface Loaded {
  readonly dir: Uint8Array;
  readonly entries: ReadonlyMap<string, DirEntry>;
  /** FASE000N -> lector de los bytes del WAD (File del usuario o, en desarrollo, /__game). */
  readonly wads: ReadonlyMap<string, () => Promise<ArrayBuffer>>;
}
interface UnitView {
  readonly unit: Unit;
  readonly sprites: SpriteCache;
  /** Armas que el MIS le da (`AuDisparar .ARMAS`, `AuAcuchillar`). */
  readonly weapons: Weapon[];
  readonly maxEnergy: number;
}
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
  readonly elem: Elem;
  readonly anim: Animator;
  readonly sprites: SpriteCache;
  x: number;
  y: number;
  z: number;
  ang: number;
}
interface Game {
  /** Nido de ametralladora: su gráfico dispara cuando el artillero dispara. */
  readonly nests: { readonly soldier: Soldier; readonly prop: Prop }[];
  readonly ladders: Ladder[];
  readonly lift: Lift | null;
  readonly demo: Demolition;
  /** Barril del juego -> su gráfico (se oculta al explotar). */
  readonly barrelProps: ReadonlyMap<Barrel, Prop>;
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
  readonly battle: Battle;
  readonly soldiers: SoldierView[];
  /** Arma elegida: el clic en un soldado ataca con ella (null = clic mueve). */
  mode: Weapon | null;
  /** El zapador va a plantar la bomba donde se haga clic (B). */
  planting: boolean;
  showCones: boolean;
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
}

let loaded: Loaded | null = null;
let game: Game | null = null;
let stage: HTMLCanvasElement | null = null;
let loopId = 0;
const keys = new Set<string>();

const say = (msg: string, error = false): void => {
  status.textContent = msg;
  status.className = error ? 'error' : '';
};
let zoomLevel = 1;
const zoom = (): number => zoomLevel;
const ZOOM_MAX = 3.4; // docs/research/q1-camara.md §Cierre

/** Zoom del exe (NUM+/NUM−): paso 0,1 (0,05 por debajo de 1), tope 3,4 y mínimo = el mapa entero en la ventana; la cámara sigue centrada en el mismo punto. */
function setZoom(next: number): void {
  const g = game;
  const min = g && stage ? Math.max(stage.width / g.map.width, stage.height / g.map.height) : 0.25;
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
  const dirFile = files.find((f) => /(^|\/)WAR_MP\.DIR$/i.test(f.webkitRelativePath));
  if (!dirFile) {
    say('No encontré WAR_MP.DIR en esa carpeta. Elegí la carpeta Legacy del juego.', true);
    return;
  }
  say('Leyendo WAR_MP.DIR…');
  const dir = new Uint8Array(await dirFile.arrayBuffer());
  const wads = new Map<string, () => Promise<ArrayBuffer>>();
  for (const f of files) {
    const m = /map_mp\/(FASE\d{4})\.WAD$/i.exec(f.webkitRelativePath);
    if (m?.[1]) wads.set(m[1].toUpperCase(), () => f.arrayBuffer());
  }
  await start(dir, wads);
}

async function start(dir: Uint8Array, wads: Map<string, () => Promise<ArrayBuffer>>): Promise<void> {
  const entries = new Map<string, DirEntry>();
  for (const e of parseContainer(dir)) entries.set(e.path.toUpperCase(), e);
  loaded = { dir, entries, wads };
  const maps = [...wads.keys()].sort().map((k) => k.slice(4)).filter((n) => entries.has(`DATOS/MISIONES/MAPA${n}.VOL`));
  mapSel.replaceChildren(...maps.map((n) => new Option(`Mapa ${n}`, n)));
  mapSel.disabled = maps.length === 0;
  if (maps.length === 0) {
    say('Encontré WAR_MP.DIR pero ningún Fase000N.wad (carpeta DATOS/recursos/bmps/map_mp).', true);
    return;
  }
  say(`${entries.size.toString()} archivos en el contenedor, ${maps.length.toString()} mapas disponibles.`);
  await load();
}

function bytes(path: string): Uint8Array | undefined {
  const e = loaded?.entries.get(path);
  return e && loaded ? entryBytes(loaded.dir, e) : undefined;
}

async function load(): Promise<void> {
  if (!loaded || !mapSel.value) return;
  const n = mapSel.value;
  const volBytes = bytes(`DATOS/MISIONES/MAPA${n}.VOL`);
  const readWad = loaded.wads.get(`FASE${n}`);
  if (!volBytes || !readWad) return;
  say(`Componiendo mapa ${n}…`);
  await new Promise((r) => setTimeout(r, 0));
  const t0 = performance.now();
  const vol = parseVol(new TextDecoder('latin1').decode(volBytes));
  const wad = parseWad(new Uint8Array(await readWad()));
  const misBytes = bytes(`DATOS/MISIONES/MAPA${n}.MIS`);
  const misText = misBytes ? new TextDecoder('latin1').decode(misBytes) : '';
  const wdef = waterBox.checked ? null : parseWater(misText);
  const wsprite = wdef ? wad.byName.get(wdef.dst.toUpperCase()) : undefined;
  const bounds = wsprite?.width === 256 && wsprite.height === 256 ? waterBounds(vol) : null; // el generador del exe asume 256×256
  const water = wdef && wsprite && bounds ? makeWater(vol, wad, wdef, wsprite.index, bounds) : null;
  const volOrder = new VolOrder(vol); // orden de dibujo del exe (docs/research/q1-orden-dibujo.md), los volúmenes una vez por mapa
  const order = volOrder.order;
  const img = composeMap(vol, wad, { ...(water ? { layer: 'land' as const } : { skipWater: waterBox.checked }), order });
  const map = document.createElement('canvas');
  map.width = img.width;
  map.height = img.height;
  map.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);

  const units: UnitView[] = [];
  const secBytes = bytes(`DATOS/MISIONES/MAPA${n}.SEC`);
  const sectors = secBytes ? new SectorMap(parseSec(secBytes)) : null;
  const macro = (name: string): string | undefined => {
    const b = bytes(`DATOS/MISIONES/${name.toUpperCase()}.MAC`);
    return b ? new TextDecoder('latin1').decode(b) : undefined;
  };
  const elems = flatten(loadWorld(misText, { difficulty: diffSel.value as Difficulty, macro }));
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
  const nestOf = new Map<Soldier, Elem>();
  let bombCount = 0;
  const barrelProps: { elem: Elem; prop: Prop }[] = [];
  const boats = new Map<Elem, { boat: Boat; prop: Prop }>();
  for (const e of elems) {
    const slots = boatSlots(e);
    if (slots.length === 0 || !e.anim) continue;
    const a = asset(e.anim);
    if (!a) continue;
    const boat = new Boat(e.x, e.y, e.z, e.angle, slots, sectors);
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
      if (host) unit.board(host.boat, units.filter((u) => u.unit.boat === host.boat).length);
      const weapons: Weapon[] = [];
      const guns = asArmas(e);
      if (guns.includes('PISTOLA')) weapons.push('PISTOLA');
      if (guns.includes('MIRILLA')) weapons.push('MIRILLA');
      if (e.actions.some((x) => x.name.toUpperCase() === 'AUACUCHILLAR')) weapons.push('CUCHILLO');
      units.push({ unit, sprites: a.sprites, weapons, maxEnergy: unit.energy });
    } else if (e.bando === 'ALEMAN' && e.anim && e.actions.some((x) => /^ac(bap|banpe|metrallero)/i.test(x.name))) {
      const a = asset(e.anim);
      if (!a) continue;
      const unit = new Unit(e.token, a.anm, e.x, e.y, e.z, e.angle, sectors);
      const pat = e.actions.find((x) => x.name.toUpperCase() === 'ACPATRULLA');
      const route = pat ? (parseRoutes(pat.params, diffSel.value as Difficulty)[0] ?? null) : null;
      const nest = e.actions.some((x) => x.name.toUpperCase() === 'ACMETRALLERO');
      const vig = e.actions.find((x) => x.name.toUpperCase() === 'ACVIGILAR')?.params ?? [];
      const sweep = asNumber(find(vig, '.ANGBARRIDO'));
      const soldier = new Soldier(e.token, unit, route, {
        ...vistaOf(e.block),
        ...(nest ? { fixed: true, noise: 500 } : {}),
        ...(sweep === undefined ? {} : { sweep }),
        elliptical: asNumber(find(vig, '.VISTAELIPTICA')) !== 0,
      });
      soldiers.push({ soldier, sprites: a.sprites });
      if (nest && e.parent?.anim) nestOf.set(soldier, e.parent);
    } else if (e.parent?.cls === 'BICHOALIADO') {
      // lo que cuelga de un comando es su inventario (las 4 bombas del ARTIFIC), no un objeto del mapa
      if (e.macro?.toUpperCase() === 'BOMBAACT') bombCount++;
    } else if (e.anim && !boats.has(e) && e.macro?.toUpperCase() !== 'MINASUB') {
      const a = asset(e.anim);
      if (!a) continue;
      const prop = { elem: e, anim: new Animator(a.anm, defaultSeq(a.anm)), sprites: a.sprites, x: e.x, y: e.y, z: e.z, ang: e.angle };
      props.push(prop);
      if (e.macro?.toUpperCase() === 'BARRIL') barrelProps.push({ elem: e, prop });
    }
  }
  const mainBoat = [...boats.values()][0] ?? null;
  const first = units[0]?.unit;
  const p = first ? project(first.body.x, first.body.y, first.z) : { px: img.width / 2, py: img.height / 2 };
  const battle = new Battle(soldiers.map((s) => s.soldier), units.map((u) => u.unit), sectors);
  const { sites, objectives, escape, kills } = parseSites(misText, vol, elems);
  const demo = new Demolition(sites, objectives, { soldiers: battle.soldiers, commandos: battle.commandos }, bombCount, { sectors, kills });
  const barrelMap = new Map<Barrel, Prop>();
  for (const e of elems) if (e.macro?.toUpperCase() === 'MINASUB') demo.addMine(e.x, e.y);
  for (const b of barrelProps) barrelMap.set(demo.addBarrel(b.elem.token, b.elem.x, b.elem.y), b.prop);
  const nests = [...nestOf].flatMap(([s, el]) => {
    const prop = props.find((x) => x.elem === el);
    return prop ? [{ soldier: s, prop }] : [];
  });
  game = { nests, ladders: parseLadders(elems), lift: elems.map(parseLift).find((l): l is Lift => l !== null) ?? null, demo, barrelProps: barrelMap, vol, wad, order, volOrder, mapSprites: new SpriteCache(wad), mapOpts: {}, escape, won: false, battle, soldiers, mode: null, planting: false, showCones: false, props, boat: mainBoat, water, map, units, sectors, selected: 0, camX: p.px, camY: p.py, ticks: 0 };
  (window as unknown as { __game: unknown }).__game = { vol, wad, game };
  setupStage();
  say(`Mapa ${n}: ${img.width.toString()}×${img.height.toString()} px, ${units.length.toString()} comandos (${Math.round(performance.now() - t0).toString()} ms). Clic izquierdo = ordenar, doble clic = correr; derecho = cancelar o arrastrar para elegir.`);
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

/** Victoria: todos los objetivos, todos los comandos vivos a bordo del bote y el bote en el punto de huida (Intend00; evaluador de docs/lectura/mision-intendencia.md §6). */
function checkWin(g: Game): void {
  const b = g.boat?.boat;
  if (g.won || !b || !g.escape || !g.demo.objectivesDone) return;
  const alive = g.units.filter((u) => !u.unit.dead);
  if (alive.length > 0 && alive.every((u) => u.unit.boat === b) && Math.hypot(b.x - g.escape.x, b.y - g.escape.y) < 250) g.won = true;
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
  const vw = (stage?.width ?? 0) / z;
  const vh = (stage?.height ?? 0) / z;
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
    stage.style.display = 'block';
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
      const r = stage?.getBoundingClientRect();
      cursor.x = e.clientX - (r?.left ?? 0);
      cursor.y = e.clientY - (r?.top ?? 0);
      cursor.inside = true;
    });
    stage.addEventListener('mouseleave', () => {
      cursor.inside = false;
    });
  }
  view.replaceChildren(stage);
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
      g.demo.tick();
      tickWorld(g);
      for (const n of g.nests) {
        const want = n.soldier.dead ? 'NODISPARA' : n.soldier.order === Order.Shoot ? 'DISPARA' : 'NODISPARA';
        if (n.prop.anim.has(want)) n.prop.anim.set(want);
      }
      g.demo.tickMines(g.boat?.boat ?? null, g.units.map((u) => u.unit));
      if (g.demo.boatSunk && g.boat?.prop.anim.has('PINCHAR')) g.boat.prop.anim.set('PINCHAR');
      if (g.demo.dirty) recompose(g);
      checkWin(g);
      g.boat?.boat.tick();
      for (const u of g.units) u.unit.tick();
      if (g.boat) {
        g.boat.prop.x = g.boat.boat.x;
        g.boat.prop.y = g.boat.boat.y;
        g.boat.prop.ang = g.boat.boat.ang;
      }
      if (g.water?.drawn) stepWater(g, g.water);
      g.ticks++;
      acc -= TICK;
    }
    scrollCamera(g, dt / TICK);
    draw(g);
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
  stage.width = Math.max(320, view.clientWidth);
  stage.height = Math.max(240, view.clientHeight);
}

function draw(g: Game): void {
  const ctx = stage?.getContext('2d');
  if (!stage || !ctx) return;
  const z = zoom();
  const vw = stage.width / z;
  const vh = stage.height / z;
  g.camX = Math.max(vw / 2, Math.min(g.map.width - vw / 2, g.camX));
  g.camY = Math.max(vh / 2, Math.min(g.map.height - vh / 2, g.camY));
  const ox = g.camX - vw / 2;
  const oy = g.camY - vh / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stage.width, stage.height);
  ctx.save();
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
  if (g.showCones) for (const s of g.soldiers) if (!s.soldier.dead) drawCone(ctx, g, s.soldier);
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
    const isBoat = pr === g.boat?.prop;
    add({ x: pr.x, y: pr.y, z: pr.z, r: isBoat ? 30 : pr.elem.radius || 10, h: isBoat ? 0.01 : pr.elem.height || 20 }, pr.sprites, pr.anim.frame(pr.ang), px, py);
  }
  g.units.forEach((u, i) => {
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
    const q = project(bm.x, bm.y, 0);
    ctx.fillStyle = '#222';
    ctx.fillRect(q.px - 5, q.py - 4, 10, 6);
    ctx.fillStyle = '#e33';
    ctx.fillRect(q.px - 1, q.py - 3, 3, 3);
  }
  for (const bl of g.demo.blasts) {
    const q = project(bl.x, bl.y, 0);
    ctx.fillStyle = `rgba(255,170,40,${(bl.ttl / 14).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(q.px, q.py, bl.radius, bl.radius * COS_VIEW, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const tr of g.battle.tracers) {
    const a = project(tr.fromX, tr.fromY, 25);
    const b = project(tr.toX, tr.toY, 25);
    ctx.strokeStyle = tr.enemy ? '#ff5a4a' : '#ffe066';
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
  drawHud(ctx, g);
  if (t) {
    ctx.fillStyle = '#d9dde3';
    ctx.font = '12px system-ui';
    ctx.fillText(`${t.token}  x=${t.body.x.toFixed(0)} y=${t.body.y.toFixed(0)}  ${t.anim.name}[${t.anim.step.toString()}]  v=${Math.hypot(t.body.vx, t.body.vy).toFixed(2)} u/ciclo  ciclo ${g.ticks.toString()}`, 10, stage.height - 10);
  }
}

const COS_VIEW = Math.cos((50 * Math.PI) / 180);

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
  g.units.forEach((u, i) => {
    const x = 10;
    const y = 10 + i * 34;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, y, 190, 30);
    if (i === g.selected) {
      ctx.strokeStyle = '#c9a24a';
      ctx.strokeRect(x + 0.5, y + 0.5, 189, 29);
    }
    ctx.fillStyle = u.unit.dead ? '#e0826f' : '#d9dde3';
    ctx.fillText(`${(i + 1).toString()} ${u.unit.token}${u.unit.dead ? ' (muerto)' : u.unit.boat ? ' (en el bote)' : u.unit.crouched ? ' (agachado)' : ''}`, x + 6, y + 13);
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 18, 176, 6);
    ctx.fillStyle = u.unit.energy / u.maxEnergy > 0.4 ? '#6cc070' : '#e0826f';
    ctx.fillRect(x + 6, y + 18, (176 * u.unit.energy) / u.maxEnergy, 6);
  });
  const sel = g.units[g.selected];
  ctx.fillStyle = '#d9dde3';
  ctx.fillText(`Arma: ${g.planting ? 'bomba (clic donde plantar)' : (g.mode ?? 'ninguna (clic = mover)')}  ·  F pistola · R fusil · C cuchillo · G agacharse · Esc mover · E subir al bote · V conos`, 10, 14 + g.units.length * 34);
  if (sel) ctx.fillText(`Disponibles: ${sel.weapons.join(', ') || '—'}`, 10, 30 + g.units.length * 34);
  let oy = 14;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(ctx.canvas.width - 210, 8, 200, 20 + g.demo.objectives.size * 15 + 18);
  ctx.fillStyle = '#c9a24a';
  ctx.fillText('Objetivos', ctx.canvas.width - 202, oy + 6);
  for (const [name, done] of g.demo.objectives) {
    oy += 15;
    ctx.fillStyle = done ? '#6cc070' : '#d9dde3';
    ctx.fillText(`${done ? '✔' : '○'} ${name}`, ctx.canvas.width - 202, oy + 6);
  }
  ctx.fillStyle = '#d9dde3';
  ctx.fillText(`Bombas: ${g.demo.bombs.toString()} (B planta, X detona) · plantadas ${g.demo.planted.length.toString()}`, ctx.canvas.width - 202, oy + 24);
  if (g.demo.boatSunk) {
    ctx.fillStyle = '#e0826f';
    ctx.fillText('¡El Zodiac tocó una mina y se hundió!', 10, 46 + g.units.length * 34);
  }
  if (g.won) {
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(0, ctx.canvas.height / 2 - 30, ctx.canvas.width, 60);
    ctx.fillStyle = '#6cc070';
    ctx.font = '28px system-ui';
    ctx.fillText('¡Misión cumplida!', 30, ctx.canvas.height / 2 + 10);
  }
  if (g.battle.lost) {
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(0, (ctx.canvas.height / 2) - 30, ctx.canvas.width, 60);
    ctx.fillStyle = '#e0826f';
    ctx.font = '28px system-ui';
    ctx.fillText('Misión fracasada: todos los comandos han muerto', 30, ctx.canvas.height / 2 + 10);
  }
}

/** ManejaBomba (docs/lectura/au-jugador.md): camina hasta el sitio, anima PONEBOMBA (11 ciclos) y entonces deja la bomba. */
function plantBomb(g: Game, u: Unit, spot: { x: number; y: number; sector: Parameters<Unit['goTo']>[2] }): boolean {
  return u.doAt(
    spot,
    () => {
      u.playOnce('PONEBOMBA', () => {
        say(g.demo.plant(u.body.x, u.body.y) ? 'Bomba plantada. X para detonar.' : 'No te quedan bombas.');
      });
    },
    spot.sector,
  );
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
  const r = stage.getBoundingClientRect();
  const x1 = e.clientX - r.left;
  const y1 = e.clientY - r.top;
  if (Math.hypot(x1 - d.x, y1 - d.y) < 3) {
    const u = g.units[g.selected]?.unit;
    if (!u || u.dead) return;
    g.battle.cancel(u);
    if (u.climb) {
      u.pauseClimb(); // MSG_BOTON2VIRTUAL trepando: queda congelado a esa altura
      say(`${u.token}: pausado en la escalera (clic más alto sube, más bajo baja).`);
      return;
    }
    u.stop();
    if (u.boat) u.boat.stop();
    say(`${u.token}: orden cancelada.`);
    return;
  }
  const z = zoom();
  const { width, height } = stage;
  const toMap = (sx: number, sy: number): { x: number; y: number } => ({ x: g.camX - width / z / 2 + sx / z, y: g.camY - height / z / 2 + sy / z });
  const a = toMap(Math.min(d.x, x1), Math.min(d.y, y1));
  const b = toMap(Math.max(d.x, x1), Math.max(d.y, y1));
  const idx = g.units.findIndex((u) => {
    const p = project(u.unit.body.x, u.unit.body.y, u.unit.z);
    return !u.unit.dead && p.px >= a.x && p.px <= b.x && p.py >= a.y && p.py <= b.y + 40;
  });
  if (idx >= 0) g.selected = idx;
}

function onMouse(e: MouseEvent): void {
  const g = game;
  if (!g || !stage) return;
  const r = stage.getBoundingClientRect();
  const z = zoom();
  const mx = g.camX - stage.width / z / 2 + (e.clientX - r.left) / z;
  const my = g.camY - stage.height / z / 2 + (e.clientY - r.top) / z;
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
  if (e.button === 2) {
    rightDown = { x: e.clientX - r.left, y: e.clientY - r.top };
    return;
  }
  const ladder = pickLadder(g.ladders, mx, my);
  if (e.button === 0 && sel?.climb) {
    // trepando (pausado o no): +1 si el punto está más alto que el comando, −1 si más bajo (FUN_004F3C70)
    const spot = g.sectors?.pick(mx, my);
    sel.resumeClimb(spot ? spot.z : sel.z + (ladder && ladder.high.z > sel.z ? 1 : -1));
  } else if (e.button === 0 && ladder && !g.mode && !g.planting && sel && !sel.dead && !sel.boat && hit < 0) {
    g.battle.cancel(sel);
    if (!sel.useLadder(ladder)) say(ladder.disabled ? 'Esa escalera quedó inutilizable.' : `${sel.token}: no puede usar esa escalera desde acá.`);
  } else if (e.button === 0 && g.planting && sel && !sel.dead && !sel.boat) {
    g.planting = false;
    const spot = g.sectors ? g.sectors.pick(mx, my) : { ...unproject(mx, my, sel.z), sector: null };
    g.battle.cancel(sel);
    if (!spot || !plantBomb(g, sel, spot)) say('No hay camino a pie hasta ese punto.');
  } else if (e.button === 0 && hit >= 0) g.selected = hit;
  else if (e.button === 0 && (g.mode === 'PISTOLA' || g.mode === 'MIRILLA') && barrel && sel && !sel.dead && !sel.boat && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, barrel, g.mode);
  else if (e.button === 0 && g.mode && foe && sel && !sel.dead && !sel.boat && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, foe.soldier, g.mode);
  else if (sel && !sel.dead && e.button === 0) {
    g.battle.cancel(sel);
    const run = e.detail >= 2 || e.shiftKey; // doble clic izquierdo = BOTON1DBLCLK: AuGoTo corre (FUN_004F68A0); Mayús queda como atajo extra
    
    // el cursor apunta al sector más alto que cruza el rayo del píxel (FUN_005F5590), no a un plano fijo
    const hit = g.sectors ? g.sectors.pick(mx, my) : { ...unproject(mx, my, sel.z), sector: null }; // sin .SEC: plano fijo del comando
    if (!hit) say('Ese punto está fuera de los sectores del mapa.');
    else if (sel.boat) {
      // En el bote: clic en agua = el bote va ahí; clic en tierra con el bote parado = el comando baja y camina.
      if (isWater(hit.sector)) sel.boat.goTo(hit);
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
    await start(dir, wads);
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
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  const g = game;
  if (!g) return;
  if (k >= '1' && k <= '9' && g.units[Number(k) - 1]) g.selected = Number(k) - 1;
  if (k === 'f' || k === 'r' || k === 'c') {
    const w: Weapon = k === 'f' ? 'PISTOLA' : k === 'r' ? 'MIRILLA' : 'CUCHILLO';
    const u = g.units[g.selected];
    if (u?.weapons.includes(w)) g.mode = w;
    else say(`${u?.unit.token ?? ''} no tiene ${w.toLowerCase()}.`);
  }
  if (k === 'escape') {
    g.mode = null;
    g.planting = false;
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
  if (k === 'b' && cur && !cur.dead && !cur.boat) {
    if (cur.token !== 'ARTIFIC') say(`${cur.token} no sabe manejar bombas (solo el zapador, ARTIFIC).`);
    else if (g.demo.bombs <= 0) say('No te quedan bombas.');
    else {
      g.planting = true;
      g.mode = null;
      say('Clic donde plantar la bomba (Esc cancela). X detona.');
    }
  }
  if (k === 'x' && g.demo.detonate() === 0) say('No hay bombas plantadas.');
  if (k === 'l' && g.lift && cur) {
    const p = g.lift.pos;
    if (Math.hypot(cur.body.x - p.x, cur.body.y - p.y) < 40 && Math.abs(cur.z - p.z) < 25) g.lift.activate();
    else say('Ponete sobre el montacargas para activarlo.');
  }
  if (k === 'e' && cur && !cur.dead && !cur.boat && g.boat) {
    const bt = g.boat.boat;
    const seat = g.units.filter((u) => u.unit.boat === bt).length;
    if (Math.hypot(bt.x - cur.body.x, bt.y - cur.body.y) > 120 || bt.speed >= 0.01) say('Acercate al bote (a menos de 120) y con el bote parado.');
    else if (seat >= bt.slots.length) say('El bote está lleno.');
    else {
      g.battle.cancel(cur);
      cur.board(bt, seat);
    }
  }
  if (k === 'v') g.showCones = !g.showCones;
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
