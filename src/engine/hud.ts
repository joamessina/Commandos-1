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
 * Posición del dibujo de cada ítem respecto de la esquina sup. izq. de la mochila (1168, 571 en 1280×720), por comando y archivo de `OPCIONES/`, con el sprite exacto
 * (algunos WAD traen varios). Leída de la memoria de `coman_mp.exe` en marcha (solo lectura): botones `ClassBotonMochila` de la ventana de la mochila, con su offset `+0xFC/+0x100`
 * y el flag de oculto `+0x124` (0 = se dibuja); coincide con las capturas del original. El (x, y) de la tabla estática del exe (`hud-items-tabla.md`) es solo el valor inicial:
 * al elegir comando el exe lo cambia (p. ej. PIEDRA: tabla (−30,85), marine (81,19), boina verde (43,18), francotirador (82,75)); quién lo cambia no está leído.
 * shortcut: solo el estado con los comandos a pie (balsa, buceo y demás contextos cambian qué ítems se ven); del zapador (ARTIFIC) solo MANO, PISTOLA y PIEDRA salen de una captura (±2 px); CEPO, CARTUCHO, ACTIVADOR y CONTROLA son los offsets de memoria de otro comando y su flag de oculto no se leyó con el zapador.
 */
export const BAG_POS: Readonly<Record<string, Readonly<Record<string, { readonly sprite: string; readonly x: number; readonly y: number }>>>> = {
  COMANDO: {
    CUCHILLO: { sprite: 'MACHETE.RLE', x: -9, y: 1 },
    MANO: { sprite: 'MANO.RLE', x: 49, y: -67 },
    PUNO: { sprite: 'PUNO.RLE', x: 69, y: 14 },
    PISTOLA: { sprite: 'PISTOLA.RLE', x: 59, y: 45 },
    PIEDRA: { sprite: 'PIEDRA.RLE', x: 43, y: 18 },
    SENUELO: { sprite: 'SENUEL.RLE', x: 63, y: 66 },
    ESPOSAS: { sprite: 'ESPOSAS.RLE', x: 24, y: 91 },
    CONTROLA: { sprite: 'CONTROLA.RLE', x: -20, y: 79 },
  },
  LANCHERO: {
    CUCHILLO: { sprite: 'MACHETE.RLE', x: -9, y: 1 },
    MANO: { sprite: 'MANO.RLE', x: 49, y: -67 },
    PISTOLA: { sprite: 'PISTOLA.RLE', x: 59, y: 46 },
    PIEDRA: { sprite: 'PIEDRA.RLE', x: 81, y: 19 },
    ARPON: { sprite: 'ARPON.RLE', x: 67, y: 5 },
    TRAJEBU: { sprite: 'BOMBONA.RLE', x: 56, y: 86 },
    CONTROLA: { sprite: 'CONTROLA.RLE', x: -26, y: 79 },
  },
  FRANCOT: {
    MANO: { sprite: 'MANO.RLE', x: 49, y: -67 },
    PISTOLA: { sprite: 'PISTOLA.RLE', x: 59, y: 46 },
    PIEDRA: { sprite: 'PIEDRA.RLE', x: 82, y: 75 },
    MIRILLA: { sprite: 'MIRATELE.RLE', x: 11, y: -1 },
    BOTIQUIN: { sprite: 'BOTIQUIN.RLE', x: 2, y: 34 },
    CONTROLA: { sprite: 'CONTROLA.RLE', x: -26, y: 79 },
  },
  ARTIFIC: {
    MANO: { sprite: 'MANO.RLE', x: 49, y: -67 },
    PISTOLA: { sprite: 'PISTOLA.RLE', x: 59, y: 46 },
    PIEDRA: { sprite: 'PIEDRA.RLE', x: 55, y: 8 },
    CEPO: { sprite: 'CEPO.RLE', x: -16, y: -14 },
    CARTUCHO: { sprite: 'CARTUCH2.RLE', x: -15, y: 32 },
    ACTIVADO: { sprite: 'DETONADO.RLE', x: -8, y: 79 },
    CONTROLA: { sprite: 'CONTROLA.RLE', x: -26, y: 79 },
  },
};

export interface BagItem {
  /** Archivo de `OPCIONES/` y sprite con el dibujo. */
  readonly wad: string;
  readonly sprite: string;
  readonly x: number;
  readonly y: number;
}

/** Ítems que se dibujan en la mochila de cada comando (disponibles, con archivo y con posición medida), por token de comando. */
export function bagItems(iface: ReadonlyMap<string, HudCommando>): Map<string, BagItem[]> {
  const out = new Map<string, BagItem[]>();
  for (const [token, c] of iface) {
    const pos = BAG_POS[token] ?? {};
    out.set(token, c.items.flatMap((i) => {
      const wad = ITEM_WAD[i.token];
      const at = wad === undefined ? undefined : pos[wad];
      return i.available && wad !== undefined && at ? [{ wad, sprite: at.sprite, x: at.x, y: at.y }] : [];
    }));
  }
  return out;
}
