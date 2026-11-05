// Cuenta las banderas crudas de SPRITE/SIZESPRITE sin extraer los recursos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseAnm } from '../src/formats/anm.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
for (const nombre of ['EXPLOS1.ANM', 'DISPFALL.ANM']) {
  const entrada = entradas.find((e) => e.path.toUpperCase().endsWith('/' + nombre));
  if (!entrada) throw new Error(`Falta ${nombre}`);
  const bytes = entryBytes(datos, entrada);
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let posicion = 4;
  let secuencia = '';
  const conteos = new Map<string, Map<number, number>>();
  const orden = new Map<string, number[]>();
  while (posicion + 4 <= bytes.length) {
    const cabecera = vista.getUint32(posicion, true);
    if (cabecera === 0xff000000) break;
    const tipo = cabecera >>> 24;
    const cantidad = (cabecera >>> 16) & 15;
    const tamano = cabecera & 0xffff;
    const mascara = vista.getUint32(posicion + 4, true);
    const base = posicion + 8 + 4 * cantidad;
    if (base + tamano > bytes.length) throw new Error(`Registro truncado en ${nombre}`);
    if (tipo >= 1 && tipo <= 3 && (mascara & 1) !== 0) {
      const inicio = base + vista.getInt32(posicion + 8, true);
      let fin = inicio;
      while (fin < base + tamano && bytes[fin] !== 0) fin++;
      secuencia = new TextDecoder('windows-1252').decode(bytes.subarray(inicio, fin));
    }
    if (tipo === 5 || tipo === 6) {
      const indice = tipo === 5 ? 3 : 5;
      if (indice >= cantidad || (mascara & (1 << indice)) !== 0) throw new Error(`Bandera inválida en ${nombre}`);
      const bandera = vista.getInt32(posicion + 8 + indice * 4, true);
      const valores = conteos.get(secuencia) ?? new Map<number, number>();
      valores.set(bandera, (valores.get(bandera) ?? 0) + 1);
      conteos.set(secuencia, valores);
      const banderas = orden.get(secuencia) ?? [];
      banderas.push(bandera);
      orden.set(secuencia, banderas);
    }
    posicion = base + tamano;
  }
  const anm = parseAnm(bytes);
  for (const [clave, valores] of conteos) {
    const flags = orden.get(clave) ?? [];
    const frames = anm.sequences.get(clave)?.steps.flat() ?? [];
    if (frames.length !== flags.length || frames.some((f, i) => f.mirror !== (((flags[i] ?? 0) & 1) !== 0) || f.additive !== (((flags[i] ?? 0) & 2) !== 0))) throw new Error(`Banderas inconsistentes en ${nombre}/${clave}`);
    console.log(nombre, clave, Object.fromEntries(valores), 'ORDEN', flags, 'LECTOR_OK');
  }
}
