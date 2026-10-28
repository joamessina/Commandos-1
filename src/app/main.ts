/**
 * Visor de mapa. El jugador elige SU carpeta del juego (Legacy): WAR_MP.DIR + DATOS/recursos/bmps/map_mp/Fase000N.wad.
 * Nada se sube ni se hace fetch: todo se lee con la File API (CONSTRAINTS: el build no lleva archivos del juego).
 */
import { entryBytes, parseContainer, type DirEntry } from '../formats/container.ts';
import { parseVol } from '../formats/vol.ts';
import { parseWad } from '../formats/wad.ts';
import { composeMap } from '../render/map.ts';

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
let loaded: Loaded | null = null;
let canvas: HTMLCanvasElement | null = null;

const say = (msg: string, error = false): void => {
  status.textContent = msg;
  status.className = error ? 'error' : '';
};

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
  await draw();
}

async function draw(): Promise<void> {
  if (!loaded || !mapSel.value) return;
  const n = mapSel.value;
  const volEntry = loaded.entries.get(`DATOS/MISIONES/MAPA${n}.VOL`);
  const readWad = loaded.wads.get(`FASE${n}`);
  if (!volEntry || !readWad) return;
  say(`Componiendo mapa ${n}…`);
  await new Promise((r) => setTimeout(r, 0)); // deja pintar el mensaje
  const t0 = performance.now();
  const vol = parseVol(new TextDecoder('latin1').decode(entryBytes(loaded.dir, volEntry)));
  const wad = parseWad(new Uint8Array(await readWad()));
  const img = composeMap(vol, wad, { skipWater: waterBox.checked });
  canvas ??= document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')?.putImageData(new ImageData(img.pixels, img.width, img.height), 0, 0);
  applyZoom();
  view.replaceChildren(canvas);
  say(`Mapa ${n}: ${img.width.toString()}×${img.height.toString()} px, ${vol.polys.length.toString()} volúmenes, ${vol.polys.reduce((a, p) => a + p.tiles.length, 0).toString()} piezas, ${img.missing.toString()} sin sprite en el WAD (${Math.round(performance.now() - t0).toString()} ms).`);
  (window as unknown as { __game: unknown }).__game = { vol, wad, img };
}

function applyZoom(): void {
  if (!canvas) return;
  const z = Number(zoomSel.value);
  canvas.style.width = `${(canvas.width * z).toString()}px`;
  canvas.style.height = `${(canvas.height * z).toString()}px`;
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
mapSel.addEventListener('change', guarded(draw));
waterBox.addEventListener('change', guarded(draw));
zoomSel.addEventListener('change', applyZoom);
