// Lista acciones y parámetros de los aliados declarados en MAPA0000.MIS, sin extraer archivos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos).filter((e) => e.path.toUpperCase().endsWith('/MAPA0000.MIS'));
if (entradas.length !== 1 || !entradas[0]) throw new Error('Se esperaba un solo MAPA0000.MIS');
const raiz = parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, entradas[0])));
const guardias = new Map<string, number>();
function recorrer(nodos: readonly Node[]): void {
  const macro = find(nodos, '.MACRO');
  if (typeof macro === 'string' && /^(BAP1|BAP2|BANPE1|BANPE2)$/i.test(macro)) {
    const nombre = macro.toUpperCase();
    guardias.set(nombre, (guardias.get(nombre) ?? 0) + 1);
  }
  if (String(find(nodos, '.CLASS')).toUpperCase() === 'BICHOALIADO') {
    console.log('ALIADO', find(nodos, '.TOKEN'), 'XYZ', JSON.stringify(find(nodos, '.XYZ')));
    for (const accion of asList(find(nodos, '.ACCIONES')) ?? []) console.log('  ACCION', JSON.stringify(accion));
  }
  for (const nodo of nodos) if (Array.isArray(nodo)) recorrer(nodo);
}
recorrer(raiz);
console.log('GUARDIAS EN TODA LA ESTRUCTURA', Object.fromEntries(guardias));
