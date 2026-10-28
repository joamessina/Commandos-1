/** Constructores de bytes SINTÉTICOS para tests (ningún byte del juego entra al repo). */

export function u32(...v: number[]): number[] {
  return v.flatMap((n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

export function str(s: string, len: number): number[] {
  const out = new Array<number>(len).fill(0);
  for (let i = 0; i < Math.min(s.length, len); i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Registro de 44 B del contenedor. */
export function rec(name: string, flag: number, a: number, b: number): number[] {
  return [...str(name, 32), flag, 0xcd, 0xcd, 0xcd, ...u32(a, b)];
}

/** RLE: tag[4], w, h, offsets (para el buf2) y filas concatenadas (buf1). */
export function rleParts(width: number, rows: number[][], tag = 'test'): { b1: number[]; b2: number[] } {
  const offs: number[] = [];
  let at = 0;
  for (const r of rows) {
    offs.push(at);
    at += r.length;
  }
  return { b1: rows.flat(), b2: [...str(tag, 4), ...u32(width, rows.length, ...offs)] };
}

export interface SpriteSpec {
  name: string;
  /** 4 = RLE, 0 = crudo. */
  comp: number;
  /** campos[0], campos[1] (alto, ancho en el WAD real). */
  h: number;
  w: number;
  b1: number[];
  b2?: number[];
  palette: number;
  s3?: number[];
}

export function spriteBytes(s: SpriteSpec): number[] {
  const b3 = s.s3 ?? [];
  return [
    ...str(s.name, 32), ...u32(s.b1.length, b3.length, 3, 0xdeadbeef),
    ...u32(s.h, s.w, 0xdeadbeef, s.comp),
    ...s.b1,
    ...(s.comp !== 0 ? [...u32((s.b2 ?? []).length), ...(s.b2 ?? [])] : []),
    ...b3,
    ...u32(s.palette),
  ];
}

/** Paleta de 256 colores RGB565 LE con los primeros colores dados. */
export function palette(colors: number[]): number[] {
  const out = new Array<number>(512).fill(0);
  colors.forEach((c, i) => {
    out[i * 2] = c & 255;
    out[i * 2 + 1] = c >> 8;
  });
  return out;
}

export function wadBytes(palettes: number[][], sprites: SpriteSpec[]): Uint8Array {
  return new Uint8Array([
    ...new Array<number>(400).fill(0xff),
    ...u32(palettes.length),
    ...palettes.flatMap((p) => [...p, ...str('', 13)]),
    ...u32(sprites.length),
    ...sprites.flatMap(spriteBytes),
  ]);
}

/** Falla el test si falta el valor (evita `!` en las aserciones). */
export function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('valor ausente');
  return v;
}

/** Registro BNM: los slots `{ s: 'texto' }` son punteros a cadenas en los datos del registro. */
export interface BnmRec {
  type: number;
  slots: (number | { s: string })[];
}

export function bnm(recs: BnmRec[], opts: { tail?: number[]; noEnd?: boolean } = {}): Uint8Array {
  const out: number[] = [0x42, 0x4e, 0x4d, 0x20];
  for (const r of recs) {
    let data: number[] = [];
    let mask = 0;
    const vals = r.slots.map((s, i) => {
      if (typeof s === 'number') return s;
      mask |= 1 << i;
      const at = data.length;
      data = [...data, ...Array.from(s.s, (c) => c.charCodeAt(0)), 0];
      return at;
    });
    out.push(...u32(((r.type << 24) | (vals.length << 16) | data.length) >>> 0), ...u32(mask), ...vals.flatMap((v) => u32(v >>> 0)), ...data);
  }
  if (opts.noEnd !== true) out.push(...u32(0xff000000));
  return new Uint8Array([...out, ...(opts.tail ?? [])]);
}

/** Secuencia ANM de prueba: cabecera + pasos con `dirs` fotogramas cada uno ("<nombre><paso><dir>.RLE", espejo en dirs impares). */
export function anmSeq(type: 1 | 2 | 3, name: string, steps: number, a: number, b: number, dirs: number, links: [string, string] = ['', '']): BnmRec[] {
  const head: BnmRec = { type, slots: [{ s: name }, steps, a, b, ...(type === 3 ? [{ s: links[0] }, { s: links[1] }] : [])] };
  const body: BnmRec[] = [];
  for (let s = 0; s < steps; s++) {
    body.push({ type: 4, slots: [dirs] });
    for (let d = 0; d < dirs; d++) body.push({ type: 5, slots: [{ s: `${name}${s.toString()}${d.toString()}.RLE` }, -10 - d, -30, d % 2] });
  }
  return [head, ...body];
}

export interface SecSector {
  verts: number[];
  plane?: [number, number, number];
  type?: number;
  flags?: number;
  name?: string;
}

export interface SecSpec {
  verts: [number, number][];
  a: SecSector[];
  b?: SecSector[];
  /** Vecino por arista de cada sector A (TW1); por defecto -1. */
  tw1?: number[][];
  /** Enlaces TW2 {sA, aristaA, sB + nA, aristaB}; undefined = sin sección TW2. */
  tw2?: [number, number, number, number][];
  tw3?: number[];
}

const f32 = (...v: number[]): number[] => [...new Uint8Array(new Float32Array(v).buffer)];

function secList(l: SecSector[]): number[] {
  return [
    ...u32(l.length),
    ...l.flatMap((s) => {
      const name = s.name ?? '';
      const flags = s.flags ?? 0;
      return [
        ...u32(s.verts.length), ...f32(...(s.plane ?? [0, 0, 0])), ...u32(s.type ?? 0, 7, 9, flags, name.length), ...str(name, name.length),
        ...(flags & 0x20 ? f32(1, 2) : []), ...u32(...s.verts),
      ];
    }),
  ];
}

/** `.SEC` sintético; `tail` reemplaza todo lo que sigue a los pares (para probar errores). */
export function secBytes(s: SecSpec, tail?: number[]): Uint8Array {
  const tw1 = s.a.flatMap((x, i) => s.tw1?.[i] ?? x.verts.map(() => -1));
  return new Uint8Array([
    ...str('NIBS', 4), ...u32(s.verts.length), ...f32(...s.verts.flat()), ...secList(s.a), ...secList(s.b ?? []),
    ...u32(1, 1, 0, 0, 0), // 1 grupo: 1 ítem, nombre vacío, (lista 0, sector 0)
    ...u32(0), // pares
    ...(tail ?? [
      ...str('TW1', 3), ...u32(...tw1.map((v) => v >>> 0)),
      ...(s.tw2 ? [...str('TW2', 3), ...s.tw2.flatMap((t) => u32(...t)), ...u32(0xffffffff)] : []),
      ...(s.tw3 ? [...str('TW3', 3), ...u32(...s.tw3)] : []),
    ]),
  ]);
}
