// Lista acciones y parámetros de los aliados declarados en MAPA0000.MIS, sin extraer archivos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos).filter((e) => e.path.toUpperCase().endsWith('/MAPA0000.MIS'));
if (entradas.length !== 1 || !entradas[0]) throw new Error('Se esperaba un solo MAPA0000.MIS');
const raiz = parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, entradas[0])));
const guardias = new Map<string, number>();
const macrosUsadas = new Set<string>();
let minas = 0;
let minasConPeso = 0;
function recorrer(nodos: readonly Node[], contexto: readonly string[] = []): void {
  for (let indice = 0; indice < nodos.length; indice++) {
    const nodo = nodos[indice];
    if (typeof nodo === 'string' && /^\.(?:TIPOPOLYSEL|ALAM\w*)$/i.test(nodo)) {
      console.log('ALAMBRADA_CLAVE', nodo, JSON.stringify(nodos[indice + 1]));
    }
  }
  const token = find(nodos, '.TOKEN');
  const actual = typeof token === 'string' ? [...contexto, token] : contexto;
  const macro = find(nodos, '.MACRO');
  if (typeof macro === 'string') macrosUsadas.add(macro.toUpperCase());
  if (typeof macro === 'string' && /^(BAP1|BAP2|BANPE1|BANPE2)$/i.test(macro)) {
    const nombre = macro.toUpperCase();
    guardias.set(nombre, (guardias.get(nombre) ?? 0) + 1);
  }
  if (typeof macro === 'string' && macro.toUpperCase() === 'ESCALA') {
    console.log('ESCALA', find(nodos, '.TOKEN'), JSON.stringify(nodos));
  }
  if (typeof macro === 'string' && macro.toUpperCase() === 'MINASUB') {
    minas++;
    if (find(nodos, '.PESOACT') !== undefined) minasConPeso++;
    console.log('MINA', token, 'XYZ', JSON.stringify(find(nodos, '.XYZ')), 'LISTAS', JSON.stringify(find(nodos, '.LISTAS')));
  }
  if (typeof macro === 'string' && macro.toUpperCase() === 'ZODIAC5') {
    console.log('ZODIAC5_INSTANCIA', 'LISTAS', JSON.stringify(find(nodos, '.LISTAS')));
  }
  if (String(find(nodos, '.CLASS')).toUpperCase() === 'BICHOALIADO') {
    console.log('ALIADO', token, 'CONTEXTO', actual.join(' > '), 'XYZ', JSON.stringify(find(nodos, '.XYZ')), 'MASA', find(nodos, '.MASA'), 'LISTAS', JSON.stringify(find(nodos, '.LISTAS')), 'VOLCOLISION', JSON.stringify(find(nodos, '.VOLCOLISION')));
    for (const accion of asList(find(nodos, '.ACCIONES')) ?? []) console.log('  ACCION', JSON.stringify(accion));
  }
  for (const nodo of nodos) if (Array.isArray(nodo)) recorrer(nodo, actual);
}
recorrer(raiz);
console.log('GUARDIAS EN TODA LA ESTRUCTURA', Object.fromEntries(guardias));
console.log('MINASUB', minas, 'CON_PESOACT', minasConPeso);
const macroMina = parseContainer(datos).find((e) => e.path.toUpperCase().endsWith('/MINASUB.MAC'));
if (!macroMina) throw new Error('Falta MINASUB.MAC');
console.log('MINASUB_MAC_DECLARA_PESOACT', /\.PESOACT\b/i.test(new TextDecoder('windows-1252').decode(entryBytes(datos, macroMina))));
for (const nombre of ['MINASUB.MAC', 'ZODIAC5.MAC', 'BOMBAACT.MAC']) {
  const entrada = parseContainer(datos).find((e) => e.path.toUpperCase().endsWith('/' + nombre));
  if (!entrada) throw new Error(`Falta ${nombre}`);
  const nodos = parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, entrada)));
  console.log(nombre, 'MASA', find(nodos, '.MASA'), 'VOLCOLISION', JSON.stringify(find(nodos, '.VOLCOLISION')),
    'LISTAS', JSON.stringify(find(nodos, '.LISTAS')), 'MOTOR', JSON.stringify(find(nodos, '.MOTOR')));
  if (nombre === 'ZODIAC5.MAC') console.log('ZODIAC5_ACCIONES', JSON.stringify(find(nodos, '.ACCIONES')));
  if (nombre === 'BOMBAACT.MAC') console.log('BOMBAACT_ORGANOS', JSON.stringify(find(nodos, '.ORGANOS')));
}
console.log('MACROS_DIRECTAS_AUDITADAS', macrosUsadas.size);
for (const nombre of macrosUsadas) {
  const entrada = parseContainer(datos).find((e) => e.path.toUpperCase().endsWith('/' + nombre + '.MAC'));
  if (!entrada) { console.log('MACRO_NO_LOCALIZADA', nombre); continue; }
  const texto = new TextDecoder('windows-1252').decode(entryBytes(datos, entrada));
  const coincidencias = [...texto.matchAll(/\.(?:TIPOPOLYSEL|ALAM\w*)\b|\bAuAlicate\b/gi)].map((m) => m[0]);
  if (coincidencias.length > 0) console.log('ALAMBRADA_MACRO', nombre, JSON.stringify(coincidencias));
}
