// Contrasta el lote de investigación ≥80 % con scripts y animaciones reales, sin extraer assets.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseAnm } from '../src/formats/anm.ts';
import { parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
const claves = new Set([
  'ACCONTROLCOMPUERTA', 'ACCONTINTERFONO', 'ACINTERFONO', 'ACCTPUENTELEVADIZO', 'ACPUENTELEVADIZO',
  'ACCANONERO', 'ACCLANCHA', 'ACCTANQUE', 'ACAVESTRUZ', 'ACFELINO',
  'NOVERHASTA', 'ESCALAMUROS', 'ESCALAUSABLEPORBUZO', 'ZONARECINTO', 'FRAMECOUNT',
  'FLAGSUSAR', 'FLAGSRECOGER', 'HORAENCENDIDO', 'ILUMINADA', 'PAR_TICKS',
  'PAR_TICKS_FACIL', 'PAR_TICKS_DIFICIL', 'ENVIAREVENTO', 'EXITHOME_EVENTS', 'REACT_EVENTS',
].map((s) => s.toUpperCase()));
const hallados = new Map<string, { cantidad: number; archivos: Set<string>; valores: Set<string> }>();
const familias = new Map<string, Set<string>>();
let scripts = 0;
let animaciones = 0;
let secuencias = 0;
for (const entrada of entradas) {
  if (/\.(MIS|MAC)$/i.test(entrada.path)) {
    scripts++;
    const visitar = (nodos: readonly Node[]): void => {
      for (let i = 0; i < nodos.length; i++) {
        const nodo = nodos[i];
        if (Array.isArray(nodo)) visitar(nodo);
        else if (typeof nodo === 'string') {
          const clave = nodo.replace(/^\./, '').toUpperCase();
          if (/^AC.*(PUENTE|COMPUERTA|INTERFONO|CANONERO|LANCHA)/.test(clave)) {
            const archivos = familias.get(clave) ?? new Set<string>();
            archivos.add(entrada.path.split('/').at(-1) ?? entrada.path);
            familias.set(clave, archivos);
          }
          if (!claves.has(clave)) continue;
          const registro = hallados.get(clave) ?? { cantidad: 0, archivos: new Set<string>(), valores: new Set<string>() };
          registro.cantidad++;
          registro.archivos.add(entrada.path.split('/').at(-1) ?? entrada.path);
          const valor = nodos[i + 1];
          if (typeof valor === 'string' && !valor.startsWith('.')) registro.valores.add(valor);
          hallados.set(clave, registro);
        }
      }
    };
    visitar(parseClave(new TextDecoder('windows-1252').decode(entryBytes(datos, entrada))));
  }
  if (/\.ANM$/i.test(entrada.path)) {
    const anm = parseAnm(entryBytes(datos, entrada));
    animaciones++;
    secuencias += anm.sequences.size;
    for (const [nombre, secuencia] of anm.sequences) {
      if (/BARR.*\.ANM$/i.test(entrada.path) || (/COMANDO\.ANM$/i.test(entrada.path) && /ESCALAR|PONEBOMBA/i.test(nombre))) {
        console.log('ANM', entrada.path, nombre, 'pasos', secuencia.steps.length, 'a', secuencia.a, 'b', secuencia.b, 'enlaces', secuencia.link1, secuencia.link2);
      }
    }
  }
}
if (scripts !== 115) throw new Error(`Inventario de scripts cambió: ${scripts}`);
if (animaciones !== 166 || secuencias !== 1321) throw new Error(`Inventario ANM cambió: ${animaciones}/${secuencias}`);
for (const clave of claves) {
  const r = hallados.get(clave);
  console.log(clave, 'usos', r?.cantidad ?? 0, 'archivos', [...r?.archivos ?? []].sort().join(','), 'valores', [...r?.valores ?? []].sort().join(','));
}
for (const [familia, archivos] of familias) console.log('FAMILIA', familia, [...archivos].sort().join(','));
console.log('TOTAL', { scripts, animaciones, secuencias });
