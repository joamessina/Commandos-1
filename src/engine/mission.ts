/**
 * Lectura mínima de una misión (.MIS): los comandos aliados de `.ELEMENTOS`. Claves leídas en docs/engine/sonido-parsers.md §2.1
 * (CLASS BICHOALIADO, TOKEN, XYZ, ANGULO, GRAPH .ANIM). El resto de los elementos (82 macros en la misión 0) no se instancia todavía.
 */
import { asList, asNumber, asNumbers, asText, find, parseClave, type Node } from '../formats/clave.ts';

export interface AllyDef {
  readonly token: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  /** Nombre del ANM (`.GRAPH [ .ANIM X ]`); si no figura, el del token. */
  readonly anim: string;
}

const MAX_NEST = 8;

/** Recorre `.ELEMENTOS`, incluidos los anidados: en la misión 0 los 4 aliados están dentro de otro elemento (el nº 24). */
function collect(elements: readonly Node[], out: AllyDef[], depth: number): void {
  if (depth > MAX_NEST) return;
  for (const e of elements) {
    const el = asList(e);
    if (!el) continue;
    if (asText(find(el, '.CLASS'))?.toUpperCase() === 'BICHOALIADO') {
      const token = asText(find(el, '.TOKEN'));
      const xyz = asNumbers(find(el, '.XYZ'));
      if (token && xyz?.length === 3) {
        // un aliado sin XYZ no está en el mapa al empezar
        const graph = asList(find(el, '.GRAPH'));
        out.push({ token, x: xyz[0] ?? 0, y: xyz[1] ?? 0, z: xyz[2] ?? 0, angle: asNumber(find(el, '.ANGULO')) ?? 0, anim: asText(find(graph ?? [], '.ANIM')) ?? token });
      }
    }
    collect(asList(find(el, '.ELEMENTOS')) ?? [], out, depth + 1);
  }
}

export function loadAllies(misText: string): AllyDef[] {
  const mission = asList(find(parseClave(misText), '.MISSION'));
  const out: AllyDef[] = [];
  collect(asList(find(mission ?? [], '.ELEMENTOS')) ?? [], out, 0);
  return out;
}
