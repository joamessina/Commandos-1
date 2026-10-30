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
import { Boat, boatSlots } from '../engine/boat.ts';
import { isWater, SectorMap } from '../engine/sectors.ts';
import { parseRoutes } from '../engine/patrol.ts';
import { Order, Soldier } from '../engine/soldier.ts';
import { COMMANDO_ENERGY, project, unproject, Unit } from '../engine/unit.ts';
import { parseWater, WaterFx } from '../engine/water.ts';
import { flatten, loadWorld, type Difficulty, type Elem } from '../engine/world.ts';
import { composeMap, repaintWater, waterBounds, type MapImage, type Rect } from '../render/map.ts';
import { SpriteCache } from '../render/sprites.ts';

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
  readonly demo: Demolition;
  /** Barril del juego -> su gráfico (se oculta al explotar). */
  readonly barrelProps: ReadonlyMap<Barrel, Prop>;
  readonly vol: Vol;
  readonly wad: Wad;
  /** Punto de huida del MIS (`PUNTOHUIDA`): el bote con todos a bordo debe llegar allí. */
  readonly escape: { x: number; y: number } | null;
  won: boolean;
  readonly battle: Battle;
  readonly soldiers: SoldierView[];
  /** Arma elegida: el clic en un soldado ataca con ella (null = clic mueve). */
  mode: Weapon | null;
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
const zoom = (): number => Number(zoomSel.value);

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
  const img = composeMap(vol, wad, water ? { layer: 'land' } : { skipWater: waterBox.checked });
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
    } else if (e.bando === 'ALEMAN' && e.anim && e.actions.some((x) => /^ac(bap|banpe)/i.test(x.name))) {
      const a = asset(e.anim);
      if (!a) continue;
      const unit = new Unit(e.token, a.anm, e.x, e.y, e.z, e.angle, sectors);
      const pat = e.actions.find((x) => x.name.toUpperCase() === 'ACPATRULLA');
      const route = pat ? (parseRoutes(pat.params, diffSel.value as Difficulty)[0] ?? null) : null;
      soldiers.push({ soldier: new Soldier(e.token, unit, route), sprites: a.sprites });
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
  const { sites, objectives, escape } = parseSites(misText, vol, elems);
  const demo = new Demolition(sites, objectives, { soldiers: battle.soldiers, commandos: battle.commandos }, bombCount);
  const barrelMap = new Map<Barrel, Prop>();
  for (const b of barrelProps) barrelMap.set(demo.addBarrel(b.elem.token, b.elem.x, b.elem.y), b.prop);
  game = { demo, barrelProps: barrelMap, vol, wad, escape, won: false, battle, soldiers, mode: null, showCones: false, props, boat: mainBoat, water, map, units, sectors, selected: 0, camX: p.px, camY: p.py, ticks: 0 };
  (window as unknown as { __game: unknown }).__game = { vol, wad, game };
  setupStage();
  say(`Mapa ${n}: ${img.width.toString()}×${img.height.toString()} px, ${units.length.toString()} comandos (${Math.round(performance.now() - t0).toString()} ms). Clic para elegir/caminar, Mayús+clic corre.`);
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
  const img = composeMap(g.vol, g.wad, { ...(g.water ? { layer: 'land' as const } : { skipWater: waterBox.checked }), rename: st.rename, ruined: st.ruined });
  g.map.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);
}

/** Victoria: todos los objetivos, todos los comandos vivos a bordo del bote y el bote en el punto de huida (Intend00; evaluador de docs/lectura/mision-intendencia.md §6). */
function checkWin(g: Game): void {
  const b = g.boat?.boat;
  if (g.won || !b || !g.escape || !g.demo.objectivesDone) return;
  const alive = g.units.filter((u) => !u.unit.dead);
  if (alive.length > 0 && alive.every((u) => u.unit.boat === b) && Math.hypot(b.x - g.escape.x, b.y - g.escape.y) < 250) g.won = true;
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
    const pan = (dt / 1000) * 600; // shortcut: 600 px/s (velocidad de scroll del original NO leída)
    if (keys.has('arrowleft') || keys.has('a')) g.camX -= pan / zoom();
    if (keys.has('arrowright') || keys.has('d')) g.camX += pan / zoom();
    if (keys.has('arrowup') || keys.has('w')) g.camY -= pan / zoom();
    if (keys.has('arrowdown') || keys.has('s')) g.camY += pan / zoom();
    draw(g);
    loopId = requestAnimationFrame(frame);
  };
  loopId = requestAnimationFrame(frame);
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
  const items: { py: number; paint: () => void }[] = [];
  for (const pr of g.props) {
    const { px, py } = project(pr.x, pr.y, pr.z);
    if (px < ox - 150 || px > ox + vw + 150 || py < oy - 150 || py > oy + vh + 150) continue;
    if ([...g.barrelProps].some(([b, bp]) => bp === pr && b.dead)) continue;
    items.push({ py: py - (pr === g.boat?.prop ? 1000 : 0), paint: () => pr.sprites.draw(ctx, pr.anim.frame(pr.ang), px, py) });
  }
  g.units.forEach((u, i) => {
    const { px, py } = project(u.unit.body.x, u.unit.body.y, u.unit.z);
    items.push({
      py: py + (u.unit.boat ? 1 : 0),
      paint: () => {
        if (i === g.selected) {
          ctx.strokeStyle = '#c9a24a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(px, py, 14, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (!u.sprites.draw(ctx, u.unit.anim.frame(u.unit.body.ang), px, py)) {
          ctx.fillStyle = '#f0f';
          ctx.fillRect(px - 4, py - 30, 8, 30);
        }
      },
    });
  });
  for (const s of g.soldiers) {
    const u = s.soldier.unit;
    const { px, py } = project(u.body.x, u.body.y, u.z);
    if (px < ox - 150 || px > ox + vw + 150 || py < oy - 150 || py > oy + vh + 150) continue;
    items.push({
      py: s.soldier.dead ? py - 500 : py, // los cuerpos van debajo de los vivos (shortcut: sin la regla de orden real)
      paint: () => {
        s.sprites.draw(ctx, u.anim.frame(u.body.ang), px, py);
        if (g.showCones && !s.soldier.dead) {
          const a = project(u.body.x, u.body.y, u.z + 30);
          const h = ((u.body.ang + s.soldier.headAngle) * Math.PI) / 180;
          ctx.fillStyle = s.soldier.order === Order.Patrol ? 'rgba(255,255,100,.12)' : 'rgba(255,60,60,.2)';
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          for (let k = -35; k <= 35; k += 7) {
            const r = h + (k * Math.PI) / 180;
            const q = project(u.body.x + Math.cos(r) * 800, u.body.y + Math.sin(r) * 800, u.z + 30);
            ctx.lineTo(q.px, q.py);
          }
          ctx.closePath();
          ctx.fill();
        }
      },
    });
  }
  items.sort((a, b) => a.py - b.py);
  for (const it of items) it.paint();
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

/** HUD mínimo: comandos con su energía, arma elegida y fin de partida (shortcut: el HUD real —libretas, mochila, caras— no se leyó). */
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
    ctx.fillText(`${(i + 1).toString()} ${u.unit.token}${u.unit.dead ? ' (muerto)' : u.unit.boat ? ' (en el bote)' : ''}`, x + 6, y + 13);
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 18, 176, 6);
    ctx.fillStyle = u.unit.energy / u.maxEnergy > 0.4 ? '#6cc070' : '#e0826f';
    ctx.fillRect(x + 6, y + 18, (176 * u.unit.energy) / u.maxEnergy, 6);
  });
  const sel = g.units[g.selected];
  ctx.fillStyle = '#d9dde3';
  ctx.fillText(`Arma: ${g.mode ?? 'ninguna (clic = mover)'}  ·  F pistola · R fusil · C cuchillo · Esc mover · E subir al bote · V conos`, 10, 14 + g.units.length * 34);
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

let lastRight = 0;
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
  if (e.button === 0 && hit >= 0) g.selected = hit;
  else if (e.button === 0 && (g.mode === 'PISTOLA' || g.mode === 'MIRILLA') && barrel && sel && !sel.dead && !sel.boat && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, barrel, g.mode);
  else if (e.button === 0 && g.mode && foe && sel && !sel.dead && !sel.boat && g.units[g.selected]?.weapons.includes(g.mode)) g.battle.attack(sel, foe.soldier, g.mode);
  else if (sel && !sel.dead && (e.button === 0 || e.button === 2)) {
    g.battle.cancel(sel);
    const now = performance.now();
    const run = e.shiftKey || (e.button === 2 && now - lastRight < 350);
    if (e.button === 2) lastRight = now;
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
  if (k === 'escape') g.mode = null;
  const cur = g.units[g.selected]?.unit;
  if (k === 'b' && cur && !cur.dead && !cur.boat) {
    if (cur.token !== 'ARTIFIC') say(`${cur.token} no sabe manejar bombas (solo el zapador, ARTIFIC).`);
    else if (!g.demo.plant(cur.body.x, cur.body.y)) say('No te quedan bombas.');
    else say('Bomba plantada. X para detonar.');
  }
  if (k === 'x' && g.demo.detonate() === 0) say('No hay bombas plantadas.');
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
