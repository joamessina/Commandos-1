import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import type { Vol } from '../formats/vol.ts';
import { anmSeq, bnm } from '../testing/builders.ts';
import { Boat } from './boat.ts';
import { BARREL_RADIUS, BLAST_CYCLES, BOMB_RADIUS, Demolition, parseSites } from './demolition.ts';
import { Soldier } from './soldier.ts';
import { Unit } from './unit.ts';
import { loadWorld, flatten } from './world.ts';

const anm = parseAnm(bnm([{ type: 0, slots: [3] }, ...anmSeq(1, 'ANDAR', 2, 30, 0, 8), ...anmSeq(1, 'REPOSO', 1, 0, 0, 8), ...anmSeq(2, 'MUERTE1', 2, 0, 20, 8)]));
const unit = (x: number, y: number, token = 'X'): Unit => new Unit(token, anm, x, y, 0, 0);
const poly = (name: string, cx: number, cy: number): Vol['polys'][number] => ({
  name,
  ramp: false,
  header: [cx, cy, 0, 0, 4, 0],
  points: [{ x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: 20 }, { x: -20, y: 20 }],
  tiles: [],
  radio: null,
  extraInfo: null,
});
const vol = { width: 1000, height: 1000, extraSprites: [], polys: [poly('ANTI01', 500, 500), poly('FARO01', 800, 200), poly('ANTENA', 100, 100), poly('CASA04', 120, 120)] } as unknown as Vol;

const MIS = `.MISSION [
  .AUTOEXPCASAS [ [ .MAP ANTI01 ] [ .MAP FARO01 .TILES [ A.RLE B.RLE C.RLE NADA ] ] [ .MAP NOEXISTE ] 4 ]
  .INTENDENCIAINFO [ .PUNTOHUIDA [ 7 9 ] .OBJETIVOS [ [ .OBJETIVO ANTI01 ] [ .OBJETIVO FARO01 ] [ .OBJETIVO CASA04 ] [ .X 1 ] ] ]
  .ELEMENTOS [ [ .CLASS BICHO .TOKEN EXPL .XYZ [ 100 100 0 ] .VOLCOLISION [ CILINDRO [ .R 50 .H 100 ] ]
    .ACCIONES [ [ acExplotaCasa [ .CAMBIATILES [ [ .MAPA ANTENA .TILES [ ANTE.RLE ANTD.RLE ] ] [ .MAPA CASA04 .TILES [ X.RLE NADA ] ] 5 ] ] ] ] ] ]
]`;
const elems = flatten(loadWorld(MIS, { difficulty: 'FACIL', macro: () => undefined }));

describe('parseSites', () => {
  const { sites, objectives } = parseSites(MIS, vol, elems);
  it('AUTOEXPCASAS (caja del polígono, TILES en pares) y acExplotaCasa (caja del cilindro, CAMBIATILES)', () => {
    expect(sites.map((s) => s.name)).toEqual(['ANTI01', 'FARO01', 'EXPL']);
    expect(sites[0]?.rect).toEqual({ x0: 480, y0: 480, x1: 520, y1: 520 });
    expect(sites[0]?.swaps[0]?.pairs).toBeNull();
    expect(sites[1]?.swaps[0]?.pairs?.get('A.RLE')).toBe('B.RLE');
    expect(sites[2]?.rect).toEqual({ x0: 50, y0: 50, x1: 150, y1: 150 });
    expect(sites[2]?.swaps.map((s) => s.poly)).toEqual(['ANTENA', 'CASA04']);
    expect(sites[2]?.swaps[1]?.pairs?.get('X.RLE')).toBe('NADA');
    expect(objectives).toEqual(['ANTI01', 'FARO01', 'CASA04']);
    expect(parseSites(MIS, vol, elems).escape).toEqual({ x: 7, y: 9 });
    expect(parseSites('.MISSION [ ]', vol, []).escape).toBeNull();
  });
});

describe('Demolition', () => {
  const mk = (bombs = 2) => {
    const s1 = new Soldier('S1', unit(520, 500, 'S1'), null);
    const s2 = new Soldier('S2', unit(900, 900, 'S2'), null);
    const c = unit(480, 520, 'COMANDO');
    const { sites, objectives } = parseSites(MIS, vol, elems);
    const d = new Demolition(sites, objectives, { soldiers: [s1, s2], commandos: [c] }, bombs);
    return { d, s1, s2, c };
  };

  it('la bomba plantada y detonada mata a quien esté a ≤250, destruye el sitio cercano, cumple el objetivo y marca el mapa sucio', () => {
    const { d, s1, s2, c } = mk();
    expect(d.plant(500, 500)).toBe(true);
    expect(d.bombs).toBe(1);
    expect(d.objectivesDone).toBe(false);
    expect(d.detonate()).toBe(1);
    expect(s1.dead && c.dead).toBe(true);
    expect(s2.dead).toBe(false);
    expect(d.objectives.get('ANTI01')).toBe(true);
    expect(d.dirty).toBe(true);
    expect(d.mapState().ruined.has('ANTI01')).toBe(true);
    expect(d.blasts).toHaveLength(1);
    expect(d.blasts[0]?.tag).toBe('XPLO');
    for (let i = 0; i < BLAST_CYCLES; i++) d.tick();
    expect(d.blasts).toHaveLength(0);
    expect(BOMB_RADIUS).toBe(250);
  });

  it('sin bombas no se planta; el segundo detonador no hace nada', () => {
    const { d } = mk(0);
    expect(d.plant(1, 1)).toBe(false);
    expect(d.detonate()).toBe(0);
  });

  it('recoge una bomba plantada a su altura una sola vez y no la detona después', () => {
    const { d } = mk(1);
    expect(d.plant(150, 200, 65)).toBe(true);
    const bomb = d.planted[0];
    expect(bomb).toEqual({ x: 150, y: 200, z: 65 });
    if (!bomb) throw new Error('bomba ausente');
    expect(d.recover(bomb)).toBe(true);
    expect([d.bombs, d.planted.length, d.detonate()]).toEqual([1, 0, 0]);
    expect(d.recover(bomb)).toBe(false);
    expect(d.bombs).toBe(1);
    expect(d.plant(150, 200, 65)).toBe(true);
    const detonated = d.planted[0];
    if (!detonated) throw new Error('bomba ausente');
    d.detonate();
    expect(d.recover(detonated)).toBe(false);
  });

  it('un barril explota con disparo (no con cuchillo), encadena barriles y bombas cercanos y alerta a los soldados a <1200', () => {
    const { d, s2 } = mk();
    const a = d.addBarrel('B1', 800, 205);
    const b = d.addBarrel('B2', 880, 205);
    const far = d.addBarrel('B3', 5000, 5000);
    d.plant(830, 210);
    a.hurt('CUCHILLO');
    expect(a.dead).toBe(false);
    a.hurt('PISTOLA');
    expect(a.dead && b.dead).toBe(true);
    expect(far.dead).toBe(false);
    expect(d.planted).toHaveLength(0); // la bomba también estalló en cadena
    expect(d.objectives.get('FARO01')).toBe(true);
    expect(d.mapState().rename.get('FARO01')?.get('C.RLE')).toBe('NADA');
    expect(s2.order).not.toBe(4); // a 800 u: lo oyó
    a.hurt('MIRILLA'); // ya explotó: no repite
    expect(d.blasts.filter((e) => e.radius === BARREL_RADIUS)).toHaveLength(2);
    expect(d.blasts.map((e) => e.tag)).toEqual(['EBAR', 'EBAR', 'XPLO']);
  });

  it('la antena (acExplotaCasa con CAMBIATILES) cambia dos volúmenes y cumple CASA04; un sitio no se destruye dos veces', () => {
    const { d } = mk();
    d.explode(100, 100, 10);
    const st = d.mapState();
    expect(st.rename.get('ANTENA')?.get('ANTE.RLE')).toBe('ANTD.RLE');
    expect(st.rename.get('CASA04')?.get('X.RLE')).toBe('NADA');
    expect(d.objectives.get('CASA04')).toBe(true);
    d.dirty = false;
    d.explode(100, 100, 10);
    expect(d.dirty).toBe(false);
    expect(d.objectivesDone).toBe(false);
  });
});

describe('minas', () => {
  const mkMine = () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    const mine = d.addMine(200, 0);
    expect(d.mines[0]).toBe(mine);
    const boat = new Boat(0, 0, 0, 0, [{ entry: [0, 0], exit: [0, 0], angle: 0 }], null);
    const u = unit(0, 0, 'COMANDO');
    u.board(boat, 0);
    return { d, boat, u };
  };

  it('el bote dispara la mina al contacto y explota al ciclo siguiente: se hunde y mueren los ocupantes', () => {
    const { d, boat, u } = mkMine();
    d.tickMines(boat, [u]);
    expect(d.mines[0]?.fuse).toBeNull(); // lejos
    boat.x = 160; // 40 < 17 + 30
    d.tickMines(boat, [u]);
    expect(d.boatSunk).toBe(false);
    d.tickMines(boat, [u]);
    expect(d.boatSunk).toBe(true);
    expect(u.dead).toBe(true);
    expect(d.mines[0]?.done).toBe(true);
    expect(d.blasts).toHaveLength(1);
    expect(d.blasts[0]?.tag).toBe('XPLO');
    d.tickMines(boat, [u]); // ya explotó: no repite
    expect(d.blasts).toHaveLength(1);
  });

  it('si el bote ya se alejó cuando explota solo hay explosión; sin bote no pasa nada', () => {
    const { d, boat, u } = mkMine();
    boat.x = 160;
    d.tickMines(boat, [u]);
    boat.x = -500;
    d.tickMines(boat, [u]);
    expect(d.boatSunk).toBe(false);
    expect(u.dead).toBe(false);
    const e = new Demolition([], [], { soldiers: [], commandos: [] });
    e.addMine(0, 0);
    e.tickMines(null, []);
    expect(e.mines[0]?.fuse).toBeNull();
  });
});

describe('minas: buzo', () => {
  it('el buzo que roza la mina muere y la dispara; el que no bucea o está lejos no', () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    d.addMine(200, 0);
    const swimmer = unit(200, 0, 'LANCHERO');
    d.tickMines(null, [swimmer]);
    expect(d.mines[0]?.fuse).toBeNull(); // no bucea
    swimmer.diving = true;
    swimmer.body.x = 100;
    d.tickMines(null, [swimmer]);
    expect(d.mines[0]?.fuse).toBeNull(); // lejos
    swimmer.body.x = 210;
    d.tickMines(null, [swimmer]);
    expect(swimmer.dead).toBe(true);
    expect(d.mines[0]?.fuse).not.toBeNull();
    d.tickMines(null, [swimmer]);
    expect(d.mines[0]?.done).toBe(true);
  });
});

describe('MATABICHOSSECTOR', () => {
  const MIS2 = `.MISSION [ .INTENDENCIAINFO [ .MATABICHOSSECTOR [ [ .TOKEN ANTI01 .SECTORS [ [ .XYZ [ 1 2 3 ] .DESAPARECE 1 ] [ .XYZ [ 9 9 9 ] ] [ .XYZ [ 1 2 ] ] ] ] [ .SECTORS [ ] ] ] ] .AUTOEXPCASAS [ [ .MAP ANTI01 ] ] ]`;
  const { sites, kills } = parseSites(MIS2, vol, []);

  it('parsea las zonas por token', () => {
    expect(kills.get('ANTI01')).toEqual([
      { x: 1, y: 2, z: 3, vanish: true },
      { x: 9, y: 9, z: 9, vanish: false },
    ]);
  });

  it('al destruirse el sitio mueren los del sector (y desaparece el cuerpo si DESAPARECE); los de otro sector no', () => {
    const sec = { id: 'a' } as never;
    const otro = { id: 'b' } as never;
    const dentro = new Soldier('D', unit(500, 500, 'D'), null);
    const fuera = new Soldier('F', unit(700, 700, 'F'), null);
    const cmd = unit(500, 500, 'COMANDO');
    dentro.unit.sector = sec;
    fuera.unit.sector = otro;
    cmd.sector = sec;
    const d = new Demolition(sites, ['ANTI01'], { soldiers: [dentro, fuera], commandos: [cmd] }, 0, { sectors: { at: () => sec, atZ: (x: number, y: number, z: number) => (z === 3 ? sec : null) }, kills });
    d.explode(500, 500, 30);
    expect(d.destroyed.has('ANTI01')).toBe(true);
    expect(dentro.dead).toBe(true);
    expect(dentro.unit.hidden).toBe(true);
    expect(cmd.dead).toBe(true);
    expect(cmd.hidden).toBe(true);
    expect(fuera.dead).toBe(false);
  });
});
