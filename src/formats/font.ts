/** COMANDO.FNT: FUN_0060EF70 y FUN_0060ED10, docs/lectura/intro-briefing.md. */
export interface FontGlyph {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly pixels: Uint8Array;
}
export interface GameFont { readonly height: number; readonly glyphs: ReadonlyMap<number, FontGlyph> }

export function parseFont(bytes: Uint8Array): GameFont {
  if (bytes.length < 6) throw new Error('FNT truncado');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const height = view.getUint16(0, true);
  const glyphs = new Map<number, FontGlyph>();
  let at = 2;
  let terminated = false;
  while (at + 4 <= bytes.length) {
    const width = view.getInt32(at, true);
    if (width === 0x12345678) {
      if (at + 4 !== bytes.length) throw new Error('Datos sobrantes en FNT');
      terminated = true;
      break;
    }
    if (at + 24 > bytes.length) throw new Error('FNT truncado');
    const h = view.getInt32(at + 4, true);
    if (width < 1 || width > 8192 || h < 1 || h > 8192 || at + 24 + width * h > bytes.length) throw new Error('Glifo FNT inválido');
    const left = view.getInt32(at + 8, true);
    const right = view.getInt32(at + 12, true);
    const top = view.getInt32(at + 16, true);
    const id = view.getUint8(at + 20);
    glyphs.set(id, { width, height: h, left, right, top, pixels: bytes.subarray(at + 24, at + 24 + width * h) });
    at += 24 + width * h;
  }
  if (!terminated) throw new Error('FNT truncado');
  return { height, glyphs };
}
