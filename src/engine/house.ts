/**
 * Casas y cuarteles (`AcCasa`, docs/lectura/obj-contenedores.md §1-§2): los comandos entran (quedan ocultos, nadie los ve) y salen por el punto de salida.
 * Cuartel (`NUMREGENSOLDIERS > 0`) o casa con algún alemán dentro: cada aliado de dentro recibe 30 de daño cada 5 ciclos (`FUN_0044DF30`, tick `FUN_0044E190`),
 * o sea entrar en un cuartel es mortal. Si la casa muere, todos los ocupantes reciben impacto BOMBA (100).
 * shortcut: capacidad 20 sin ranuras ni conductor; sin la puerta animada ni el sonido; la salida es el punto `XYZSALIDA` tal cual (el exe busca un sitio libre por
 *           ángulos, `FUN_004B90A0`); no hay soldados alemanes que entren o salgan (refuerzos con la alarma no portados). Cuándo mejorar: al portar la alarma.
 */
import { asNumbers, find, type Node } from '../formats/clave.ts';
import type { Unit } from './unit.ts';
import type { Elem } from './world.ts';

export interface HouseBox {
  /** `.BOXSELECCIONREL [x y ancho alto]` relativo al punto proyectado de la casa. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const CAPACITY = 20;
const DAMAGE = 30; // impacto tipo 0 de 0x1E
const COOLDOWN = 4; // +0x50 = 4 → un golpe cada 5 ciclos

export class House {
  readonly token: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly entry: { x: number; y: number; z: number };
  readonly exit: { x: number; y: number; z: number };
  /** `NUMREGENSOLDIERS` (cuartel si > 0). */
  private reserve: number;
  private readonly barracksKind: boolean;
  readonly jail: boolean;
  readonly box: HouseBox;
  readonly occupants: Unit[] = [];
  private cooldown = 0;

  constructor(e: Elem, params: readonly Node[]) {
    this.token = e.token;
    this.x = e.x;
    this.y = e.y;
    this.z = e.z;
    const en = asNumbers(find(params, '.XYZENTRADA'));
    const ex = asNumbers(find(params, '.XYZSALIDA'));
    this.entry = en?.length === 3 ? { x: en[0] ?? 0, y: en[1] ?? 0, z: en[2] ?? 0 } : { x: e.x, y: e.y, z: e.z };
    this.exit = ex?.length === 3 ? { x: ex[0] ?? 0, y: ex[1] ?? 0, z: ex[2] ?? 0 } : this.entry;
    this.reserve = Number(String(find(params, '.NUMREGENSOLDIERS') ?? 0)) || 0;
    this.barracksKind = this.reserve > 0;
    this.jail = Number(String(find(params, '.CARCEL') ?? 0)) > 0;
    const b = asNumbers(find(e.block, '.BOXSELECCIONREL'));
    this.box = b?.length === 4 ? { x: b[0] ?? 0, y: b[1] ?? 0, w: b[2] ?? 0, h: b[3] ?? 0 } : { x: -20, y: -50, w: 40, h: 50 };
  }

  get barracks(): boolean {
    return this.barracksKind;
  }

  get regen(): number {
    return this.reserve;
  }

  /** `FUN_005A2AD0`: solo descuenta una reserva cuando se creó el patrullero. */
  recruit(create: () => boolean): boolean {
    if (this.reserve <= 0 || !create()) return false;
    this.reserve--;
    return true;
  }

  /** Un comando entra (si hay sitio): queda oculto. */
  enter(u: Unit): boolean {
    if (this.occupants.length >= CAPACITY || u.dead || this.occupants.includes(u)) return false;
    this.occupants.push(u);
    u.hidden = true;
    u.inHouse = this.token;
    u.stop();
    return true;
  }

  /** Sale por el punto de salida. */
  leave(u: Unit): boolean {
    const i = this.occupants.indexOf(u);
    if (i < 0) return false;
    this.occupants.splice(i, 1);
    u.hidden = false;
    u.inHouse = null;
    u.place(this.exit.x, this.exit.y, u.body.ang);
    return true;
  }

  /** Muere la casa: los de dentro mueren (BOMBA 100). */
  destroy(): void {
    this.reserve = 0;
    for (const u of this.occupants.splice(0)) {
      u.inHouse = null;
      u.hit(1e9);
    }
  }

  /** Un ciclo: cuartel con aliados dentro = 30 de daño a cada uno cada 5 ciclos. */
  tick(): void {
    for (let i = this.occupants.length - 1; i >= 0; i--) if (this.occupants[i]?.dead) this.occupants.splice(i, 1);
    if (!this.barracks || this.occupants.length === 0) {
      this.cooldown = 0;
      return;
    }
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }
    for (const u of this.occupants) u.hit(DAMAGE);
    this.cooldown = COOLDOWN;
  }
}

/** Casas de una misión: elementos con `acCasa` (CASA, CUARTEL, CARCEL). */
export function parseHouses(elems: readonly Elem[]): House[] {
  const out: House[] = [];
  for (const e of elems) {
    const a = e.actions.find((x) => x.name.toUpperCase() === 'ACCASA');
    if (a) out.push(new House(e, a.params));
  }
  return out;
}
