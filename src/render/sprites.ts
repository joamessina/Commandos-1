/**
 * Sprites del WAD a canvas y dibujo de un fotograma de ANM. El píxel mezclado (FE) del RLE se dibuja como negro al 50 %,
 * que es exactamente lo que hace el blitter del exe (dst/2). Posición: esquina superior izquierda = punto del mundo
 * proyectado + (hx,hy) del fotograma; si `mirror`, la imagen se voltea en su lugar (hx ya es su borde izquierdo).
 */
import type { AnmFrame } from '../formats/anm.ts';
import { BLEND, rgb565, TRANSPARENT, type Sprite, type Wad } from '../formats/wad.ts';

export class SpriteCache {
  private readonly cache = new Map<Sprite, HTMLCanvasElement>();

  constructor(private readonly wad: Wad) {}

  private build(s: Sprite): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = s.width;
    c.height = s.height;
    const pal = this.wad.palettes[s.palette];
    const img = new ImageData(s.width, s.height);
    for (let i = 0; i < s.mode.length; i++) {
      const m = s.mode[i] ?? TRANSPARENT;
      if (m === TRANSPARENT) continue;
      const o = i * 4;
      if (m === BLEND) img.data[o + 3] = 128;
      else {
        const k = (s.index[i] ?? 0) * 2;
        const [r, g, b] = rgb565(pal?.[k] ?? 0, pal?.[k + 1] ?? 0);
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    c.getContext('2d')?.putImageData(img, 0, 0);
    return c;
  }

  /** Dibuja el fotograma con su punto del mundo ya proyectado a píxel de mapa. Devuelve false si el sprite no existe en el WAD. */
  draw(ctx: CanvasRenderingContext2D, f: AnmFrame, px: number, py: number): boolean {
    const s = this.wad.byName.get(f.sprite.toUpperCase());
    if (!s) return false;
    let c = this.cache.get(s);
    if (!c) {
      c = this.build(s);
      this.cache.set(s, c);
    }
    const left = Math.round(px + f.hx);
    const top = Math.round(py + f.hy);
    if (f.mirror) {
      ctx.save();
      ctx.translate(left + s.width, top);
      ctx.scale(-1, 1);
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    } else ctx.drawImage(c, left, top);
    return true;
  }
}
