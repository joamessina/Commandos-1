// Inventario focal de MAPA0000.MIS desde el DIR raíz; solo imprime datos de script.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const archivo = parseContainer(datos).find((e) => /(?:^|[\\/])MAPA0000\.MIS$/i.test(e.path));
if (!archivo) throw new Error('No aparece MAPA0000.MIS en WAR_MP.DIR raíz');
const raiz = parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, archivo)));
const ver = (n: Node, profundidad = 0): string => Array.isArray(n)
  ? `[${n.map((x) => ver(x, profundidad + 1)).join(' ')}]`
  : String(n);
const buscar = (nodos: readonly Node[], patron: RegExp, ruta = ''): void => {
  for (let i = 0; i < nodos.length; i++) {
    const n = nodos[i];
    if (Array.isArray(n)) buscar(n, patron, ruta);
    else if (typeof n === 'string' && patron.test(n)) {
      console.log(`${ruta}/${n}: ${nodos[i + 1] === undefined ? '' : ver(nodos[i + 1] as Node).slice(0, 800)}`);
    }
  }
};
const encontrar = (nodos: readonly Node[], clave: string): Node | undefined => {
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i] === clave) return nodos[i + 1] as Node | undefined;
    const n = nodos[i];
    if (Array.isArray(n)) {
      const hallado = encontrar(n, clave);
      if (hallado !== undefined) return hallado;
    }
  }
  return undefined;
};
const hijos = (n: Node | undefined): readonly Node[] => Array.isArray(n) ? n : [];
console.log('ARCHIVO', archivo.path, 'bytes', entryBytes(datos, archivo).length);
buscar(raiz, /^(\.MUSICA|\.SENSORES_SND_ZONA|\.PATRULLAS|\.ELEMENTOS|\.AMBIENTE|\.HORAENCENDIDO|\.ILUMINADA|\.EXITHOME_EVENTS|\.REACT_EVENTS)$/i);
for (const [seccion, filtro] of [['.ELEMENTOS', /^(\.CLASS|\.MACRO|\.TOKEN|\.XYZ|\.BANDO|\.REACTIVIDADES|\.ACCIONES|\.ORGANOS)$/i], ['.PATRULLAS', /^(\.TOKEN|\.NSOLDIERS|\.EXITHOME_EVENTS|\.REACT_EVENTS|\.HOME|\.REGENERATE)$/i]] as const) {
const bloques = hijos(encontrar(raiz, seccion));
  console.log('RESUMEN', seccion, 'bloques', bloques.length);
  for (const bloque of bloques) {
    if (!Array.isArray(bloque)) continue;
    const campos: string[] = [];
    for (let i = 0; i < bloque.length; i++) {
      const campo = bloque[i];
      if (typeof campo === 'string' && filtro.test(campo)) campos.push(`${campo}=${ver(bloque[i + 1] as Node).slice(0, 180)}`);
    }
    if (campos.length > 0) console.log(campos.join(' '));
  }
}
