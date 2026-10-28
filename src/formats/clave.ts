/**
 * Lenguaje `.CLAVE [ … ]` de MIS, MAC, DAT y cfg. Gramática leída en el exe (docs/engine/sonido-parsers.md §2,
 * preproceso 0x60A6D0, tokens 0x60AD60) y verificada: 117/117 archivos parsean con corchetes balanceados.
 *  - se corta en 0x1A; `#` abre comentario hasta fin de línea; NO hay comillas ni `;` como comentario
 *  - tokens separados por blancos; `[` y `]` solo cuentan si son un token suelto
 *  - las claves empiezan con `.` y se buscan sin distinguir mayúsculas
 * El exe es tolerante con `]` sobrantes o `[` sin cerrar; este lector los rechaza (entrada no confiable).
 */

/** Átomo (texto) o lista entre corchetes. */
export type Node = string | Node[];

export class ClaveError extends Error {}

const MAX_DEPTH = 64;
const MAX_TOKENS = 5_000_000;

export function parseClave(text: string): Node[] {
  const cut = text.indexOf('\x1a');
  const src = (cut >= 0 ? text.slice(0, cut) : text).replace(/#[^\r\n]*/g, ' ');
  const tokens = src.split(/\s+/).filter((t) => t !== '');
  if (tokens.length > MAX_TOKENS) throw new ClaveError('demasiados tokens');
  const root: Node[] = [];
  const stack: Node[][] = [root];
  for (const t of tokens) {
    const top = stack[stack.length - 1] as Node[];
    if (t === '[') {
      if (stack.length > MAX_DEPTH) throw new ClaveError('anidamiento excesivo');
      const child: Node[] = [];
      top.push(child);
      stack.push(child);
    } else if (t === ']') {
      if (stack.length === 1) throw new ClaveError('`]` sin abrir');
      stack.pop();
    } else top.push(t);
  }
  if (stack.length !== 1) throw new ClaveError('`[` sin cerrar');
  return root;
}

const same = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

/** Nodo que sigue a la clave `.KEY` entre los hijos directos de `list` (el primero). */
export function find(list: readonly Node[], key: string): Node | undefined {
  for (let i = 0; i + 1 < list.length; i++) {
    const n = list[i];
    if (typeof n === 'string' && same(n, key)) return list[i + 1];
  }
  return undefined;
}

/** Todos los nodos que siguen a cada aparición de `.KEY` entre los hijos directos. */
export function findAll(list: readonly Node[], key: string): Node[] {
  const out: Node[] = [];
  for (let i = 0; i + 1 < list.length; i++) {
    const n = list[i];
    if (typeof n === 'string' && same(n, key)) out.push(list[i + 1] as Node);
  }
  return out;
}

export const asList = (n: Node | undefined): Node[] | undefined => (Array.isArray(n) ? n : undefined);
export const asText = (n: Node | undefined): string | undefined => (typeof n === 'string' ? n : undefined);

export function asNumber(n: Node | undefined): number | undefined {
  if (typeof n !== 'string') return undefined;
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
}

/** Lista de números (p. ej. `.XYZ [ 1 2 3 ]`); undefined si algún elemento no lo es. */
export function asNumbers(n: Node | undefined): number[] | undefined {
  const l = asList(n);
  if (!l) return undefined;
  const out: number[] = [];
  for (const e of l) {
    const v = asNumber(e);
    if (v === undefined) return undefined;
    out.push(v);
  }
  return out;
}
