/** Ficha de objetivos: FUN_005207F0, FUN_00520D50 y FUN_0060EC70. */
import { parseFont, type FontGlyph, type GameFont } from '../formats/font.ts';
import { rgb565 } from '../formats/wad.ts';
import { fitCanvas } from './viewport.ts';

function strings(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(\S{4})(?:[ \t](.*))?$/.exec(line);
    if (match?.[1]) out.set(match[1], (match[2] ?? '').split('#')[0]?.trimEnd() ?? '');
  }
  return out;
}

function glyphCanvas(glyph: FontGlyph, color: 12 | 13): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = glyph.width; canvas.height = glyph.height;
  const image = new ImageData(glyph.width, glyph.height);
  const base = color === 12 ? [255, 0, 0] : [0, 0, 0];
  const end = [205, 210, 163];
  for (let i = 0; i < glyph.pixels.length; i++) {
    const index = glyph.pixels[i] ?? 128;
    if (index > 15) continue;
    const component = (channel: number): number => Math.round((base[channel] ?? 0) + ((end[channel] ?? 0) - (base[channel] ?? 0)) * (15 - index) / 16);
    const r = component(0); const g = component(1); const b = component(2);
    const packed = ((r & 248) << 8) | ((g & 252) << 3) | (b >> 3);
    const [rr, gg, bb] = rgb565(packed & 255, packed >> 8);
    image.data.set([rr, gg, bb, 255], i * 4);
  }
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas;
}

function write(ctx: CanvasRenderingContext2D, font: GameFont, text: string, x: number, y: number, color: 12 | 13, cache: Map<string, HTMLCanvasElement>): void {
  const space = font.glyphs.get(32);
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (code === 32) { x += space ? space.width - space.left - space.right : 20; continue; }
    const glyph = font.glyphs.get(code);
    if (!glyph) continue;
    const key = `${color.toString()}:${code.toString()}`;
    let image = cache.get(key);
    if (!image) { image = glyphCanvas(glyph, color); cache.set(key, image); }
    ctx.drawImage(image, x - glyph.left, y + glyph.top);
    x += glyph.width - glyph.left - glyph.right;
  }
}

export async function showBriefing(view: HTMLElement, width: number, height: number, read: (path: string) => Uint8Array | undefined, missionStrings: string): Promise<void> {
  const bmp = read('DATOS/RECURSOS/BMPS/SYSTEM/MISC/MBRIEFMA.BMP');
  const fnt = read('DATOS/FONTS/COMANDO.FNT');
  const global = read('DATOS/MISIONES/GLOBAL.STR');
  if (!bmp || !fnt || !global) throw new Error('Faltan recursos de la ficha de misión');
  const background = await createImageBitmap(new Blob([bmp.slice().buffer], { type: 'image/bmp' }));
  const font = parseFont(fnt);
  const labels = strings(new TextDecoder('windows-1252').decode(global));
  const values = strings(missionStrings);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.cssText = 'margin:auto';
  const ctx = canvas.getContext('2d');
  if (!ctx) { background.close(); throw new Error('No se pudo crear la ficha de misión'); }
  view.replaceChildren(canvas);
  fitCanvas(canvas, view);
  ctx.fillStyle = 'black'; ctx.fillRect(0, 0, width, height);
  const x = Math.floor((width - background.width) / 2);
  const y = Math.floor((height - background.height) / 2);
  ctx.drawImage(background, x, y);
  background.close();
  const cache = new Map<string, HTMLCanvasElement>();
  ['DATE', 'PLAC', 'TITL'].forEach((key, i) => {
    write(ctx, font, labels.get(key) ?? key, x + 90, y + 110 + i * 15, 12, cache);
    write(ctx, font, values.get(key) ?? '', x + 150, y + 110 + i * 15, 13, cache);
  });
  for (let i = 0; i < 25; i++) {
    const line = values.get(i.toString().padStart(4, '0')) ?? '';
    if (line.startsWith('%k')) break;
    write(ctx, font, line, x + 90, y + 180 + i * 12, 13, cache);
  }
  await new Promise<void>((resolve) => {
    const close = (): void => { canvas.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key); resolve(); };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape' || (e.altKey && e.code === 'KeyB')) { e.preventDefault(); close(); } };
    canvas.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
  });
}
