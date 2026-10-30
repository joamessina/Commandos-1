/**
 * Disposición del HUD de misión (docs/lectura/hud.md). Las medidas salen de los WAD `GLOBAL/<ancho>X<alto>.WAD` (tira superior de 45, columna derecha de 36) y de una captura
 * del juego original a 1280×720 (imagenesReferncia/HUD.PNG): caras con su barra de sangre a la izquierda de la tira, ojo en la esquina derecha.
 * shortcut: las posiciones de las ranuras y de los iconos se midieron sobre la captura (±2 px), no se leyeron del exe; la transición de la cara y la altura de la barra de sangre
 *           (la vida) son lineales. Cuándo mejorar: al leer `ClassVisorComandos`/`ClassSubInterfaceAliado`.
 */
import { asList, asText, find, parseClave } from '../formats/clave.ts';

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

/** Zona del mundo: lo que queda bajo la tira superior y al lado de la columna (que va a la derecha o, con la tecla de lado, a la izquierda). */
export const viewRect = (width: number, height: number, left = false): Rect => ({ x: left ? HUD_COLUMN : 0, y: HUD_BAR, w: Math.max(1, width - HUD_COLUMN), h: Math.max(1, height - HUD_BAR) });

/** X de la columna según el lado. */
export const columnX = (width: number, left: boolean): number => (left ? 0 : width - HUD_COLUMN);

/** Cara de un aliado: 10 = calavera (murió); si no, el fotograma de su animación de selección (1 = gris de perfil, 9 = naranja de frente). */
export const faceNumber = (phase: number, dead: boolean): number => (dead ? 10 : Math.min(9, Math.max(1, Math.round(phase))));

/**
 * Animación de la cara de cada comando: sin selección está en gris y de perfil (fotograma 1) y al seleccionarlo "se prende" en naranja (fotograma 9).
 * shortcut: la transición pasa por los fotogramas intermedios a 1 por ciclo (el exe no se leyó: solo se vieron los dos extremos en la captura).
 */
export class FaceAnim {
  private readonly phase: number[] = [];

  /** Un ciclo: acerca cada cara a su extremo según esté seleccionada o no. */
  tick(count: number, selected: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.phase[i] ?? 1;
      this.phase[i] = i === selected ? Math.min(9, p + 1) : Math.max(1, p - 1);
    }
  }

  of(i: number): number {
    return this.phase[i] ?? 1;
  }
}

/** Alto en píxeles de la barra de sangre (`SANGRE`, 37 de alto) para la vida dada (el HP del comando); 0 sin vida. */
export const bloodHeight = (energy: number, max: number, full = 37): number => (energy <= 0 ? 0 : Math.max(1, Math.round((full * Math.min(1, energy / max)))));

/** Ranuras de comandos en la tira superior: marco `MARC0000` (62×44) con el hueco de la cara (38×38 en +6,+2) y el pozo de la barra de sangre (`SANGRE` 9×37 en +47,+4). Paso medido sobre la captura (63). */
export const SLOT = { x: 1, y: 0, pitch: 63, frameW: 62, faceDx: 6, faceDy: 2, bloodDx: 47, bloodDy: 4 } as const;

export const slotRect = (i: number): Rect => ({ x: SLOT.x + i * SLOT.pitch, y: SLOT.y, w: SLOT.frameW, h: HUD_BAR - SLOT.y });

/** Índice de la ranura bajo (x, y) o -1; solo cuenta hasta `count` ranuras. */
export function slotAt(x: number, y: number, count: number): number {
  for (let i = 0; i < count; i++) {
    const r = slotRect(i);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

/** ¿El punto (x, y) del lienzo cae sobre el HUD (tira o columna) y no sobre el mundo? */
export const overHud = (x: number, y: number, width: number, left = false): boolean => y < HUD_BAR || (left ? x < HUD_COLUMN : x >= width - HUD_COLUMN);

/**
 * Mochila del comando seleccionado: 112×149 pegada al borde inferior del lado de la columna, con la foto grande (71×91) clavada arriba.
 * shortcut: el lado de la mochila (siempre el de la columna) y los desplazamientos salen de una sola captura (columna a la izquierda); los ítems aún no se dibujan.
 */
export const BAG = { w: 112, h: 149, photoDx: 42, photoDy: -2 } as const;
export const bagRect = (width: number, height: number, left: boolean): Rect => ({ x: left ? 0 : width - BAG.w, y: height - BAG.h, w: BAG.w, h: BAG.h });

export interface HudItem {
  /** Token del catálogo (`IT_PISTOLA`, …). */
  readonly token: string;
  /** `.DISPONIBLE NO` = oculto hasta que se consigue. */
  readonly available: boolean;
}

export interface HudCommando {
  readonly items: readonly HudItem[];
}

/** `.INTERFACE [ .SUBINTERFACES [ [ SUBINTERFACEALIADO [ .TOKEN COMANDO .ITEMS [ [ .TOKEN IT_X .DISPONIBLE NO ] … ] ] ] … ] ]`: los ítems de cada comando, en el orden del `.MIS`. */
export function parseInterface(misText: string): Map<string, HudCommando> {
  const out = new Map<string, HudCommando>();
  const info = asList(find(asList(find(parseClave(misText), '.MISSION')) ?? [], '.INTERFACE')) ?? [];
  for (const sub of asList(find(info, '.SUBINTERFACES')) ?? []) {
    const pair = asList(sub) ?? [];
    if (asText(pair[0])?.toUpperCase() !== 'SUBINTERFACEALIADO') continue;
    const body = asList(pair[1]) ?? [];
    const token = asText(find(body, '.TOKEN'));
    if (!token) continue;
    const items: HudItem[] = [];
    for (const it of asList(find(body, '.ITEMS')) ?? []) {
      const l = asList(it) ?? [];
      const t = asText(find(l, '.TOKEN'));
      if (t) items.push({ token: t, available: asText(find(l, '.DISPONIBLE'))?.toUpperCase() !== 'NO' });
    }
    out.set(token, { items });
  }
  return out;
}

/**
 * Archivo de `OPCIONES/` con el dibujo de cada ítem del catálogo (el exe arma el nombre con `"%s%s%s.WAD"` y `OPCIONES\`; la tabla ítem→archivo no se leyó, se emparejó por nombre).
 * Sin entrada = el ítem no tiene dibujo propio hallado (GOLPEAR, ACTSENUELOON/OFF, LEVANTARSE, AGACHARSE, MANOCHICA, PUTADISTRAE, BOMBATIEMPO…).
 */
export const ITEM_WAD: Readonly<Record<string, string>> = {
  IT_PISTOLA: 'PISTOLA',
  IT_LUGER: 'LUGER',
  IT_PIPAPUTA: 'PIPAPUTA',
  IT_MIRILLA: 'MIRILLA',
  IT_ARPON: 'ARPON',
  IT_GRANADA: 'GRANADA',
  IT_ESCOPETA: 'ESCOPETA',
  IT_MAUSER: 'MAUSER',
  IT_BALLESTA: 'BALLESTA',
  IT_METRALLETA: 'METRALLE',
  IT_MP38: 'MP38',
  IT_PIEDRA: 'PIEDRA',
  IT_TABACO: 'TABACO',
  IT_CUCHILLO: 'CUCHILLO',
  IT_QUITAUNIFORME: 'QUITAUNI',
  IT_CACHIPORRA: 'CACHIP',
  IT_CLOROFORMO: 'CLOROF',
  IT_ESPOSAS: 'ESPOSAS',
  IT_PIOLET: 'PIOLET',
  IT_MANO: 'MANO',
  IT_GOLPEAR: 'PUNO',
  IT_BALSA: 'BALSA',
  IT_TRAJEBUZO: 'TRAJEBU',
  IT_CARTUCHO: 'CARTUCHO',
  IT_ACTIVADOR: 'ACTIVADO',
  IT_LANZALLAMAS: 'LANZALLA',
  IT_SEGNUELO: 'SENUELO',
  IT_ALICATE: 'ALICATE',
  IT_INSIGNIA: 'INSIGNIA',
  IT_UNIFORME: 'UNIFORME',
  IT_CAMUFLARSE: 'CAMUFLAR',
  IT_JERINGUILLALETAL: 'JERIN',
  IT_BOTIQUIN: 'BOTIQUIN',
  IT_CEPO: 'CEPO',
  IT_CONTROLALEMAN: 'CONTROLA',
  IT_MALETIN: 'MALETIN',
  IT_INTERRUPTOR_ASCENSOR: 'PALANCA',
  IT_ESPIAA: 'ESPIAA',
  IT_ESPIAA2: 'ESPIAA2',
  IT_ESPIAA3: 'ESPIAA3',
  IT_ESPIAA4: 'ESPIAA4',
  IT_ESPIAA5: 'ESPIAA5',
  IT_ESPIAA6: 'ESPIAA6',
  IT_ESPIAA7: 'ESPIAA7',
};

/**
 * Hueco entre el dibujo de un ítem y el borde derecho/inferior de la ventana, medido por coincidencia de plantilla sobre una captura 1280×720 del original (boina verde
 * a pie, mochila a la derecha; diferencia media 2,6–7,8 de 255 contra >17 para cualquier otro dibujo). El exe no trae la posición en el `.MIS`, ni en los WAD, ni en la tabla de ítems.
 * shortcut: solo los 7 ítems que mostraba esa captura (los demás no se dibujan hasta tener su posición); se dibujan todos los `.DISPONIBLE` del comando sin la regla de contexto del exe.
 */
export const BAG_GAP: Readonly<Record<string, { readonly right: number; readonly bottom: number }>> = {
  CUCHILLO: { right: 0, bottom: 126 },
  MANO: { right: 0, bottom: 94 },
  PUNO: { right: 0, bottom: 98 },
  PISTOLA: { right: 0, bottom: 33 },
  PIEDRA: { right: 39, bottom: 101 },
  ESPOSAS: { right: 35, bottom: 0 },
  CONTROLA: { right: 76, bottom: 0 },
};

/** Archivos de `OPCIONES/` que se dibujan en la mochila de cada comando (disponibles, con archivo y con posición medida), por token de comando. */
export function bagItems(iface: ReadonlyMap<string, HudCommando>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [token, c] of iface) {
    const names = c.items.flatMap((i) => {
      const wad = ITEM_WAD[i.token];
      return i.available && wad !== undefined && wad in BAG_GAP ? [wad] : [];
    });
    out.set(token, names);
  }
  return out;
}
