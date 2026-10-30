/**
 * Agua animada (`.WATER` del MIS): lectura del bloque, ciclo `FUN_006BED80` y generador de píxeles `FUN_006491E0`.
 * Reglas y verificación (píxel a píxel contra el código del exe emulado): docs/lectura/agua.md.
 */
import { asList, asNumber, asText, find, parseClave } from '../formats/clave.ts';

export const WATER_SIZE = 256;
/** Stride del destino: 256 + cola de 2 píxeles (copia de los 2 primeros de la fila). */
export const WATER_STRIDE = 258;

const DEG = Math.fround(0.01745329238474369); // 0x8113FC

export interface WaterDef {
  /** Nombre del bitmap que usan los tiles (`.BMPDST`); `.BMP` y `.BMPSRC` el exe no los lee. */
  readonly dst: string;
  /** 1, 2 o null (sin `.TYPE`: el exe usa el generador tipo 1 con desplazamiento fijo, hipótesis de agua.md §3). */
  readonly type: number | null;
  readonly sininc: number;
  readonly velinc: number;
  readonly anginc: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly length: number;
  readonly speed: number;
}

/** `.WATER [ … ]` de un MIS, o null si no hay bloque o no trae `.BMPDST` (misiones 1, 2: bloque vacío). */
export function parseWater(misText: string): WaterDef | null {
  const root = parseClave(misText);
  const w = asList(find(asList(find(root, '.MISSION')) ?? root, '.WATER'));
  const dst = asText(find(w ?? [], '.BMPDST'));
  if (!w || !dst) return null;
  const n = (key: string): number => asNumber(find(w, key)) ?? 0; // clave ausente = 0 (agua.md §2)
  return {
    dst,
    type: asNumber(find(w, '.TYPE')) ?? null,
    sininc: n('.SININC'),
    velinc: n('.VELINC'),
    anginc: n('.ANGINC'),
    centerX: n('.CENTERX'),
    centerY: n('.CENTERY'),
    length: n('.LENGTH'),
    speed: n('.SPEED'),
  };
}

/** Tablas de `FUN_006487D0` (amplitud 8): ángulo float32 acumulado, seno a float32, truncado hacia cero. */
function sineTables(): { s8: Int8Array; s32: Int32Array } {
  const s8 = new Int8Array(256);
  const s32 = new Int32Array(256);
  let ang = 0;
  for (let i = 0; i < 256; i++) {
    const v = Math.fround(Math.sin(ang)) * 8;
    s8[i] = Math.trunc(v);
    s32[i] = Math.trunc(v * 65536);
    ang = Math.fround(ang + 0.02454369328916073);
  }
  return { s8, s32 };
}
const { s8: S8, s32: S32 } = sineTables();

/** `fistp qword` y quedarse con los 32 bits bajos (como el exe). */
const fix16 = (x: number): number => Number(BigInt.asIntN(32, BigInt(Math.trunc(x * 65536))));

/** `FUN_006491E0`: rellena `dst` (stride 258) deformando `src` (256×256, stride 256). `kind` 2 = 16.16, 1 = bytes. */
export function warp(src: Uint8Array, dst: Uint8Array, kind: 1 | 2, phase: number, offX: number, offY: number): void {
  if (kind === 2) {
    const p = fix16(phase);
    const a = fix16(offX);
    const b = fix16(offY);
    for (let i = 0; i < WATER_SIZE; i++) {
      const rowTerm = (S32[((p >> 16) + 2 * i) & 255] as number);
      for (let j = 0; j < WATER_SIZE; j++) {
        const y = (j << 16) + rowTerm + a;
        const k = ((p + y) >> 16) & 255;
        const sx = (((i << 16) + ((S32[k] as number)) + b) >> 16) & 255;
        dst[i * WATER_STRIDE + j] = src[((y >> 16) & 255) * 256 + sx] as number;
      }
    }
  } else {
    const A = Math.trunc(phase);
    const B = Math.trunc(offY);
    const C = Math.trunc(offX);
    for (let r = 0; r < WATER_SIZE; r++) {
      const rowTerm = (S8[(A + r) & 255] as number);
      for (let c = 0; c < WATER_SIZE; c++) {
        const u = (C + c + rowTerm) & 255;
        const v = (B + r + ((S8[(u + A) & 255] as number))) & 255;
        dst[r * WATER_STRIDE + c] = src[u * 256 + v] as number;
      }
    }
  }
  for (let r = 0; r < WATER_SIZE; r++) {
    dst[r * WATER_STRIDE + 256] = dst[r * WATER_STRIDE] as number;
    dst[r * WATER_STRIDE + 257] = dst[r * WATER_STRIDE + 1] as number;
  }
}

/** Estado del objeto agua (campos `[3]..[6]`, `[0xE]` del exe; todos float32). */
export class WaterFx {
  /** Origen intacto: clon del bitmap al cargar, ya sin las colas de 2 px (stride 256; FUN_00646830 lo reempaqueta). Destino con stride 258. */
  readonly src: Uint8Array;
  readonly dst = new Uint8Array(WATER_STRIDE * WATER_SIZE + 1);
  private offX = 0;
  private offY = 0;
  private phase = 0;
  private cosPhase = 0;

  private readonly def: WaterDef;

  constructor(def: WaterDef, index: Uint8Array) {
    this.def = def;
    this.src = Uint8Array.from(index);
  }

  /**
   * Un ciclo lógico (20/s), solo si el mar se dibujó desde el anterior (agua.md §3). `cam` = centro de la ventana en
   * píxeles de mapa, o null si no hay visor.
   */
  step(cam: { readonly x: number; readonly y: number } | null): void {
    const d = this.def;
    if (d.type === 2 && cam) {
      const f = Math.fround(Math.fround(Math.fround(Math.cos(this.cosPhase)) * d.length) + d.length * 0.5);
      // FUN_005CACA0 (call 0x406771 sobre el vector): lo NORMALIZA en el sitio; el desplazamiento avanza f px por ciclo hacia/contra el centro, no f·distancia
      const dx = Math.fround(cam.x - d.centerX);
      const dy = Math.fround(cam.y - d.centerY);
      const len = Math.fround(Math.sqrt(Math.fround(dx * dx + dy * dy)));
      const ux = len > 0 ? Math.fround(dx / len) : 0; // shortcut: el exe divide por 0 (NaN) si la cámara está justo en el centro
      const uy = len > 0 ? Math.fround(dy / len) : 0;
      this.offX = Math.fround(this.offX + Math.fround(ux * f));
      this.offY = Math.fround(this.offY + Math.fround(uy * f));
      this.cosPhase = Math.fround(this.cosPhase + d.speed);
    } else if (d.type === 1) {
      this.offX = Math.fround(this.offX + Math.fround(Math.cos(Math.fround(d.anginc * DEG)) * d.velinc));
      this.offY = Math.fround(this.offY + Math.fround(Math.sin(Math.fround(d.anginc * DEG)) * d.velinc));
    }
    this.phase = Math.fround(d.sininc + this.phase);
    warp(this.src, this.dst, d.type === 2 ? 2 : 1, this.phase, this.offX, this.offY);
  }

  /** Copia el destino (sin la cola) al índice del sprite que dibujan los tiles. */
  copyTo(index: Uint8Array): void {
    for (let r = 0; r < WATER_SIZE; r++) index.set(this.dst.subarray(r * WATER_STRIDE, r * WATER_STRIDE + WATER_SIZE), r * WATER_SIZE);
  }
}
