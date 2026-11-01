import { describe, expect, it } from 'vitest';
import { parseClave, type Node } from '../formats/clave.ts';
import { Patrol, parseRoutes, RouteType, type Route } from './patrol.ts';

const params = (text: string): Node[] => parseClave(text);
const P = (tipo: string, extra = ''): string =>
  `.PATRULLA [ [ .RUTA [ [ .XYZ [ 0 0 0 ] ] [ .XYZ [ 10 0 0 ] .ESPERA 2 ] [ .XYZ [ 20 0 5 ] .ANGULO 90 .VELOCIDADTRAMO 3 ] ] ${tipo} .VEL 2 .NOMBRE R1 ${extra} ] ]`;

describe('parseRoutes', () => {
  it('lee puntos, ESPERA, ANGULO, VELOCIDADTRAMO (hereda VEL) y el tipo de ruta', () => {
    const [r] = parseRoutes(params(P('.TIPORUTA PINGPONG')), 'DIFICIL');
    expect(r).toMatchObject({ name: 'R1', type: RouteType.PingPong });
    expect(r?.points.map((p) => [p.x, p.wait, p.angle, p.vel])).toEqual([
      [0, 0, 0, 2],
      [10, 2, 0, 2],
      [20, 0, 90, 3],
    ]);
  });

  it('lee EVENTO del punto en mayúsculas y no lo agrega cuando falta', () => {
    const [r] = parseRoutes(params('.PATRULLA [ [ .RUTA [ [ .XYZ [ 1 2 3 ] .EVENTO reac ] [ .XYZ [ 4 5 6 ] ] ] ] ]'), 'FACIL');
    expect(r?.points[0]?.event).toBe('REAC');
    expect(r?.points[1]?.event).toBeUndefined();
  });

  it('tipos: LOOP/JUMP/EXIT/STOPPED, otro = ida y vuelta, sin clave = LOOP; VEL por defecto 1.5', () => {
    const t = (s: string) => parseRoutes(params(`.PATRULLA [ [ .RUTA [ [ .XYZ [ 0 0 0 ] ] ] ${s} ] ]`), 'FACIL')[0];
    expect([t('.TIPORUTA loop'), t('.TIPORUTA JUMP'), t('.TIPORUTA EXIT'), t('.TIPORUTA STOPPED'), t('.TIPORUTA X'), t('')].map((r) => r?.type)).toEqual([0, 2, 3, 4, 1, 0]);
    expect(t('')?.points[0]?.vel).toBe(1.5);
  });

  it('NOMBRE con prefijo FACIL_/DIFICIL_ solo vale con esa dificultad; ignora puntos y rutas mal formados', () => {
    const text = `.PATRULLA [ [ .RUTA [ [ .XYZ [ 0 0 0 ] ] [ .XYZ [ 1 2 ] ] 5 ] .NOMBRE FACIL_A ] [ .RUTA [ [ .XYZ [ 1 1 1 ] ] ] .NOMBRE DIFICIL_B ] 7 ]`;
    expect(parseRoutes(params(text), 'FACIL').map((r) => [r.name, r.points.length])).toEqual([['A', 1]]);
    expect(parseRoutes(params(text), 'DIFICIL').map((r) => r.name)).toEqual(['B']);
    expect(parseRoutes(params('.X 1'), 'FACIL')).toEqual([]);
  });
});

const route = (type: Route['type'], n = 3, wait = 0, angle = 0): Route => ({
  name: 'r',
  type,
  points: Array.from({ length: n }, (_, i) => ({ x: i * 10, y: 0, z: 0, wait, angle, vel: 2 })),
});
const walk = (p: Patrol, n: number): number[] => {
  const seq: number[] = [];
  let arrived = false;
  for (let i = 0; i < n; i++) {
    const s = p.step(arrived);
    arrived = false;
    if (s.kind === 'goto' || s.kind === 'jump') {
      seq.push(s.point.x);
      arrived = s.kind === 'goto';
    }
  }
  return seq;
};

describe('Patrol', () => {
  it('emite EVENTO una vez después de la espera y antes del siguiente punto', () => {
    const points = route(RouteType.Loop, 2).points;
    const p = new Patrol({ name: 'r', type: RouteType.Loop, points: [{ ...points[0], x: 0, y: 0, z: 0, wait: 2, angle: 0, vel: 2, event: 'REAC' }, { ...points[1], x: 10, y: 0, z: 0, wait: 0, angle: 0, vel: 2 }] });
    expect(p.step(false).kind).toBe('goto');
    expect(p.step(true).kind).toBe('wait');
    expect(p.step(false).kind).toBe('wait');
    expect(p.step(false)).toEqual({ kind: 'event', event: 'REAC' });
    expect(p.step(false)).toMatchObject({ kind: 'goto', point: { x: 10 } });
  });
  it('en PINGPONG usa la velocidad del punto anterior al regresar', () => {
    const r: Route = { name: 'r', type: RouteType.PingPong, points: [
      { x: 0, y: 0, z: 0, wait: 0, angle: 0, vel: 1 },
      { x: 10, y: 0, z: 0, wait: 0, angle: 0, vel: 2 },
      { x: 20, y: 0, z: 0, wait: 0, angle: 0, vel: 3 },
    ] };
    const p = new Patrol(r);
    expect(p.step(false)).toMatchObject({ kind: 'goto', point: { x: 0, vel: 1 } });
    expect(p.step(true)).toMatchObject({ kind: 'goto', point: { x: 10, vel: 2 } });
    expect(p.step(true)).toMatchObject({ kind: 'goto', point: { x: 20, vel: 3 } });
    expect(p.step(true)).toMatchObject({ kind: 'goto', point: { x: 10, vel: 3 } });
    p.resend();
    expect(p.step(false)).toMatchObject({ kind: 'goto', point: { x: 10, vel: 3 } });
    expect(p.step(true)).toMatchObject({ kind: 'goto', point: { x: 0, vel: 2 } });
    expect(p.step(true)).toMatchObject({ kind: 'goto', point: { x: 10, vel: 2 } });
  });
  it('LOOP vuelve al primer punto; PINGPONG invierte el sentido', () => {
    expect(walk(new Patrol(route(RouteType.Loop)), 4)).toEqual([0, 10, 20, 0]);
    expect(walk(new Patrol(route(RouteType.PingPong)), 6)).toEqual([0, 10, 20, 10, 0, 10]);
  });

  it('JUMP se teletransporta al punto 0 y sigue hacia el 1; EXIT y STOPPED terminan', () => {
    expect(walk(new Patrol(route(RouteType.Jump)), 6)).toEqual([0, 10, 20, 0, 10, 20]);
    for (const t of [RouteType.Exit, RouteType.Stopped]) {
      const p = new Patrol(route(t));
      expect(walk(p, 8)).toEqual([0, 10, 20]);
      expect(p.step(true)).toEqual({ kind: 'idle' });
    }
  });

  it('al llegar gira a ANGULO y espera ESPERA ciclos antes de seguir', () => {
    const p = new Patrol(route(RouteType.Loop, 2, 3, 90));
    expect(p.step(false).kind).toBe('goto');
    expect(p.step(false).kind).toBe('wait');
    expect(p.step(true)).toEqual({ kind: 'face', angle: 90 });
    expect(p.step(false)).toEqual({ kind: 'face', angle: 90 });
    expect([p.step(false).kind, p.step(false).kind, p.step(false).kind]).toEqual(['wait', 'wait', 'wait']);
    const next = p.step(false);
    expect(next).toMatchObject({ kind: 'goto', point: { x: 10 } });
  });

  it('sin ESPERA ni ANGULO pasa directo; resend() repite la orden de ir; ruta vacía = idle', () => {
    const p = new Patrol(route(RouteType.Loop, 2));
    p.step(false);
    expect(p.step(true)).toMatchObject({ kind: 'goto', point: { x: 10 } });
    p.resend();
    expect(p.step(false)).toMatchObject({ kind: 'goto', point: { x: 10 } });
    expect(p.target?.x).toBe(10);
    const e = new Patrol(route(RouteType.Loop, 0));
    expect(e.step(true)).toEqual({ kind: 'idle' });
    expect(e.target).toBeNull();
  });
});
