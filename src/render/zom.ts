/** Muestreo del mosaico del briefing (FUN_00703DF0, docs/lectura/intro-briefing.md). */
import type { ZoomBitmap } from '../formats/zom.ts';
import { rgb565 } from '../formats/wad.ts';

export function zoomPixels(z: ZoomBitmap, cx: number, cy: number, zoom: number, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const windowW = width / zoom;
  const windowH = height / zoom;
  if (zoom <= 0 || windowW > z.width || windowH > z.height) return result;
  const left = Math.max(0, Math.min(z.width - windowW, cx - windowW / 2));
  const top = Math.max(0, Math.min(z.height - windowH, cy - windowH / 2));
  for (let y = 0; y < height; y++) {
    const sourceY = top + y / zoom;
    const row = z.rows[Math.floor(sourceY)];
    if (!row) continue;
    let segment = 0;
    let from = 0;
    for (let x = 0; x < width; x++) {
      const sourceX = left + x / zoom;
      while (segment < row.length && sourceX >= from + (row[segment]?.length ?? 0)) {
        from += row[segment]?.length ?? 0;
        segment++;
      }
      let selected = segment;
      let selectedFrom = from;
      let span = row[selected];
      let layer = span ? z.layers[span.layer] : undefined;
      while (selected > 0 && layer && layer.scaleX / zoom >= 1.4375) {
        selected--;
        span = row[selected];
        selectedFrom -= span?.length ?? 0;
        layer = span ? z.layers[span.layer] : undefined;
      }
      if (!span || !layer) continue;
      const sx = Math.floor(span.x / 65536 + (sourceX - selectedFrom) * layer.scaleX);
      const sy = Math.floor(span.y / 65536 + (sourceY % 1) * layer.scaleY);
      if (sx < 0 || sx >= layer.width || sy < 0 || sy >= layer.height) continue;
      const color = (layer.pixels[sy * layer.width + sx] ?? 0) * 2;
      const [r, g, b] = rgb565(layer.palette[color] ?? 0, layer.palette[color + 1] ?? 0);
      const p = (y * width + x) * 4;
      result[p] = r; result[p + 1] = g; result[p + 2] = b; result[p + 3] = 255;
    }
  }
  return result;
}
