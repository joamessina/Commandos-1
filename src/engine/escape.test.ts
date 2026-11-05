import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { Boat } from './boat.ts';
import { escapeReady, MissionWarnings } from './mission.ts';
import { SectorMap } from './sectors.ts';
import { Unit } from './unit.ts';

const anm = parseAnm(bnm([{ type: 0, slots: [1] }, ...anmSeq(1, 'ANDAR', 1, 0, 0, 1)]));
const map = new SectorMap(parseSec(secBytes({
  verts: [[0, 0], [500, 0], [500, 100], [0, 100], [600, 0], [600, 100]],
  a: [{ verts: [0, 1, 2, 3] }, { verts: [1, 4, 5, 2] }],
})));

describe('salida de la misión', () => {
  it('emite una sola vez el aviso de muerte y prioriza la derrota diferida si murieron todos', () => {
    const a = new Unit('A', anm, 0, 0, 0, 0), b = new Unit('B', anm, 0, 0, 0, 0);
    const warnings = new MissionWarnings();
    expect(warnings.next([], null, null, null, false)).toBeNull();
    a.wound(99999);
    expect(warnings.next([a, b], null, null, null, false)).toBe('AMUC');
    expect(warnings.next([a, b], null, null, null, false)).toBeNull();
    b.wound(99999);
    expect(new MissionWarnings().next([a, b], null, null, null, false)).toBeNull();
  });
  it('distingue salida prematura y falta de tripulantes', () => {
    const boat = new Boat(50, 50, 0, 0, [], null);
    const a = new Unit('A', anm, 0, 0, 0, 0), b = new Unit('B', anm, 0, 0, 0, 0);
    const exit = { x: 200, y: 50 };
    a.boat = boat;
    expect(new MissionWarnings().next([a, b], boat, exit, map, true)).toBe('ALOL');
    expect(new MissionWarnings().next([a, b], boat, exit, map, false)).toBeNull();
    b.boat = boat;
    expect(new MissionWarnings().next([a, b], boat, exit, map, false)).toBe('NOO2');
    expect(new MissionWarnings().next([a, b], boat, exit, map, true)).toBeNull();
    boat.x = 550;
    expect(new MissionWarnings().next([a, b], boat, exit, map, false)).toBeNull();
  });
  it('compara sectores, aunque el bote esté cerca del punto o lejos dentro del mismo sector', () => {
    const boat = new Boat(550, 50, 0, 0, [], null);
    const u = new Unit('COMANDO', anm, 0, 0, 0, 0);
    u.boat = boat;
    expect(escapeReady([u], boat, { x: 490, y: 50 }, map)).toBe(false);
    boat.x = 10;
    expect(escapeReady([u], boat, { x: 490, y: 50 }, map)).toBe(true);
    expect(escapeReady([u], boat, { x: -20, y: 50 }, map)).toBe(false);
    expect(escapeReady([u], boat, { x: 490, y: 50 }, null)).toBe(false);
  });

  it('requiere a todos los comandos vivos en la misma Zodiac', () => {
    const boat = new Boat(50, 50, 0, 0, [], null);
    const a = new Unit('COMANDO', anm, 0, 0, 0, 0);
    const b = new Unit('ARTIFIC', anm, 0, 0, 0, 0);
    const exit = { x: 200, y: 50 };
    expect(escapeReady([], boat, exit, map)).toBe(false);
    a.boat = boat;
    expect(escapeReady([a, b], boat, exit, map)).toBe(false);
    b.boat = boat;
    expect(escapeReady([a, b], boat, exit, map)).toBe(true);
    b.wound(99999);
    expect(escapeReady([a, b], boat, exit, map)).toBe(false);
  });
});
