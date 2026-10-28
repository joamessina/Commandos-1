/**
 * `.SEC` (magia `NIBS`): sectores de navegación. Layout leído en el exe (FUN_005FBEA0 cargador, FUN_005F9EC0 lista de sectores,
 * FUN_005FA5F0 grupos, FUN_005F4A40 pares): docs/research/q1-movimiento.md §R4; verificado con tools/sec_check.py (11/11 cierran al byte).
 *   'NIBS' ; u32 nV ; nV × (f32 x, f32 y) ; lista A ; lista B ; grupos ; pares ; 'TW1' [ 'TW2' ] [ 'TW3' ]
 *   lista  = u32 n ; n × sector
 *   sector = u32 nverts, f32 A, f32 B, f32 C, u32 tipo, u32 u1, u32 u2, u32 flags, u32 namelen, name, [f32 f32 si flags&0x20], nverts × u32 vértice
 *   plano del suelo: z = A·x + B·y + C ; arista i = vértice i -> i+1
 *   TW1: por cada arista de cada sector de A, i32 vecino (-1 = ninguno) · TW2: {sA, aristaA, sB+nA, aristaB} hasta sA == -1 · TW3: sectores A con Cubierto
 */

export class SecError extends Error {}

/** Nombres del exe (volcado FUN_0053E2E0). */
export const SectorFlag = {
  Inclin: 0x1,
  Superp: 0x2,
  NTrans: 0x4,
  NCamin: 0x8,
  Ocluso: 0x10,
  SoloAg: 0x400,
  Cubierto: 0x10000,
} as const;

export interface Sector {
  /** 0 LAND · 1 WATER · 2 SNOW · 3 DEEPWATER · 4 CONVEYOR · 5 RAPIDS. */
  readonly type: number;
  /** Plano del suelo: z = a·x + b·y + c. */
  readonly a: number;
  readonly b: number;
  readonly c: number;
  /** Flags tal como están en el archivo. */
  readonly rawFlags: number;
  /** Flags tras el cargador (máscara 0x3FDC/0x3EDC + Inclin + Superp + Cubierto). Mutable: las misiones los cambian en juego. */
  flags: number;
  /** true = lista B (sectores superpuestos: puentes/pisos altos). */
  readonly overlay: boolean;
  /** Índices a `Sec.verts`. */
  readonly verts: readonly number[];
  /** Vecino por arista (índice en `Sec.sectors`, -1 = borde). */
  readonly neighbors: number[];
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface Sec {
  readonly verts: readonly { readonly x: number; readonly y: number }[];
  /** Lista A y luego lista B. */
  readonly sectors: readonly Sector[];
  /** Cantidad de sectores de la lista A (los siguientes son B). */
  readonly nA: number;
}

const MAX_NAME = 4096;

class Reader {
  p = 0;
  private readonly b: Uint8Array;
  private readonly dv: DataView;
  constructor(b: Uint8Array) {
    this.b = b;
    this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  }
  need(n: number): void {
    if (n < 0 || this.p + n > this.b.length) throw new SecError('se corta antes del fin');
  }
  u32(): number {
    this.need(4);
    const v = this.dv.getUint32(this.p, true);
    this.p += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.dv.getInt32(this.p, true);
    this.p += 4;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.dv.getFloat32(this.p, true);
    this.p += 4;
    return v;
  }
  skip(n: number): void {
    this.need(n);
    this.p += n;
  }
  tag(t: string): boolean {
    for (let i = 0; i < t.length; i++) if (this.b[this.p + i] !== t.charCodeAt(i)) return false;
    return true;
  }
  /** Cantidad de elementos de `size` bytes que aún caben: evita reservar memoria por un conteo falso. */
  count(size: number): number {
    const n = this.u32();
    this.need(n * size);
    return n;
  }
  get left(): number {
    return this.b.length - this.p;
  }
}

function readList(r: Reader, verts: readonly { x: number; y: number }[], overlay: boolean): Sector[] {
  const out: Sector[] = [];
  const n = r.count(36);
  for (let i = 0; i < n; i++) {
    const nv = r.count(4);
    const a = r.f32();
    const b = r.f32();
    const c = r.f32();
    const type = r.u32();
    r.skip(8); // u1, u2: el cargador los lee y los descarta
    const rawFlags = r.u32();
    const nameLen = r.u32();
    if (nameLen > MAX_NAME) throw new SecError('nombre de sector demasiado largo');
    r.skip(nameLen);
    if (rawFlags & 0x20) r.skip(8); // vector de corriente: no aparece en ningún .SEC real y no se usa
    const idx: number[] = [];
    for (let k = 0; k < nv; k++) {
      const v = r.u32();
      if (v >= verts.length) throw new SecError('índice de vértice fuera de rango');
      idx.push(v);
    }
    const xs = idx.map((v) => verts[v]?.x ?? 0);
    const ys = idx.map((v) => verts[v]?.y ?? 0);
    const trans = (rawFlags & SectorFlag.NTrans) !== 0;
    // máscara del cargador: 0x3FDC en sectores NTrans, 0x3EDC en el resto (NVista solo se conserva en NTrans)
    let flags = rawFlags & (trans ? 0x3fdc : 0x3edc);
    if (a !== 0 || b !== 0) flags |= SectorFlag.Inclin;
    if (overlay) flags |= SectorFlag.Superp;
    out.push({
      type, a, b, c, rawFlags, flags, overlay, verts: idx, neighbors: new Array<number>(nv).fill(-1),
      minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
    });
  }
  return out;
}

export function parseSec(bytes: Uint8Array): Sec {
  const r = new Reader(bytes);
  if (!r.tag('NIBS')) throw new SecError('sin magia NIBS');
  r.skip(4);
  const verts: { x: number; y: number }[] = [];
  const nV = r.count(8);
  for (let i = 0; i < nV; i++) verts.push({ x: r.f32(), y: r.f32() });
  const listA = readList(r, verts, false);
  const listB = readList(r, verts, true);
  const sectors = [...listA, ...listB];
  const nA = listA.length;
  // grupos con nombre y pares: se leen para llegar a la cola; su consumidor no está leído (R4)
  const ng = r.count(8);
  for (let g = 0; g < ng; g++) {
    const items = r.count(8);
    const nameLen = r.u32();
    if (nameLen > MAX_NAME) throw new SecError('nombre de grupo demasiado largo');
    r.skip(nameLen);
    r.skip(items * 8);
  }
  r.skip(r.count(8) * 8);

  if (!r.tag('TW1')) throw new SecError('falta TW1');
  r.skip(3);
  for (const s of listA) {
    for (let e = 0; e < s.neighbors.length; e++) {
      const v = r.i32();
      if (v < -1 || v >= sectors.length) throw new SecError('vecino TW1 fuera de rango');
      // idx >= nA apunta fuera de la lista A en el original (aritmética de punteros sobre A); acá se toma como índice de la lista unida
      s.neighbors[e] = v;
    }
  }
  if (r.tag('TW2')) {
    r.skip(3);
    for (;;) {
      const sa = r.i32();
      if (sa === -1) break;
      const ea = r.i32();
      const sb = r.i32();
      const eb = r.i32();
      const a = sectors[sa];
      const b = sectors[sb];
      if (sa < 0 || sa >= nA || sb < nA || !a || !b || ea < 0 || ea >= a.neighbors.length || eb < 0 || eb >= b.neighbors.length) throw new SecError('enlace TW2 fuera de rango');
      a.neighbors[ea] = sb;
      if (b.neighbors[eb] === -1) b.neighbors[eb] = sa;
    }
  }
  if (r.tag('TW3')) {
    r.skip(3);
    while (r.left > 0) {
      const i = r.i32();
      const s = sectors[i];
      if (i < 0 || i >= nA || !s) throw new SecError('índice TW3 fuera de rango');
      s.flags |= SectorFlag.Cubierto;
    }
  }
  if (r.left !== 0) throw new SecError(`sobran ${r.left.toString()} bytes`);
  return { verts, sectors, nA };
}
