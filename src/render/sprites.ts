/**
 * Sprites del WAD a canvas y dibujo de un fotograma de ANM. El píxel mezclado (FE) combina el color de paleta y el fondo al 50 %
 * (FUN_00659C80, 0x659E45–0x659E75). Posición: esquina superior izquierda = punto del mundo
 * proyectado + (hx,hy) del fotograma; si `mirror`, la imagen se voltea en su lugar (hx ya es su borde izquierdo).
 */
import type { AnmFrame } from '../formats/anm.ts';
import { BLEND, rgb565, TRANSPARENT, type Sprite, type Wad } from '../formats/wad.ts';

/** Colores sin premultiplicar para el canvas: FE conserva el color y lo mezcla con el fondo. */
export function spriteRgba(s: Sprite, pal: Uint8Array | undefined, additive = false): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(s.width * s.height * 4);
  for (let i = 0; i < s.mode.length; i++) {
    const m = s.mode[i] ?? TRANSPARENT;
    if (m === TRANSPARENT) continue;
    const o = i * 4;
    const k = (s.index[i] ?? 0) * 2;
    const [r, g, b] = rgb565(pal?.[k] ?? 0, pal?.[k + 1] ?? 0);
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = m === BLEND && !additive ? 128 : 255;
  }
  return rgba;
}

export class SpriteCache {
  private readonly cache = new Map<Sprite, HTMLCanvasElement>();
  private readonly additiveCache = new Map<Sprite, HTMLCanvasElement>();

  constructor(private readonly wad: Wad) {}

  private build(s: Sprite, additive = false): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = s.width;
    c.height = s.height;
    const pal = this.wad.palettes[s.palette];
    const img = new ImageData(s.width, s.height);
    img.data.set(spriteRgba(s, pal, additive));
    c.getContext('2d')?.putImageData(img, 0, 0);
    return c;
  }

  /** Canvas del sprite con su paleta y los píxeles mezclados a alfa 128. */
  canvasFor(s: Sprite): HTMLCanvasElement {
    let c = this.cache.get(s);
    if (!c) {
      c = this.build(s);
      this.cache.set(s, c);
    }
    return c;
  }

  /** Rectángulo (en píxeles de mapa) que cubre el fotograma dibujado en (px,py), o null si el sprite no existe. */
  bounds(f: AnmFrame, px: number, py: number): { x0: number; y0: number; x1: number; y1: number } | null {
    const s = this.wad.byName.get(f.sprite.toUpperCase());
    if (!s) return null;
    const left = Math.round(px + f.hx);
    const top = Math.round(py + f.hy);
    return { x0: left, y0: top, x1: left + s.width, y1: top + s.height };
  }

  /** Dibuja el fotograma con su punto del mundo ya proyectado a píxel de mapa. Devuelve false si el sprite no existe en el WAD. */
  draw(ctx: CanvasRenderingContext2D, f: AnmFrame, px: number, py: number, additive = f.additive): boolean {
    const s = this.wad.byName.get(f.sprite.toUpperCase());
    if (!s) return false;
    const cache = additive ? this.additiveCache : this.cache;
    let c = cache.get(s);
    if (!c) {
      c = this.build(s, additive);
      cache.set(s, c);
    }
    const left = Math.round(px + f.hx);
    const top = Math.round(py + f.hy);
    if (f.mirror || additive) ctx.save();
    if (additive) ctx.globalCompositeOperation = 'lighter';
    if (f.mirror) {
      ctx.translate(left + s.width, top);
      ctx.scale(-1, 1);
      ctx.drawImage(c, 0, 0);
    } else ctx.drawImage(c, left, top);
    if (f.mirror || additive) ctx.restore();
    return true;
  }
}
