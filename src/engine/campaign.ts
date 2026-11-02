/**
 * Campaña del juego: `MISIONES.DAT` (`.DATOSMISIONES [ .LISTA [ [ .FICHEROMISION MAPA0005.MIS .HTIT 3N05 ] … ] ]`) da las misiones en el orden en que se juegan,
 * que no es el del número de archivo (la segunda es MAPA0005, la del zoo); el título, fecha y lugar de cada una salen del `MBnn.STR` del mismo número (… `DATE JUL 14, 1940 PLAC GUERNSEY, ENGLAND TITL DYING LIGHT`).
 * Los mapas que no figuran en la lista (MAPA0008…) no son de la campaña.
 */
import { asList, asText, find, parseClave } from '../formats/clave.ts';

/** Números de mapa (`0005`) en el orden de `MISIONES.DAT`. */
export function parseCampaign(datText: string): string[] {
  const root = asList(find(parseClave(datText), '.DATOSMISIONES')) ?? [];
  const out: string[] = [];
  for (const n of asList(find(root, '.LISTA')) ?? []) {
    const file = asText(find(asList(n) ?? [], '.FICHEROMISION'));
    const m = file ? /^MAPA(\d{4})\.MIS$/i.exec(file) : null;
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

export interface MissionInfo {
  readonly date: string;
  readonly place: string;
  readonly title: string;
}

const capital = (s: string): string => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());

/** Fecha, lugar y título del `MBnn.STR` (en mayúsculas en el archivo; se devuelven con la inicial de cada palabra). null si no trae los tres. */
export function parseMissionInfo(strText: string): MissionInfo | null {
  const m = /DATE\s+(.+?)\s+PLAC\s+(.+?)\s+TITL\s+(.+?)\s*(?:\x1a.*)?$/s.exec(strText.replace(/\s+/g, ' '));
  return m?.[1] && m[2] && m[3] ? { date: capital(m[1]), place: capital(m[2]), title: capital(m[3]) } : null;
}

export interface MissionFiles {
  readonly vol: string | undefined;
  readonly sec: string | undefined;
  /** `FASEnnnn` (sin extensión): banco de gráficos del mapa. */
  readonly wad: string | undefined;
}

/**
 * Archivos de mapa de una misión (`.MISSION [ .DATOSFICHEROSMISION [ .VOLUMENES … .SECTORES … .WADMAP … ] ]`). No siempre son los del número de la misión: MAPA0009 usa los de la 4 (de noche),
 * MAPA0010 y los siete tutoriales los de MAPA0008 (los tutoriales 1 a 6 con `TUT.SEC`), MAPF0001 los de la 1.
 */
export function parseMissionFiles(misText: string): MissionFiles {
  const mission = asList(find(parseClave(misText), '.MISSION')) ?? [];
  const files = asList(find(mission, '.DATOSFICHEROSMISION')) ?? [];
  const wad = asText(find(files, '.WADMAP'));
  return { vol: asText(find(files, '.VOLUMENES')), sec: asText(find(files, '.SECTORES')), wad: wad?.replace(/\.WAD$/i, '').toUpperCase() };
}

/** Misiones jugables que trae el contenedor, por nombre de archivo sin extensión (`MAPA0005`, `MAPF0001`, `TUT03`), ordenadas. */
export function missionNames(paths: Iterable<string>): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const m = /^DATOS\/MISIONES\/((?:MAPA|MAPF)\d{4}|TUT\d{2})\.MIS$/i.exec(p);
    if (m?.[1]) out.push(m[1].toUpperCase());
  }
  return out.sort();
}
