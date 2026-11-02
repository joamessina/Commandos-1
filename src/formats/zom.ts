/** Capas de imagen ZOM: FUN_00709090 (0x7090c6–0x709491), docs/lectura/intro-briefing.md. */
export interface ZoomLayer {
  readonly width: number;
  readonly height: number;
  readonly scaleX: number;
  readonly scaleY: number;
  /** Paleta RGB565 little-endian, seguida por filas de índices de color. */
  readonly palette: Uint8Array;
  readonly pixels: Uint8Array;
}
export interface ZoomBitmap {
  readonly width: number;
  readonly height: number;
  readonly layers: readonly ZoomLayer[];
  readonly rows: readonly (readonly ZoomSpan[])[];
}
export interface ZoomSpan {
  readonly length: number;
  readonly layer: number;
  /** Coordenadas en 16.16 dentro de la capa. */
  readonly x: number;
  readonly y: number;
}

export function parseZom(bytes: Uint8Array): ZoomBitmap {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const read = (n: number): Uint8Array => {
    if (!Number.isSafeInteger(n) || n < 0 || offset + n > bytes.length) throw new Error('ZOM truncado');
    const data = bytes.subarray(offset, offset + n);
    offset += n;
    return data;
  };
  const u32 = (): number => { const pos = offset; read(4); return view.getUint32(pos, true); };
  const i32 = (): number => { const pos = offset; read(4); return view.getInt32(pos, true); };
  const f32 = (): number => { const pos = offset; read(4); return view.getFloat32(pos, true); };
  const width = u32();
  const height = u32();
  const count = u32();
  if (width === 0 || height === 0 || width > 8192 || height > 8192 || count === 0 || count > 32) throw new Error('Cabecera ZOM inválida');
  const layers: ZoomLayer[] = [];
  for (let i = 0; i < count; i++) {
    const w = u32();
    const h = u32();
    const scaleX = f32();
    const scaleY = f32();
    if (w === 0 || h === 0 || w > 8192 || h > 8192 || !Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) throw new Error('Capa ZOM inválida');
    const palette = read(512);
    const pixels = read(w * h);
    layers.push({ width: w, height: h, scaleX, scaleY, palette, pixels });
  }
  const rows: ZoomSpan[][] = [];
  for (let y = 0; y < height; y++) {
    const spans: ZoomSpan[] = [];
    const spanCount = u32();
    if (spanCount > width) throw new Error('Fila ZOM inválida');
    let total = 0;
    for (let i = 0; i < spanCount; i++) {
      const length = u32();
      const layer = u32();
      const x = i32();
      const sourceY = i32();
      if (length === 0 || layer >= count || total + length > width) throw new Error('Tramo ZOM inválido');
      total += length;
      spans.push({ length, layer, x, y: sourceY });
    }
    if (total !== width) throw new Error('Fila ZOM incompleta');
    rows.push(spans);
  }
  if (offset !== bytes.length) throw new Error('Datos sobrantes en ZOM');
  return { width, height, layers, rows };
}
