export type Resolution = readonly [number, number];

/** Convierte posición CSS a píxeles lógicos aunque el canvas se ajuste a la ventana. */
export function canvasPoint(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, size: Resolution): { x: number; y: number } {
  return { x: (clientX - rect.left) * size[0] / rect.width, y: (clientY - rect.top) * size[1] / rect.height };
}

/** Factor con que un canvas `w`×`h` llena la caja `boxW`×`boxH`: entero si la ventana es mayor (píxeles parejos), fraccionario solo si no entra. */
export function fitScale(boxW: number, boxH: number, w: number, h: number): number {
  const s = Math.min(boxW / w, boxH / h);
  return s >= 1 ? Math.floor(s) : s;
}

const watching = new WeakMap<HTMLCanvasElement, () => void>();

/** Deja el canvas al mayor tamaño entero que cabe en `view`, y lo recalcula si cambia la ventana o el tamaño del canvas; se suelta solo al sacarlo de la página. Llamarlo otra vez reemplaza el anterior. */
export function fitCanvas(canvas: HTMLCanvasElement, view: HTMLElement): void {
  watching.get(canvas)?.();
  const stop = (): void => {
    resize.disconnect();
    attrs.disconnect();
  };
  const apply = (): void => {
    if (!canvas.isConnected) {
      stop();
      return;
    }
    if (view.clientWidth <= 0 || view.clientHeight <= 0) return;
    const k = fitScale(view.clientWidth, view.clientHeight, canvas.width, canvas.height);
    canvas.style.width = `${(canvas.width * k).toString()}px`;
    canvas.style.height = `${(canvas.height * k).toString()}px`;
  };
  const resize = new ResizeObserver(apply);
  const attrs = new MutationObserver(apply);
  watching.set(canvas, stop);
  resize.observe(view);
  attrs.observe(canvas, { attributeFilter: ['width', 'height'] });
  apply();
}
