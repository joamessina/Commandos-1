/**
 * Composición del mapa de una fase: pinta, EN EL ORDEN DEL ARCHIVO, cada TILE de cada POLY del .VOL
 * con el recorte (sx,sy,w,h) del sprite del Fase000N.WAD. Port 1:1 de tools/vol_render.py (verificado
 * visualmente con la fase 0; docs/engine/graficos-mapa.md §3.3).
 * Estado inicial: edificios sanos. Los tiles de ruinas/explosión llevan un guion (`-RUINA06.RLE`, `-EXPLO00.RLE`) y el exe los
 * busca sin quitarlo, así que no encuentran sprite y no se dibujan (FUN_00614040 → FUN_005CDE70).
 * Es una vista del mapa estático, NO el juego: sin objetos. El mar se anima aparte (capas `water`/`land`, src/engine/water.ts).
 */
import { BLEND, rgb565, TRANSPARENT, type Sprite, type Wad } from '../formats/wad.ts';
import type { Tile, Vol } from '../formats/vol.ts';

export interface MapOptions {
  /** Omite el polígono AGUA (tiras de mar; sin su animación se ve negro/recortado). */
  readonly skipWater?: boolean;
  /** Capas para animar el mar: 'water' = solo el polígono AGUA sobre negro; 'land' = todo lo demás sobre transparente. */
  readonly layer?: 'water' | 'land';
  /** Volúmenes destruidos con renombre de tiles (CAMBIATILES: pares sprite → sprite, `NADA` = quitar) por nombre de polígono. */
  readonly rename?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Volúmenes destruidos sin lista (AUTOEXPCASAS): los tiles con guion se muestran sin él y el resto se quita. */
  readonly ruined?: ReadonlySet<string>;
}

/** Tiles de un polígono según su estado de destrucción. */
function tilesOf(poly: Vol['polys'][number], opts: MapOptions): Tile[] {
  const pairs = opts.rename?.get(poly.name);
  if (pairs) {
    return poly.tiles.flatMap((t) => {
      const to = pairs.get(t.sprite.toUpperCase());
      return to === undefined ? [t] : to === 'NADA' ? [] : [{ ...t, sprite: to }];
    });
  }
  if (opts.ruined?.has(poly.name)) return poly.tiles.filter((t) => t.sprite.startsWith('-')).map((t) => ({ ...t, sprite: t.sprite.slice(1) }));
  return poly.tiles;
}

export interface MapImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, fila a fila. */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  /** Tiles sin gráfico: su nombre exacto no está en el banco (los `-…` ocultos hasta destruir el edificio, o sprites de otro banco). */
  readonly missing: number;
}

function drawTile(img: Uint8ClampedArray, mw: number, mh: number, t: Tile, s: Sprite, pal: Uint8Array): void {
  // RLE: sx módulo el ancho del sprite y w recortado. BMP crudo: textura repetida, recorte módulo ancho y alto
  // (FUN_0057F770; el SUELO01.BMP de BASE trae sx,sy negativos). Evidencia: docs/research/q1-render.md.
  const mod = (a: number, n: number): number => ((a % n) + n) % n;
  const sx = mod(t.sx, s.width);
  const w = s.rle ? Math.min(t.w, s.width - sx) : t.w;
  const flipX = t.flags.includes('X');
  const flipY = t.flags.includes('Y');
  for (let yy = 0; yy < t.h; yy++) {
    const sy = s.rle ? t.sy + yy : mod(t.sy + yy, s.height);
    if (sy < 0 || sy >= s.height) continue;
    const dy = t.y + (flipY ? t.h - 1 - yy : yy);
    if (dy < 0 || dy >= mh) continue;
    for (let xx = 0; xx < w; xx++) {
      const px = s.rle ? sx + xx : (sx + xx) % s.width;
      if (px >= s.width) continue;
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
  if (opts.layer !== 'land') for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  let missing = 0;
  for (const poly of vol.polys) {
    if (opts.skipWater === true && poly.name === 'AGUA') continue;
    if (opts.layer !== undefined && (poly.name === 'AGUA') !== (opts.layer === 'water')) continue;
    for (const t of tilesOf(poly, opts)) {
      const s = wad.byName.get(t.sprite.toUpperCase());
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

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Caja que cubren los tiles del polígono AGUA, o null si no hay. */
export function waterBounds(vol: Vol): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const poly of vol.polys) {
    if (poly.name !== 'AGUA') continue;
    for (const t of poly.tiles) {
      x0 = Math.min(x0, t.x);
      y0 = Math.min(y0, t.y);
      x1 = Math.max(x1, t.x + t.w);
      y1 = Math.max(y1, t.y + t.h);
    }
  }
  return x0 > x1 ? null : { x: Math.max(0, x0), y: Math.max(0, y0), w: x1 - Math.max(0, x0), h: y1 - Math.max(0, y0) };
}

/** Vuelve a pintar los tiles del polígono AGUA que tocan `clip` en una capa 'water' ya compuesta (el bitmap del mar cambió). */
export function repaintWater(img: MapImage, vol: Vol, wad: Wad, clip: Rect): void {
  for (const poly of vol.polys) {
    if (poly.name !== 'AGUA') continue;
    for (const t of poly.tiles) {
      if (t.x >= clip.x + clip.w || t.x + t.w <= clip.x || t.y >= clip.y + clip.h || t.y + t.h <= clip.y) continue;
      const s = wad.byName.get(t.sprite.toUpperCase());
      const pal = s ? wad.palettes[s.palette] : undefined;
      if (s && pal) drawTile(img.pixels, img.width, img.height, t, s, pal);
    }
  }
}
