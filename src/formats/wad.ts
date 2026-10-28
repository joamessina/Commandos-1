/**
 * WAD de sprites + paletas y RLE. Formato: docs/formats-graficos.md §1-2 y docs/engine/graficos-mapa.md §2
 * (verificado: 245/245 WAD sin bytes sobrantes; 11 483 sprites RLE decodifican fila a fila).
 *
 *   cab[400] ; u32 A ; A x { pal[512] (256 x RGB565 LE) ; nombre[13] } ; u32 B ; B x sprite
 *   sprite = nombre[32] ; u32 s1 ; u32 s3 ; u32 tipo ; u32 basura ; campos[16] = {u32 h, u32 w, u32 basura, u32 compresion} ;
 *            buf1[s1] ; si compresion != 0: u32 s2 + buf2[s2] ; buf3[s3] ; i32 índice de paleta
 *   compresion 4 = RLE (buf1 = filas, buf2 = tag[4], u32 w, u32 h, u32 fila_off[h]); 0 = crudo (h·(w+2)+1 B)
 *   fila RLE: FF n = n transparentes | FE n + n bytes = n píxeles mezclados 50 % | n < FE + n bytes = n opacos
 */

export class WadError extends Error {}

const MAX_PALETTES = 4096;
const MAX_SPRITES = 100_000;
const MAX_DIM = 8192;

/** Modo de cada píxel decodificado. */
export const TRANSPARENT = 0;
export const OPAQUE = 1;
export const BLEND = 2;

export interface Sprite {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Índice de paleta de cada píxel (width*height). */
  readonly index: Uint8Array;
  /** TRANSPARENT | OPAQUE | BLEND por píxel. */
  readonly mode: Uint8Array;
  /** Índice de la paleta del WAD que usa este sprite. */
  readonly palette: number;
  /** true = RLE (el recorte `sx` del VOL se toma módulo el ancho); false = bitmap crudo. */
  readonly rle: boolean;
}

export interface Wad {
  /** Cada paleta: 256 colores RGB565 little-endian (512 B). */
  readonly palettes: readonly Uint8Array[];
  readonly sprites: readonly Sprite[];
  /** Sprites por nombre de banco (ver `bankName`); el primero gana. */
  readonly byName: ReadonlyMap<string, Sprite>;
}

/**
 * Nombre con el que el exe registra un sprite del WAD: quita UN guion inicial (FUN_005D02B0) y busca en mayúsculas
 * (FUN_005CDE70). La búsqueda de un TILE del .VOL NO quita el guion: `-RUINA06.RLE` no coincide con nada y ese tile
 * queda sin gráfico (invisible hasta que la explosión del edificio cambie los tiles).
 */
export function bankName(name: string): string {
  return (name.startsWith('-') ? name.slice(1) : name).toUpperCase();
}

function cstr(b: Uint8Array, at: number, max: number): string {
  let s = '';
  for (let i = at; i < at + max && (b[i] ?? 0) !== 0; i++) s += String.fromCharCode(b[i] ?? 0);
  return s;
}

function decodeRle(name: string, b1: Uint8Array, b2: Uint8Array, palette: number): Sprite {
  if (b2.length < 12) throw new WadError(`${name}: índice RLE corto`);
  const dv = new DataView(b2.buffer, b2.byteOffset, b2.byteLength);
  const width = dv.getUint32(4, true);
  const height = dv.getUint32(8, true);
  if (width === 0 || height === 0 || width > MAX_DIM || height > MAX_DIM) throw new WadError(`${name}: dimensiones absurdas`);
  if (b2.length !== 12 + 4 * height) throw new WadError(`${name}: índice RLE de tamaño inesperado`);
  const index = new Uint8Array(width * height);
  const mode = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let p = dv.getUint32(12 + 4 * y, true);
    const end = y + 1 < height ? dv.getUint32(12 + 4 * (y + 1), true) : b1.length;
    if (p > end || end > b1.length) throw new WadError(`${name}: fila ${y.toString()} fuera de rango`);
    let x = 0;
    while (p < end) {
      const op = b1[p] ?? 0;
      if (op === 0xff) {
        x += b1[p + 1] ?? 0;
        p += 2;
      } else {
        const blend = op === 0xfe;
        const n = blend ? (b1[p + 1] ?? 0) : op;
        p += blend ? 2 : 1;
        if (p + n > end || x + n > width) throw new WadError(`${name}: fila ${y.toString()} excede el ancho`);
        for (let i = 0; i < n; i++) {
          index[y * width + x + i] = b1[p + i] ?? 0;
          mode[y * width + x + i] = blend ? BLEND : OPAQUE;
        }
        x += n;
        p += n;
      }
    }
    if (p !== end || x !== width) throw new WadError(`${name}: fila ${y.toString()} no cierra (${x.toString()} de ${width.toString()})`);
  }
  return { name, width, height, index, mode, palette, rle: true };
}

function decodeRaw(name: string, b1: Uint8Array, hRaw: number, wRaw: number, palette: number): Sprite {
  // campos[0] = alto, campos[1] = ancho; filas de ancho+2 bytes y 1 byte final (506/506 cumplen len = h*(w+2)+1).
  const height = hRaw;
  const width = wRaw;
  if (width === 0 || height === 0 || width > MAX_DIM || height > MAX_DIM) throw new WadError(`${name}: dimensiones absurdas`);
  if (b1.length !== height * (width + 2) + 1) throw new WadError(`${name}: tamaño crudo inesperado`);
  const index = new Uint8Array(width * height);
  const mode = new Uint8Array(width * height).fill(OPAQUE);
  for (let y = 0; y < height; y++) index.set(b1.subarray(y * (width + 2), y * (width + 2) + width), y * width);
  return { name, width, height, index, mode, palette, rle: false };
}

export function parseWad(buf: Uint8Array): Wad {
  if (buf.length < 408) throw new WadError('archivo corto');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 400;
  const a = dv.getUint32(p, true);
  p += 4;
  if (a > MAX_PALETTES || p + a * 525 + 4 > buf.length) throw new WadError('paletas fuera de rango');
  const palettes: Uint8Array[] = [];
  for (let i = 0; i < a; i++) {
    palettes.push(buf.subarray(p, p + 512));
    p += 525;
  }
  const n = dv.getUint32(p, true);
  p += 4;
  if (n > MAX_SPRITES) throw new WadError('demasiados sprites');
  const sprites: Sprite[] = [];
  const byName = new Map<string, Sprite>();
  for (let i = 0; i < n; i++) {
    if (p + 64 > buf.length) throw new WadError(`sprite ${i.toString()}: cabecera fuera de rango`);
    const name = cstr(buf, p, 32);
    const s1 = dv.getUint32(p + 32, true);
    const s3 = dv.getUint32(p + 36, true);
    const h = dv.getUint32(p + 48, true);
    const w = dv.getUint32(p + 52, true);
    const comp = dv.getUint32(p + 60, true);
    p += 64;
    if (p + s1 > buf.length) throw new WadError(`${name}: buffer 1 fuera de rango`);
    const b1 = buf.subarray(p, p + s1);
    p += s1;
    let b2: Uint8Array = new Uint8Array(0);
    if (comp !== 0) {
      if (p + 4 > buf.length) throw new WadError(`${name}: buffer 2 fuera de rango`);
      const s2 = dv.getUint32(p, true);
      p += 4;
      if (p + s2 > buf.length) throw new WadError(`${name}: buffer 2 fuera de rango`);
      b2 = buf.subarray(p, p + s2);
      p += s2;
    }
    p += s3;
    if (p + 4 > buf.length) throw new WadError(`${name}: cola fuera de rango`);
    const palette = dv.getInt32(p, true);
    p += 4;
    if (palette < 0 || palette >= palettes.length) throw new WadError(`${name}: paleta ${palette.toString()} inexistente`);
    const sprite = comp !== 0 ? decodeRle(name, b1, b2, palette) : decodeRaw(name, b1, h, w, palette);
    sprites.push(sprite);
    const key = bankName(name);
    if (!byName.has(key)) byName.set(key, sprite);
  }
  if (p !== buf.length) throw new WadError(`${(buf.length - p).toString()} bytes sobrantes`);
  return { palettes, sprites, byName };
}

/** RGB565 little-endian -> [r,g,b] 0..255 (misma conversión que el exe: FUN_00659c80 / wad_render.py). */
export function rgb565(lo: number, hi: number): [number, number, number] {
  const c = lo | (hi << 8);
  return [Math.floor(((c >> 11) & 31) * 255 / 31), Math.floor(((c >> 5) & 63) * 255 / 63), Math.floor((c & 31) * 255 / 31)];
}
