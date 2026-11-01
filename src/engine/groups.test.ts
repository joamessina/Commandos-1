import { describe, expect, it } from 'vitest';
import { eventList, ExitSchedule, followPoint, formationOf, groupSize, parseGroups, parseZoneSensors, recruitMissing, successor, ZoneEvents } from './groups.ts';

const MIS = `.MISSION [
  .SENSORES_SND_ZONA [ [ .ZONA CAMPAMENTO .MENSAJE REAC ] [ .ZONA OTRA .MENSAJE ZOIN ] ]
  .PATRULLAS [
    [ .TOKEN PAT1 .NSOLDIERS 3 .HOME CASA_REACT_01 .EXITHOME_EVENTS REAC .REACT_EVENTS [ REAC ALAR ] .STARTATHOME 1 .NCOLUMNS 1
      .RUTADEF [ [ .NOMBRE RUTA1 .TIPORUTA LOOP .RUTA [ [ .XYZ [ 10 20 0 ] ] [ .XYZ [ 30 40 0 ] ] ] .VEL 1.7 ] ]
      .ANIMCABO CABO .ANIMSOLDADO ALEGABAR ]
    [ .TOKEN PAT2 .XYZ [ 7 8 9 ] .ANGULO 90 .EXITHOME_EVENTS [ REAC ZOIN ] ]
  ]
]`;

describe('groups', () => {
  it('cuenta el cabo además de los patrulleros, incluso si no hay patrulleros', () => {
    expect(groupSize({ n: 3 })).toBe(4);
    expect(groupSize({ n: 0 })).toBe(1);
  });

  it('ordena la salida de un patrullero por ciclo múltiplo de 20', () => {
    const q = new ExitSchedule(2);
    expect(q.done).toBe(false);
    expect(q.step(19)).toBeNull();
    expect(q.step(20)).toBe(1);
    expect(q.step(20)).toBeNull();
    expect(q.step(21)).toBeNull();
    expect(q.step(40)).toBe(2);
    expect(q.done).toBe(true);
    expect(q.step(60)).toBeNull();
    expect(new ExitSchedule(0).step(0)).toBeNull();
  });

  it('repone solo las bajas posibles y detiene el intento si falla la creación', () => {
    let reserve = 2;
    const house = { recruit: (create: () => boolean): boolean => {
      if (!reserve || !create()) return false;
      reserve--;
      return true;
    } };
    let made = 0;
    expect(recruitMissing(house, 0, () => { made++; return true; })).toBe(0);
    expect(recruitMissing(house, 4, () => { made++; return true; })).toBe(2);
    expect([reserve, made]).toEqual([0, 2]);
    reserve = 2;
    expect(recruitMissing(house, 2, () => false)).toBe(0);
    expect(reserve).toBe(2);
  });

  it('elige como sucesor al patrullero disponible con mayor energía', () => {
    const soldiers = [
      { dead: true, down: false, unit: { energy: 100 } },
      { dead: false, down: true, unit: { energy: 90 } },
      { dead: false, down: false, unit: { energy: 40 } },
      { dead: false, down: false, unit: { energy: 80 } },
      { dead: false, down: false, unit: { energy: 80 } },
    ];
    expect(successor(soldiers)).toBe(soldiers[3]);
    expect(successor(soldiers.slice(0, 2))).toBeNull();
    expect(successor([])).toBeNull();
    const inside = { dead: false, down: false, unit: { energy: 100, hidden: true } };
    const outside = { dead: false, down: false, unit: { energy: 20, hidden: false } };
    expect(successor([inside, outside])).toBe(outside);
    expect(successor([inside])).toBeNull();
  });
  it('lee los grupos de .PATRULLAS con sus valores por defecto', () => {
    const g = parseGroups(MIS, 'FACIL');
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ token: 'PAT1', n: 3, startAtHome: true, regeneratePatrol: false, home: 'CASA_REACT_01', exitEvents: ['REAC'], columns: 1, animCabo: 'CABO', animSoldier: 'ALEGABAR', formX: 40, formY: 30 });
    expect(g[0]?.route?.points.map((p) => [p.x, p.y, p.vel])).toEqual([[10, 20, 1.7], [30, 40, 1.7]]);
    expect(g[0]?.reactEvents).toEqual(['REAC', 'ALAR']);
    expect(g[0]?.routes).toHaveLength(1);
    expect(g[1]).toMatchObject({ token: 'PAT2', n: 4, home: null, position: { x: 7, y: 8, z: 9 }, angle: 90, exitEvents: ['REAC', 'ZOIN'], route: null, columns: 2 });
    expect(g[0]).toMatchObject({ position: null, angle: 0 });
    expect(eventList('reac')).toEqual(['REAC']);
    expect(eventList(undefined)).toEqual([]);
  });

  it('formación: con 2 columnas los dos primeros van a ±20 del cabo, los demás en fila tras el patrullero idx−n', () => {
    expect(formationOf(0, 2, 5, 40)).toEqual({ leader: -1, lateral: -20 });
    expect(formationOf(1, 2, 5, 40)).toEqual({ leader: -1, lateral: 20 });
    expect(formationOf(2, 2, 5, 40)).toEqual({ leader: 0, lateral: 0 });
    expect(formationOf(0, 1, 5, 40)).toEqual({ leader: -1, lateral: 0 });
    expect(formationOf(1, 1, 5, 40)).toEqual({ leader: 0, lateral: 0 });
    expect(formationOf(1, 2, 1, 40)).toEqual({ leader: 0, lateral: 0 }); // solo queda 1 vivo: una columna
    const p = followPoint(100, 100, 0, 0, 30);
    expect([Math.round(p.x), Math.round(p.y)]).toEqual([70, 100]);
    const q = followPoint(100, 100, 90, 20, 0);
    expect([Math.round(q.x), Math.round(q.y)]).toEqual([80, 100]);
  });

  it('el sensor de zona devuelve el evento si el sector pertenece a la zona', () => {
    const sensors = parseZoneSensors(MIS);
    expect(sensors).toEqual([{ zone: 'CAMPAMENTO', message: 'REAC' }, { zone: 'OTRA', message: 'ZOIN' }]);
    const z = new ZoneEvents({ groups: [{ name: 'CAMPAMENTO', items: [[0, 4], [0, 7]] }, { name: 'otra', items: [[0, 7]] }] }, sensors);
    expect(z.at(4)).toEqual(['REAC']);
    expect(z.at(7)).toEqual(['REAC', 'ZOIN']);
    expect(z.at(9)).toEqual([]);
  });

  it('ignora grupos sin TOKEN, entradas que no son listas y sensores incompletos', () => {
    const bad = `.MISSION [
      .SENSORES_SND_ZONA [ [ .ZONA SOLA ] [ .MENSAJE SOLO ] NOLISTA ]
      .PATRULLAS [ [ .NSOLDIERS 2 ] NOLISTA [ .TOKEN OK .EXITHOME_EVENTS [ A [ B ] ] ] ] ]`;
    expect(parseGroups(bad, 'FACIL').map((g) => [g.token, g.exitEvents])).toEqual([['OK', ['A']]]);
    expect(parseZoneSensors(bad)).toEqual([]);
    expect(parseGroups('', 'FACIL')).toEqual([]);
    expect(parseGroups('.MISSION [ .PATRULLAS [ [ .TOKEN P .REGENERATEPATROL 1 ] ] ]', 'FACIL')[0]?.regeneratePatrol).toBe(true);
  });
});
