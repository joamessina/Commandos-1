/**
 * Zodiac (`MotorBalsa` + `SimBalsa`): docs/lectura/sim-vehiculos.md §1 y §5, docs/lectura/obj-contenedores.md §3.
 * El motor pide VELMAX constante hacia el destino y calcula `avanzar(v−e, v+e)` con `e = R·Δ·π/180`; el Sim topa cada oruga a 5,0,
 * filtra con `v *= 0,8` (0,5 si tocó tierra), integra el empuje y limita el desplazamiento a 0,5·R por ciclo.
 * shortcut: sin el SimObjeto terrestre (balsa varada con fricción 0,2), sin corriente de sector, sin ParachoquesDuro ni
 *           rebote en DEEPWATER vacía; al topar con tierra se frena en seco. Cuándo mejorar: al portar vehículos terrestres.
 */
import { asList, asNumber, asNumbers, find } from '../formats/clave.ts';
import { isWater, type SectorMap } from './sectors.ts';
import type { Elem } from './world.ts';
import { norm180, type Vec } from './walk.ts';

const DEG = Math.PI / 180;
const TRACK_MAX = 5; // SimBalsa+0xB4 (0x793734)
const ARRIVE_PREC = 64; // motor+0x90 de la base
const MAX_STEP_R = 0.5; // limitar: 0,5·R por ciclo (FUN_006679D0)

/** Plaza del bote (`.INFO [[ .ENTRADA .SALIDA .ANGULO ]…]`) en coordenadas locales (x hacia proa). */
export interface BoatSlot {
  readonly entry: readonly [number, number];
  readonly exit: readonly [number, number];
  readonly angle: number;
}

/**
 * Plaza que ocupa quien sube (`FUN_004B74D0`): si su habilidad coincide con la del vehículo (`AcUsaHab .HABILIDAD BALSA`, solo el marino) toma la plaza 0 = la del piloto
 * (`bicho+0x138 = 1`, el único que le da órdenes al vehículo); si no, va de pasajero en una plaza ≥ 1. null = no hay plaza libre.
 * shortcut: el exe, con la plaza 0 ocupada por otro, la intercambia (`MSGA_INTERCAMBIA_POS`); aquí el piloto solo entra si esa plaza está libre.
 */
export function freeSeat(slots: number, taken: ReadonlySet<number>, pilot: boolean): number | null {
  if (pilot) return taken.has(0) || slots < 1 ? null : 0;
  for (let i = 1; i < slots; i++) if (!taken.has(i)) return i;
  return null;
}

export class Boat {
  /** Ángulo en grados (0 = +x). */
  ang: number;
  vx = 0;
  vy = 0;
  dest: Vec | null = null;
  /** Se tocó tierra en el último ciclo (+0xCC). */
  touchedLand = false;
  readonly radius: number;
  readonly vmax: number;
  readonly slots: readonly BoatSlot[];
  x: number;
  y: number;
  z: number;
  private reverse = false;
  private readonly sectors: Pick<SectorMap, 'at'> | null;

  constructor(x: number, y: number, z: number, ang: number, slots: readonly BoatSlot[], sectors: Pick<SectorMap, 'at'> | null, radius = 30, vmax = 4) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.ang = ang;
    this.slots = slots;
    this.sectors = sectors;
    this.radius = radius;
    this.vmax = vmax;
  }

  /** Teletransporte (`MSG_TELEPORTSELECCIONADO` sobre un vehículo): lo pone en el punto, parado y sin destino. */
  place(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.dest = null;
    this.vx = this.vy = 0;
  }

  /** `GoTo` del motor: la marcha atrás se decide una sola vez (balsa: |Δ| > 135° y d² < 16·R²). */
  goTo(p: Vec): void {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    if (dx * dx + dy * dy < 1e-6 && this.dest) return;
    this.dest = { x: p.x, y: p.y };
    const delta = norm180(Math.atan2(dy, dx) / DEG - this.ang);
    this.reverse = Math.abs(delta) > 135 && dx * dx + dy * dy < 16 * this.radius * this.radius;
  }

  stop(): void {
    this.dest = null;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /** Punto del mundo de una plaza (`SALIDA` o `ENTRADA`) girado con el bote. */
  slotPoint(local: readonly [number, number]): Vec {
    const r = this.ang * DEG;
    return { x: this.x + local[0] * Math.cos(r) - local[1] * Math.sin(r), y: this.y + local[0] * Math.sin(r) + local[1] * Math.cos(r) };
  }

  /** Un ciclo: motor (`FUN_005F17C0` + maniobra `FUN_005F00E0`) y Sim (inercia `FUN_00667D30`, integración, límite). */
  tick(): void {
    let a = 0;
    let b = 0;
    if (this.dest) {
      const dx = this.dest.x - this.x;
      const dy = this.dest.y - this.y;
      if (dx * dx + dy * dy >= this.vmax * this.vmax + ARRIVE_PREC) {
        // (el exe anula Δ si d² ≤ 4, pero aquí d² ≥ v² + 64 siempre)
        let delta = norm180(Math.atan2(dy, dx) / DEG - this.ang);
        let v = this.vmax;
        if (this.reverse) {
          v = -v;
          delta = norm180(delta + 180);
        }
        const e = this.radius * delta * DEG;
        a = v - e;
        b = v + e;
        const m = Math.max(Math.abs(a), Math.abs(b));
        if (m > TRACK_MAX) {
          a *= TRACK_MAX / m;
          b *= TRACK_MAX / m;
        }
      } else this.dest = null;
    }
    const k = this.touchedLand ? 0.5 : 0.8;
    this.vx *= k;
    this.vy *= k;
    if (this.vx * this.vx + this.vy * this.vy < 1e-4) this.vx = this.vy = 0;
    const omega = ((b - a) / (2 * this.radius) / DEG) * (this.touchedLand ? 0.75 : 1);
    const d = 0.5 * (a + b);
    const h = (this.ang + omega / 2) * DEG;
    const nx = d * Math.cos(h);
    const ny = d * Math.sin(h);
    const nn = nx * nx + ny * ny;
    if (nn > 1e-4) {
      const vn = this.vx * nx + this.vy * ny;
      if (vn < nn) {
        const f = 1 - vn / nn;
        this.vx += nx * f;
        this.vy += ny * f;
      }
    }
    this.ang = (((this.ang + omega) % 360) + 360) % 360;
    let mx = this.vx;
    let my = this.vy;
    const lim = MAX_STEP_R * this.radius;
    const m2 = mx * mx + my * my;
    if (m2 > lim * lim) {
      const s = lim / Math.sqrt(m2);
      mx *= s;
      my *= s;
    }
    this.touchedLand = false;
    const nxp = this.x + mx;
    const nyp = this.y + my;
    const into = this.sectors?.at(nxp, nyp) ?? null;
    if (this.sectors && !isWater(into)) {
      this.touchedLand = true;
      this.vx = this.vy = 0;
      return;
    }
    this.x = nxp;
    this.y = nyp;
  }
}

/** Plazas del `acPilotaje.INFO` de un vehículo (ENTRADA, SALIDA, ANGULO); vacío si no es un vehículo. */
export function boatSlots(e: Elem): BoatSlot[] {
  const params = e.actions.find((a) => a.name.toUpperCase() === 'ACPILOTAJE')?.params ?? [];
  const out: BoatSlot[] = [];
  for (const s of asList(find(params, '.INFO')) ?? []) {
    const l = asList(s);
    const en = asNumbers(find(l ?? [], '.ENTRADA'));
    const ex = asNumbers(find(l ?? [], '.SALIDA'));
    if (en && ex) out.push({ entry: [en[0] ?? 0, en[1] ?? 0], exit: [ex[0] ?? 0, ex[1] ?? 0], angle: asNumber(find(l ?? [], '.ANGULO')) ?? 0 });
  }
  return out;
}
