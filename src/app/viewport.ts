export type Resolution = readonly [number, number];

/** Convierte posición CSS a píxeles lógicos aunque el canvas se ajuste a la ventana. */
export function canvasPoint(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, size: Resolution): { x: number; y: number } {
  return { x: (clientX - rect.left) * size[0] / rect.width, y: (clientY - rect.top) * size[1] / rect.height };
}
