/**
 * Un comando en el mundo: cuerpo (walk.ts) + animador (anim.ts), con el flujo de docs/research/q1-movimiento.md §R1:
 * el clic fija un destino y la animación (ANDAR/CORRE) se elige por nombre; la velocidad la decide el motor
 * (2.5 al andar; correr según personaje), NO la animación. La animación avanza por distancia recorrida sobre el rumbo.
 * Con un SectorMap: suelo = plano del sector, destino y pasos validados (docs/research/q1-movimiento.md §R4); agua ×0.5.
 * Rutas (R3, docs/research/q1-rutas.md): `goTo` pide a `Nav` la cadena de sectores (atajo recto o A*) y camina por sus puntos de giro; sin camino la orden se rechaza.
 * Atasco: 9 ciclos sin avanzar (FUN_00629EF0) y la orden se abandona (TPathTool::abandona, FUN_006281A0: para el motor y, si faltan menos de 10 u al
 * destino, la da por cumplida; si no, resetea. NO re-planifica). shortcut: sin escaleras/PEscal (bit 4) ni agua/buceo en la ruta.
 * shortcut: al detenerse la secuencia queda en el paso donde estaba (no se leyó cómo el original elige la pose de reposo),
 *           cuándo mejorar: al leer REPOSO/AGACHARSE y el estado de animación del bicho.
 */
import type { Anm } from '../formats/anm.ts';
import type { Sector } from '../formats/sec.ts';
import { Animator } from './anim.ts';
import type { Boat } from './boat.ts';
import { CLIMB_DOWN_MIN, CLIMB_UP_MIN, newClimb, reverse, stepClimb, wallXY, type Climb, type Ladder } from './ladder.ts';
import { navFor, type Nav } from './path.ts';
import { COS50, groundZ, isWater, SIN50, simBlocked, stepOk, TYPE_DEEPWATER, validTarget, type SectorMap } from './sectors.ts';
import { newBody, norm360, runSpeed, stepBody, WALK_SPEED, type Body, type Vec } from './walk.ts';

export { COS50, SIN50 };

/** Energía inicial de los comandos (tabla `0x815198`). */
export const COMMANDO_ENERGY: Readonly<Record<string, number>> = { COMANDO: 200, FRANCOT: 100, LANCHERO: 160, ARTIFIC: 130, CONDUC: 130, ESPIA: 160 };

/** Mundo (x,y,z) -> píxel de mapa. Verificado con 19 edificios del mapa 0 (mediana 0,3 px): docs/research/q1-render.md. */
export const project = (x: number, y: number, z: number): { px: number; py: number } => ({ px: x, py: COS50 * y - SIN50 * z });

/** Inversa de `project` para un plano z conocido. */
export const unproject = (px: number, py: number, z: number): Vec => ({ x: px, y: (py + SIN50 * z) / COS50 });

/** Ciclos seguidos sin avanzar que disparan un nuevo plan (FUN_00629EF0: `param_1[5] < 9`). */
const STUCK_CYCLES = 9;

/** Punto del mundo con la altura del suelo en él. */
export interface Vec3 extends Vec {
  z: number;
}

export class Unit {
  readonly body: Body;
  readonly anim: Animator;
  /** Destino final de la orden vigente (con la altura del suelo ahí, para dibujarlo). */
  target: Vec3 | null = null;
  /** Puntos que faltan hasta `target` (el primero es al que va el cuerpo). */
  private path: Vec3[] = [];
  private stuck = 0;
  private readonly nav: Nav | null;
  running = false;
  /** Sector que pisa (null sin mapa de sectores o fuera de todos). */
  sector: Sector | null = null;
  /** Energía (`bicho+0x208`): tabla 0x815198 para los comandos. */
  energy = 100;
  dead = false;
  /** Agachado (0x23C & 0x40): lo ven a la mitad de alcance. */
  crouched = false;
  /** Velocidad al andar (VEL de la ruta del soldado); null = la del jugador, 2,5. */
  speed: number | null = null;
  /**
   * Munición por arma (`AuDisparar .MUNMIRILLA n`, acción+0x48+id·4); un arma sin entrada es ilimitada.
   * shortcut: el ctor del exe copia 1 como munición inicial de pistola/arpón/escopeta cuando el MAC no trae `MUN…` (tabla 0x8143C0 +0x74), lo que no se pudo interpretar
   *           (¿un solo tiro?); solo se limita lo que el MIS fija (MUNMIRILLA 6). Cuándo mejorar: al leer FUN_004F1680 / el uso real de la columna +0x74.
   */
  readonly ammo: Record<string, number> = {};
  /** Trepada en curso (escalera); null si no trepa. */
  climb: Climb | null = null;
  /** Altura del cuerpo (`.VOLCOLISION .H` = `bicho+0x58`). shortcut: 29 (la de los soldados) si el elemento no la trae. */
  height = 29;
  /** Altura del ojo: agachado o buceando es H×0,125 (`bicho+0x58`, AUAgacharse/AuBucear). */
  get eye(): number {
    return this.crouched || this.diving ? this.height * 0.125 : this.height;
  }
  /** Buceando (AuBucear): solo se pisan sectores de agua, sin el ×0,5 del agua (MotorAliado lo omite al bucear) y los soldados no lo ven (oculto). shortcut: va en línea recta (sin rutas por el mar). */
  diving = false;
  /** Casa en la que está (oculto dentro). */
  inHouse: string | null = null;
  /** Oculto (el cuerpo `DESAPARECE` de MATABICHOSSECTOR): no se dibuja ni se ve. */
  hidden = false;
  /** Acción pendiente al llegar al destino de `doAt` (p. ej. plantar la bomba). */
  private arrive: (() => void) | null = null;
  /** Ciclos que faltan de una animación que ocupa al personaje (`playOnce`) y qué hacer al terminar. */
  private busy = 0;
  private busyDone: (() => void) | null = null;
  /** Vehículo en el que va (su plaza = `seat`): el cuerpo sigue a la plaza y no camina. */
  boat: Boat | null = null;
  private seat = 0;

  constructor(
    readonly token: string,
    anm: Anm,
    x: number,
    y: number,
    /** Altura del suelo en el punto: la del plano del sector si hay mapa de sectores; si no, la del `.XYZ` (shortcut: suelo plano). */
    public z: number,
    angle: number,
    private readonly sectors: SectorMap | null = null,
  ) {
    this.body = newBody(x, y, angle);
    this.anim = new Animator(anm, 'ANDAR');
    this.nav = sectors ? navFor(sectors) : null;
    this.land();
  }

  /**
   * Ordena caminar (o correr) hasta un punto del mundo. Devuelve false si el destino no es transitable (FUN_0053A250).
   * `to` = sector del destino: quien da la orden lo recibe del picking del cursor (SectorMap.pick, FUN_00628470 lo toma como parámetro).
   * shortcut: sin `to`, sale de atZ con la z del comando; cuándo mejorar: si algún llamador no pasa por el cursor.
   */
  goTo(p: Vec, run: boolean, to: Sector | null = this.sectors?.atZ(p.x, p.y, this.z) ?? null): boolean {
    if (this.sectors && !validTarget(to, this.diving ? { water: true } : {})) return false;
    const goalZ = to ? groundZ(to, p.x, p.y) : this.z;
    let path: Vec3[] = [{ ...p, z: goalZ }];
    if (this.nav && !this.diving) {
      const route = this.sector ? this.nav.route(this.body, this.sector, p, to) : null;
      if (!route) return false;
      if (route.length === 0) return true; // ya está a menos de 2 u: la orden se ignora
      path = route;
    }
    this.path = path;
    this.stuck = 0;
    this.target = { ...p, z: goalZ };
    // agachado (0x23C & 0x40) el flag de correr se fuerza a 0 y solo cambia la animación (ARRASTRARSE); la velocidad es la de andar (FUN_004BC460, q1-movimiento.md)
    this.running = run && !this.crouched;
    const run1 = ['CORRE', 'CORRER'].find((n) => this.anim.has(n));
    this.anim.set(this.diving && this.anim.has('BUCEAR') ? 'BUCEAR' : this.crouched && this.anim.has('ARRASTRARSE') ? 'ARRASTRARSE' : this.running && run1 ? run1 : 'ANDAR');
    return true;
  }

  /**
   * Sector en (x,y): siguiendo los vecinos del actual (FUN_005F9E60, así se sube a un puente o piso B que la vecindad enlaza);
   * si no, búsqueda global con z. shortcut: el original cae a FUN_005F6C60 (sin z); atZ evita elegir un B que está por encima.
   */
  private sectorAt(x: number, y: number): Sector | null {
    return (this.sector && this.nav?.follow(this.sector, x, y)) || (this.sectors?.atZ(x, y, this.z) ?? null);
  }

  /** Sector y altura del suelo bajo el cuerpo. */
  private land(): void {
    const s = this.sectorAt(this.body.x, this.body.y);
    this.sector = s;
    if (s) this.z = groundZ(s, this.body.x, this.body.y);
  }

  /** ¿Puede pisar (x,y)? Sector transitable y escalón dentro de [-20,+15] respecto del suelo actual. */
  private blocked = (x: number, y: number): boolean => {
    if (!this.sectors) return false;
    const s = this.sectorAt(x, y);
    return !s || simBlocked(s, this.diving ? { water: true } : {}) || (s !== this.sector && !stepOk(groundZ(s, x, y) - this.z));
  };

  /**
   * AUEscalar: va al pie de la escalera (el extremo más cercano en z) y trepa; devuelve false si está desactivada, si el desnivel no pasa el umbral del motor
   * (subir > 15, bajar > 20) o no hay camino.
   */
  useLadder(l: Ladder): boolean {
    if (this.dead || this.boat || l.disabled) return false;
    const up = this.z <= (l.low.z + l.high.z) / 2;
    if (Math.abs(l.high.z - l.low.z) <= (up ? CLIMB_UP_MIN : CLIMB_DOWN_MIN)) return false;
    const from = up ? l.low : l.high;
    const sec = this.sectors?.atZ(from.x, from.y, from.z) ?? null;
    return this.doAt(
      from,
      () => {
        this.beginClimb(l, up ? 1 : -1);
      },
      sec,
    );
  }

  private beginClimb(l: Ladder, dir: 1 | -1): void {
    this.climb = newClimb(l, dir);
    const s = dir > 0 ? l.low : l.high;
    const e = dir > 0 ? l.high : l.low;
    this.body.x = s.x;
    this.body.y = s.y;
    this.z = s.z;
    this.body.ang = norm360((Math.atan2(e.y - s.y, e.x - s.x) * 180) / Math.PI);
    this.anim.set(dir > 0 && this.anim.has('ESCALAR_EMPIEZA') ? 'ESCALAR_EMPIEZA' : this.anim.has('ESCALAR_CICLICO') ? 'ESCALAR_CICLICO' : this.anim.name);
  }

  /** Lo lleva un montacargas: desplaza el cuerpo y su altura. */
  carryBy(dx: number, dy: number, dz: number): void {
    this.body.x += dx;
    this.body.y += dy;
    this.z += dz;
  }

  /** Al parar el montacargas: vuelve a buscar el sector bajo los pies. */
  settle(): void {
    this.land();
  }

  /** Botón derecho (MSG_BOTON2VIRTUAL) trepando: pausa, queda congelado a esa altura. */
  pauseClimb(): void {
    if (this.climb) this.climb.paused = true;
  }

  /** Clic izquierdo con la trepada pausada: +1 si el punto está más alto que el comando, −1 si más bajo (FUN_004F3C70); sigue o da vuelta. */
  resumeClimb(targetZ: number): void {
    if (this.climb) reverse(this.climb, targetZ >= this.z ? 1 : -1);
  }

  private climbTick(): void {
    const c = this.climb;
    if (!c) return;
    const r = stepClimb(c, this.z);
    if (!c.paused) this.anim.advance(0, 1);
    if (c.phase === 'top' && c.dir > 0 && this.anim.has('ESCALAR_FIN')) this.anim.set('ESCALAR_FIN');
    this.z = r.z;
    const w = wallXY(c.ladder, r.z);
    this.body.x = w.x;
    this.body.y = w.y;
    if (!r.done) return;
    const end = c.dir > 0 ? c.ladder.high : c.ladder.low;
    this.body.x = end.x;
    this.body.y = end.y;
    this.z = end.z + (c.dir > 0 ? 2 : 0);
    this.climb = null;
    this.land();
    this.anim.set(this.anim.has('REPOSO') ? 'REPOSO' : 'ANDAR');
  }

  /**
   * AuBucear: empieza solo si el sector que pisa es de agua (`MSGO_MOTOR_GETSECTORESPISADOS`), anima BUCEAR y pasa al modo agua. Devuelve el nuevo estado.
   */
  toggleDive(): boolean {
    if (this.dead || this.boat) return this.diving;
    if (this.diving) {
      // salir (clic derecho): quita buceando/oculto; solo donde se pueda estar de pie (agua somera o tierra)
      if (this.sector?.type === TYPE_DEEPWATER) return true;
      this.diving = false;
      this.stop();
      this.anim.set(this.anim.has('REPOSO') ? 'REPOSO' : 'ANDAR');
      return false;
    }
    if (!isWater(this.sector)) return false;
    this.diving = true;
    this.stop();
    if (this.anim.has('BUCEAR')) this.anim.set('BUCEAR');
    return true;
  }

  /** Se tira al agua desde el bote parado (la salida es cualquier sector de agua, también profunda) y empieza a bucear. */
  diveOut(): boolean {
    const boat = this.boat;
    if (!boat || boat.speed >= 0.01 || !this.sectors) return false;
    for (const slot of boat.slots) {
      const p = boat.slotPoint(slot.exit);
      const s = this.sectors.atZ(p.x, p.y, boat.z) ?? this.sectors.at(p.x, p.y);
      if (!isWater(s)) continue;
      this.boat = null;
      this.body.x = p.x;
      this.body.y = p.y;
      this.land();
      this.diving = true;
      if (this.anim.has('BUCEAR')) this.anim.set('BUCEAR');
      return true;
    }
    return false;
  }

  /** AUAgacharse (`AGAC`, 0x4E5E00): alterna agachado/de pie (en bote no); agachado los enemigos lo ven a la mitad de alcance. Devuelve el nuevo estado. */
  toggleCrouch(): boolean {
    if (this.dead || this.boat) return this.crouched;
    this.crouched = !this.crouched;
    this.running = false;
    const idle = this.crouched ? 'AGACHARSE' : 'REPOSO';
    if (this.target === null && this.anim.has(idle)) this.anim.set(idle);
    else if (this.target !== null) this.anim.set(this.crouched && this.anim.has('ARRASTRARSE') ? 'ARRASTRARSE' : 'ANDAR');
    return this.crouched;
  }

  /** Detiene la orden de caminar en curso (y cualquier acción pendiente). */
  stop(): void {
    this.path = [];
    this.target = null;
    this.arrive = null;
    this.busy = 0;
    this.busyDone = null;
  }

  /** ¿Está ocupado en una animación de acción (`playOnce`)? */
  get occupied(): boolean {
    return this.busy > 0;
  }

  /** Camina hasta `p` y al llegar ejecuta `then` (ManejaBomba: camina → gira → anima → actúa, docs/lectura/au-jugador.md). Devuelve false si no hay camino. */
  doAt(p: Vec, then: () => void, sector?: Sector | null): boolean {
    if (!this.goTo(p, false, sector)) return false;
    this.arrive = then;
    return true;
  }

  /** Reproduce una animación una vez, quieto, durante su período, y al terminar llama a `done`. */
  playOnce(name: string, done: () => void): void {
    this.path = [];
    this.target = null;
    this.arrive = null;
    if (this.anim.has(name)) this.anim.set(name);
    this.busy = Math.max(1, this.anim.period(name));
    this.busyDone = done;
  }

  /** Coloca al personaje (teletransporte de JUMP, al bajar de un vehículo): posición y rumbo, y vuelve a buscar el sector. */
  place(x: number, y: number, ang: number): void {
    this.body.x = x;
    this.body.y = y;
    this.body.ang = ang;
    this.body.vx = this.body.vy = 0;
    this.stop();
    this.land();
  }

  /** Sube a una plaza del bote (animación EMBARCADO). */
  board(boat: Boat, seat: number): void {
    this.boat = boat;
    this.seat = seat;
    this.path = [];
    this.target = null;
    if (this.anim.has('EMBARCADO')) this.anim.set('EMBARCADO');
    this.ride();
  }

  private ride(): void {
    const boat = this.boat;
    const slot = boat?.slots[this.seat];
    if (!boat || !slot) return;
    const p = boat.slotPoint(slot.entry);
    this.body.x = p.x;
    this.body.y = p.y;
    this.body.ang = (((boat.ang + slot.angle) % 360) + 360) % 360;
    this.body.vx = this.body.vy = 0;
    this.z = boat.z;
  }

  /**
   * Baja del bote (FUN_00503340: solo con el bote casi parado, velocidad < 0,01): prueba la SALIDA de la propia plaza y luego las demás;
   * sirve el primer punto con sector a pie (DEEPWATER no). Devuelve false si no hay dónde bajar.
   */
  disembark(): boolean {
    const boat = this.boat;
    if (!boat || boat.speed >= 0.01 || !this.sectors) return false;
    const order = boat.slots.map((_, i) => (i + this.seat) % boat.slots.length);
    for (const i of order) {
      const slot = boat.slots[i];
      if (!slot) continue;
      const p = boat.slotPoint(slot.exit);
      const s = this.sectors.atZ(p.x, p.y, boat.z) ?? this.sectors.at(p.x, p.y);
      if (!validTarget(s)) continue;
      this.boat = null;
      this.body.x = p.x;
      this.body.y = p.y;
      this.land();
      this.anim.set('ANDAR');
      return true;
    }
    return false;
  }

  /**
   * `AcMuerte` (docs/lectura/muerte.md §3): si la energía ≤ daño muere (energía 0), si no se descuenta. Devuelve true si murió con este golpe.
   * shortcut: sin animación de herido ni voces; la muerte anima MUERTE1 y deja el cuerpo.
   */
  hit(damage: number): boolean {
    if (this.dead) return false;
    if (this.energy > damage) {
      this.energy -= damage;
      return false;
    }
    this.energy = 0;
    this.dead = true;
    this.path = [];
    this.target = null;
    this.body.vx = this.body.vy = 0;
    this.boat = null;
    if (this.anim.has('MUERTE1')) this.anim.set('MUERTE1');
    return true;
  }

  /** Un ciclo de lógica (1/20 s). */
  tick(): void {
    if (this.dead) {
      this.anim.advance(0, 1);
      return;
    }
    if (this.climb) {
      this.climbTick();
      return;
    }
    if (this.busy > 0) {
      this.anim.advance(0, 1);
      if (--this.busy === 0) {
        const d = this.busyDone;
        this.busyDone = null;
        d?.();
      }
      return;
    }
    if (this.boat) {
      this.ride();
      return;
    }
    const v = this.running ? runSpeed(this.token) : (this.speed ?? WALK_SPEED);
    const wp = this.path[0] ?? null;
    const r = stepBody(this.body, wp, v, isWater(this.sector) && !this.diving ? 0.5 : 1, this.blocked);
    this.land();
    if (wp && r.arrived) {
      this.path.shift();
      if (this.path.length === 0) this.target = null;
    } else if (wp) this.watchStuck(r.dx, r.dy);
    if (this.arrive && this.target === null && this.path.length === 0) {
      const a = this.arrive;
      this.arrive = null;
      a();
    }
    const rad = (this.body.ang * Math.PI) / 180;
    this.anim.advance(r.dx * Math.cos(rad) + r.dy * Math.sin(rad), 1); // distancia sobre el rumbo (FUN_00591DE0)
  }

  /** Cuenta ciclos sin avanzar y, al llegar a 9, abandona la orden (cumplida si faltan < 10 u, reseteada si no: en ambos casos el comando se queda). */
  private watchStuck(dx: number, dy: number): void {
    this.stuck = dx * dx + dy * dy < 1e-4 ? this.stuck + 1 : 0;
    if (this.stuck < STUCK_CYCLES) return;
    this.stuck = 0;
    this.path = [];
    this.target = null;
  }

  /** Puntos que faltan hasta el destino (para dibujar la ruta). */
  get waypoints(): readonly Vec3[] {
    return this.path;
  }

  get moving(): boolean {
    return this.target !== null || Math.abs(this.body.vx) + Math.abs(this.body.vy) > 0.001;
  }
}
