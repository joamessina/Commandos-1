/**
 * Soldado alemán (BAP1/BAP2/BANPE1/BANPE2): patrulla (`acPatrulla`), vista con barrido de cabeza (`AcVigilar`), reacción (`AcBap`) y disparo (`AcDisparar`).
 * Fuentes: docs/lectura/soldado-acbap.md (órdenes), patrulla.md, vigilar-vigilante.md (barrido), ac-disparar.md y disparo-enemigo.md (daño 30, sin tirada
 * de acierto: daña siempre que el blanco esté en la lista de vistos; recarga = TIEMPORECARGA (15 por defecto, ctor 0x45AE70) + rand%6).
 * Órdenes de `AcBap` portadas: 4 patrulla/puesto · 5 fumar · 8 apuntar al visto (0x28 ciclos) · 0x11 disparar · 9 ir a investigar · 0xB ir a la cajetilla · 0x14 volver al puesto · 0x15 muerto · 0x18 recogerla.
 * Piedra (`MSGA_PEDRADA`, armas-restantes.md): el contador de pedradas sube; la 1.ª mira 100 ciclos, la 2.ª mira al lanzador 200, desde la 3.ª los que caminan (BAP2/BANPE2) van hacia él.
 * Cajetilla (`FUN_0043B270`/`FUN_00435060`/`FUN_0043BA50`, solo AcBap2/AcBanpe2; tabaco-control.md): camina a 1,5 hasta ella, anima RECOGER (8 ciclos), vuelve al puesto y a los 60 ciclos fuma 500 (FUMAR);
 * después vuelve a fumar cada 370-1000 ciclos. Control alemán (`ClassBichoArrestado`): el esposado se levanta, obedece a su dueño dentro de un anillo de radio 400 y hace charlar a los que se le acercan.
 * shortcut: sin la cadena de reacciones por sonidos/cuerpos/compañeros (alarma, voces, refuerzos), sin fumar/charlar/mirar alrededor (órdenes 5/0xD/0xE),
 *           los pasos finos de la cajetilla (mirar al lanzador 30 ciclos si cae a la vista, voces AL01/AL07), la orden 0xE de la 1.ª pedrada de BAP2 (aquí mira como BAP1), el rango de charla del control
 *           (hip: 120) y que el que charla no vigila (hip); sin desnudo ni Gestapo (el atontado y el esposado solo ponen la animación, la altura 5 y dejan de actuar: sin chirivitas ni la cadena de avisos); el disparo de otro soldado a <200 u (SONIDO_PELIGRO) los manda a investigar; giro del cuerpo instantáneo
 *           al apuntar; los golpes del jugador usan la energía por defecto 100 (armas-danio.md §5: pistola 3 tiros, fusil de mira 1, cuchillo 1) y un soldado herido
 *           que sobrevive apunta al agresor. Cuándo mejorar: al portar AcBap2 completo (0x43A0E0…).
 */
import { DAMAGE, type Target, type Weapon } from './attack.ts';
import { followPoint } from './groups.ts';
import type { Claimant, Pack, Packs } from './throwing.ts';
import { DEFAULT_ANGLE, DEFAULT_RANGE, sees } from './vision.ts';
import { Patrol, type Route } from './patrol.ts';
import type { SectorMap } from './sectors.ts';
import type { Unit } from './unit.ts';
import { norm360 } from './walk.ts';

export const Order = { Patrol: 4, Smoke: 5, Aim: 8, Investigate: 9, Pack: 0xb, Look: 0xe, Shoot: 0x11, Return: 0x14, Dead: 0x15, Pick: 0x18 } as const;
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
/** `AcBap` base (BAP1, BANPE1): ante un estímulo se queda mirando el punto (orden 9) `+0x90 = 100` ciclos; AcBap2/AcBanpe2 caminan hasta él (docs/lectura/soldado-acbap2.md §0). */
const LOOK_CYCLES = 100;
/** Cada cuántos ciclos un patrullero recalcula su puesto en la formación. */
const FOLLOW_EVERY = 10;
/** Velocidad extra del seguidor sobre la del líder (`ORDEN_MUEVETE`: `acc+0xD0 + 0,5`). */
const FOLLOW_SPEED_BONUS = 0.5;
const PACK_SPEED = 1.5; // `FUN_0043B270`: velocidad al ir a la cajetilla
const PICK_CYCLES = 8; // RECOGER (b=8 en el ANM)
const SMOKE_FIRST = 60; // `acc+0x78` tras recoger
const SMOKE_CYCLES = 500; // FUMAR
const SMOKE_MIN = 370;
const SMOKE_SPAN = 631; // 370..1000
/** Radio del anillo del control alemán (`0x79BFD8`) y distancia a la que un controlado hace charlar a otro soldado (hip: `AuInsignia` ≤ 120). */
export const CONTROL_RADIUS = 400;
export const CHAT_RANGE = 120;
export const CHAT_CYCLES = 10;

/** Patrullero de un grupo: sigue a su líder con un lateral y una distancia hacia atrás (engine/groups.ts). */
export interface Follow {
  /** Posición y rumbo del líder, o null si ya no está. */
  readonly leader: () => { readonly x: number; readonly y: number; readonly ang: number; readonly speed: number | null } | null;
  readonly lateral: number;
  readonly back: number;
}
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
  readonly bodies?: readonly { readonly x: number; readonly y: number; /** Altura del suelo bajo el cuerpo: con ella el rayo de vista pasa por la pendiente de los sectores como con cualquier blanco. */ readonly z?: number }[];
  readonly sectors: SectorMap | null;
  readonly rng: () => number;
  /** Cajetillas en el suelo. */
  readonly packs?: Packs;
  /** Un disparo de un soldado: el mundo lo dibuja y avisa a los demás. */
  readonly onShot: (from: Soldier, shot: Shot) => void;
  readonly onVoice?: (from: Soldier, voice: 'VMUE' | 'ALRM') => void;
  readonly onEvent?: (event: string) => void;
}

export class Soldier implements Target, Claimant {
  readonly unit: Unit;
  readonly token: string;
  order: Order = Order.Patrol;
  /** Rumbo de la cabeza respecto del cuerpo (barrido). */
  headAngle = 0;
  /** Alcance actual de la vista (cambia con el giro de la cabeza, ver `lookRange`). */
  reach: number;
  target: Unit | null = null;
  private patrol: Patrol | null;
  private readonly post: { x: number; y: number; ang: number };
  private readonly range: number;
  private readonly angle: number;
  private phase: number;
  private timer = 0;
  private lost = 0;
  private cooldown = 0;
  private moving = false;
  private bodyAlertPending = false;
  private lookTurns = 0;
  private spot: { x: number; y: number } | null = null;
  private readonly seenBodies = new Set<string>();
  /** Ciclos de atontado que faltan (cachiporrazo = puño); 0 = no está atontado. */
  stun = 0;
  /** Esposado (entrada 6 de AcGuarda): fuera de combate. */
  cuffed = false;
  /** `.TENGOTABACO` (`0x23C & 0x10000`): muerto, el comando se lo puede robar; también lo recibe quien recoge una cajetilla. */
  tobacco: boolean;
  /** Dueño si un comando lo controla (`AuTomarControlAleman`); null = libre. */
  controlled: Unit | null = null;
  /** Ciclos de charla que le quedan (`ECHAR_CHARLA`): quieto y sin vigilar. */
  chatLeft = 0;
  private pedradas = 0;
  private pack: Pack | null = null;
  private smokeIn = -1;
  private standHeight = 0;

  /** Artillero de un nido: no se mueve (investiga girando, no caminando). */
  private readonly fixed: boolean;
  private readonly sweepAmp: number;
  private readonly elliptical: boolean;
  /** false = soldado de la base `AcBap` (BAP1/BANPE1): mira el punto del estímulo pero no va hasta él. */
  private readonly walks: boolean;
  private follow: Follow | null;
  private followWait = 0;
  /** AcBap2/AcBanpe2: van a por la cajetilla y fuman; los de la base solo la anotan. */
  private readonly smokes: boolean;
  private readonly brain: 'base' | 'route' | null;
  private readonly investigateSpeed: number | null;
  /** Radio del ruido de su disparo (fusil 400 `FUSL`; el nido `NIDO` 500). */
  readonly noiseRadius: number;

  constructor(
    token: string,
    unit: Unit,
    route: Route | null,
    opts: { readonly range?: number; readonly angle?: number; readonly fixed?: boolean; readonly sweep?: number; readonly elliptical?: boolean; readonly noise?: number; readonly walks?: boolean; readonly follow?: Follow; readonly smokes?: boolean; readonly tobacco?: boolean; readonly brain?: 'base' | 'route'; readonly investigateSpeed?: number; readonly alternateRoutes?: readonly Route[]; readonly waitRouteEvent?: boolean } = {},
  ) {
    this.fixed = opts.fixed ?? false;
    this.sweepAmp = opts.sweep ?? SWEEP_AMP;
    this.elliptical = opts.elliptical ?? true;
    this.walks = opts.walks ?? true;
    this.follow = opts.follow ?? null;
    this.smokes = opts.smokes ?? false;
    this.brain = opts.brain ?? null;
    this.investigateSpeed = this.brain === 'route' ? (opts.investigateSpeed ?? 3) : null;
    this.tobacco = opts.tobacco ?? false;
    this.noiseRadius = opts.noise ?? GUNSHOT_RADIUS;
    this.token = token;
    this.unit = unit;
    this.patrol = route && route.points.length > 0 ? new Patrol(route, opts.alternateRoutes, opts.waitRouteEvent) : null;
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

  /** El patrullero elegido deja de seguir y toma el recorrido del jefe (`FUN_004D4680`). */
  promote(route: Route | null, alternatives: readonly Route[] = []): void {
    this.releasePack();
    this.follow = null;
    this.patrol = route && route.points.length > 0 ? new Patrol(route, alternatives) : null;
    this.target = null;
    this.order = Order.Patrol;
    this.moving = false;
    this.unit.stop();
  }

  /** Solicitud de ruta recibida por `MSGA_TRIGGER_REACT`. */
  triggerRoute(event: string): boolean {
    return this.patrol?.trigger(event) ?? false;
  }

  /** Golpe de un comando (daño de `DAMAGE`): si sobrevive se vuelve hacia quien lo hirió. */
  hurt(weapon: Weapon, from: Unit): void {
    if (this.dead) return;
    if (weapon === 'PIEDRA') {
      this.pedrada(from);
      return;
    }
    if (weapon === 'PUNO') {
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
    if (this.dead || this.down || this.controlled) return;
    if (this.order === Order.Patrol || this.order === Order.Return || this.order === Order.Smoke) this.investigate(x, y);
  }

  /** `MSGA_PEDRADA` (sin daño): reacción según cuántas lleva (ver cabecera). El artillero del nido solo gira. */
  pedrada(from: Unit): void {
    if (this.dead || this.down || this.controlled) return;
    this.pedradas++;
    const b = from.body;
    if (this.fixed) this.face(b.x, b.y);
    else if (this.order === Order.Aim || this.order === Order.Shoot) return;
    else if (this.pedradas >= 3 && this.walks) this.investigate(b.x, b.y);
    else this.stare(b.x, b.y, this.pedradas === 1 ? LOOK_CYCLES : 2 * LOOK_CYCLES);
  }

  /** `NO_VENGAS` de la cajetilla: otro está más cerca, vuelve al puesto. */
  callOff(): void {
    if (this.order !== Order.Pack) return;
    this.pack = null;
    this.order = Order.Return;
    this.returnToPost();
  }

  /** Su cuerpo tiene tabaco para robar (y se lo lleva el que lo roba). */
  takeTobacco(): boolean {
    if (!this.dead || !this.tobacco) return false;
    this.tobacco = false;
    return true;
  }

  /** `ECHAR_CHARLA`: se queda quieto `cycles` ciclos mirando a (x, y), sin vigilar. */
  chat(x: number, y: number, cycles: number): void {
    if (this.dead || this.down || this.controlled || this.order === Order.Aim || this.order === Order.Shoot) return;
    if (this.chatLeft <= 0) this.face(x, y);
    this.chatLeft = cycles;
  }

  /** `AuTomarControlAleman` sobre un esposado: se levanta y obedece a `owner`. Devuelve false si no está esposado. */
  control(owner: Unit): boolean {
    if (this.dead || !this.cuffed) return false;
    this.cuffed = false;
    this.unit.height = this.standHeight || this.unit.height;
    this.standHeight = 0;
    this.controlled = owner;
    this.order = Order.Patrol;
    this.unit.speed = null;
    this.moving = false;
    this.idleAnim();
    return true;
  }

  /** `FIN_CONTROL_ARRESTADO`: queda esposado donde esté. shortcut: el exe destruye el bicho controlado y devuelve al esposado original (su sitio no se leyó); aquí es el mismo. */
  releaseControl(): void {
    if (!this.controlled) return;
    this.controlled = null;
    this.unit.stop();
    this.handcuff();
  }

  /** El controlado va a `p` recortado al anillo de radio 400 centrado en su dueño (`FUN_004BB1E0`). */
  controlGo(p: { readonly x: number; readonly y: number }, sector?: Parameters<Unit['goTo']>[2]): boolean {
    const o = this.controlled;
    if (!o) return false;
    const dx = p.x - o.body.x;
    const dy = p.y - o.body.y;
    const d = Math.hypot(dx, dy);
    const k = d > CONTROL_RADIUS - 0.1 ? (CONTROL_RADIUS - 0.1) / d : 1;
    const ok = this.unit.goTo({ x: o.body.x + dx * k, y: o.body.y + dy * k }, false, k === 1 ? sector : undefined);
    this.moving = ok && this.unit.target !== null;
    if (this.moving) this.unit.anim.set('ANDAR');
    return ok;
  }

  private idleAnim(): void {
    if (this.unit.anim.has('REPOSO')) this.unit.anim.set('REPOSO');
  }

  /** Se queda quieto mirando (x, y) `cycles` ciclos y vuelve al puesto. */
  private stare(x: number, y: number, cycles: number): void {
    this.releasePack();
    this.order = Order.Investigate;
    this.spot = { x, y };
    this.timer = cycles;
    this.moving = false;
    this.unit.stop();
    this.face(x, y);
    this.idleAnim();
  }

  private investigate(x: number, y: number): void {
    if (this.fixed) {
      this.face(x, y); // el artillero del nido solo gira hacia el ruido
      return;
    }
    if (!this.walks) {
      this.stare(x, y, LOOK_CYCLES);
      return;
    }
    this.releasePack();
    this.order = Order.Investigate;
    this.spot = { x, y };
    this.timer = INVESTIGATE_WAIT;
    this.unit.speed = this.investigateSpeed;
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
    if (this.controlled) {
      if (this.moving && this.unit.target === null) {
        this.moving = false;
        this.idleAnim();
      }
      this.unit.tick();
      return;
    }
    if (this.chatLeft > 0) {
      this.chatLeft--;
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

    if (!seen && (this.order === Order.Patrol || this.order === Order.Return)) {
      this.lookForBodies(w);
      this.lookForPacks(w);
    }
    if (this.smokeIn > 0 && this.order === Order.Patrol) this.smokeIn--;
    switch (this.order) {
      case Order.Patrol:
      case Order.Return:
      case Order.Investigate:
      case Order.Pack:
      case Order.Pick:
      case Order.Smoke:
        if (seen) this.startAim(seen);
        else if (this.order === Order.Pack) this.goingToPack();
        else if (this.order === Order.Pick) this.picking(w);
        else if (this.order === Order.Smoke) this.smoking(w);
        else if (this.order === Order.Patrol) {
          if (this.smokeIn === 0) this.startSmoke();
          else if (this.follow) this.followLeader(this.follow);
          else this.walkRoute(w);
        }
        else if (this.order === Order.Investigate) this.investigating();
        else this.returning();
        break;
      case Order.Aim:
        this.aiming(seen);
        break;
      case Order.Look:
        if (seen) {
          this.finishBodyAlert(w);
          this.startAim(seen);
        } else this.lookAround(w);
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
   * Ve un cuerpo por primera vez (FUN_004326B0: anota su posición y mira hacia él) y va a verlo de cerca. El cuerpo se ve como cualquier blanco de la vista: cono, rayo ojo a ojo por la pendiente
   * de los sectores (`FUN_005F9820`) con su ojo a 0 (`AcMuerte` estado 1: `bicho+0x58 = 0`), de modo que el borde de un acantilado o un muelle esconde al que yace a su pie y no hay regla por nivel (organos.md).
   * shortcut: el ojo vale 0 desde que cae (el exe lo pone al terminar la animación de muerte, estado 1) y no se prueban los volúmenes (`FUN_0063E200`).
   * shortcut: sin niveles de alerta; BAP1 emite ALRM/VMUE y BAP2 VMUE al comenzar a investigar, una vez por posición. Mejorar al portar la cadena completa.
   */
  private lookForBodies(w: SoldierWorld): void {
    const b = this.unit.body;
    const viewer = { x: b.x, y: b.y, z: this.unit.z, eye: this.unit.eye, sector: this.unit.sector, heading: b.ang + this.headAngle, range: this.reach, angle: this.angle };
    for (const body of w.bodies ?? []) {
      const key = `${Math.round(body.x).toString()},${Math.round(body.y).toString()}`;
      if (this.seenBodies.has(key) || (body.x === b.x && body.y === b.y)) continue;
      if (!sees(viewer, { x: body.x, y: body.y, radius: 10, low: false, ...(body.z === undefined ? {} : { z: body.z, eye: 0 }) }, w.sectors)) continue;
      this.seenBodies.add(key);
      if (this.brain === 'base') w.onVoice?.(this, 'ALRM');
      if (this.brain) w.onVoice?.(this, 'VMUE');
      if (this.brain === 'route') this.bodyAlertPending = true;
      this.investigate(body.x, body.y);
      return;
    }
  }

  /** Ve una cajetilla (código 0xB, `FUN_00434460`): si nadie más cercano va, camina hasta ella. */
  private lookForPacks(w: SoldierWorld): void {
    if (!this.smokes || !w.packs) return;
    const b = this.unit.body;
    const viewer = { x: b.x, y: b.y, z: this.unit.z, eye: this.unit.eye, sector: this.unit.sector, heading: b.ang + this.headAngle, range: this.reach, angle: this.angle };
    for (const p of w.packs.list) {
      if (p.taken || !sees(viewer, { x: p.x, y: p.y, radius: 2, low: false }, w.sectors) || !w.packs.claim(p, this)) continue;
      this.pack = p;
      this.order = Order.Pack;
      this.unit.speed = PACK_SPEED;
      this.unit.goTo({ x: p.x, y: p.y }, false);
      this.moving = this.unit.target !== null;
      if (this.moving) this.unit.anim.set('ANDAR');
      return;
    }
  }

  private releasePack(): void {
    if (this.pack && this.pack.claimant === this) this.pack.claimant = null;
    this.pack = null;
  }

  private goingToPack(): void {
    const p = this.pack;
    if (!p || p.taken) {
      this.order = Order.Return;
      this.returnToPost();
      return;
    }
    if (this.unit.target !== null) return;
    this.moving = false;
    if (Math.hypot(p.x - this.x, p.y - this.y) > 30) {
      this.releasePack(); // no llegó (camino cortado)
      this.order = Order.Return;
      this.returnToPost();
      return;
    }
    this.order = Order.Pick;
    this.timer = PICK_CYCLES;
    this.unit.stop();
    if (this.unit.anim.has('RECOGER')) this.unit.anim.set('RECOGER');
  }

  private picking(w: SoldierWorld): void {
    if (--this.timer > 0) return;
    const p = this.pack;
    this.pack = null;
    if (p && !p.taken) {
      w.packs?.take(p);
      this.tobacco = true;
      this.smokeIn = SMOKE_FIRST;
    }
    this.order = Order.Return;
    this.returnToPost();
  }

  private startSmoke(): void {
    this.order = Order.Smoke;
    this.timer = SMOKE_CYCLES;
    this.unit.stop();
    this.moving = false;
    if (this.unit.anim.has('FUMAR')) this.unit.anim.set('FUMAR');
  }

  private smoking(w: SoldierWorld): void {
    if (--this.timer > 0) return;
    this.smokeIn = SMOKE_MIN + Math.floor(w.rng() * SMOKE_SPAN);
    this.order = Order.Return;
    this.returnToPost();
  }

  private startAim(c: Unit): void {
    this.releasePack();
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
    if (this.bodyAlertPending && this.brain === 'route') {
      this.order = Order.Look;
      this.lookTurns = 0;
      this.timer = 30;
      return;
    }
    if (--this.timer <= 0) {
      this.order = Order.Return;
      this.returnToPost();
    }
  }

  private finishBodyAlert(w: SoldierWorld): void {
    if (this.bodyAlertPending) w.onVoice?.(this, 'ALRM');
    this.bodyAlertPending = false;
  }

  /** `FUN_0043BA50`: tres giros, con esperas de 30 ciclos, y ALRM al salir de la orden. */
  private lookAround(w: SoldierWorld): void {
    if (--this.timer > 0) return;
    const angles = [0, 180, 90];
    const angle = angles[this.lookTurns];
    if (angle !== undefined) {
      this.unit.body.ang = norm360(this.unit.body.ang + angle); // shortcut: giro instantáneo; mejorar al portar MOTOR_SETANG.
      this.lookTurns++;
      this.timer = 30;
      return;
    }
    this.finishBodyAlert(w);
    this.order = Order.Return;
    this.returnToPost();
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

  /** Patrullero de un grupo: cada `FOLLOW_EVERY` ciclos va al puesto que le toca detrás de su líder (`FUN_004D5650`/`FUN_004C31C0`); sin líder se queda donde está. */
  private followLeader(f: Follow): void {
    const u = this.unit;
    if (this.moving && u.target === null) {
      this.moving = false;
      this.idleAnim();
    }
    const l = f.leader();
    if (!l || this.followWait-- > 0) return;
    this.followWait = FOLLOW_EVERY;
    const p = followPoint(l.x, l.y, l.ang, f.lateral, f.back);
    if (Math.hypot(p.x - this.x, p.y - this.y) < 6) return;
    u.speed = l.speed === null ? null : l.speed + FOLLOW_SPEED_BONUS;
    u.goTo(p, false);
    this.moving = u.target !== null;
    if (this.moving) u.anim.set('ANDAR');
  }

  /** Recorrido de `acPatrulla`: ir al punto, girar, esperar, siguiente. */
  private walkRoute(w: SoldierWorld): void {
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
    } else if (s.kind === 'event') w.onEvent?.(s.event);
    else if (s.kind === 'face') u.body.ang = norm360(s.angle);
    else if (s.kind === 'jump') {
      u.place(s.point.x, s.point.y, u.body.ang);
      this.idleAnim();
    }
  }
}
