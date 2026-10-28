/**
 * Visor de mapa con los comandos animados. El jugador elige SU carpeta del juego (Legacy): WAR_MP.DIR +
 * DATOS/recursos/bmps/map_mp/Fase000N.wad. Nada se sube ni se hace fetch: todo se lee con la File API.
 * Controles: clic izquierdo = elegir comando / caminar; clic derecho = caminar; Mayús+clic o doble clic derecho = correr;
 * flechas o WASD = mover la cámara; 1-4 = elegir comando; Inicio = centrar en el elegido.
 * shortcut: suelo plano (z fijo, sin sectores), sin colisiones ni rutas, orden de dibujo por y de los pies (R2 pendiente);
 *           los controles (derecho = mover) son los del original según el juego conocido, NO leídos del exe todavía.
 */
import { parseAnm } from '../formats/anm.ts';
import { entryBytes, parseContainer, type DirEntry } from '../formats/container.ts';
import { parseVol } from '../formats/vol.ts';
import { parseWad, type Wad } from '../formats/wad.ts';
import { loadAllies } from '../engine/mission.ts';
import { project, unproject, Unit } from '../engine/unit.ts';
import { composeMap } from '../render/map.ts';
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
}
interface Game {
  readonly map: HTMLCanvasElement;
  readonly units: UnitView[];
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
  const img = composeMap(vol, wad, { skipWater: waterBox.checked });
  const map = document.createElement('canvas');
  map.width = img.width;
  map.height = img.height;
  map.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);

  const units: UnitView[] = [];
  const mis = bytes(`DATOS/MISIONES/MAPA${n}.MIS`);
  for (const a of mis ? loadAllies(new TextDecoder('latin1').decode(mis)) : []) {
    const anm = bytes(`DATOS/RECURSOS/ELEM/${a.anim.toUpperCase()}.ANM`);
    const w = bytes(`DATOS/RECURSOS/ELEM/${a.anim.toUpperCase()}.WAD`);
    if (!anm || !w) continue;
    const uWad: Wad = parseWad(w);
    units.push({ unit: new Unit(a.token, parseAnm(anm), a.x, a.y, a.z, a.angle), sprites: new SpriteCache(uWad) });
  }
  const first = units[0]?.unit;
  const p = first ? project(first.body.x, first.body.y, first.z) : { px: img.width / 2, py: img.height / 2 };
  game = { map, units, selected: 0, camX: p.px, camY: p.py, ticks: 0 };
  (window as unknown as { __game: unknown }).__game = { vol, wad, game };
  setupStage();
  say(`Mapa ${n}: ${img.width.toString()}×${img.height.toString()} px, ${units.length.toString()} comandos (${Math.round(performance.now() - t0).toString()} ms). Clic para elegir/caminar, Mayús+clic corre.`);
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
      for (const u of g.units) u.unit.tick();
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
  ctx.drawImage(g.map, 0, 0);
  const order = g.units.map((u, i) => ({ u, i, py: project(u.unit.body.x, u.unit.body.y, u.unit.z).py })).sort((a, b) => a.py - b.py);
  for (const { u, i } of order) {
    const { px, py } = project(u.unit.body.x, u.unit.body.y, u.unit.z);
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
  }
  const t = g.units[g.selected]?.unit;
  if (t?.target) {
    const q = project(t.target.x, t.target.y, t.z);
    ctx.strokeStyle = '#c9a24a';
    ctx.beginPath();
    ctx.arc(q.px, q.py, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (t) {
    ctx.fillStyle = '#d9dde3';
    ctx.font = '12px system-ui';
    ctx.fillText(`${t.token}  x=${t.body.x.toFixed(0)} y=${t.body.y.toFixed(0)}  ${t.anim.name}[${t.anim.step.toString()}]  v=${Math.hypot(t.body.vx, t.body.vy).toFixed(2)} u/ciclo  ciclo ${g.ticks.toString()}`, 10, stage.height - 10);
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
  if (e.button === 0 && hit >= 0) g.selected = hit;
  else if (sel && (e.button === 0 || e.button === 2)) {
    const now = performance.now();
    const run = e.shiftKey || (e.button === 2 && now - lastRight < 350);
    if (e.button === 2) lastRight = now;
    sel.goTo(unproject(mx, my, sel.z), run);
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
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  const g = game;
  if (!g) return;
  if (k >= '1' && k <= '9' && g.units[Number(k) - 1]) g.selected = Number(k) - 1;
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
