/**
 * Composición del mapa de una fase: pinta, EN EL ORDEN DEL ARCHIVO, cada TILE de cada POLY del .VOL
 * con el recorte (sx,sy,w,h) del sprite del Fase000N.WAD. Port 1:1 de tools/vol_render.py (verificado
 * visualmente con la fase 0; docs/engine/graficos-mapa.md §3.3).
 * Es una vista del mapa estático, NO el juego: sin estados de edificios destruidos, agua animada ni objetos.
 */
import { BLEND, normalizeName, rgb565, TRANSPARENT, type Sprite, type Wad } from '../formats/wad.ts';
import type { Tile, Vol } from '../formats/vol.ts';

export interface MapOptions {
  /** Omite el polígono AGUA (tiras de mar; sin su animación se ve negro/recortado). */
  readonly skipWater?: boolean;
}

export interface MapImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, fila a fila. */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  /** Tiles cuyo sprite no está en el WAD de la fase (p. ej. -EXPLO00.RLE en otro banco). */
  readonly missing: number;
}

function drawTile(img: Uint8ClampedArray, mw: number, mh: number, t: Tile, s: Sprite, pal: Uint8Array): void {
  // RLE: sx módulo el ancho del sprite y w recortado; crudo: tal cual (vol_render.py).
  const sx = s.rle ? t.sx % s.width : t.sx;
  const w = s.rle ? Math.min(t.w, s.width - sx) : t.w;
  const flipX = t.flags.includes('X');
  const flipY = t.flags.includes('Y');
  for (let yy = 0; yy < t.h; yy++) {
    const sy = t.sy + yy;
    if (sy < 0 || sy >= s.height) continue;
    const dy = t.y + (flipY ? t.h - 1 - yy : yy);
    if (dy < 0 || dy >= mh) continue;
    for (let xx = 0; xx < w; xx++) {
      const px = sx + xx;
      if (px < 0 || px >= s.width) continue;
      const k = sy * s.width + px;
      const mode = s.mode[k] ?? TRANSPARENT;
      if (mode === TRANSPARENT) continue;
      const dx = t.x + (flipX ? w - 1 - xx : xx);
      if (dx < 0 || dx >= mw) continue;
      const o = (dy * mw + dx) * 4;
      if (mode === BLEND) {
        // 50 % con el fondo, como el blitter del exe (sombras).
        img[o] = (img[o] ?? 0) >> 1;
        img[o + 1] = (img[o + 1] ?? 0) >> 1;
        img[o + 2] = (img[o + 2] ?? 0) >> 1;
      } else {
        const i = (s.index[k] ?? 0) * 2;
        const [r, g, b] = rgb565(pal[i] ?? 0, pal[i + 1] ?? 0);
        img[o] = r;
        img[o + 1] = g;
        img[o + 2] = b;
      }
      img[o + 3] = 255;
    }
  }
}

export function composeMap(vol: Vol, wad: Wad, opts: MapOptions = {}): MapImage {
  const { width, height } = vol;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  let missing = 0;
  for (const poly of vol.polys) {
    if (opts.skipWater === true && poly.name === 'AGUA') continue;
    for (const t of poly.tiles) {
      const s = wad.byName.get(normalizeName(t.sprite));
      const pal = s ? wad.palettes[s.palette] : undefined;
      if (!s || !pal) {
        missing++;
        continue;
      }
      drawTile(pixels, width, height, t, s, pal);
    }
  }
  return { width, height, pixels, missing };
}
