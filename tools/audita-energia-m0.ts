// Energía (.ENEGIA) de cada macro instanciada en MAPA0000 y de las instancias que la pisan; solo imprime texto de configuración.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
const leer = (nombre: string): Node[] | undefined => {
  const e = entradas.filter((x) => x.path.toUpperCase().endsWith('/' + nombre));
  if (e.length !== 1 || !e[0]) return undefined;
  return parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, e[0])));
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
const mis = leer('MAPA0000.MIS');
if (!mis) throw new Error('MAPA0000.MIS');
const elementos = asList(buscar(mis, '.ELEMENTOS')) ?? [];
const porMacro = new Map<string, { n: number; pisan: string[] }>();
for (const e of elementos) {
  if (!Array.isArray(e)) continue;
  const macro = find(e, '.MACRO');
  const clave = typeof macro === 'string' ? macro.toUpperCase() : '(sin macro)';
  const reg = porMacro.get(clave) ?? { n: 0, pisan: [] };
  reg.n++;
  const energia = find(e, '.ENEGIA');
  if (energia !== undefined) reg.pisan.push(JSON.stringify(energia));
  porMacro.set(clave, reg);
}
for (const [macro, { n, pisan }] of [...porMacro].sort()) {
  const mac = leer(`${macro}.MAC`);
  const base = mac ? find(mac, '.ENEGIA') ?? buscar(mac, '.ENEGIA') : undefined;
  console.log(macro.padEnd(10), 'instancias', String(n).padStart(3), 'MAC.ENEGIA', base === undefined ? '-' : JSON.stringify(base), 'MIS.ENEGIA', pisan.length ? pisan.join(',') : '-');
}
