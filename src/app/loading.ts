/** Pantalla de carga de misión: FUN_006EC8E0, FUN_005C64B0 y FUN_00506170. */
import { parseRleBitmap } from '../formats/rle-bmp.ts';
import { SpriteCache } from '../render/sprites.ts';
import { fitCanvas, type Resolution } from './viewport.ts';

export function showLoading(view: HTMLElement, read: (path: string) => Uint8Array | undefined, resolution: Resolution): (progress: number) => void {
  const canvas = document.createElement('canvas');
  canvas.width = resolution[0]; canvas.height = resolution[1];
  canvas.dataset['loading'] = 'true';
  canvas.style.cssText = 'margin:auto';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear la pantalla de carga');
  const asset = (name: string): HTMLCanvasElement | null => {
    const data = read(`DATOS/RECURSOS/BMPS/SYSTEM/MISC/${name}`);
    if (!data) return null;
    const wad = parseRleBitmap(name, data);
    const sprite = wad.sprites[0];
    return sprite ? new SpriteCache(wad).canvasFor(sprite) : null;
  };
  const background = asset('LOAD0000.RLE');
  const bar = asset('LOAD0001.RLE');
  const label = asset('LOAD0002.RLE');
  view.replaceChildren(canvas);
  fitCanvas(canvas, view);
  return (progress: number): void => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!background) return;
    const x = Math.trunc((canvas.width - background.width) / 2);
    const y = Math.trunc((canvas.height - background.height) / 2);
    ctx.drawImage(background, x, y);
    if (label) ctx.drawImage(label, Math.trunc((canvas.width - label.width) / 2) + 5, y + background.height - label.height - 50);
    if (bar) {
      const fraction = Math.max(0, Math.min(1, progress));
      const w = fraction >= 1 ? bar.width : Math.floor((bar.width * fraction) / 16) * 16;
      if (w > 0) ctx.drawImage(bar, 0, 0, w, bar.height, x + background.width - 281, y + background.height - 38, w, bar.height);
    }
  };
}
