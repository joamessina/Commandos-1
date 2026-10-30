/**
 * Disposición del HUD de misión (docs/lectura/hud.md). Las medidas salen de los WAD `GLOBAL/<ancho>X<alto>.WAD` (tira superior de 45, columna derecha de 36) y de una captura
 * del juego original a 1280×720 (imagenesReferncia/HUD.PNG): caras con su barra de sangre a la izquierda de la tira, ojo en la esquina derecha.
 * shortcut: las posiciones de las ranuras y de los iconos se midieron sobre la captura (±2 px), no se leyeron del exe; la cara por energía (9 grados + calavera) y la altura de la
 *           barra de sangre son lineales. Cuándo mejorar: al leer `ClassVisorComandos`/`ClassSubInterfaceAliado`.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Resoluciones con WAD de interfaz, de mayor a menor. */
export const HUD_MODES: readonly (readonly [number, number])[] = [
  [1280, 720],
  [1024, 768],
  [800, 600],
  [640, 480],
  [512, 384],
];

export const HUD_BAR = 45;
export const HUD_COLUMN = 36;

/** El WAD de interfaz más grande que cabe en la ventana (el del exe se elige por la resolución de pantalla); si no cabe ninguno, el menor. */
export function hudMode(width: number, height: number): readonly [number, number] {
  return HUD_MODES.find(([w, h]) => w <= width && h <= height) ?? (HUD_MODES[HUD_MODES.length - 1] as readonly [number, number]);
}

/** Zona del mundo: lo que queda bajo la tira superior y a la izquierda de la columna. */
export const viewRect = (width: number, height: number): Rect => ({ x: 0, y: HUD_BAR, w: Math.max(1, width - HUD_COLUMN), h: Math.max(1, height - HUD_BAR) });

/** Cara de un aliado: `COM0001` (sano) a `COM0009` según la energía perdida, `COM0010` (calavera) si murió. */
export function faceNumber(energy: number, max: number, dead: boolean): number {
  if (dead || energy <= 0) return 10;
  return Math.min(9, Math.max(1, 1 + Math.floor((1 - Math.min(1, energy / max)) * 9)));
}

/** Alto en píxeles de la barra de sangre (`SANGRE`, 37 de alto) para la energía dada; 0 con energía 0. */
export const bloodHeight = (energy: number, max: number, full = 37): number => (energy <= 0 ? 0 : Math.max(1, Math.round((full * Math.min(1, energy / max)))));

/**
 * Ranuras de comandos en la tira superior: marco `MARC0000` (62×44) con el hueco de la cara (38×38 en +6,+2) y el pozo de la barra de sangre (`SANGRE` 9×37 en +47,+4);
 * el seleccionado usa `MARCA000` (86×44, con una ventana más) y empuja a los siguientes. Paso medido sobre la captura: 63.
 * shortcut: lo que muestra la ventana extra del seleccionado (¿el ítem activo?) no se leyó: queda vacía.
 */
export const SLOT = { x: 1, y: 0, pitch: 63, frameW: 62, selW: 86, faceDx: 6, faceDy: 2, bloodDx: 47, bloodDy: 4 } as const;

export const slotRect = (i: number, selected = -1): Rect => ({
  x: SLOT.x + i * SLOT.pitch + (selected >= 0 && i > selected ? SLOT.selW - SLOT.frameW : 0),
  y: SLOT.y,
  w: i === selected ? SLOT.selW : SLOT.frameW,
  h: HUD_BAR - SLOT.y,
});

/** Índice de la ranura bajo (x, y) o -1; solo cuenta hasta `count` ranuras. */
export function slotAt(x: number, y: number, count: number, selected = -1): number {
  for (let i = 0; i < count; i++) {
    const r = slotRect(i, selected);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

/** ¿El punto (x, y) del lienzo cae sobre el HUD (tira o columna) y no sobre el mundo? */
export const overHud = (x: number, y: number, width: number): boolean => y < HUD_BAR || x >= width - HUD_COLUMN;
