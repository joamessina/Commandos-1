/**
 * Cursor del mouse según lo que tiene en la mano el comando elegido. Los sprites salen de `GLOBAL/CURSORES.WAD`; la tabla nombre→sprite se leyó del exe
 * (init estático 0x786E60.., ctor `FUN_0069EFB0(nombre, id, …, sprites)`): `CUR_PISTOLA` (id 28) = `C_PIPA`, `CUR_CUCHILLO` (1) = `C_FACA`, `CUR_MIRA` (24) = `C_MIRA2` (no se usa: la mirilla del francotirador usa la retícula `C_MIRILL`),
 * `CUR_GOLPEA` (62) = `C_PGOLPE` y `CUR_GOLPEA_ACT` (63) = `C_GOLPE` (sobre un blanco válido), `CUR_ESPOSAS` (53) = `C_ESPOS`, `CUR_PIEDRA` (51) = `C_PIEDRA`,
 * `CUR_EXPLOSIVO` (10) = `C_PETA`, `CUR_ARROW` (20) = `C_FLECHA`. Los nombres `CUR_N*` (id impar, "no aplicable") van con `C_N*`.
 * shortcut: el punto caliente de los cursores de `CURSORES.WAD` no se leyó (los pares (x, y) del ctor valen 0 en la pistola y no se pudieron interpretar en los demás): las armas usan el centro del sprite y la flecha la esquina sup. izq. (la retícula sí tiene su (47, 47) en el exe);
 *           los cursores de dos cuadros (esposas, golpe) no se animan; la variante "no aplicable" (`C_N*`) no se usa todavía. Cuándo mejorar: al leer `FUN_0069EFB0` o mirar el original.
 */
import type { Weapon } from './attack.ts';

export interface CursorSpec {
  /** Nombre del sprite en `CURSORES.WAD`. */
  readonly sprite: string;
  /** Punto caliente: el centro del sprite o su esquina sup. izq. */
  readonly hot: 'center' | 'topleft';
}

export const ARROW: CursorSpec = { sprite: 'C_FLECHA.RLE', hot: 'topleft' };

const WEAPON_CURSOR: Readonly<Record<Weapon, { readonly idle: string; readonly target: string }>> = {
  PISTOLA: { idle: 'C_PIPA.RLE', target: 'C_PIPA.RLE' },
  // la retícula del francotirador: `C_MIRILL.RLE` (95×95 de `OPCIONES/MIRILLA.WAD`), que el exe carga con el motor (`FUN_005BFE20`) con el punto caliente en (47, 47) = el centro
  MIRILLA: { idle: 'C_MIRILL.RLE', target: 'C_MIRILL.RLE' },
  CUCHILLO: { idle: 'C_FACA.RLE', target: 'C_FACA.RLE' },
  PUNO: { idle: 'C_PGOLPE.RLE', target: 'C_GOLPE.RLE' },
  ESPOSAS: { idle: 'C_ESPOS.RLE', target: 'C_ESPOS.RLE' },
  PIEDRA: { idle: 'C_PIEDRA.RLE', target: 'C_PIEDRA.RLE' },
};

/** Cursor para el arma elegida (`mode`), el modo de plantar una bomba o, sin nada, la flecha; `overTarget` = el cursor está sobre un blanco válido. */
export function cursorFor(mode: Weapon | null, planting: boolean, overTarget: boolean): CursorSpec {
  if (planting) return { sprite: 'C_PETA.RLE', hot: 'center' };
  if (!mode) return ARROW;
  const c = WEAPON_CURSOR[mode];
  return { sprite: overTarget ? c.target : c.idle, hot: 'center' };
}
