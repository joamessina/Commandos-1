/**
 * Cursor del mouse según lo que tiene en la mano el comando elegido. Los sprites salen de `GLOBAL/CURSORES.WAD`; la tabla nombre→sprite se leyó del exe
 * (init estático 0x786E60.., ctor `FUN_0069EFB0(nombre, id, …, sprites)`): `CUR_PISTOLA` (id 28) = `C_PIPA`, `CUR_CUCHILLO` (1) = `C_FACA`, `CUR_MIRA` (24) = `C_MIRA2` (no se usa: la mirilla del francotirador usa la retícula `C_MIRILL`),
 * `CUR_GOLPEA` (62) = `C_PGOLPE` y `CUR_GOLPEA_ACT` (63) = `C_GOLPE` (sobre un blanco válido), `CUR_ESPOSAS` (53) = `C_ESPOS`, `CUR_PIEDRA` (51) = `C_PIEDRA`,
 * `CUR_EXPLOSIVO` (10) = `C_PETA`, `CUR_ARROW` (20) = `C_FLECHA`. Los nombres `CUR_N*` (id impar, "no aplicable") van con `C_N*`.
 * shortcut: los puntos calientes restantes usan centro o esquina; esposas y golpe aún no se animan. Cuándo mejorar: portar las demás entradas de la tabla 0x87CA38.
 */
import type { Weapon } from './attack.ts';

export interface CursorSpec {
  /** Nombre del sprite en `CURSORES.WAD`. */
  readonly sprite: string;
  /** Punto caliente: el centro del sprite o su esquina sup. izq. */
  readonly hot: 'center' | 'topleft';
  readonly x?: number;
  readonly y?: number;
}

export const ARROW: CursorSpec = { sprite: 'C_FLECHA.RLE', hot: 'topleft' };

/** Lo que el cursor puede llevar: un arma o un ítem que se usa sobre un blanco (cajetilla, botiquín, control alemán). */
export type CursorMode = Weapon | 'TABACO' | 'BOTIQUIN' | 'CONTROL' | 'OJO' | 'MANO';

const WEAPON_CURSOR: Readonly<Record<CursorMode, { readonly idle: string; readonly target: string }>> = {
  // shortcut: BOTIQUIN y CONTROL todavía no alternan sus variantes; mejorar al portar sus condiciones de aplicabilidad.
  ARPON: { idle: 'C_MIRA1.RLE', target: 'C_MIRA1.RLE' },
  OJO: { idle: 'C_OJO1.RLE', target: 'C_OJO1.RLE' },
  MANO: { idle: 'C_MANO1.RLE', target: 'C_MANO1.RLE' },
  TABACO: { idle: 'C_TABACO.RLE', target: 'C_TABACO.RLE' },
  BOTIQUIN: { idle: 'C_MEDIC.RLE', target: 'C_MEDIC.RLE' },
  CONTROL: { idle: 'C_GORRA1.RLE', target: 'C_GORRA1.RLE' },
  PISTOLA: { idle: 'C_PIPA.RLE', target: 'C_PIPA.RLE' },
  // la retícula del francotirador: `C_MIRILL.RLE` (95×95 de `OPCIONES/MIRILLA.WAD`), que el exe carga con el motor (`FUN_005BFE20`) con el punto caliente en (47, 47) = el centro
  MIRILLA: { idle: 'C_MIRILL.RLE', target: 'C_MIRILL.RLE' },
  CUCHILLO: { idle: 'C_FACA.RLE', target: 'C_FACA.RLE' },
  PUNO: { idle: 'C_PGOLPE.RLE', target: 'C_GOLPE.RLE' },
  ESPOSAS: { idle: 'C_ESPOS.RLE', target: 'C_ESPOS.RLE' },
  PIEDRA: { idle: 'C_PIEDRA.RLE', target: 'C_PIEDRA.RLE' },
};

/** Cursor para el arma elegida (`mode`), el modo de plantar una bomba o, sin nada, la flecha; `overTarget` = el cursor está sobre un blanco válido. */
export function cursorFor(mode: CursorMode | null, planting: boolean, overTarget: boolean, tick = 0): CursorSpec {
  if (planting) return { sprite: 'C_PETA.RLE', hot: 'center' };
  if (!mode) return ARROW;
  if (mode === 'MANO') {
    const first = Math.floor(tick / 2) % 2 === 0;
    return { sprite: first ? 'C_MANO1.RLE' : 'C_MANO2.RLE', hot: 'topleft', x: 0, y: first ? 11 : 9 };
  }
  if (mode === 'OJO') return { sprite: overTarget && Math.floor(tick / 2) % 2 !== 0 ? 'C_OJO2.RLE' : 'C_OJO1.RLE', hot: 'topleft', x: 0, y: 10 };
  if (mode === 'ARPON') return overTarget ? { sprite: 'C_MIRA1.RLE', hot: 'center', x: 8, y: 8 } : { sprite: 'C_NMIRA1.RLE', hot: 'center', x: 16, y: 16 };
  const c = WEAPON_CURSOR[mode];
  return { sprite: overTarget ? c.target : c.idle, hot: 'center' };
}
