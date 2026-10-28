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
