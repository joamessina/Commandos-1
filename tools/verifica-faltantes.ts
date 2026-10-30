// Lee datos reales sin extraer recursos: libretas y grafos de aves del WAR_MP.DIR raíz.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseClave, type Node } from '../src/formats/clave.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
const claves = new Set(['SCALE', 'BITMAP', 'ZONARECINTO']);
let misiones = 0;
let macros = 0;
let grafos = 0;
let basesTotales = 0;
let aristasTotales = 0;
let repetidas = 0;
const campo = (nodos: readonly Node[], clave: string): Node | undefined => {
  const indice = nodos.indexOf(`.${clave}`);
  return indice < 0 ? undefined : nodos[indice + 1];
};
let libretas = 0;
let filas = 0;
const validarRle = (bytes: Uint8Array): void => {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ancho = v.getInt32(18, true);
  const alto = v.getInt32(22, true);
  const inicio = v.getUint32(10, true);
  if (v.getUint16(0, true) !== 0x4d42 || v.getUint16(28, true) !== 8 || v.getUint32(30, true) !== 4 || ancho < 1 || alto < 1 || inicio !== 1090 + 4 * alto || v.getUint32(1082, true) !== ancho || v.getUint32(1086, true) !== alto) throw new Error('Cabecera RLE inesperada');
  for (let y = 0; y < alto; y++) {
    let p = inicio + v.getUint32(1090 + y * 4, true);
    const fin = y + 1 < alto ? inicio + v.getUint32(1094 + y * 4, true) : bytes.length;
    if (p < inicio || fin > bytes.length || p > fin) throw new Error('Offset de fila inválido');
    let pixeles = 0;
    while (p < fin) {
      const op = bytes[p++];
      if (op === undefined) throw new Error('Fila truncada');
      const cantidad = op >= 254 ? bytes[p++] : op;
      if (cantidad === undefined) throw new Error('Operando truncado');
      pixeles += cantidad;
      if (op !== 255) p += cantidad;
    }
    if (p !== fin || pixeles !== ancho) throw new Error('Longitud de fila incorrecta');
    filas++;
  }
  libretas++;
};
for (const entrada of entradas) {
  if (entrada.path.includes('/LIBRETAS/')) {
    const bytes = entryBytes(datos, entrada);
    validarRle(bytes);
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    console.log('RECURSO', entrada.path, 'ancho', vista.getInt32(18, true), 'alto', vista.getInt32(22, true), 'bpp', vista.getUint16(28, true), 'compresión', vista.getUint32(30, true));
  }
  if (!/\.(MIS|MAC)$/i.test(entrada.path)) continue;
  if (/\.MIS$/i.test(entrada.path)) misiones++;
  else macros++;
  const texto = new TextDecoder('windows-1252').decode(entryBytes(datos, entrada));
  const recorrer = (nodos: readonly Node[], camino: string): void => {
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      if (typeof nodo === 'string' && nodo.startsWith('.')) {
        const clave = nodo.slice(1).toUpperCase();
        const valor = nodos[i + 1];
        if (claves.has(clave) || (clave === 'XY' && camino === '/MISSION/MAP')) console.log(entrada.path, camino, clave, JSON.stringify(valor));
        if (clave === 'PAJAROS' && Array.isArray(valor)) {
          for (const grupo of valor) {
            if (!Array.isArray(grupo)) throw new Error('Grupo de aves sin lista');
            const bases = campo(grupo, 'BASES');
            if (!Array.isArray(bases)) throw new Error('Faltan bases');
            let aristas = 0;
            for (const base of bases) {
              if (!Array.isArray(base)) throw new Error('Base sin lista');
              const xyz = campo(base, 'XYZ');
              if (!Array.isArray(xyz) || xyz.length !== 3 || xyz.some((n) => typeof n !== 'string' || !Number.isFinite(Number(n)))) throw new Error('XYZ inválido');
              const conexion = campo(base, 'CONEXION');
              const destinos = Array.isArray(conexion) ? conexion : [conexion];
              const indices = destinos.map((n) => typeof n === 'string' ? Number(n) : NaN);
              if (indices.some((n) => !Number.isInteger(n) || n < 0 || n >= bases.length)) throw new Error('Conexión fuera del grafo');
              aristas += indices.length;
              repetidas += indices.length - new Set(indices).size;
            }
            grafos++;
            basesTotales += bases.length;
            aristasTotales += aristas;
            console.log('GRAFO', entrada.path, campo(grupo, 'ANIM'), 'aves', campo(grupo, 'NUMPAJAROS'), 'bases', bases.length, 'conexiones', aristas);
          }
        }
        if (Array.isArray(valor)) recorrer(valor, `${camino}/${clave}`);
      } else if (Array.isArray(nodo) && (i === 0 || typeof nodos[i - 1] !== 'string')) recorrer(nodo, camino);
    }
  };
  recorrer(parseClave(texto), '');
}
if (libretas !== 9 || grafos !== 22 || misiones !== 19 || macros !== 96) throw new Error('Inventario distinto al investigado');
console.log('TOTAL', { misiones, macros, libretas, filas, grafos, bases: basesTotales, conexiones: aristasTotales, conexionesRepetidas: repetidas });
