// Cruza las claves OCLU y FLAGS de las instancias de M0 con sus macros originales.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { find, parseClave, type Node } from '../src/formats/clave.ts';
import { flatten, loadWorld } from '../src/engine/world.ts';

const bytes = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entries = parseContainer(bytes);
const decoder = new TextDecoder('windows-1252');
function leer(nombre: string): Node[] | null {
  const e = entries.find((entry) => entry.path.toUpperCase().endsWith('/' + nombre));
  return e ? parseClave(decoder.decode(entryBytes(bytes, e))) : null;
}
const mision = leer('MAPA0000.MIS');
if (!mision) throw new Error('Falta MAPA0000.MIS');
const macros = new Map<string, number>();
function recorrer(nodos: readonly Node[]): void {
  const nombre = find(nodos, '.MACRO');
  if (typeof nombre === 'string') macros.set(nombre.toUpperCase(), (macros.get(nombre.toUpperCase()) ?? 0) + 1);
  const oclu = find(nodos, '.OCLU');
  const flags = find(nodos, '.FLAGS');
  if (oclu !== undefined || flags !== undefined) console.log('INSTANCIA', find(nodos, '.TOKEN'), 'MACRO', nombre, 'OCLU', oclu, 'FLAGS', JSON.stringify(flags));
  for (const nodo of nodos) if (Array.isArray(nodo)) recorrer(nodo);
}
recorrer(mision);
for (const [nombre, cantidad] of [...macros].sort(([a], [b]) => a.localeCompare(b))) {
  const macro = leer(nombre + '.MAC');
  if (!macro) { console.log('MACRO_NO_LOCALIZADA', nombre, cantidad); continue; }
  const oclu = find(macro, '.OCLU');
  const flags = find(macro, '.FLAGS');
  if (oclu !== undefined || flags !== undefined) console.log('MACRO', nombre, cantidad, 'OCLU', oclu, 'FLAGS', JSON.stringify(flags));
}

const misionTexto = (() => {
  const entry = entries.find((item) => item.path.toUpperCase().endsWith('/MAPA0000.MIS'));
  if (!entry) throw new Error('Falta MAPA0000.MIS');
  return decoder.decode(entryBytes(bytes, entry));
})();
for (const dificultad of ['FACIL', 'DIFICIL'] as const) {
  const elementos = flatten(loadWorld(misionTexto, { difficulty: dificultad, macro: (nombre) => {
    const entry = entries.find((item) => item.path.toUpperCase().endsWith('/' + nombre.toUpperCase() + '.MAC'));
    return entry ? decoder.decode(entryBytes(bytes, entry)) : undefined;
  } }));
  const grupos = new Map<string, string[]>();
  for (const elemento of elementos) {
    const oclu = find(elemento.block, '.OCLU');
    const flags = find(elemento.block, '.FLAGS');
    const clave = `${elemento.cls}/${elemento.macro ?? '-'} OCLU=${JSON.stringify(oclu ?? null)} FLAGS=${JSON.stringify(flags ?? null)}`;
    const tokens = grupos.get(clave) ?? [];
    tokens.push(elemento.token);
    grupos.set(clave, tokens);
  }
  console.log('EXPANSION_PORT', dificultad, 'TOTAL', elementos.length);
  for (const [clave, tokens] of [...grupos].sort(([a], [b]) => a.localeCompare(b))) {
    console.log('GRUPO', clave, 'CANTIDAD', tokens.length, 'EJEMPLOS', tokens.slice(0, 5).join(','));
  }
  for (const elemento of elementos.filter((item) => find(item.block, '.OCLU') === '1')) {
    console.log('OCLU_ACTIVO_EN_BLOQUE', elemento.token, 'XYZ', elemento.x, elemento.y, elemento.z,
      'LISTAS', JSON.stringify(find(elemento.block, '.LISTAS')),
      'VOLCOLISION', JSON.stringify(find(elemento.block, '.VOLCOLISION')));
  }
}
