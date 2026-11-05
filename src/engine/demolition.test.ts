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
    expect(sites.map((s) => s.name)).toEqual(['ANTI01', 'FARO01', 'CASA04', 'EXPL']);
    expect(sites[0]?.rect).toEqual({ x0: 480, y0: 480, x1: 520, y1: 520 });
    expect(sites[0]?.swaps[0]?.pairs).toBeNull();
    expect(sites[1]?.swaps[0]?.pairs?.get('A.RLE')).toBe('B.RLE');
    expect(sites[3]?.rect).toEqual({ x0: 50, y0: 50, x1: 150, y1: 150 });
    expect(sites[3]?.swaps.map((s) => s.poly)).toEqual(['ANTENA', 'CASA04']);
    expect(sites[3]?.swaps[1]?.pairs?.get('X.RLE')).toBe('NADA');
    expect(objectives).toEqual(['ANTI01', 'FARO01', 'CASA04']);
    expect(parseSites(MIS, vol, elems).escape).toEqual({ x: 7, y: 9 });
    expect(parseSites('.MISSION [ ]', vol, []).escape).toBeNull();
  });
  it('genera las casas del VOL, reenvía impactos de B a A y excluye EXP1', () => {
    const circle = { ...poly('CASA07', 700, 700), points: [], radio: 30 };
    const extra: Vol = { ...vol, polys: [...vol.polys, poly('CASA06A', 300, 300), poly('CASA06B', 400, 300), poly('CASA06EXP1', 450, 300), circle] };
    const parsed = parseSites('.MISSION [ ]', extra, []);
    expect(parsed.sites.find((s) => s.name === 'CASA06B')?.forwardsTo).toBe('CASA06A');
    expect(parsed.sites.find((s) => s.name === 'CASA06EXP1')).toBeUndefined();
    expect(parsed.sites.find((s) => s.name === 'CASA07')?.rect).toEqual({ x0: 670, y0: 670, x1: 730, y1: 730 });
    const d = new Demolition(parsed.sites, [], { soldiers: [], commandos: [] });
    d.explode(400, 300, 1);
    expect(d.destroyed.has('CASA06A')).toBe(true);
    expect(d.destroyed.has('CASA06B')).toBe(false);
    expect(d.mapState().ruined.has('CASA06B')).toBe(true);
  });
  it('una casa fuerte rechaza explosión menor y acepta bomba', () => {
    const parsed = parseSites('.MISSION [ .CASASFUERTES [ [ .MAP CASA04 ] ] .INTENDENCIAINFO [ .OBJETIVOS [ [ .OBJETIVO CASA04 ] ] ] ]', vol, []);
    const d = new Demolition(parsed.sites, parsed.objectives, { soldiers: [], commandos: [] });
    d.explode(120, 120, 1, 'EBAR');
    expect(d.objectives.get('CASA04')).toBe(false);
    d.explode(120, 120, 1);
    expect(d.objectives.get('CASA04')).toBe(true);
  });
  it('los detectores respetan la altura del cilindro de la onda', () => {
    const house = { ...poly('CASA04', 120, 120), header: [120, 120, 355, 105, 4, 0] };
    const parsed = parseSites('.MISSION [ .INTENDENCIAINFO [ .OBJETIVOS [ [ .OBJETIVO CASA04 ] ] ] ]', { ...vol, polys: [house] }, []);
    const d = new Demolition(parsed.sites, parsed.objectives, { soldiers: [], commandos: [] });
    d.explode(120, 120, 250, 'XPLO', 'BOMBA', 665);
    expect(d.objectives.get('CASA04')).toBe(false);
    d.explode(120, 120, 250, 'XPLO', 'BOMBA', 355);
    expect(d.objectives.get('CASA04')).toBe(true);
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

  it('el daño de área respeta el radio del cuerpo y el intervalo vertical de la onda', () => {
    const inside = unit(109, 0, 'COMANDO');
    const boundary = unit(110, 0, 'ARTIFIC');
    const above = unit(0, 0, 'FRANCOT');
    above.z = 101;
    const d = new Demolition([], [], { soldiers: [], commandos: [inside, boundary, above] });
    d.explode(0, 0, 100);
    expect(inside.dead).toBe(true);
    expect(boundary.dead).toBe(false);
    expect(above.dead).toBe(false);
  });

  it('un barril no encadena otro que esté por encima de la onda', () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    const near = d.addBarrel('NEAR', 0, 0, 0, 20);
    const high = d.addBarrel('HIGH', 0, 0, 101, 20);
    near.hurt('PISTOLA');
    expect(near.dead).toBe(true);
    expect(high.dead).toBe(false);
  });

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

  it('cambiar los tiles de CASA04 desde la antena no destruye por sí solo el edificio objetivo', () => {
    const { d } = mk();
    d.explode(60, 100, 1);
    const st = d.mapState();
    expect(st.rename.get('ANTENA')?.get('ANTE.RLE')).toBe('ANTD.RLE');
    expect(st.rename.get('CASA04')?.get('X.RLE')).toBe('NADA');
    expect(d.objectives.get('CASA04')).toBe(false);
    expect(d.destroyed.has('CASA04')).toBe(false);
    d.dirty = false;
    d.explode(60, 100, 1);
    expect(d.dirty).toBe(false);
    d.explode(120, 120, 1);
    expect(d.objectives.get('CASA04')).toBe(true);
    expect(d.destroyed.has('CASA04')).toBe(true);
    expect(d.objectivesDone).toBe(false);
  });
});

describe('minas', () => {
  const mkMine = () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    const mine = d.addMine(200, 0);
    expect(d.mines[0]).toBe(mine);
    const boat = new Boat(0, 0, 0, 0, [{ entry: [0, 0], exit: [0, 0], angle: 0 }], null);
    boat.share = true;
    const u = unit(0, 0, 'COMANDO');
    u.pilot = true;
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
    expect(u.dead).toBe(true);
    boat.tick();
    d.tickMines(boat, [u]);
    expect(d.boatSunk).toBe(true);
    expect(u.dead).toBe(true);
    expect(d.mines[0]?.done).toBe(true);
    expect(d.blasts).toHaveLength(1);
    expect(d.blasts[0]?.tag).toBe('XPLO');
    d.tickMines(boat, [u]); // ya explotó: no repite
    expect(d.blasts).toHaveLength(1);
  });

  it('el impacto de contacto ocurre aunque el bote se aleje antes de la explosión', () => {
    const { d, boat, u } = mkMine();
    boat.x = 160;
    d.tickMines(boat, [u]);
    expect(u.dead).toBe(true);
    boat.x = -500;
    boat.tick();
    d.tickMines(boat, [u]);
    expect(d.boatSunk).toBe(true);
    const e = new Demolition([], [], { soldiers: [], commandos: [] });
    e.addMine(0, 0);
    e.tickMines(null, []);
    expect(e.mines[0]?.fuse).toBeNull();
  });
  it('la invencibilidad del ocupante no se anula al explotar la mina', () => {
    const { d, boat, u } = mkMine();
    u.invulnerable = true;
    boat.x = 160;
    d.tickMines(boat, [u]);
    boat.tick();
    d.tickMines(boat, [u]);
    boat.tick();
    expect(u.dead).toBe(false);
    expect(boat.punctured).toBe(false);
  });
});

describe('minas: buzo', () => {
  it('el buzo que roza la mina muere y la dispara; las posiciones alejadas o a otra altura no', () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    d.addMine(200, 0);
    const swimmer = unit(200, 0, 'LANCHERO');
    swimmer.z = 200;
    d.tickMines(null, [swimmer]);
    expect(d.mines[0]?.fuse).toBeNull(); // por encima del cilindro
    swimmer.diving = true;
    swimmer.z = 0;
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
  it('un aliado sin bucear también activa el contacto si se superponen los cilindros', () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    d.addMine(200, 0, -70);
    const ally = unit(200, 0, 'COMANDO');
    d.tickMines(null, [ally]);
    expect(ally.dead).toBe(true);
    expect(d.mines[0]?.fuse).toBe(1);
  });
  it('la Zodiac no toca una mina a otra altura, aunque coincidan en XY', () => {
    const d = new Demolition([], [], { soldiers: [], commandos: [] });
    d.addMine(0, 0, -200);
    const boat = new Boat(0, 0, 0, 0, [], null);
    d.tickMines(boat, []);
    expect(d.mines[0]?.fuse).toBeNull();
    boat.z = -110;
    d.tickMines(boat, []);
    expect(d.mines[0]?.fuse).toBe(1);
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
