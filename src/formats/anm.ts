/**
 * `.ANM` = flujo `BNM `: llamadas a métodos registrados. Formato y semántica: docs/formats-graficos.md §3 y
 * docs/engine/graficos-mapa.md §1 (cargador FUN_004E4100; verificado: 166/166 flujos cierran al byte).
 *   'BNM ' ; registros { hdr u32 | mask u32 | slots[nslots] i32 | datos[tamaño] } hasta hdr == 0xFF000000
 *   hdr: tamaño = hdr & 0xFFFF ; nslots = (hdr>>16) & 0xF ; tipo = hdr >> 24 ; bit i de mask: la ranura es un offset a `datos`
 * Tipos: 0 NUM_SEQUENCES · 1 SEQUENCE (cíclica) · 2 NLSEQUENCE · 3 CHAINSEQUENCE · 4 FRAME n · 5 SPRITE · 6 SIZESPRITE ·
 *        7 NHOTSPOTS · 8 HOTSPOT · 9 ANCLAJES · 10 ANCLAJE · 11 ANCLAJESEC
 */

export class AnmError extends Error {}

export interface Hotspot {
  readonly x: number;
  readonly y: number;
  readonly k: number;
}

export interface AnmFrame {
  readonly sprite: string;
  /** Posición de la esquina superior izquierda del sprite respecto del punto del mundo (con signo). */
  readonly hx: number;
  readonly hy: number;
  /** true = el sprite se dibuja volteado horizontalmente (hx ya es el borde izquierdo de la imagen volteada). */
  readonly mirror: boolean;
  readonly hotspots: Hotspot[];
}

export interface AnmSequence {
  readonly name: string;
  /** SEQUENCE (tipo 1) = cíclica; NLSEQUENCE y CHAINSEQUENCE no. */
  readonly cyclic: boolean;
  /** Pasos; cada paso tiene `n` fotogramas (8 = una por dirección; 1 = sin dirección). */
  readonly steps: AnmFrame[][];
  /** Período en distancia (unidades de mapa por ciclo de animación; locomoción). 0 = no aporta. */
  readonly a: number;
  /** Período en ticks de 1/20 s. 0 = no aporta. */
  readonly b: number;
  readonly link1: string;
  readonly link2: string;
  readonly anchored: boolean;
}

export interface Anm {
  readonly sequences: ReadonlyMap<string, AnmSequence>;
}

interface Rec {
  readonly type: number;
  readonly slots: (number | string)[];
}

const MAX_RECORDS = 2_000_000;

function readRecords(b: Uint8Array): Rec[] {
  if (b.length < 8 || b[0] !== 0x42 || b[1] !== 0x4e || b[2] !== 0x4d || b[3] !== 0x20) throw new AnmError('sin magia BNM');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Rec[] = [];
  let p = 4;
  for (;;) {
    if (p + 4 > b.length) throw new AnmError('se corta antes del fin');
    const hdr = dv.getUint32(p, true);
    if (hdr === 0xff000000) {
      if (p + 4 !== b.length) throw new AnmError('bytes sobrantes tras el fin');
      return out;
    }
    if (out.length >= MAX_RECORDS) throw new AnmError('demasiados registros');
    const n = (hdr >>> 16) & 0xf;
    const size = hdr & 0xffff;
    if (p + 8 + 4 * n + size > b.length) throw new AnmError('registro pasa del fin');
    const mask = dv.getUint32(p + 4, true);
    const dataAt = p + 8 + 4 * n;
    const slots: (number | string)[] = [];
    for (let i = 0; i < n; i++) {
      const v = dv.getInt32(p + 8 + 4 * i, true);
      if ((mask >>> i) & 1) {
        if (v < 0 || v >= size) throw new AnmError('puntero a cadena fuera de rango');
        let e = v;
        while (e < size && b[dataAt + e] !== 0) e++;
        if (e >= size) throw new AnmError('cadena sin terminar');
        slots.push(String.fromCharCode(...b.subarray(dataAt + v, dataAt + e)));
      } else slots.push(v);
    }
    out.push({ type: hdr >>> 24, slots });
    p = dataAt + size;
  }
}

const num = (r: Rec, i: number): number => {
  const v = r.slots[i];
  if (typeof v !== 'number') throw new AnmError(`tipo ${r.type.toString()}: la ranura ${i.toString()} debía ser un número`);
  return v;
};
const txt = (r: Rec, i: number): string => {
  const v = r.slots[i];
  if (typeof v !== 'string') throw new AnmError(`tipo ${r.type.toString()}: la ranura ${i.toString()} debía ser texto`);
  return v;
};

export function parseAnm(bytes: Uint8Array): Anm {
  const recs = readRecords(bytes);
  const sequences = new Map<string, AnmSequence>();
  let declared = -1;
  let count = 0;
  let seq: { name: string; cyclic: boolean; steps: AnmFrame[][]; pasos: number; a: number; b: number; link1: string; link2: string; anchored: boolean } | null = null;
  let want = 0; // fotogramas que faltan en el paso actual
  let frame: { sprite: string; hx: number; hy: number; mirror: boolean; hotspots: Hotspot[] } | null = null;

  const closeSeq = (): void => {
    if (!seq) return;
    if (want !== 0) throw new AnmError(`${seq.name}: paso incompleto`);
    if (seq.steps.length !== seq.pasos) throw new AnmError(`${seq.name}: ${seq.steps.length.toString()} pasos, se declararon ${seq.pasos.toString()}`);
    count++;
    if (!sequences.has(seq.name)) sequences.set(seq.name, { name: seq.name, cyclic: seq.cyclic, steps: seq.steps, a: seq.a, b: seq.b, link1: seq.link1, link2: seq.link2, anchored: seq.anchored });
    seq = null;
  };
  const cur = (r: Rec): NonNullable<typeof seq> => {
    if (!seq) throw new AnmError(`tipo ${r.type.toString()} fuera de una secuencia`);
    return seq;
  };

  for (const r of recs) {
    switch (r.type) {
      case 0:
        declared = num(r, 0);
        break;
      case 1:
      case 2:
      case 3:
        closeSeq();
        seq = { name: txt(r, 0), cyclic: r.type === 1, steps: [], pasos: num(r, 1), a: num(r, 2), b: num(r, 3), link1: r.type === 3 ? txt(r, 4) : '', link2: r.type === 3 ? txt(r, 5) : '', anchored: false };
        break;
      case 4: {
        const s = cur(r);
        if (want !== 0) throw new AnmError(`${s.name}: paso incompleto`);
        want = num(r, 0);
        if (want < 0 || want > 64) throw new AnmError(`${s.name}: nº de fotogramas absurdo`);
        s.steps.push([]);
        break;
      }
      case 5:
      case 6: {
        const s = cur(r);
        if (want === 0) throw new AnmError(`${s.name}: fotograma fuera de un paso`);
        const f = { sprite: txt(r, 0), hx: num(r, 1), hy: num(r, 2), mirror: num(r, r.type === 5 ? 3 : 5) !== 0, hotspots: [] as Hotspot[] };
        (s.steps[s.steps.length - 1] as AnmFrame[]).push(f);
        frame = f;
        want--;
        break;
      }
      case 7:
        cur(r); // NHOTSPOTS n: informativo (máx. 5); los HOTSPOT siguientes lo cumplen
        if (num(r, 0) > 5) throw new AnmError('NHOTSPOTS > 5');
        break;
      case 8: {
        if (!frame) throw new AnmError('HOTSPOT sin fotograma');
        if (frame.hotspots.length >= 5) throw new AnmError('más de 5 HOTSPOT en un fotograma'); // límite del exe (FUN_004E1F00)
        frame.hotspots.push({ x: num(r, 0), y: num(r, 1), k: num(r, 2) });
        break;
      }
      case 9:
        cur(r).anchored = true;
        break;
      case 10:
      case 11:
        break; // anclajes de los animales (LEON…): no se usan todavía
      default:
        throw new AnmError(`tipo de registro desconocido: ${r.type.toString()}`);
    }
  }
  closeSeq();
  if (declared !== -1 && declared !== count) throw new AnmError(`${count.toString()} secuencias leídas, se declararon ${declared.toString()}`);
  return { sequences };
}
