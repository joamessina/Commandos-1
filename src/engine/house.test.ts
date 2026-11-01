import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { CAPACITY, destroyLinkedHouses, parseHouses } from './house.ts';
import { Soldier } from './soldier.ts';
import { Unit } from './unit.ts';
import { flatten, loadWorld } from './world.ts';

const MAC_CASA = `.CLASS BICHO .ACCIONES [ [ acCasa [ .XYZENTRADA [ 1 2 3 ] .XYZSALIDA [ 10 20 3 ] ] ] ] .BOXSELECCIONREL [ -5 -55 25 45 ]`;
const MAC_CUARTEL = `.CLASS BICHO .ACCIONES [ [ acCasa [ .XYZENTRADA [ ] .NUMREGENSOLDIERS 8 .CARCEL 1 ] ] ]`;
const MIS = `.MISSION [ .ELEMENTOS [
  [ .CLASS MACRO .MACRO CASA .TOKEN H1 .XYZ [ 100 200 30 ] ]
  [ .CLASS MACRO .MACRO CUARTEL .TOKEN Q1 .XYZ [ 50 60 0 ] ]
  [ .CLASS BICHO .TOKEN NOCASA ]
] ]`;
const houses = parseHouses(flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: (n) => ({ CASA: MAC_CASA, CUARTEL: MAC_CUARTEL })[n] })));
const anm = parseAnm(bnm([{ type: 0, slots: [1] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8)]));
const cmd = (x = 0, y = 0): Unit => new Unit('COMANDO', anm, x, y, 0, 0);

describe('parseHouses', () => {
  it('lee entrada/salida, regeneración, cárcel y la caja de selección; sin XYZ usa la posición', () => {
    expect(houses.map((h) => h.token)).toEqual(['H1', 'Q1']);
    expect(houses[0]).toMatchObject({ entry: { x: 1, y: 2, z: 3 }, exit: { x: 10, y: 20, z: 3 }, regen: 0, jail: false, box: { x: -5, y: -55, w: 25, h: 45 } });
    expect(houses[1]).toMatchObject({ entry: { x: 50, y: 60, z: 0 }, regen: 8, jail: true, box: { x: -20, y: -50, w: 40, h: 50 } });
    expect(houses[0]?.barracks).toBe(false);
    expect(houses[1]?.barracks).toBe(true);
  });
});

describe('House', () => {
  it('la destrucción del edificio enlazado vacía la casa, mata ocupantes y bloquea la entrada', () => {
    const mac = `.CLASS BICHO .ACCIONES [ [ acCasa [ .NUMREGENSOLDIERS 8 ] ] [ acCasaLogica [ .TOKENCASA CASA06A ] ] ]`;
    const hs = parseHouses(flatten(loadWorld('.MISSION [ .ELEMENTOS [ [ .CLASS MACRO .MACRO Q .TOKEN Q1 ] ] ]', { difficulty: 'FACIL', macro: () => mac })));
    const h = hs[0];
    const u = cmd();
    h?.enter(u);
    h?.addGarrison(4);
    destroyLinkedHouses(hs, new Set(['OTRA']));
    expect(h?.destroyed).toBe(false);
    destroyLinkedHouses(hs, new Set(['CASA06A']));
    expect([h?.destroyed, h?.regen, h?.soldiersInside, u.dead]).toEqual([true, 0, 0, true]);
    expect(h?.enter(cmd())).toBe(false);
    destroyLinkedHouses(hs, new Set(['CASA06A']));
  });
  it('regenera un grupo completo o reducido, y no gasta reserva si falla su creación', () => {
    const getHouse = () => parseHouses(flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: (n) => ({ CASA: MAC_CASA, CUARTEL: MAC_CUARTEL })[n] })))[1];
    const h = getHouse();
    expect(h?.recruitPatrol(3, () => false)).toBe(false);
    expect(h?.regen).toBe(8);
    expect(h?.recruitPatrol(3, (n) => n === 3)).toBe(true);
    expect(h?.regen).toBe(4);
    expect(h?.recruitPatrol(9, (n) => n === 3)).toBe(true);
    expect(h?.regen).toBe(0);
    expect(h?.recruitPatrol(1, () => true)).toBe(false);
    const h2 = getHouse();
    for (let i = 0; i < 7; i++) h2?.recruit(() => true);
    expect(h2?.recruitPatrol(0, () => true)).toBe(false);
    expect(h2?.regen).toBe(1);
  });

  it('los soldados de patrulla ocupan plazas que dejan de estar disponibles para comandos', () => {
    const h = parseHouses(flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: (n) => ({ CASA: MAC_CASA, CUARTEL: MAC_CUARTEL })[n] })))[1];
    h?.addGarrison(CAPACITY - 1);
    expect(h?.enter(cmd())).toBe(true);
    expect(h?.enter(cmd())).toBe(false);
    h?.leaveGarrison();
    expect(h?.enter(cmd())).toBe(true);
  });
  it('descuenta una reserva únicamente al crear un patrullero; al destruirse no quedan reservas', () => {
    const cuartel = parseHouses(flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: (n) => ({ CASA: MAC_CASA, CUARTEL: MAC_CUARTEL })[n] })))[1];
    expect(cuartel?.recruit(() => false)).toBe(false);
    expect(cuartel?.regen).toBe(8);
    for (let i = 0; i < 8; i++) expect(cuartel?.recruit(() => true)).toBe(true);
    expect(cuartel?.regen).toBe(0);
    expect(cuartel?.barracks).toBe(true);
    const u = cmd();
    cuartel?.enter(u);
    cuartel?.tick();
    expect(u.energy).toBe(100);
    cuartel?.addGarrison(1);
    expect(cuartel?.soldiersInside).toBe(1);
    cuartel?.tick();
    expect(u.energy).toBe(70);
    cuartel?.leaveGarrison();
    cuartel?.leaveGarrison();
    expect(cuartel?.soldiersInside).toBe(0);
    let called = false;
    expect(cuartel?.recruit(() => { called = true; return true; })).toBe(false);
    expect(called).toBe(false);
    const otro = parseHouses(flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: (n) => ({ CASA: MAC_CASA, CUARTEL: MAC_CUARTEL })[n] })))[1];
    otro?.addGarrison(2);
    otro?.destroy();
    expect(otro?.regen).toBe(0);
    expect(otro?.soldiersInside).toBe(0);
    expect(otro?.recruit(() => true)).toBe(false);
  });
  it('entrar oculta al comando (los soldados no lo ven) y salir lo deja en el punto de salida', () => {
    const [casa] = houses;
    const u = cmd();
    expect(casa?.enter(u)).toBe(true);
    expect(casa?.enter(u)).toBe(false);
    expect(u.hidden && u.inHouse === 'H1').toBe(true);
    const s = new Soldier('S', cmd(300, 0), null);
    s.unit.body.ang = 180;
    s.tick({ commandos: [u], sectors: null, rng: () => 0, onShot: () => undefined });
    expect(s.order).toBe(4);
    for (let i = 0; i < 50; i++) casa?.tick(); // una casa normal no daña
    expect(u.energy).toBe(100);
    expect(casa?.leave(u)).toBe(true);
    expect(casa?.leave(u)).toBe(false);
    expect([u.hidden, u.inHouse, u.body.x, u.body.y]).toEqual([false, null, 10, 20]);
  });

  it('el cuartel mata: 30 de daño cada 5 ciclos a cada aliado de dentro', () => {
    const [, cuartel] = houses;
    const u = cmd();
    cuartel?.enter(u);
    cuartel?.tick();
    expect(u.energy).toBe(70);
    for (let i = 0; i < 4; i++) cuartel?.tick();
    expect(u.energy).toBe(70);
    cuartel?.tick();
    expect(u.energy).toBe(40);
    for (let i = 0; i < 30; i++) cuartel?.tick();
    expect(u.dead).toBe(true);
    expect(cuartel?.occupants).toHaveLength(0);
    cuartel?.tick(); // vacío: no hace nada
  });

  it('capacidad 20, muerto no entra, y al destruirse la casa mueren los de dentro', () => {
    const [casa] = houses;
    const dentro = Array.from({ length: CAPACITY }, () => cmd());
    for (const u of dentro) expect(casa?.enter(u)).toBe(true);
    expect(casa?.enter(cmd())).toBe(false);
    const muerto = cmd();
    muerto.hit(1e9);
    expect(casa?.enter(muerto)).toBe(false);
    casa?.destroy();
    expect(dentro.every((u) => u.dead)).toBe(true);
    expect(casa?.occupants).toHaveLength(0);
  });
});
