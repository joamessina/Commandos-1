/**
 * Soldado alemán (BAP1/BAP2/BANPE1/BANPE2): patrulla (`acPatrulla`), vista con barrido de cabeza (`AcVigilar`), reacción (`AcBap`) y disparo (`AcDisparar`).
 * Fuentes: docs/lectura/soldado-acbap.md (órdenes), patrulla.md, vigilar-vigilante.md (barrido), ac-disparar.md y disparo-enemigo.md (daño 30, sin tirada
 * de acierto: daña siempre que el blanco esté en la lista de vistos; recarga = TIEMPORECARGA (15 por defecto, ctor 0x45AE70) + rand%6).
 * Órdenes de `AcBap` portadas: 4 patrulla/puesto · 8 apuntar al visto (0x28 ciclos) · 0x11 disparar · 9 ir a investigar · 0x14 volver al puesto · 0x15 muerto.
 * shortcut: sin la cadena de reacciones por sonidos/cuerpos/compañeros (alarma, voces, refuerzos), sin fumar/charlar/mirar alrededor (órdenes 5/0xD/0xE),
 *           sin desnudo ni Gestapo (el atontado y el esposado solo ponen la animación, la altura 5 y dejan de actuar: sin chirivitas ni la cadena de avisos); el disparo de otro soldado a <200 u (SONIDO_PELIGRO) los manda a investigar; giro del cuerpo instantáneo
 *           al apuntar; los golpes del jugador usan la energía por defecto 100 (armas-danio.md §5: pistola 3 tiros, fusil de mira 1, cuchillo 1) y un soldado herido
 *           que sobrevive apunta al agresor. Cuándo mejorar: al portar AcBap2 completo (0x43A0E0…).
 */
import { DAMAGE, type Target, type Weapon } from './attack.ts';
import { DEFAULT_ANGLE, DEFAULT_RANGE, sees } from './vision.ts';
import { Patrol, type Route } from './patrol.ts';
import type { SectorMap } from './sectors.ts';
import type { Unit } from './unit.ts';
import { norm360 } from './walk.ts';

export const Order = { Patrol: 4, Aim: 8, Investigate: 9, Shoot: 0x11, Return: 0x14, Dead: 0x15 } as const;
export type Order = (typeof Order)[keyof typeof Order];

const AIM_CYCLES = 0x28; // acc+0x90 de la orden 8
const LOSE_CYCLES = 20; // sin ver al blanco: va a investigar
const SHOT_DAMAGE = 30;
const RELOAD_BASE = 15; // acc+0x50 por defecto de AcDisparar
/** Ruido del fusil del soldado (`FUSL` en la tabla de ruidos 0x821DE0: radio 400; la pistola enemiga sería `PIPA` 600). Se oye si dist < radio (Oido01, strict). */
export const GUNSHOT_RADIUS = 400;
const SWEEP_AMP = 50; // AcVigilar ANGBARRIDO por defecto
const SWEEP_PERIOD = 100; // DEMORA por defecto
const SWEEP_PHASE = [0, 4, 3, 0, 2, 1, 1, 4, 2, 0, 2, 4, 2, 0, 3, 1]; // 0x812B28
const INVESTIGATE_WAIT = 60;
/** Entrada 7 (atontado): `+0x34 = 600` ciclos (30 s); altura del bicho 5,0 (`0x793734`) en 6 y 7 (docs/lectura/guarda.md §4). */
const STUN_CYCLES = 600;
const DOWN_HEIGHT = 5;

/**
 * Alcance real de la vista con la cabeza girada `headDeg` (AcVigilar `FUN_004C0E60` con VISTAELIPTICA=1, por defecto): el alcance base `a` se mide sobre un óvalo
 * de semiejes a y b = a/3, `r = LOOKSCAN·a·b/√((b·cosθ)² + (a·senθ)²)`; mirando de frente vale `a` y mirando de costado cae a ~42 % con θ = 50°. El órgano lo recibe
 * como `MSGO_VISTA_SETANGCABEZA_CHANGEMOD(ángulo, alcance·1000)` y pasa a ser su `+0x64` (el radio de los dos conos).
 */
export function lookRange(base: number, headDeg: number, lookScan = 1): number {
  const b = base * (1 / 3); // 0x799668
  const th = (headDeg * Math.PI) / 180;
  return (lookScan * base * b) / Math.hypot(b * Math.cos(th), base * Math.sin(th));
}

export interface Shot {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  /** ¿Dio en el blanco? (siempre, mientras lo vea). */
  readonly hit: boolean;
}

export interface SoldierWorld {
  /** Comandos vivos o muertos (el soldado filtra). */
  readonly commandos: readonly Unit[];
  /** Cuerpos tirados (soldados y comandos muertos): al verlos va a investigar (clasificador FUN_006AFC10 código 2 → FUN_004326B0). */
  readonly bodies?: readonly { readonly x: number; readonly y: number }[];
  readonly sectors: SectorMap | null;
  readonly rng: () => number;
  /** Un disparo de un soldado: el mundo lo dibuja y avisa a los demás. */
  readonly onShot: (from: Soldier, shot: Shot) => void;
}

export class Soldier implements Target {
  readonly unit: Unit;
  readonly token: string;
  order: Order = Order.Patrol;
  /** Rumbo de la cabeza respecto del cuerpo (barrido). */
  headAngle = 0;
  /** Alcance actual de la vista (cambia con el giro de la cabeza, ver `lookRange`). */
  reach: number;
  target: Unit | null = null;
  private readonly patrol: Patrol | null;
  private readonly post: { x: number; y: number; ang: number };
  private readonly range: number;
  private readonly angle: number;
  private phase: number;
  private timer = 0;
  private lost = 0;
  private cooldown = 0;
  private moving = false;
  private spot: { x: number; y: number } | null = null;
  private readonly seenBodies = new Set<string>();
  /** Ciclos de atontado que faltan (cachiporrazo = puño); 0 = no está atontado. */
  stun = 0;
  /** Esposado (entrada 6 de AcGuarda): fuera de combate. */
  cuffed = false;
  private standHeight = 0;

  /** Artillero de un nido: no se mueve (investiga girando, no caminando). */
  private readonly fixed: boolean;
  private readonly sweepAmp: number;
  private readonly elliptical: boolean;
  /** Radio del ruido de su disparo (fusil 400 `FUSL`; el nido `NIDO` 500). */
  readonly noiseRadius: number;

  constructor(
    token: string,
    unit: Unit,
    route: Route | null,
    opts: { readonly range?: number; readonly angle?: number; readonly fixed?: boolean; readonly sweep?: number; readonly elliptical?: boolean; readonly noise?: number } = {},
  ) {
    this.fixed = opts.fixed ?? false;
    this.sweepAmp = opts.sweep ?? SWEEP_AMP;
    this.elliptical = opts.elliptical ?? true;
    this.noiseRadius = opts.noise ?? GUNSHOT_RADIUS;
    this.token = token;
    this.unit = unit;
    this.patrol = route && route.points.length > 0 ? new Patrol(route) : null;
    this.post = { x: unit.body.x, y: unit.body.y, ang: unit.body.ang };
    this.range = opts.range ?? DEFAULT_RANGE;
    this.reach = this.range;
    this.angle = opts.angle ?? DEFAULT_ANGLE;
    let h = 0;
    for (const ch of token) h += ch.charCodeAt(0);
    this.phase = ((SWEEP_PHASE[h & 15] ?? 0) + 0x14) * 5; // fase inicial del barrido (AcVigilar +0x18)
    this.idleAnim();
  }

  get dead(): boolean {
    return this.unit.dead;
  }

  get x(): number {
    return this.unit.body.x;
  }

  get y(): number {
    return this.unit.body.y;
  }

  /** Golpe de un comando (daño de `DAMAGE`): si sobrevive se vuelve hacia quien lo hirió. */
  hurt(weapon: Weapon, from: Unit): void {
    if (this.dead) return;
    if (weapon === 'PUNO' || weapon === 'PIEDRA') {
      this.knockOut();
      return;
    }
    if (weapon === 'ESPOSAS') {
      this.handcuff();
      return;
    }
    if (this.unit.hit(DAMAGE[weapon])) {
      this.order = Order.Dead;
      this.target = null;
    } else if (!this.down && (this.order === Order.Patrol || this.order === Order.Return || this.order === Order.Investigate)) this.startAim(from);
  }

  /** Atontado o esposado: no ve ni actúa. */
  get down(): boolean {
    return this.stun > 0 || this.cuffed;
  }

  private lieDown(anim: string): void {
    if (this.standHeight === 0) this.standHeight = this.unit.height;
    this.unit.height = DOWN_HEIGHT;
    this.unit.stop();
    this.moving = false;
    this.target = null;
    if (this.unit.anim.has(anim)) this.unit.anim.set(anim);
  }

  /** `MSGA_CACHIPORRAZO` (entrada 7 de AcGuarda): cae con la animación ATONTADO durante 600 ciclos y se levanta. */
  private knockOut(): void {
    if (this.cuffed) return;
    this.stun = STUN_CYCLES;
    this.lieDown('ATONTADO');
  }

  /** `MSGA_HAS_SIDO_ESPOSADO` (entrada 6): queda esposado con la animación ESPOSAS1 y no se levanta. */
  private handcuff(): void {
    this.stun = 0;
    this.cuffed = true;
    this.lieDown('ESPOSAS1');
  }

  private getUp(): void {
    this.stun = 0;
    this.unit.height = this.standHeight || this.unit.height;
    this.standHeight = 0;
    this.order = Order.Return;
    this.returnToPost();
  }

  /** Muerte directa (explosión). */
  kill(): void {
    if (this.dead) return;
    this.unit.hit(1e9);
    this.order = Order.Dead;
    this.target = null;
  }

  /** Oye un disparo en (x,y): si está tranquilo va a investigar. */
  hear(x: number, y: number): void {
    if (this.dead || this.down) return;
    if (this.order === Order.Patrol || this.order === Order.Return) this.investigate(x, y);
  }

  private idleAnim(): void {
    if (this.unit.anim.has('REPOSO')) this.unit.anim.set('REPOSO');
  }

  private investigate(x: number, y: number): void {
    if (this.fixed) {
      this.face(x, y); // el artillero del nido solo gira hacia el ruido
      return;
    }
    this.order = Order.Investigate;
    this.spot = { x, y };
    this.timer = INVESTIGATE_WAIT;
    this.unit.speed = null;
    this.unit.goTo({ x, y }, false);
    this.moving = this.unit.target !== null;
    if (this.moving) this.unit.anim.set('ANDAR');
  }

  private face(x: number, y: number): void {
    this.unit.body.ang = norm360((Math.atan2(y - this.unit.body.y, x - this.unit.body.x) * 180) / Math.PI);
  }

  /** El comando más cercano que ve (cono + oclusión), o null. */
  private scan(w: SoldierWorld): Unit | null {
    const b = this.unit.body;
    const viewer = { x: b.x, y: b.y, z: this.unit.z, eye: this.unit.eye, sector: this.unit.sector, heading: b.ang + this.headAngle, range: this.reach, angle: this.angle };
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const c of w.commandos) {
      if (c.dead || c.hidden || c.diving) continue; // dentro de una casa o buceando (oculto, 0x23C & 0x80000) no lo ven
      if (!sees(viewer, { x: c.body.x, y: c.body.y, z: c.z, eye: c.eye, radius: 10, low: c.crouched }, w.sectors)) continue;
      const d = Math.hypot(c.body.x - b.x, c.body.y - b.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Ángulo de apertura del cono (`.ANG`). */
  get aperture(): number {
    return this.angle;
  }

  /** Un ciclo de lógica. */
  tick(w: SoldierWorld): void {
    if (this.unit.dead) {
      this.order = Order.Dead;
      this.unit.tick();
      return;
    }
    if (this.down) {
      this.unit.tick();
      if (!this.cuffed && --this.stun <= 0) this.getUp();
      return;
    }
    const aiming = this.order === Order.Aim || this.order === Order.Shoot;
    // AcVigilar: la cabeza barre ±ANGBARRIDO; apuntando, mira al frente (el cuerpo ya se giró hacia el blanco)
    this.phase++;
    this.headAngle = aiming ? 0 : Math.sin((2 * Math.PI * (this.phase % SWEEP_PERIOD)) / SWEEP_PERIOD) * this.sweepAmp;
    this.reach = this.elliptical ? lookRange(this.range, this.headAngle) : this.range; // VISTAELIPTICA 0: el alcance no varía con la cabeza
    const seen = this.scan(w);
    if (seen) {
      this.lost = 0;
      this.spot = { x: seen.body.x, y: seen.body.y };
    } else this.lost++;

    if (!seen && (this.order === Order.Patrol || this.order === Order.Return)) this.lookForBodies(w);
    switch (this.order) {
      case Order.Patrol:
      case Order.Return:
      case Order.Investigate:
        if (seen) this.startAim(seen);
        else if (this.order === Order.Patrol) this.walkRoute();
        else if (this.order === Order.Investigate) this.investigating();
        else this.returning();
        break;
      case Order.Aim:
        this.aiming(seen);
        break;
      case Order.Shoot:
        this.shooting(w, seen);
        break;
      default:
        break;
    }
    this.unit.tick();
  }

  /**
   * Ve un cuerpo por primera vez (FUN_004326B0: anota su posición y mira hacia él) y va a verlo de cerca.
   * shortcut: el exe además sube el nivel de alerta y puede dar la alarma por la cadena de reacciones (no portada); aquí solo investiga el sitio, una vez por cuerpo.
   */
  private lookForBodies(w: SoldierWorld): void {
    const b = this.unit.body;
    const viewer = { x: b.x, y: b.y, z: this.unit.z, eye: this.unit.eye, sector: this.unit.sector, heading: b.ang + this.headAngle, range: this.reach, angle: this.angle };
    for (const body of w.bodies ?? []) {
      const key = `${Math.round(body.x).toString()},${Math.round(body.y).toString()}`;
      if (this.seenBodies.has(key) || (body.x === b.x && body.y === b.y)) continue;
      if (!sees(viewer, { x: body.x, y: body.y, radius: 10, low: false }, w.sectors)) continue;
      this.seenBodies.add(key);
      this.investigate(body.x, body.y);
      return;
    }
  }

  private startAim(c: Unit): void {
    this.order = Order.Aim;
    this.target = c;
    this.timer = AIM_CYCLES;
    this.unit.stop();
    this.moving = false;
    this.face(c.body.x, c.body.y);
    if (this.unit.anim.has('APUNTAR')) this.unit.anim.set('APUNTAR');
  }

  private aiming(seen: Unit | null): void {
    if (seen) {
      this.target = seen;
      this.face(seen.body.x, seen.body.y);
    }
    if (this.lost >= LOSE_CYCLES && this.spot) {
      this.investigate(this.spot.x, this.spot.y);
      return;
    }
    if (--this.timer <= 0 && seen) {
      this.order = Order.Shoot;
      this.cooldown = 0;
    }
  }

  private shooting(w: SoldierWorld, seen: Unit | null): void {
    if (!seen) {
      if (this.lost >= LOSE_CYCLES && this.spot) this.investigate(this.spot.x, this.spot.y);
      return;
    }
    this.target = seen;
    this.face(seen.body.x, seen.body.y);
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }
    this.cooldown = RELOAD_BASE + Math.floor(w.rng() * 6);
    if (this.unit.anim.has('DISPARAR')) {
      this.unit.anim.set('APUNTAR');
      this.unit.anim.set('DISPARAR');
    }
    seen.hit(SHOT_DAMAGE);
    w.onShot(this, { fromX: this.unit.body.x, fromY: this.unit.body.y, toX: seen.body.x, toY: seen.body.y, hit: true });
    if (seen.dead) {
      this.target = null;
      this.order = Order.Return;
      this.returnToPost();
    }
  }

  private investigating(): void {
    if (this.unit.target !== null) return;
    if (this.moving) {
      this.moving = false;
      this.idleAnim();
    }
    if (--this.timer <= 0) {
      this.order = Order.Return;
      this.returnToPost();
    }
  }

  private returnToPost(): void {
    this.unit.speed = null;
    const p = this.patrol?.target ?? this.post;
    this.unit.goTo({ x: p.x, y: p.y }, false);
    this.moving = this.unit.target !== null;
    if (this.moving) this.unit.anim.set('ANDAR');
    else this.finishReturn();
  }

  private returning(): void {
    if (this.unit.target === null) this.finishReturn();
  }

  private finishReturn(): void {
    this.order = Order.Patrol;
    this.moving = false;
    if (this.patrol) this.patrol.resend();
    else {
      this.unit.body.ang = this.post.ang;
      this.idleAnim();
    }
  }

  /** Recorrido de `acPatrulla`: ir al punto, girar, esperar, siguiente. */
  private walkRoute(): void {
    const u = this.unit;
    if (!this.patrol) return;
    const arrived = this.moving && u.target === null;
    if (arrived) {
      this.moving = false;
      this.idleAnim();
    }
    const s = this.patrol.step(arrived);
    if (s.kind === 'goto') {
      u.speed = s.point.vel;
      u.goTo({ x: s.point.x, y: s.point.y }, false);
      this.moving = true; // si ya estaba allí o no hay camino, target queda null y se da por llegado en el ciclo siguiente
      if (u.target !== null) u.anim.set('ANDAR');
    } else if (s.kind === 'face') u.body.ang = norm360(s.angle);
    else if (s.kind === 'jump') {
      u.place(s.point.x, s.point.y, u.body.ang);
      this.idleAnim();
    }
  }
}
