// Cruce de instancias de guardias y plantillas desde el DIR raíz; solo imprime texto de configuración.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
const leer = (nombre: string): Node[] => {
  const encontrados = entradas.filter((e) => e.path.toUpperCase().endsWith('/' + nombre));
  if (encontrados.length !== 1 || !encontrados[0]) throw new Error(`${nombre}: ${encontrados.length.toString()} coincidencias`);
  return parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, encontrados[0])));
};
const buscar = (nodos: readonly Node[], clave: string): Node | undefined => {
  const directo = find(nodos, clave);
  if (directo !== undefined) return directo;
  for (const n of nodos) if (Array.isArray(n)) {
    const valor = buscar(n, clave);
    if (valor !== undefined) return valor;
  }
  return undefined;
};
const resumen = (n: Node | undefined): string => n === undefined ? '-' : JSON.stringify(n);
for (const macro of ['BAP1', 'BAP2', 'BANPE1', 'BANPE2']) {
  const base = leer(`${macro}.MAC`);
  console.log('MAC_COMPLETA', macro, resumen(base));
  console.log('MAC', macro, 'ACCIONES', resumen(buscar(base, '.ACCIONES')), 'ORGANOS', resumen(buscar(base, '.ORGANOS')));
}
const elementos = asList(buscar(leer('MAPA0000.MIS'), '.ELEMENTOS')) ?? [];
let total = 0;
const niveles = new Map<string, number>();
const clases = new Map<string, number>();
let conPatrulla = 0;
for (const nodo of elementos) {
  if (!Array.isArray(nodo)) continue;
  const macro = find(nodo, '.MACRO');
  if (typeof macro !== 'string' || !/^(BAP1|BAP2|BANPE1|BANPE2)$/i.test(macro)) continue;
  const campos: string[] = [];
  for (let i = 0; i + 1 < nodo.length; i += 2) {
    const clave = nodo[i];
    if (typeof clave === 'string' && !['.CLASS', '.MACRO', '.TOKEN', '.XYZ', '.ANGULO', '.GRAFICO'].includes(clave.toUpperCase())) campos.push(`${clave}=${resumen(nodo[i + 1])}`);
  }
  console.log('INSTANCIA', resumen(find(nodo, '.TOKEN')), macro, campos.join(' '));
  const nivel = find(nodo, '.NIVEL');
  const etiqueta = typeof nivel === 'string' ? nivel.toUpperCase() : '(sin declarar)';
  niveles.set(etiqueta, (niveles.get(etiqueta) ?? 0) + 1);
  clases.set(macro.toUpperCase(), (clases.get(macro.toUpperCase()) ?? 0) + 1);
  if (find(nodo, '.ACPATRULLA') !== undefined) conPatrulla++;
  total++;
}
console.log('TOTAL', total, 'CLASES', Object.fromEntries(clases), 'NIVELES', Object.fromEntries(niveles), 'CON_PATRULLA', conPatrulla);
