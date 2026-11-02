import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { Boat, boatSlots, type BoatSlot } from './boat.ts';
import { SectorMap } from './sectors.ts';
import { Unit } from './unit.ts';
import { flatten, loadWorld, type WorldOpts } from './world.ts';

const MAC = `# comentario
.CLASS BICHO
.VARIABLES [ EAngulo.180 GGrafico.ALEMAN2 AAcPatrulla VTENGO.1 ]
.BANDO ALEMAN
.ANGULO $Angulo
.VOLCOLISION [ CILINDRO [ .R 10 .H 29 ] ]
.GRAPH [ .ANIM $Grafico ]
.ACCIONES [ [ AcMuerte [ .CARISMA 999 ] ] [ $AcPatrulla [ .CARISMA 200 ] ] [ AcPisar [ .CARISMA 100 ] ] ]
`;
const BOAT_MAC = `.CLASS BICHO
.GRAPH [ .ANIM BARCA ]
.ACCIONES [ [ acPilotaje [ .INFO [ [ .ENTRADA [ 20 0 0 ] .SALIDA [ 55 0 0 ] .ANGULO 180 ] [ .ENTRADA [ 0 7 0 ] .SALIDA [ 0 55 0 ] ] ] ] ] ]
`;
const opts = (difficulty: 'FACIL' | 'DIFICIL'): WorldOpts => ({ difficulty, macro: (n) => ({ SOLD: MAC, BOTE: BOAT_MAC })[n] });

const MIS = `.MISSION [ .ELEMENTOS [
  [ .CLASS MACRO .MACRO SOLD .TOKEN S1 .XYZ [ 10 20 30 ] .Angulo 30 .AcPatrulla [ acPatrulla [ .RUTA [ ] ] ] ]
  [ .CLASS MACRO .MACRO SOLD .TOKEN S2 .XYZ [ 1 2 3 ] .NIVEL FACIL ]
  [ .CLASS MACRO .MACRO SOLD .TOKEN S3 .XYZ [ 4 5 6 ] .NIVEL DIFICIL .Grafico CABO ]
  [ .CLASS MACRO .MACRO NOEXISTE .TOKEN X ]
  [ .CLASS MACRO .MACRO BOTE .TOKEN B .XYZ [ 100 200 0 ] .ELEMENTOS [ [ .CLASS BICHOALIADO .TOKEN A1 .XYZ [ 0 0 0 ] .GRAPH [ .ANIM FRANCO ] ] ] ]
  [ .CLASS BICHO .TOKEN P .XYZ [ 7 8 9 ] ]
] ]`;

describe('loadWorld', () => {
  it('expande hijos definidos en la macro con sus variables y conserva los hijos de la instancia', () => {
    const macro = '.CLASS BICHO .VARIABLES [ TArtillero ] .ELEMENTOS [ [ .CLASS BICHO .TOKEN $Artillero .BANDO ALEMAN ] ]';
    const mis = '.MISSION [ .ELEMENTOS [ [ .CLASS MACRO .MACRO NIDO .TOKEN ARMA .Artillero ART1 .ELEMENTOS [ [ .CLASS BICHO .TOKEN OTRO ] ] ] ] ]';
    const [nido] = loadWorld(mis, { difficulty: 'FACIL', macro: () => macro });
    expect(nido?.children.map((c) => c.token)).toEqual(['ART1', 'OTRO']);
    expect(nido?.children[0]?.parent).toBe(nido);
    expect(nido?.children[0]?.bando).toBe('ALEMAN');
  });
  it('expande la macro: variables de la instancia, defaults de .VARIABLES y acciones con $Var', () => {
    const [s1] = loadWorld(MIS, opts('DIFICIL'));
    expect(s1).toMatchObject({ token: 'S1', cls: 'BICHO', macro: 'SOLD', bando: 'ALEMAN', x: 10, y: 20, z: 30, angle: 30, anim: 'ALEMAN2', radius: 10, height: 29 });
    // $AcPatrulla = lista [acPatrulla [...]] en posición de nombre: nombre = lista[0], y los parámetros del MAC se suman
    expect(s1?.actions.map((a) => a.name)).toEqual(['AcMuerte', 'acPatrulla', 'AcPisar']);
  });

  it('una variable sin valor ni default (AcPatrulla) no crea acción; el default del ángulo es 180', () => {
    const w = flatten(loadWorld(MIS, opts('DIFICIL')));
    const s3 = w.find((e) => e.token === 'S3');
    expect(s3?.actions.map((a) => a.name)).toEqual(['AcMuerte', 'AcPisar']);
    expect(s3?.angle).toBe(180);
    expect(s3?.anim).toBe('CABO');
  });

  it('.NIVEL: FACIL y DIFICIL solo con su dificultad; sin .MAC no se crea; BICHO directo y anidados', () => {
    const facil = flatten(loadWorld(MIS, opts('FACIL'))).map((e) => e.token);
    const dificil = flatten(loadWorld(MIS, opts('DIFICIL'))).map((e) => e.token);
    expect(facil).toEqual(['S1', 'S2', 'B', 'A1', 'P']);
    expect(dificil).toEqual(['S1', 'S3', 'B', 'A1', 'P']);
    const w = loadWorld(MIS, opts('DIFICIL'));
    const bote = w.find((e) => e.token === 'B');
    expect(bote?.children[0]?.parent).toBe(bote);
    expect(bote?.children[0]).toMatchObject({ token: 'A1', cls: 'BICHOALIADO', anim: 'FRANCO' });
    expect(w.find((e) => e.token === 'P')).toMatchObject({ cls: 'BICHO', macro: null, x: 7 });
  });

  it('misión sin .MISSION o sin .ELEMENTOS = vacía', () => {
    expect(loadWorld('.X 1', opts('FACIL'))).toEqual([]);
    expect(loadWorld('.MISSION [ ]', opts('FACIL'))).toEqual([]);
  });
});

describe('boatSlots', () => {
  it('lee ENTRADA/SALIDA/ANGULO de acPilotaje.INFO; un elemento sin pilotaje no tiene plazas', () => {
    const bote = loadWorld(MIS, opts('DIFICIL')).find((e) => e.token === 'B');
    expect(bote && boatSlots(bote)).toEqual([
      { entry: [20, 0], exit: [55, 0], angle: 180 },
      { entry: [0, 7], exit: [0, 55], angle: 0 },
    ]);
    const s1 = loadWorld(MIS, opts('DIFICIL'))[0];
    expect(s1 && boatSlots(s1)).toEqual([]);
  });
});

// Mar (tipo 1) en x 0..100, tierra (tipo 0) 100..200, agua profunda (tipo 3) 200..300
const verts: [number, number][] = [];
for (let i = 0; i <= 3; i++) verts.push([i * 100, 0], [i * 100, 100]);
const quad = (i: number, extra: object = {}): { verts: number[] } => ({ verts: [i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1], ...extra });
const sectors = new SectorMap(
  parseSec(secBytes({ verts, a: [quad(0, { type: 1 }), quad(1), quad(2, { type: 3 })], tw1: [[-1, 1, -1, -1], [-1, 2, -1, 0], [-1, -1, -1, 1]] })),
);
const anm = parseAnm(bnm([{ type: 0, slots: [2] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'EMBARCADO', 2, 30, 0, 8)]));
const slots: BoatSlot[] = [
  { entry: [20, 0], exit: [55, 0], angle: 180 },
  { entry: [0, 7], exit: [0, 55], angle: 0 },
];

describe('Unit en un bote', () => {
  it('embarca (EMBARCADO, sigue la plaza y el rumbo del bote) y no camina', () => {
    const boat = new Boat(50, 50, 0, 90, slots, sectors);
    const u = new Unit('X', anm, 0, 0, 0, 0, sectors);
    u.board(boat, 0);
    expect(u.anim.name).toBe('EMBARCADO');
    expect(u.body.x).toBeCloseTo(50, 5); // plaza 0 en (20,0) local = (0,20) con el bote a 90°
    expect(u.body.y).toBeCloseTo(70, 5);
    expect(u.body.ang).toBeCloseTo(270, 5);
    boat.x = 60;
    u.tick();
    expect(u.body.x).toBeCloseTo(60, 5);
  });

  it('baja con el bote parado a la primera SALIDA a pie (la propia plaza, o la siguiente); no en agua profunda ni con el bote en marcha', () => {
    const boat = new Boat(50, 50, 0, 0, slots, sectors);
    const u = new Unit('X', anm, 0, 0, 0, 0, sectors);
    u.board(boat, 0);
    boat.vx = 1;
    expect(u.disembark()).toBe(false); // velocidad ≥ 0,01
    boat.vx = 0;
    expect(u.disembark()).toBe(true); // salida (105,50) = tierra
    expect(u.boat).toBeNull();
    expect(u.body.x).toBeCloseTo(105, 5);
    expect(u.sector?.type).toBe(0);
    expect(u.anim.name).toBe('ANDAR');

    const deep = new Boat(250, 50, 0, 0, slots, sectors); // sus salidas caen en x 305 (fuera) y 250,105 (fuera)
    const v = new Unit('Y', anm, 0, 0, 0, 0, sectors);
    v.board(deep, 0);
    expect(v.disembark()).toBe(false);
    expect(v.boat).toBe(deep);
    expect(new Unit('Z', anm, 0, 0, 0, 0, sectors).disembark()).toBe(false); // no va en ningún bote
  });
});

describe('Unit: buceo (AuBucear)', () => {
  const anmD = parseAnm(bnm([{ type: 0, slots: [3] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(1, 'BUCEAR', 2, 30, 0, 8)]));
  const at = (x: number): Unit => {
    const u = new Unit('LANCHERO', anmD, x, 50, 0, 0, sectors);
    u.tick();
    return u;
  };

  it('solo empieza en el agua; bajo el agua solo se pisa agua (también profunda) y se sale con otro AuBucear salvo en agua profunda', () => {
    expect(at(150).toggleDive()).toBe(false); // tierra
    const u = at(50);
    expect(u.toggleDive()).toBe(true);
    expect(u.anim.name).toBe('BUCEAR');
    expect(u.goTo({ x: 150, y: 50 }, false)).toBe(false); // tierra
    expect(u.goTo({ x: 250, y: 50 }, false)).toBe(false); // agua profunda separada por tierra
    // bajo el agua no rige el ×0,5: caminar 2,5 por ciclo y correr (doble clic) 5 o 6
    const x0 = u.body.x;
    u.goTo({ x: 90, y: 50 }, true);
    u.tick();
    expect(u.running).toBe(true);
    expect(u.body.x - x0).toBeGreaterThan(2.5);
    u.stop();
    expect(u.toggleDive()).toBe(false);
    expect(u.diving).toBe(false);
    expect(u.anim.name).toBe('REPOSO');
    const deep = at(250);
    expect(deep.toggleDive()).toBe(false); // no se inicia en agua profunda
    deep.diving = true;
    expect(deep.toggleDive()).toBe(true); // no se sale en agua profunda
    expect(new Unit('X', anmD, 0, 0, 0, 0, sectors).toggleDive()).toBe(false); // sin sector
    const dead = at(50);
    dead.hit(1e9);
    expect(dead.toggleDive()).toBe(false);
  });

  it('se tira desde el bote parado a una salida con agua; no con el bote en marcha ni sin agua', () => {
    const boat = new Boat(20, 50, 0, 0, slots, sectors); // salida 0 = (75,50) mar
    const u = new Unit('LANCHERO', anmD, 0, 0, 0, 0, sectors);
    u.board(boat, 0);
    boat.vx = 1;
    expect(u.diveOut()).toBe(false);
    boat.vx = 0;
    expect(u.diveOut()).toBe(true);
    expect(u.boat).toBeNull();
    expect(u.diving).toBe(true);
    expect(u.body.x).toBeCloseTo(75, 5);
    expect(u.anim.name).toBe('BUCEAR');
    const land = new Boat(120, 50, 0, 0, slots, sectors); // salidas en tierra
    const v = new Unit('LANCHERO', anmD, 0, 0, 0, 0, sectors);
    v.board(land, 0);
    expect(v.diveOut()).toBe(false);
    expect(new Unit('Z', anmD, 0, 0, 0, 0, sectors).diveOut()).toBe(false);
  });
});

describe('loadWorld: casos límite', () => {
  const mac = (n: string): string | undefined =>
    ({
      RARA: '.VARIABLES [ X VN.7.5 Cnombre ] .ACCIONES [ solo [ [ ] .CARISMA 1 ] [ [ [ ] ] ] [ [ [ nombre ] [ .K 1 ] ] [ .Z 2 ] ] [ AcOk [ .A 1 ] ] ]',
      CUERPO: '.CLASS BICHO .VOLCOLISION [ ] .ACCIONES [ [ AcX [ ] ] ]',
    })[n];
  const w = loadWorld('.MISSION [ .ELEMENTOS [ [ .CLASS MACRO .MACRO RARA ] [ .CLASS MACRO ] [ .CLASS MACRO .MACRO CUERPO .XYZ [ a b ] ] 7 ] ]', { difficulty: 'FACIL', macro: mac });
  it('macro sin .CLASS = BICHO, sin .TOKEN toma el nombre de la macro, sin .XYZ el origen; entradas raras de .ACCIONES se ignoran', () => {
    expect(w.map((e) => [e.token, e.cls, e.x, e.y, e.z, e.angle, e.anim, e.radius])).toEqual([
      ['RARA', 'BICHO', 0, 0, 0, 0, null, 0],
      ['CUERPO', 'BICHO', 0, 0, 0, 0, null, 0],
    ]);
    expect(w[0]?.actions.map((a) => a.name)).toEqual(['AcOk']);
    expect(w[1]?.actions.map((a) => a.name)).toEqual(['AcX']);
  });

  it('un MACRO sin .MACRO no se crea', () => {
    expect(loadWorld('.MISSION [ .ELEMENTOS [ [ .CLASS MACRO .TOKEN T ] ] ]', { difficulty: 'FACIL', macro: mac })).toEqual([]);
  });

  it('boatSlots ignora plazas incompletas', () => {
    const e = loadWorld('.MISSION [ .ELEMENTOS [ [ .CLASS BICHO .ACCIONES [ [ acPilotaje [ .INFO [ [ .ENTRADA [ 1 2 ] ] 3 [ .ENTRADA [ 1 2 ] .SALIDA [ 3 4 ] ] ] ] ] ] ] ] ]', { difficulty: 'FACIL', macro: mac })[0];
    expect(e && boatSlots(e)).toEqual([{ entry: [1, 2], exit: [3, 4], angle: 0 }]);
  });
});
