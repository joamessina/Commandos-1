import { describe, expect, it } from 'vitest';
import { eventList, followPoint, formationOf, parseGroups, parseZoneSensors, ZoneEvents } from './groups.ts';

const MIS = `.MISSION [
  .SENSORES_SND_ZONA [ [ .ZONA CAMPAMENTO .MENSAJE REAC ] [ .ZONA OTRA .MENSAJE ZOIN ] ]
  .PATRULLAS [
    [ .TOKEN PAT1 .NSOLDIERS 3 .HOME CASA_REACT_01 .EXITHOME_EVENTS REAC .STARTATHOME 1 .NCOLUMNS 1
      .RUTADEF [ [ .NOMBRE RUTA1 .TIPORUTA LOOP .RUTA [ [ .XYZ [ 10 20 0 ] ] [ .XYZ [ 30 40 0 ] ] ] .VEL 1.7 ] ]
      .ANIMCABO CABO .ANIMSOLDADO ALEGABAR ]
    [ .TOKEN PAT2 .EXITHOME_EVENTS [ REAC ZOIN ] ]
  ]
]`;

describe('groups', () => {
  it('lee los grupos de .PATRULLAS con sus valores por defecto', () => {
    const g = parseGroups(MIS, 'FACIL');
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ token: 'PAT1', n: 3, home: 'CASA_REACT_01', exitEvents: ['REAC'], columns: 1, animCabo: 'CABO', animSoldier: 'ALEGABAR', formX: 40, formY: 30 });
    expect(g[0]?.route?.points.map((p) => [p.x, p.y, p.vel])).toEqual([[10, 20, 1.7], [30, 40, 1.7]]);
    expect(g[1]).toMatchObject({ token: 'PAT2', n: 4, home: null, exitEvents: ['REAC', 'ZOIN'], route: null, columns: 2 });
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
  });
});
