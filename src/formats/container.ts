/**
 * Contenedor WAR_MP.DIR. Formato: docs/inventario.md §1 (verificado: 1227/1227 archivos, sin huecos).
 * Registro de 44 B: nombre[32] · u8 flag (+3 pad) · u32 A · u32 B.
 *  - archivo (flag 0): A = tamaño, B = offset absoluto
 *  - directorio (flag 1): B = posición de su lista dentro de la tabla (A no se usa)
 * Cada lista termina en un registro `DIRECTOR.FIN`. El registro 0 es la raíz.
 */

const RECORD = 44;
const MAX_RECORDS = 100_000;
const MAX_DEPTH = 64;

export interface DirEntry {
  /** Ruta con `/`, sin la raíz `DATOS` repetida: p. ej. `DATOS/MISIONES/MAPA0000.VOL`. */
  readonly path: string;
  readonly size: number;
  readonly offset: number;
}

export class ContainerError extends Error {}

function readName(view: Uint8Array, at: number): string {
  let end = at;
  while (end < at + 32 && view[end] !== 0) end++;
  let s = '';
  for (let i = at; i < end; i++) s += String.fromCharCode(view[i] ?? 0);
  return s;
}

export function parseContainer(buf: Uint8Array): DirEntry[] {
  if (buf.length < RECORD) throw new ContainerError('archivo demasiado corto');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: DirEntry[] = [];
  const seen = new Set<number>();
  let records = 0;

  const walk = (pos: number, path: string, depth: number): void => {
    if (depth > MAX_DEPTH) throw new ContainerError('anidamiento excesivo');
    if (seen.has(pos)) throw new ContainerError(`lista de directorio repetida en ${pos.toString()}`);
    seen.add(pos);
    for (;;) {
      if (pos < 0 || pos + RECORD > buf.length) throw new ContainerError(`tabla fuera de rango en ${pos.toString()}`);
      if (++records > MAX_RECORDS) throw new ContainerError('demasiados registros');
      const name = readName(buf, pos);
      const flag = buf[pos + 32] ?? 0;
      const a = dv.getUint32(pos + 36, true);
      const b = dv.getUint32(pos + 40, true);
      pos += RECORD;
      if (name === 'DIRECTOR.FIN') return;
      if (flag === 1) walk(b, `${path}/${name}`, depth + 1);
      else {
        if (b + a > buf.length) throw new ContainerError(`archivo ${name} fuera de rango`);
        out.push({ path: `${path}/${name}`, size: a, offset: b });
      }
    }
  };

  const rootName = readName(buf, 0);
  walk(dv.getUint32(40, true), rootName, 0);
  return out;
}

/** Vista (sin copiar) sobre los bytes de una entrada. */
export function entryBytes(buf: Uint8Array, e: DirEntry): Uint8Array {
  return buf.subarray(e.offset, e.offset + e.size);
}
