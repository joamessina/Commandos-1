/** Menú y fuentes del exe: docs/lectura/menu-principal.md, FUN_006015C0 y FUN_00600090. */
import { parseWad, type Sprite, type Wad } from '../formats/wad.ts';
import { SpriteCache } from '../render/sprites.ts';

type Page = 'main' | 'new' | 'skill' | 'options' | 'video';
interface Row { key: string; action: string; enabled?: boolean; label?: string }
interface Screen { title: string; rows: Row[] }
const screens: Record<Page, Screen> = {
  main: { title: 'MMEN', rows: [{ key: 'NGAM', action: 'new' }, { key: 'SGAM', action: '', enabled: false }, { key: 'LGAM', action: '', enabled: false }, { key: 'OPTI', action: 'options' }, { key: 'CRED', action: '', enabled: false }, { key: 'HELP', action: '', enabled: false }, { key: 'QGAM', action: '', enabled: false }] },
  new: { title: 'NGAM', rows: [{ key: 'SPMP', action: 'skill' }, { key: 'REST', action: '', enabled: false }, { key: '3LQS', action: '', enabled: false }, { key: 'PASS', action: '', enabled: false }, { key: 'EXIT', action: 'main' }] },
  skill: { title: 'SKIL', rows: [{ key: 'EASY', action: 'FACIL' }, { key: 'HARD', action: 'DIFICIL' }, { key: 'EXIT', action: 'new' }] },
  options: { title: 'OPTI', rows: [{ key: 'VOPT', action: 'video' }, { key: 'SOPT', action: '', enabled: false }, { key: '3PRE', action: '', enabled: false }, { key: 'EXIT', action: 'main' }] },
  // shortcut: GLOBAL.STR nombra otros tamaños que los aplicados por estas acciones; mostrar la resolución real hasta investigar la discrepancia.
  video: { title: 'VOPT', rows: [{ key: 'OVI1', label: '640 X 480', action: '640' }, { key: 'OVI2', label: '800 X 600', action: '800' }, { key: 'OVI3', label: '1024 X 768', action: '1024' }, { key: 'OVI4', label: '1280 X 720', action: '1280' }, { key: 'EXIT', action: 'options' }] },
};
const sizes: Record<string, [number, number]> = { '640': [640, 480], '800': [800, 600], '1024': [1024, 768], '1280': [1280, 720] };

function glyph(wad: Wad, char: string): Sprite | undefined {
  const c = char.toUpperCase();
  return wad.byName.get(/^\d$/.test(c) ? `${c.padStart(8, '0')}.RLE` : `${c}.RLE`);
}
function width(wad: Wad, text: string): number {
  const space = (glyph(wad, 'I')?.width ?? 0) + 1;
  return Array.from(text).reduce((n, c) => n + (c === ' ' ? space : (glyph(wad, c)?.width ?? 0) + 1), 0);
}
function drawText(ctx: CanvasRenderingContext2D, wad: Wad, cache: SpriteCache, text: string, x: number, y: number): void {
  for (const char of text) {
    const sprite = glyph(wad, char);
    if (char === ' ') x += (glyph(wad, 'I')?.width ?? 0) + 1;
    else if (sprite) { ctx.drawImage(cache.canvasFor(sprite), x, y); x += sprite.width + 1; }
  }
}

export async function showMenu(view: HTMLElement, read: (path: string) => Uint8Array | undefined, begin: (difficulty: 'FACIL' | 'DIFICIL') => void): Promise<() => void> {
  const required = (path: string): Uint8Array => {
    const b = read(path);
    if (!b) throw new Error(`Falta ${path} en WAR_MP.DIR`);
    return b;
  };
  const title = parseWad(required('DATOS/FONTS/COMANDO.WAD'));
  const font = parseWad(required('DATOS/FONTS/COMANDP.WAD'));
  const titleCache = new SpriteCache(title);
  const fontCache = new SpriteCache(font);
  const strings = new Map<string, string>();
  for (const line of new TextDecoder('windows-1252').decode(required('DATOS/MISIONES/GLOBAL.STR')).split(/\r?\n/)) {
    const m = /^(\S{4})\s+([^#]*)/.exec(line);
    if (m?.[1] && m[2]) strings.set(m[1], m[2].trim());
  }
  const backgrounds = new Map<number, ImageBitmap>();
  for (const n of [640, 800, 1024]) {
    const b = required(`DATOS/RECURSOS/BMPS/SYSTEM/MISC/MENU${n.toString()}.BMP`);
    backgrounds.set(n, await createImageBitmap(new Blob([b.slice().buffer], { type: 'image/bmp' })));
  }
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'max-width:100%;max-height:100%;width:auto;height:auto;margin:auto;object-fit:contain';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el canvas del menú');
  view.replaceChildren(canvas);
  let page: Page = 'main';
  let selected = 0;
  // shortcut: abrir a 640×480 hasta portar la configuración guardada; 1280 usa el fondo 1024 escalado hasta resolver MENU1280.
  let size = 640;
  let frame = 0;
  let active = true;
  const label = (r: Row): string => r.label ?? strings.get(r.key) ?? r.key;
  const layout = (): { x: number; y: number; top: number; w: number } => {
    const rows = screens[page].rows;
    const gap = canvas.height >= 600 ? 112 : 75;
    const w = Math.max(...rows.map((row) => width(font, label(row))));
    const y = Math.floor((canvas.height - gap - rows.length * 38) / 2);
    return { x: Math.floor((canvas.width - w) / 2), y, top: y + gap, w };
  };
  const render = (time: number): void => {
    if (!active) return;
    const [w, h] = sizes[String(size)] ?? [640, 480];
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const bg = backgrounds.get(size === 1280 ? 1024 : size);
    if (bg) ctx.drawImage(bg, 0, 0, w, h);
    const s = screens[page];
    const pos = layout();
    const heading = strings.get(s.title) ?? s.title;
    drawText(ctx, title, titleCache, heading, Math.floor((w - width(title, heading)) / 2), pos.y);
    s.rows.forEach((row, i) => {
      // shortcut: brillo aproximado hasta trasladar la tabla RGB565 de FUN_006457F0.
      ctx.save();
      ctx.filter = row.enabled === false ? 'brightness(0.56)' : i === selected ? `brightness(${(1 + 0.2 * Math.sin(time * Math.PI / 400)).toString()})` : 'none';
      drawText(ctx, font, fontCache, label(row), pos.x, pos.top + i * 38);
      ctx.restore();
    });
    frame = requestAnimationFrame(render);
  };
  const move = (delta: number): void => {
    const rows = screens[page].rows;
    do { selected = (selected + delta + rows.length) % rows.length; } while (rows[selected]?.enabled === false);
  };
  const choose = (): void => {
    const action = screens[page].rows[selected]?.action;
    if (action === 'FACIL' || action === 'DIFICIL') { cleanup(); begin(action); }
    else if (action && action in sizes) size = Number(action);
    else if (action && action in screens) { page = action as Page; selected = 0; }
  };
  const keydown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Enter') choose();
    else if (e.key === 'Escape' && page !== 'main') { page = page === 'video' ? 'options' : page === 'skill' ? 'new' : 'main'; selected = 0; }
    else return;
    e.preventDefault();
  };
  const mouse = (e: MouseEvent): void => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * canvas.width / rect.width;
    const y = (e.clientY - rect.top) * canvas.height / rect.height;
    const pos = layout();
    const i = Math.floor((y - pos.top) / 38);
    if (x >= pos.x && x < pos.x + pos.w && i >= 0 && i < screens[page].rows.length && screens[page].rows[i]?.enabled !== false) {
      selected = i;
      if (e.type === 'click') choose();
    }
  };
  const cleanup = (): void => {
    active = false;
    cancelAnimationFrame(frame);
    window.removeEventListener('keydown', keydown);
    canvas.removeEventListener('mousemove', mouse);
    canvas.removeEventListener('click', mouse);
    for (const bg of backgrounds.values()) bg.close();
  };
  window.addEventListener('keydown', keydown);
  canvas.addEventListener('mousemove', mouse);
  canvas.addEventListener('click', mouse);
  frame = requestAnimationFrame(render);
  return cleanup;
}
