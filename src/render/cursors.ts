/** Cursores del mouse como imágenes CSS a partir de `GLOBAL/CURSORES.WAD` y de la retícula de `OPCIONES/MIRILLA.WAD` (engine/cursors.ts). */
import type { CursorSpec } from '../engine/cursors.ts';
import type { Sprite, Wad } from '../formats/wad.ts';
import { SpriteCache } from './sprites.ts';

export class Cursors {
  private readonly banks: { readonly wad: Wad; readonly cache: SpriteCache }[];
  private readonly css = new Map<string, string>();

  /** `wads`: se busca el sprite en el primero que lo tenga. */
  constructor(...wads: Wad[]) {
    this.banks = wads.map((wad) => ({ wad, cache: new SpriteCache(wad) }));
  }

  /** Valor de la propiedad CSS `cursor` (con la flecha del sistema de reserva si falta el sprite). */
  cssFor(spec: CursorSpec): string {
    const key = `${spec.sprite}|${spec.hot}|${spec.tint ?? ''}`;
    const hit = this.css.get(key);
    if (hit !== undefined) return hit;
    let found: { s: Sprite; canvas: HTMLCanvasElement } | null = null;
    for (const b of this.banks) {
      const s = b.wad.byName.get(spec.sprite);
      if (s) {
        found = { s, canvas: b.cache.canvasFor(s) };
        break;
      }
    }
    let value = 'default';
    if (found) {
      const x = spec.hot === 'center' ? Math.floor(found.s.width / 2) : 0;
      const y = spec.hot === 'center' ? Math.floor(found.s.height / 2) : 0;
      let canvas = found.canvas;
      if (spec.tint) {
        // shortcut: teñido por composición (rojo sobre los píxeles opacos); el tono exacto del original (`005D6160`) no se leyó
        canvas = document.createElement('canvas');
        canvas.width = found.s.width;
        canvas.height = found.s.height;
        const c = canvas.getContext('2d');
        if (c) {
          c.drawImage(found.canvas, 0, 0);
          c.globalCompositeOperation = 'source-atop';
          c.fillStyle = 'rgba(255, 0, 0, 0.6)';
          c.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      value = `url(${canvas.toDataURL()}) ${x.toString()} ${y.toString()}, default`;
    }
    this.css.set(key, value);
    return value;
  }
}
