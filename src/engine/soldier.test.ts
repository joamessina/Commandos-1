import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec, SectorFlag } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { RouteType, type Route } from './patrol.ts';
import { SectorMap } from './sectors.ts';
import { lookRange, Order, Soldier, type Shot, type SoldierWorld } from './soldier.ts';
import { COMMANDO_ENERGY, Unit } from './unit.ts';
import { inCone, lineClear, rayReach, sees } from './vision.ts';

const anm = parseAnm(
  bnm([{ type: 0, slots: [5] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(1, 'APUNTAR', 1, 0, 0, 8), ...anmSeq(2, 'DISPARAR', 1, 0, 5, 8), ...anmSeq(2, 'MUERTE1', 2, 0, 20, 8)]),
);
const unit = (x: number, y: number, ang = 0, token = 'S'): Unit => new Unit(token, anm, x, y, 0, ang);

describe('vision', () => {
  const v = { x: 0, y: 0, heading: 0 };
  it('cono de 70° y alcance 800; el radio del blanco da margen en el borde', () => {
    expect(inCone(v, { x: 500, y: 0, radius: 10, low: false })).toBe(true);
    expect(inCone(v, { x: 801, y: 0, radius: 10, low: false })).toBe(false);
    expect(inCone(v, { x: 500, y: 300, radius: 10, low: false })).toBe(true); // 31°
    expect(inCone(v, { x: 500, y: 400, radius: 10, low: false })).toBe(false); // 38,7°
    expect(inCone(v, { x: -100, y: 0, radius: 10, low: false })).toBe(false); // a la espalda
    expect(inCone(v, { x: 500, y: 350, radius: 100, low: false })).toBe(true); // 35°: el margen r lo deja entrar
  });

  it('agachado o buceando: la mitad del alcance; respeta .MOD y .ANG', () => {
    expect(inCone(v, { x: 500, y: 0, radius: 10, low: true })).toBe(false);
    expect(inCone(v, { x: 399, y: 0, radius: 10, low: true })).toBe(true);
    expect(inCone({ ...v, range: 320, angle: 40 }, { x: 321, y: 0, radius: 10, low: false })).toBe(false);
    expect(inCone({ ...v, heading: 90 }, { x: 0, y: 300, radius: 10, low: false })).toBe(true);
  });

  // x 0..100 llano, 100..200 Ocluso, 200..300 llano
  const verts: [number, number][] = [];
  for (let i = 0; i <= 3; i++) verts.push([i * 100, 0], [i * 100, 100]);
  const quad = (i: number, extra: object = {}): { verts: number[] } => ({ verts: [i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1], ...extra });
  const map = new SectorMap(parseSec(secBytes({ verts, a: [quad(0), quad(1, { flags: SectorFlag.Ocluso }), quad(2)], tw1: [[-1, 1, -1, -1], [-1, 2, -1, 0], [-1, -1, -1, 1]] })));
  // muelle (x 0..100, suelo z=65) junto al mar (x 100..200, z=0): el borde del muelle esconde lo que queda pegado a su pie (FUN_005F9820)
  const pv: [number, number][] = [];
  for (let i = 0; i <= 2; i++) pv.push([i * 100, 0], [i * 100, 100]);
  const pier = new SectorMap(parseSec(secBytes({ verts: pv, a: [quad(0, { plane: [0, 0, 65] }), quad(1, { type: 1 })], tw1: [[-1, 1, -1, -1], [-1, -1, -1, 0]] })));
  it('desde el muelle no se ve lo que está al pie del borde, pero sí lo lejano; a su mismo nivel se ve todo', () => {
    const viewer = { x: 80, y: 50, z: 65, eye: 29, sector: pier.at(80, 50), heading: 0 };
    const at = (x: number, z: number, eye = 29): Parameters<typeof sees>[1] => ({ x, y: 50, z, eye, radius: 10, low: false });
    expect(sees(viewer, at(110, 0), pier)).toBe(false); // al pie del borde
    expect(sees(viewer, at(120, 0), pier)).toBe(false);
    expect(sees(viewer, at(130, 0), pier)).toBe(true);
    expect(sees(viewer, at(190, 0, 3.6), pier)).toBe(true);
    expect(sees(viewer, at(90, 65), pier)).toBe(true); // mismo nivel
    expect(sees({ ...viewer, z: 0, eye: 29, sector: pier.at(150, 50), x: 150, heading: 180 }, at(110, 0), pier)).toBe(true); // desde abajo ve hacia arriba hasta el borde... (sin suelo más alto entre ellos)
    expect(sees({ ...viewer, sector: null }, at(110, 0), pier)).toBe(true); // sin sector de partida no oculta
    expect(sees({ x: 80, y: 50, heading: 0 }, at(110, 0), pier)).toBe(true); // sin alturas, solo el viejo
    expect(sees(viewer, { ...at(250, 0) }, pier)).toBe(false); // el rayo sale del mapa por un borde sin vecino
  });

  it('un sector Ocluso entre los dos corta el rayo; el del propio observador o blanco no; sin mapa no hay oclusión', () => {
    expect(lineClear(map, 50, 50, 250, 50)).toBe(false);
    expect(lineClear(map, 150, 50, 250, 50)).toBe(true); // el observador está dentro del Ocluso
    expect(lineClear(map, 50, 50, 150, 50)).toBe(true); // el blanco está dentro
    expect(lineClear(map, 10, 50, 90, 50)).toBe(true);
    expect(lineClear(null, 50, 50, 250, 50)).toBe(true);
    expect(rayReach(map, 50, 50, 0, 800)).toBe(56); // entra en el sector Ocluso a x=100 (50 + 8·7)
    expect(rayReach(map, 50, 50, Math.PI, 800)).toBe(800);
    expect(rayReach(null, 0, 0, 0, 300)).toBe(300);
    // el suelo del sector Ocluso está en z=0: tapa a quien está a su nivel y no a quien mira desde 100 u más arriba
    expect(rayReach(map, 50, 50, 0, 800, 0)).toBe(56);
    expect(rayReach(map, 50, 50, 0, 800, 100)).toBe(800);
    expect(lineClear(map, 50, 50, 250, 50, 0)).toBe(false);
    expect(lineClear(map, 50, 50, 250, 50, 100)).toBe(true);
    expect(sees({ x: 50, y: 50, heading: 0 }, { x: 250, y: 50, radius: 10, low: false }, map)).toBe(false);
    expect(sees({ x: 50, y: 50, heading: 0 }, { x: 90, y: 50, radius: 10, low: false }, map)).toBe(true);
  });
});

const route = (...xs: number[]): Route => ({ name: 'r', type: RouteType.PingPong, points: xs.map((x) => ({ x, y: 0, z: 0, wait: 0, angle: 0, vel: 2 })) });
interface Fx {
  world: SoldierWorld;
  shots: Shot[];
}
const mkWorld = (commandos: Unit[], rng = (): number => 0): Fx => {
  const shots: Shot[] = [];
  return { shots, world: { commandos, sectors: null, rng, onShot: (_s, shot) => shots.push(shot) } };
};
const run = (s: Soldier, w: SoldierWorld, n: number): void => {
  for (let i = 0; i < n; i++) s.tick(w);
};

describe('Soldier', () => {
  it('una patrulla que espera evento empieza la ruta que recibe por TRIGGER_REACT', () => {
    const a = { ...route(100), name: 'A' };
    const b = { ...route(200), name: 'B' };
    const s = new Soldier('S', unit(0, 0), a, { alternateRoutes: [b], waitRouteEvent: true });
    const w = mkWorld([]).world;
    s.tick(w);
    expect(s.unit.target).toBeNull();
    expect(s.triggerRoute('OTRA')).toBe(false);
    expect(s.triggerRoute('b')).toBe(true);
    s.tick(w);
    expect(s.unit.target?.x).toBe(200);
    expect(new Soldier('SIN_RUTA', unit(0, 0), null).triggerRoute('B')).toBe(false);
  });
  it('BAP2 avisa al interrumpir la búsqueda alrededor de un cadáver', () => {
    const commandos: Unit[] = [];
    const voices: string[] = [];
    const s = new Soldier('BAP2', unit(0, 0), null, { brain: 'route' });
    const w = { ...mkWorld(commandos).world, bodies: [{ x: 50, y: 0 }], onVoice: (_s: Soldier, voice: 'VMUE' | 'ALRM') => { voices.push(voice); } };
    for (let i = 0; i < 100 && s.order !== Order.Look; i++) s.tick(w);
    expect(s.order).toBe(Order.Look);
    expect(voices).toEqual(['VMUE']);
    commandos.push(unit(s.x + 50, s.y));
    for (let i = 0; i < 30 && s.order === Order.Look; i++) {
      s.unit.body.ang = 0;
      s.tick(w);
    }
    expect(s.order).toBe(Order.Aim);
    expect(voices).toEqual(['VMUE', 'ALRM']);
  });
  it('al tomar el mando deja de seguir y comienza el recorrido de la patrulla', () => {
    const s = new Soldier('S', unit(0, 0), null, { follow: { leader: () => ({ x: -200, y: 0, ang: 0, speed: 1 }), lateral: 0, back: 30 } });
    s.promote(route(100));
    s.tick(mkWorld([]).world);
    expect(s.unit.target?.x).toBe(100);
    s.promote(null);
    expect(s.unit.target).toBeNull();
    expect(s.order).toBe(Order.Patrol);
  });
  it('no ve al buzo ni al que está dentro de una casa, aunque esté pegado y de frente', () => {
    const c = unit(100, 0);
    const s = new Soldier('S', unit(0, 0), null);
    s.unit.body.ang = 0;
    const { world } = mkWorld([c]);
    s.tick(world);
    expect(s.order).not.toBe(Order.Patrol); // lo ve
    const t = new Soldier('T', unit(0, 0), null);
    t.unit.body.ang = 0;
    c.diving = true;
    run(t, world, 5);
    expect(t.order).toBe(Order.Patrol);
  });

  it('patrulla su ruta a la VEL de la ruta y llega al segundo punto', () => {
    const u = unit(0, 0);
    const s = new Soldier('S', u, route(0, 100));
    const { world } = mkWorld([]);
    run(s, world, 20);
    expect(u.body.x).toBeGreaterThan(20);
    expect(u.speed).toBe(2);
    let max = 0;
    for (let i = 0; i < 80; i++) {
      s.tick(world);
      max = Math.max(max, u.body.x);
    }
    expect(max).toBeGreaterThan(95); // llegó al punto 100 y vuelve (ida y vuelta)
    expect(u.body.x).toBeLessThan(max);
    expect(s.order).toBe(Order.Patrol);
  });

  it('ve a un comando: apunta 40 ciclos y dispara con daño 30 y recarga 15; mata a FRANCOT a los 4 tiros', () => {
    const c = unit(300, 0, 180, 'FRANCOT');
    c.energy = COMMANDO_ENERGY['FRANCOT'] ?? 0;
    const s = new Soldier('S', unit(0, 0), null);
    const { world, shots } = mkWorld([c]);
    run(s, world, 5);
    expect(s.order).toBe(Order.Aim);
    expect(shots).toHaveLength(0);
    run(s, world, 40);
    expect(s.order).toBe(Order.Shoot);
    run(s, world, 5 + 15 * 4);
    expect(shots.length).toBe(4);
    expect(shots[0]).toMatchObject({ toX: 300, hit: true });
    expect(c.dead).toBe(true);
    expect(c.energy).toBe(0);
    expect(s.order).toBe(Order.Patrol); // mató al blanco: vuelve a su puesto
  });

  it('si pierde de vista al blanco va a su última posición, espera y vuelve al puesto', () => {
    const c = unit(300, 0, 180);
    const u = unit(0, 0);
    const s = new Soldier('S', u, null);
    const { world } = mkWorld([c]);
    run(s, world, 10);
    expect(s.order).toBe(Order.Aim);
    c.body.x = 300;
    c.body.y = 2000; // se esconde
    run(s, world, 25);
    expect(s.order).toBe(Order.Investigate);
    run(s, world, 400);
    expect(s.order).toBe(Order.Patrol);
    expect(Math.hypot(u.body.x, u.body.y)).toBeLessThan(5);
  });

  it('oye un disparo y va a investigar; muerto no reacciona; kill() deja el cuerpo', () => {
    const u = unit(0, 0);
    const s = new Soldier('S', u, null);
    const { world } = mkWorld([]);
    s.hear(100, 0);
    expect(s.order).toBe(Order.Investigate);
    run(s, world, 100);
    expect(u.body.x).toBeGreaterThan(50);
    s.kill();
    expect(s.dead).toBe(true);
    expect(s.order).toBe(Order.Dead);
    s.hear(5, 5);
    run(s, world, 5);
    expect(s.order).toBe(Order.Dead);
    s.kill();
    expect(u.anim.name).toBe('MUERTE1');
  });

  it('un comando agachado se ve solo a la mitad del alcance; los muertos no se ven', () => {
    const c = unit(600, 0, 180);
    c.crouched = true;
    const s = new Soldier('S', unit(0, 0), null);
    const { world } = mkWorld([c]);
    run(s, world, 200); // todo un barrido de cabeza: agachado, a 600 u no entra en la zona corta (≤ 400) en ningún momento
    expect(s.order).toBe(Order.Patrol);
    c.crouched = false;
    let aimed = false;
    for (let i = 0; i < 100; i++) {
      s.tick(world);
      aimed ||= s.order === Order.Aim; // de pie lo ve cuando la cabeza pasa cerca del frente (alcance 800)
    }
    expect(aimed).toBe(true);
    const d = unit(100, 0);
    d.hit(1e9);
    const t = new Soldier('T', unit(0, 0), null);
    run(t, mkWorld([d]).world, 5);
    expect(t.order).toBe(Order.Patrol);
  });
});

describe('Unit.hit / place', () => {
  it('muere cuando la energía ≤ daño (no cuando queda en 0): COMANDO 200 aguanta 6 tiros de 30 y cae en el 7.º', () => {
    const c = unit(0, 0, 0, 'COMANDO');
    c.energy = COMMANDO_ENERGY['COMANDO'] ?? 0;
    const died = Array.from({ length: 7 }, () => c.hit(30));
    expect(died).toEqual([false, false, false, false, false, false, true]);
    expect(c.hit(30)).toBe(false);
    c.tick();
    c.place(5, 6, 90);
    expect([c.body.x, c.body.y, c.body.ang]).toEqual([5, 6, 90]);
  });
});

describe('Soldier: vista propia', () => {
  it('respeta el alcance y la apertura del MAC (.MOD / .ANG)', () => {
    const c = unit(300, 0, 180);
    const corto = new Soldier('S', unit(0, 0), null, { range: 200, angle: 90 });
    run(corto, mkWorld([c]).world, 5);
    expect(corto.order).toBe(Order.Patrol); // a 300 u, fuera de su alcance de 200
    const ancho = new Soldier('S', unit(0, 0), null, { range: 400, angle: 90 });
    run(ancho, mkWorld([c]).world, 5);
    expect(ancho.order).toBe(Order.Aim);
  });
});

describe('lookRange (alcance elíptico con la cabeza girada)', () => {
  it('de frente vale el alcance base; de costado cae (≈42 % a 50°, ≈64 % a 25°); LOOKSCAN lo escala', () => {
    expect(lookRange(800, 0)).toBeCloseTo(800, 6);
    expect(lookRange(800, 50)).toBeCloseTo(335, 0);
    expect(lookRange(800, -25)).toBeCloseTo(513, 0);
    expect(lookRange(800, 0, 0.5)).toBeCloseTo(400, 6);
  });
});

describe('Soldier: cuerpos', () => {
  it('ve un cuerpo tirado en su cono y va a investigarlo, una sola vez por cuerpo', () => {
    const u = unit(0, 0);
    const s = new Soldier('S', u, null);
    const body = { x: 150, y: 0 };
    const w = { ...mkWorld([]).world, bodies: [body] };
    let investigated = false;
    for (let i = 0; i < 120 && !investigated; i++) {
      s.tick(w);
      investigated = s.order === Order.Investigate;
    }
    expect(investigated).toBe(true);
    for (let i = 0; i < 400; i++) s.tick(w);
    expect(s.order).toBe(Order.Patrol); // lo investigó y volvió; no lo vuelve a "descubrir"
    const solo = new Soldier('T', unit(0, 0), null);
    solo.tick({ ...mkWorld([]).world, bodies: [{ x: 0, y: 0 }] });
    expect(solo.order).toBe(Order.Patrol);
  });
});

describe('artillero de nido (soldado fijo)', () => {
  it('vistaOf lee .MOD (×2) y .ANG del órgano Vista01; sin claves no hay opciones', async () => {
    const { parseClave } = await import('../formats/clave.ts');
    const { vistaOf } = await import('./vision.ts');
    expect(vistaOf(parseClave('.ORGANOS [ .VISTA [ Vista01 [ .MOD 320 .ANG 40 ] ] ]'))).toEqual({ range: 640, angle: 40 });
    expect(vistaOf(parseClave('.ORGANOS [ .VISTA [ Vista01 [ ] ] ]'))).toEqual({});
    expect(vistaOf(parseClave('.X 1'))).toEqual({});
  });

  it('no se mueve al oír un disparo (solo gira), dispara con su ruido de 500 y VISTAELIPTICA 0 mantiene el alcance', () => {
    const u = unit(0, 0);
    const s = new Soldier('N', u, null, { fixed: true, noise: 500, elliptical: false, sweep: 65, range: 640, angle: 40 });
    expect(s.noiseRadius).toBe(500);
    s.hear(100, 100);
    expect(s.order).toBe(Order.Patrol);
    expect(u.body.ang).toBeCloseTo(45, 5);
    const w = mkWorld([]).world;
    for (let i = 0; i < 100; i++) s.tick(w);
    expect(s.reach).toBe(640); // sin elipse el alcance no baja al girar la cabeza
    expect(Math.hypot(u.body.x, u.body.y)).toBe(0);
  });

  it('AcBap base (BAP1/BANPE1): ante un disparo se queda mirando el punto 100 ciclos y vuelve; AcBap2 camina hasta él', () => {
    const w: SoldierWorld = { commandos: [], sectors: null, rng: () => 0, onShot: () => undefined };
    const look = new Soldier('S', unit(0, 0, 90), null, { walks: false });
    const walk = new Soldier('S', unit(0, 0, 90), null);
    look.hear(400, 0);
    walk.hear(400, 0);
    for (let i = 0; i < 30; i++) {
      look.tick(w);
      walk.tick(w);
    }
    expect([look.order, Math.round(look.x), look.unit.body.ang]).toEqual([Order.Investigate, 0, 0]);
    expect(walk.x).toBeGreaterThan(20);
    for (let i = 0; i < 80; i++) look.tick(w);
    expect(look.order).not.toBe(Order.Investigate);
  });

  it('BAP2 investiga a velocidad 3 por defecto o a la velocidad definida en su acción', () => {
    const a = new Soldier('A', unit(0, 0), null, { brain: 'route' });
    const b = new Soldier('B', unit(0, 0), null, { brain: 'route', investigateSpeed: 4 });
    a.hear(200, 0);
    b.hear(200, 0);
    expect(a.unit.speed).toBe(3);
    expect(b.unit.speed).toBe(4);
    a.tick(mkWorld([]).world);
    b.tick(mkWorld([]).world);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('patrullero de un grupo: va al puesto detrás de su líder con lateral y se queda quieto si el líder ya no está', () => {
    const w: SoldierWorld = { commandos: [], sectors: null, rng: () => 0, onShot: () => undefined };
    let lead: { x: number; y: number; ang: number; speed: number | null } | null = { x: 400, y: 0, ang: 0, speed: 1.7 };
    const f = new Soldier('S', unit(0, 0, 0), null, { follow: { leader: () => lead, lateral: 0, back: 30 } });
    for (let i = 0; i < 200; i++) f.tick(w);
    expect(Math.round(f.x)).toBeGreaterThan(300); // camina hasta ~370 (400 − 30)
    expect(f.unit.speed).toBeCloseTo(2.2, 5);
    const x = f.x;
    lead = null;
    for (let i = 0; i < 30; i++) f.tick(w);
    expect(f.x).toBeCloseTo(x, 0);
  });
});
