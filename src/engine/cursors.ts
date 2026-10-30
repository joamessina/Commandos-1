/**
 * Cursor del mouse según lo que tiene en la mano el comando elegido. Los sprites salen de `GLOBAL/CURSORES.WAD`; la tabla nombre→sprite se leyó del exe
 * (init estático 0x786E60.., ctor `FUN_0069EFB0(nombre, id, …, sprites)`): `CUR_PISTOLA` (id 28) = `C_PIPA`, `CUR_CUCHILLO` (1) = `C_FACA`, `CUR_MIRA` (24) = `C_MIRA2`,
 * `CUR_GOLPEA` (62) = `C_PGOLPE` y `CUR_GOLPEA_ACT` (63) = `C_GOLPE` (sobre un blanco válido), `CUR_ESPOSAS` (53) = `C_ESPOS`, `CUR_PIEDRA` (51) = `C_PIEDRA`,
 * `CUR_EXPLOSIVO` (10) = `C_PETA`, `CUR_ARROW` (20) = `C_FLECHA`. Los nombres `CUR_N*` (id impar, "no aplicable") van con `C_N*`.
 * shortcut: el punto caliente (hotspot) no se leyó (es un argumento del ctor que no se pudo interpretar): las armas usan el centro del sprite y la flecha la esquina sup. izq.;
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
  MIRILLA: { idle: 'C_MIRA2.RLE', target: 'C_MIRA2.RLE' },
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
