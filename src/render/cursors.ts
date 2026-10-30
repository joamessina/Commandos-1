/** Cursores del mouse como imágenes CSS a partir de `GLOBAL/CURSORES.WAD` (engine/cursors.ts). */
import type { CursorSpec } from '../engine/cursors.ts';
import type { Wad } from '../formats/wad.ts';
import { SpriteCache } from './sprites.ts';

export class Cursors {
  private readonly cache: SpriteCache;
  private readonly css = new Map<string, string>();

  constructor(private readonly wad: Wad) {
    this.cache = new SpriteCache(wad);
  }

  /** Valor de la propiedad CSS `cursor` (con la flecha del sistema de reserva si falta el sprite). */
  cssFor(spec: CursorSpec): string {
    const key = `${spec.sprite}|${spec.hot}`;
    const hit = this.css.get(key);
    if (hit !== undefined) return hit;
    const s = this.wad.byName.get(spec.sprite);
    let value = 'default';
    if (s) {
      const x = spec.hot === 'center' ? Math.floor(s.width / 2) : 0;
      const y = spec.hot === 'center' ? Math.floor(s.height / 2) : 0;
      value = `url(${this.cache.canvasFor(s).toDataURL()}) ${x.toString()} ${y.toString()}, default`;
    }
    this.css.set(key, value);
    return value;
  }
}
