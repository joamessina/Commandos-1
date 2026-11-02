/**
 * Mundo de una misión: `.ELEMENTOS` del MIS con las macros `.MAC` expandidas. Reglas leídas en el exe
 * (docs/engine/sonido-parsers.md §2.1, docs/lectura/mision-intendencia.md §1):
 *  - `.CLASS MACRO` + `.MACRO X` carga `X.MAC`; las claves de la instancia son las variables `$Nombre` del MAC
 *    (sin distinguir mayúsculas; el default sale de `.VARIABLES [ EAngulo.180 … ]`: letra de tipo + nombre + `.default`).
 *  - `.NIVEL FACIL|DIFICIL|TODOS`: el elemento se crea si es TODOS/ausente o coincide con la dificultad.
 *  - `.ELEMENTOS` anidados se cargan recursivamente (los comandos de la misión 0 están dentro del Zodiac).
 * shortcut: la sustitución de `$Var` se hace sobre el árbol ya parseado (el exe la hace sobre los tokens); si la variable vale una lista
 *           en posición de nombre de acción (`[ $AcPatrulla [ .CARISMA 200 ] ]`), se toma nombre = lista[0] y parámetros = lista[1] + los del MAC.
 */
import { asList, asNumber, asNumbers, asText, find, parseClave, type Node } from '../formats/clave.ts';

export type Difficulty = 'FACIL' | 'DIFICIL';

export interface ActionDef {
  readonly name: string;
  readonly params: readonly Node[];
}

export interface Elem {
  readonly token: string;
  readonly cls: string;
  readonly macro: string | null;
  readonly bando: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  /** `.GRAPH [ .ANIM X ]` (ya sustituido). */
  readonly anim: string | null;
  readonly actions: readonly ActionDef[];
  /** Cilindro de colisión `.VOLCOLISION [ CILINDRO [ .R .H ] ]`. */
  readonly radius: number;
  readonly height: number;
  /** Bloque expandido (macro + instancia) para consultar claves sueltas con `get`. */
  readonly block: readonly Node[];
  readonly children: Elem[];
  parent: Elem | null;
}

const MAX_DEPTH = 8;

/** Variables de un MAC: nombre en mayúsculas -> default (`.VARIABLES [ EAngulo.180 CVolumen … ]`). */
function macroDefaults(mac: readonly Node[]): Map<string, Node> {
  const vars = new Map<string, Node>();
  for (const t of asList(find(mac, '.VARIABLES')) ?? []) {
    if (typeof t !== 'string' || t.length < 2) continue;
    const dot = t.indexOf('.', 1);
    const name = (dot < 0 ? t.slice(1) : t.slice(1, dot)).toUpperCase();
    vars.set(name, dot < 0 ? '' : t.slice(dot + 1));
  }
  return vars;
}

function subst(n: Node, vars: ReadonlyMap<string, Node>): Node {
  if (typeof n === 'string') return n.startsWith('$') ? (vars.get(n.slice(1).toUpperCase()) ?? '') : n;
  return n.map((c) => subst(c, vars));
}

/** Claves `.X v` de la instancia que cuentan como variables (todas, sin las estructurales). */
function instanceVars(inst: readonly Node[]): Map<string, Node> {
  const vars = new Map<string, Node>();
  for (let i = 0; i + 1 < inst.length; i++) {
    const k = inst[i];
    if (typeof k === 'string' && k.startsWith('.')) vars.set(k.slice(1).toUpperCase(), inst[i + 1] as Node);
  }
  return vars;
}

/** Valor de `.KEY` en el bloque expandido: primero el macro (ya sustituido), después la instancia. */
export function get(block: readonly Node[], key: string): Node | undefined {
  return find(block, key);
}

function actionsOf(block: readonly Node[]): ActionDef[] {
  const out: ActionDef[] = [];
  for (const e of asList(find(block, '.ACCIONES')) ?? []) {
    const entry = asList(e);
    if (!entry) continue;
    const head = entry[0];
    const tail = asList(entry[1]) ?? [];
    if (typeof head === 'string') {
      if (head !== '') out.push({ name: head, params: tail });
    } else if (Array.isArray(head) && typeof head[0] === 'string' && head[0] !== '') {
      out.push({ name: head[0], params: [...(asList(head[1]) ?? []), ...tail] });
    }
  }
  return out;
}

export interface WorldOpts {
  readonly difficulty: Difficulty;
  /** Texto del `X.MAC`, o undefined si no existe. */
  readonly macro: (name: string) => string | undefined;
}

function build(inst: readonly Node[], opts: WorldOpts, depth: number, parent: Elem | null, out: Elem[]): void {
  const nivel = asText(find(inst, '.NIVEL'))?.toUpperCase();
  if (nivel === 'FACIL' || nivel === 'DIFICIL') if (nivel !== opts.difficulty) return;
  const cls = asText(find(inst, '.CLASS'))?.toUpperCase() ?? '';
  let block: Node[] = [...inst];
  let macroChildren: readonly Node[] = [];
  let macro: string | null = null;
  let macroClass = cls;
  if (cls === 'MACRO') {
    macro = asText(find(inst, '.MACRO')) ?? null;
    const text = macro ? opts.macro(macro) : undefined;
    if (text === undefined) return; // sin .MAC el exe no crea el bicho
    const mac = parseClave(text);
    const vars = macroDefaults(mac);
    for (const [k, v] of instanceVars(inst)) vars.set(k, v);
    const expanded = subst(mac, vars) as Node[];
    macroChildren = asList(find(expanded, '.ELEMENTOS')) ?? [];
    macroClass = asText(find(expanded, '.CLASS'))?.toUpperCase() ?? 'BICHO';
    block = [...expanded, ...inst];
  }
  const xyz = asNumbers(find(inst, '.XYZ')) ?? asNumbers(find(block, '.XYZ'));
  const cyl = asList(find(asList(find(block, '.VOLCOLISION')) ?? [], 'CILINDRO'));
  const el: Elem = {
    token: asText(find(inst, '.TOKEN')) ?? macro ?? '',
    cls: macroClass,
    macro,
    bando: (asText(find(block, '.BANDO')) ?? '').toUpperCase(),
    x: xyz?.[0] ?? 0,
    y: xyz?.[1] ?? 0,
    z: xyz?.[2] ?? 0,
    angle: asNumber(find(block, '.ANGULO')) ?? 0,
    anim: asText(find(asList(find(block, '.GRAPH')) ?? [], '.ANIM')) ?? null,
    actions: actionsOf(block),
    radius: asNumber(find(cyl ?? [], '.R')) ?? 0,
    height: asNumber(find(cyl ?? [], '.H')) ?? 0,
    block,
    children: [],
    parent,
  };
  (parent ? parent.children : out).push(el);
  if (depth < MAX_DEPTH) for (const c of [...macroChildren, ...(asList(find(inst, '.ELEMENTOS')) ?? [])]) if (Array.isArray(c)) build(c, opts, depth + 1, el, out);
}

/** Elementos de nivel superior de `.MISSION .ELEMENTOS` (con sus hijos anidados). */
export function loadWorld(misText: string, opts: WorldOpts): Elem[] {
  const mission = asList(find(parseClave(misText), '.MISSION'));
  const out: Elem[] = [];
  for (const e of asList(find(mission ?? [], '.ELEMENTOS')) ?? []) if (Array.isArray(e)) build(e, opts, 0, null, out);
  return out;
}

/** Aplana la jerarquía (padre antes que hijos). */
export function flatten(elems: readonly Elem[]): Elem[] {
  const out: Elem[] = [];
  const walk = (e: Elem): void => {
    out.push(e);
    e.children.forEach(walk);
  };
  elems.forEach(walk);
  return out;
}
