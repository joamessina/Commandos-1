// Contrasta las claves investigadas con MIS/MAC del WAR_MP.DIR de raíz, sin extraer assets.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseClave, type Node } from '../src/formats/clave.ts';

const ruta = 'D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR';
const datos = new Uint8Array(readFileSync(ruta));
const entradas = parseContainer(datos).filter((e) => /\.(MIS|MAC)$/i.test(e.path));
const claves = new Set([
  'HABILIDAD', 'VEHICULOS', 'TIPOVEH', 'REPARTEIMPACTO', 'ATROPELLA', 'NUMREGENSOLDIERS',
  'ESPERAEVENTO', 'ENLAZAR', 'EXITHOME_EVENTS', 'REACT_EVENTS', 'ZONARECINTO',
  'POSGALLINERO', 'PRESO', 'OTROVIGI', 'CARCEL', 'SENSORES_SND_ZONA', 'ENEGIA',
  'PIEDRAS', 'GRANADAS', 'LANZALLA', 'ESCALAUSABLEPORBUZO', 'MATABICHOSSECTOR',
  'HORAENCENDIDO', 'ILUMINADA', 'DURACIONCICLO', 'EVENTOA', 'EVENTOB', 'EVENTOC',
]);
const cuenta = new Map<string, { archivos: Set<string>; valores: Set<string>; cantidad: number }>();
let listas = 0;
for (const entrada of entradas) {
  const texto = new TextDecoder('windows-1252').decode(entryBytes(datos, entrada));
  const raiz = parseClave(texto);
  const visitar = (nodos: readonly Node[]): void => {
    listas++;
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      if (Array.isArray(nodo)) visitar(nodo);
      else if (typeof nodo === 'string' && claves.has(nodo.replace(/^\./, '').toUpperCase()) && nodo.startsWith('.')) {
        const clave = nodo.slice(1).toUpperCase();
        const registro = cuenta.get(clave) ?? { archivos: new Set<string>(), valores: new Set<string>(), cantidad: 0 };
        registro.archivos.add(entrada.path);
        registro.cantidad++;
        const valor = nodos[i + 1];
        if (typeof valor === 'string') registro.valores.add(valor);
        cuenta.set(clave, registro);
      }
    }
  };
  visitar(raiz);
}
const misiones = entradas.filter((e) => /\.MIS$/i.test(e.path)).length;
const macros = entradas.filter((e) => /\.MAC$/i.test(e.path)).length;
if (misiones !== 19 || macros !== 96) throw new Error(`Inventario distinto: ${misiones} MIS, ${macros} MAC`);
console.log(`WAR_MP.DIR raíz: ${misiones} MIS + ${macros} MAC parseados; ${listas} listas recorridas.`);
for (const clave of claves) {
  const registro = cuenta.get(clave);
  console.log(`${clave}: ${registro?.cantidad ?? 0} usos, ${registro?.archivos.size ?? 0} archivos; valores simples: ${Array.from(registro?.valores ?? []).sort().join(', ')}`);
}
