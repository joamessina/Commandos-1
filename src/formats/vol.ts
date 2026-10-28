/**
 * `.VOL` de mapa. Sintaxis leída en el exe (FUN_00616830 / FUN_006159A0 / FUN_00614040): docs/engine/graficos-mapa.md §3.
 *   MAPDIMXY w,h · MAPTABPOLYS · POLY "n",cx,cy,cz,alt,#vért,#tiles · POLYRAMPA "n",cx,cy,cz,alt,altOff,#vért,#tiles
 *   POINT x,y · RADIO r · EXTRAINFO b0..b7 · TILE x,y,w,h,sx,sy,g,"sprite","flags" · TILEID …,"id" · EXTRASPRITE "x.RLE"
 * Verificado con tools/vol_render.py: #tiles y #vért de cada POLY coinciden con lo leído en los 9 mapas con WAD.
 */

export class VolError extends Error {}

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly sx: number;
  readonly sy: number;
  readonly g: number;
  readonly sprite: string;
  /** Letras: X espejo horizontal, Y espejo vertical, L (sin efecto conocido aún). */
  readonly flags: string;
}

export interface Poly {
  readonly name: string;
  readonly ramp: boolean;
  /** Números de la cabecera, en orden. */
  readonly header: readonly number[];
  readonly points: { x: number; y: number }[];
  readonly tiles: Tile[];
  radio: number | null;
  extraInfo: readonly number[] | null;
}

export interface Vol {
  readonly width: number;
  readonly height: number;
  readonly polys: readonly Poly[];
  readonly extraSprites: readonly string[];
}

const MAX_LINES = 2_000_000;
const INT = '(-?\\d+)';
const RE_DIM = /^MAPDIMXY\s+(\d+)\s*,\s*(\d+)$/;
const RE_POLY = /^POLY(RAMPA)?\s+"([^"]*)"\s*,(.*)$/;
const RE_POINT = new RegExp(`^POINT\\s+${INT}\\s*,\\s*${INT}$`);
const RE_RADIO = new RegExp(`^RADIO\\s+${INT}$`);
const RE_EXTRA = /^EXTRAINFO\s+(.*)$/;
const RE_TILE = new RegExp(`^TILE(?:ID)?\\s+${INT},\\s*${INT},\\s*${INT},\\s*${INT},\\s*${INT},\\s*${INT},\\s*${INT},\\s*"([^"]*)",\\s*"([^"]*)"`);
const RE_SPRITE = /^EXTRASPRITE\s+"([^"]*)"$/;

function nums(csv: string, line: string): number[] {
  return csv.split(',').map((v) => {
    const n = Number(v.trim());
    if (!Number.isInteger(n)) throw new VolError(`número inválido en: ${line}`);
    return n;
  });
}

export function parseVol(text: string): Vol {
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_LINES) throw new VolError('demasiadas líneas');
  let dim: [number, number] | null = null;
  const polys: Poly[] = [];
  const extraSprites: string[] = [];
  const cur = (line: string): Poly => {
    const p = polys[polys.length - 1];
    if (!p) throw new VolError(`dato sin POLY previo: ${line}`);
    return p;
  };
  for (const raw of lines) {
    const s = raw.replace(/;.*/, '').trim();
    if (s === '' || s === '{' || s === '}' || s.startsWith('MAPTABPOLYS')) continue;
    let m: RegExpExecArray | null;
    if ((m = RE_DIM.exec(s))) dim = [Number(m[1]), Number(m[2])];
    else if ((m = RE_POLY.exec(s))) polys.push({ name: m[2] ?? '', ramp: m[1] !== undefined, header: nums(m[3] ?? '', s), points: [], tiles: [], radio: null, extraInfo: null });
    else if ((m = RE_POINT.exec(s))) cur(s).points.push({ x: Number(m[1]), y: Number(m[2]) });
    else if ((m = RE_RADIO.exec(s))) cur(s).radio = Number(m[1]);
    else if ((m = RE_EXTRA.exec(s))) cur(s).extraInfo = nums(m[1] ?? '', s);
    else if ((m = RE_TILE.exec(s)))
      cur(s).tiles.push({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]), sx: Number(m[5]), sy: Number(m[6]), g: Number(m[7]), sprite: m[8] ?? '', flags: m[9] ?? '' });
    else if ((m = RE_SPRITE.exec(s))) extraSprites.push(m[1] ?? '');
    else throw new VolError(`línea no reconocida: ${s}`);
  }
  if (!dim) throw new VolError('falta MAPDIMXY');
  for (const p of polys) {
    const nTiles = p.header[p.header.length - 1];
    if (nTiles !== p.tiles.length) throw new VolError(`${p.name}: ${String(nTiles)} tiles declarados, ${p.tiles.length.toString()} leídos`);
  }
  return { width: dim[0], height: dim[1], polys, extraSprites };
}
