/**
 * Dibujo del HUD de misión (docs/lectura/hud.md, engine/hud.ts): tira superior (BARRA01 + BARRA02), columna derecha (BARS0000 + BARS0001), caras de los comandos con su barra
 * de sangre, marco de selección, y los iconos de la esquina (ojo, ayuda, cámara). Todo a 1:1 con el WAD de interfaz que cabe en la ventana.
 * shortcut: si la ventana es más ancha/alta que el WAD, la tira y la columna se alargan repitiendo su último tramo (el exe solo corre a resoluciones fijas).
 */
import { BAG, bagRect, bloodHeight, columnX, faceNumber, HUD_BAR, HUD_COLUMN, hudMode, SLOT, slotRect, type BagItem } from '../engine/hud.ts';
import type { Sprite, Wad } from '../formats/wad.ts';
import { SpriteCache } from './sprites.ts';

export interface HudUnit {
  readonly token: string;
  readonly energy: number;
  readonly max: number;
  readonly dead: boolean;
  /** Ítems que se dibujan en su mochila (engine/hud.ts `bagItems`). */
  readonly items: readonly BagItem[];
}

interface Bank {
  readonly wad: Wad;
  readonly cache: SpriteCache;
}

const bank = (wad: Wad): Bank => ({ wad, cache: new SpriteCache(wad) });

export class Hud {
  private readonly global: Bank;
  private readonly sized = new Map<string, Bank>();
  private readonly faces = new Map<string, Bank>();
  private readonly items = new Map<string, Bank>();

  /** `sized` = `GLOBAL/<ancho>X<alto>.WAD` por "ancho×alto"; `faces` = `CARAS/<TOKEN>.WAD` por token de comando; `items` = `OPCIONES/<ITEM>.WAD` por nombre. */
  constructor(global: Wad, sized: ReadonlyMap<string, Wad>, faces: ReadonlyMap<string, Wad>, items: ReadonlyMap<string, Wad>) {
    this.global = bank(global);
    for (const [mode, wad] of sized) this.sized.set(mode, bank(wad));
    for (const [token, wad] of faces) this.faces.set(token, bank(wad));
    for (const [name, wad] of items) this.items.set(name, bank(wad));
  }

  private static get(b: Bank, name: string): { s: Sprite; c: HTMLCanvasElement } | null {
    const s = b.wad.byName.get(name);
    return s ? { s, c: b.cache.canvasFor(s) } : null;
  }

  /** Repite horizontalmente el último tramo del sprite hasta cubrir `to`. */
  private strip(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number, to: number): void {
    ctx.drawImage(c, x, y);
    const tile = Math.min(120, c.width);
    for (let px = x + c.width; px < to; px += tile) ctx.drawImage(c, c.width - tile, 0, tile, c.height, px, y, Math.min(tile, to - px), c.height);
  }

  /** `phase(i)` = fotograma de la cara del comando i (engine/hud.ts `FaceAnim`); `left` = columna y mochila a la izquierda. */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, units: readonly HudUnit[], selected: number, phase: (i: number) => number, left: boolean): void {
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    // tira superior
    const [mw, mh] = hudMode(width, height);
    const sized = this.sized.get(`${mw.toString()}x${mh.toString()}`) ?? [...this.sized.values()][0];
    if (!sized) return;
    const b1 = Hud.get(sized, 'BARRA01.BMP');
    const b2 = Hud.get(sized, 'BARRA02.BMP');
    if (b1) ctx.drawImage(b1.c, 0, 0);
    if (b2) this.strip(ctx, b2.c, b1?.c.width ?? 0, 0, width);
    // columna: BARS0000 y BARS0001 una bajo la otra, repetidas si falta alto; a la izquierda va espejada
    const c0 = Hud.get(sized, 'BARS0000.RLE');
    const c1 = Hud.get(sized, 'BARS0001.RLE');
    const x = columnX(width, left);
    let y = HUD_BAR;
    ctx.save();
    if (left) {
      ctx.translate(HUD_COLUMN, 0);
      ctx.scale(-1, 1);
    }
    const cx = left ? 0 : x;
    for (let k = 0; y < height; k++) {
      const part = k === 0 ? c0 : (c1 ?? c0);
      if (!part) break;
      ctx.drawImage(part.c, cx, y);
      y += part.c.height;
    }
    ctx.restore();
    // esquina: ojo, ayuda y cámara (posiciones medidas sobre la captura, relativas al borde derecho)
    const eye = Hud.get(this.global, 'P_OJOAL0.BMP');
    if (eye) ctx.drawImage(eye.c, width - eye.c.width, 0);
    const help = Hud.get(this.global, 'INTERROG.RLE');
    if (help) ctx.drawImage(help.c, width - 156, 8);
    const cam = Hud.get(this.global, 'CAMARA.RLE');
    if (cam) ctx.drawImage(cam.c, width - 121, 4);
    // comandos: marco, cara (gris de perfil o naranja de frente si es el seleccionado) y barra de sangre (la vida)
    units.forEach((u, i) => {
      const r = slotRect(i);
      const fb = this.faces.get(u.token);
      // cada WAD de caras nombra las suyas con otro prefijo (COM, FRA, LAN, BOM, MEC, ESP): son los 10 BMP en orden
      const face = fb?.wad.sprites.filter((s) => s.name.toUpperCase().endsWith('.BMP'))[faceNumber(phase(i), u.dead) - 1];
      const frame = Hud.get(this.global, 'MARC0000.RLE');
      if (frame) ctx.drawImage(frame.c, r.x, r.y);
      if (fb && face) ctx.drawImage(fb.cache.canvasFor(face), r.x + SLOT.faceDx, r.y + SLOT.faceDy);
      const blood = Hud.get(this.global, 'SANGRE.BMP');
      const h = bloodHeight(u.energy, u.max, blood?.s.height ?? 37);
      if (blood && h > 0) ctx.drawImage(blood.c, 0, blood.s.height - h, blood.s.width, h, r.x + SLOT.bloodDx, r.y + SLOT.bloodDy + blood.s.height - h, blood.s.width, h);
    });
    // mochila del seleccionado con su foto grande
    const sel = units[selected];
    if (sel && !sel.dead) {
      const bag = bagRect(width, height, left);
      const pack = Hud.get(this.global, 'MOCHILA.RLE');
      if (pack) ctx.drawImage(pack.c, bag.x, bag.y);
      const fb = this.faces.get(sel.token);
      const photo = fb?.wad.sprites.find((s) => /^FOTO\d+\.RLE$/i.test(s.name));
      if (fb && photo) ctx.drawImage(fb.cache.canvasFor(photo), bag.x + BAG.photoDx, bag.y + BAG.photoDy);
      for (const it of sel.items) {
        const ib = this.items.get(it.wad);
        const art = ib?.wad.byName.get(it.sprite);
        if (ib && art) ctx.drawImage(ib.cache.canvasFor(art), bag.x + it.x, bag.y + it.y);
      }
    }
    ctx.imageSmoothingEnabled = was;
  }
}
