/**
 * Paso de caminata de un peatón: motor + Sim. Port de tools/q1a_sim_walk.py; fuentes (exe de la raíz) y evidencia en
 * docs/research/q1-movimiento.md §R1: motor FUN_005D7D90/FUN_005DCF70 (rumbo, frenado), Sim FUN_0066BB20 (v*=0.3),
 * FUN_00575F60 (empuje mínimo), FUN_005734A0 (mezcla 0.8/0.2), FUN_0057E6E0 (límites y pos += v), FUN_00574200 (vprev).
 * Unidades: mapa por ciclo de lógica; el juego corre a 20 ciclos/s.
 * shortcut: sin colisiones, rampas, agua ni escalones (el Sim real prueba el movimiento hasta 3 veces y desliza),
 *           cuándo mejorar: al portar CHOQ*.VOL y los sectores (.SEC).
 */

export interface Vec {
  x: number;
  y: number;
}

export interface Body {
  x: number;
  y: number;
  /** Ángulo del cuerpo en grados de mundo [0,360): 0 = +x, 90 = +y. */
  ang: number;
  /** Velocidad del Sim (== vprev al final de cada ciclo). */
  vx: number;
  vy: number;
  /** Ángulo objetivo (`motor+0x54`): solo se actualiza si d² > 1.5·R². */
  angTarget: number;
}

/** Velocidades pedidas al motor (u/ciclo): andar del jugador, constante 0x793CE8. */
export const WALK_SPEED = 2.5;
/** Correr: tabla por personaje en 0x815198 (COMANDO y CONDUC 6.0; el resto 5.0). */
export function runSpeed(token: string): number {
  return token === 'COMANDO' || token === 'CONDUC' ? 6 : 5;
}

/** Radio del cilindro de un peatón (VOLCOLISION CILINDRO .R 10). */
export const BODY_RADIUS = 10;
const ARRIVE_D2 = 1; // BUSCADORGOTOPUNTO: FUN_005D7D90(1.0)
const MAX_TURN = 45; // FUN_0066BCD0: |v.ang| <= 45°

export const newBody = (x: number, y: number, ang: number): Body => ({ x, y, ang: norm360(ang), vx: 0, vy: 0, angTarget: norm360(ang) });

export function norm360(a: number): number {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

export function norm180(a: number): number {
  const r = norm360(a);
  return r >= 180 ? r - 360 : r;
}

export interface StepResult {
  /** Desplazamiento efectivo de este ciclo. */
  readonly dx: number;
  readonly dy: number;
  /** true cuando el motor declara el punto alcanzado (queda la deriva del Sim). */
  readonly arrived: boolean;
}

/**
 * Un ciclo de lógica. `target` null = no hay destino (Mover(0,0,0,0,0)): solo actúa la deriva del Sim.
 * `v` = velocidad pedida (SETVEL).
 */
export function stepBody(b: Body, target: Vec | null, v: number): StepResult {
  // ---- motor ----
  let nx = 0;
  let ny = 0;
  let dAng = 0;
  let arrived = target === null;
  if (target) {
    const dx = target.x - b.x;
    const dy = target.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < ARRIVE_D2) arrived = true;
    else {
      const phi = norm360((Math.atan2(dy, dx) * 180) / Math.PI);
      if (d2 > 1.5 * BODY_RADIUS * BODY_RADIUS) b.angTarget = phi;
      dAng = norm180(b.angTarget - b.ang);
      let vp = v;
      if (d2 < 16 * v * v && v > 0.001) vp = Math.sqrt(d2) / Math.ceil(Math.sqrt(d2) / v); // frenado: llega justo en N ciclos
      nx = vp * Math.cos((phi * Math.PI) / 180);
      ny = vp * Math.sin((phi * Math.PI) / 180);
    }
  }
  // ---- Sim peatón ----
  let { vx, vy } = b;
  const vprevX = b.vx;
  const vprevY = b.vy;
  vx *= 0.3; // FUN_0066BB20
  vy *= 0.3;
  if (vx * vx + vy * vy < 0.01) vx = vy = 0;
  const n2 = nx * nx + ny * ny;
  const vn = vx * nx + vy * ny;
  if (n2 > 1e-4 && vn < n2) {
    // FUN_00575F60: la velocidad a lo largo de n llega al menos a |n|
    const k = 1 - vn / n2;
    vx += nx * k;
    vy += ny * k;
  }
  vx = 0.8 * vx + 0.2 * vprevX; // FUN_005734A0
  vy = 0.8 * vy + 0.2 * vprevY;
  if (Math.abs(vx) + Math.abs(vy) < 0.001) vx = vy = 0;
  const sp = Math.hypot(vx, vy);
  if (sp > BODY_RADIUS) {
    vx = (vx / sp) * BODY_RADIUS; // FUN_0066BCD0: paso máximo = radio del cilindro
    vy = (vy / sp) * BODY_RADIUS;
  }
  const turn = Math.abs(dAng) < 0.001 ? 0 : Math.max(-MAX_TURN, Math.min(MAX_TURN, dAng));
  b.x += vx;
  b.y += vy;
  b.ang = norm360(b.ang + turn);
  b.vx = vx;
  b.vy = vy;
  return { dx: vx, dy: vy, arrived };
}
