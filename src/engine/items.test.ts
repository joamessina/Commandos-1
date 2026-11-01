import { describe, expect, it } from 'vitest';
import { parseAnm } from '../formats/anm.ts';
import { parseSec } from '../formats/sec.ts';
import { anmSeq, bnm, secBytes } from '../testing/builders.ts';
import { Attack, type AttackWorld, ARPON_RELOAD } from './attack.ts';
import { Battle } from './battle.ts';
import { Boat } from './boat.ts';
import { SectorMap } from './sectors.ts';
import { CONTROL_RADIUS, Order, Soldier, type SoldierWorld } from './soldier.ts';
import { canThrow, Packs, STONE_NOISE } from './throwing.ts';
import { MEDKIT_HEAL, Unit } from './unit.ts';

const anm = parseAnm(
  bnm([
    { type: 0, slots: [11] },
    ...anmSeq(1, 'ANDAR', 2, 30, 0, 8),
    ...anmSeq(1, 'REPOSO', 1, 0, 0, 8),
    ...anmSeq(1, 'APUNTAR', 1, 0, 0, 8),
    ...anmSeq(2, 'DISPARAR', 1, 0, 5, 8),
    ...anmSeq(2, 'MUERTE1', 2, 0, 20, 8),
    ...anmSeq(2, 'RECOGER', 1, 0, 8, 8),
    ...anmSeq(1, 'FUMAR', 1, 0, 0, 8),
    ...anmSeq(1, 'ESPOSAS1', 1, 0, 0, 8),
    ...anmSeq(2, 'LANZARPIEDRA', 1, 0, 8, 8),
    ...anmSeq(1, 'APUNTAARPON', 1, 0, 0, 8),
    ...anmSeq(2, 'DISPARAARPON', 1, 0, 2, 8),
  ]),
);
const mk = (x: number, y = 0, token = 'S', z = 0): Unit => new Unit(token, anm, x, y, z, 0);
const world = (over: Partial<SoldierWorld> = {}): SoldierWorld => ({ commandos: [], sectors: null, rng: () => 0, onShot: () => undefined, ...over });
const run = (s: Soldier, w: SoldierWorld, n: number): void => {
  for (let i = 0; i < n; i++) s.tick(w);
};
const smoker = (x: number, y = 0, opts: ConstructorParameters<typeof Soldier>[3] = {}): Soldier => new Soldier('B2', mk(x, y, 'B2'), null, { smokes: true, tobacco: true, ...opts });

describe('canThrow', () => {
  const from = { x: 0, y: 0, z: 0 };
  const to = (x: number, z = 0): { x: number; y: number; z: number; sector: null } => ({ x, y: 0, z, sector: null });
  it('piedra: menos de 300; cajetilla: hasta 200; el destino no puede estar 200 o más por encima', () => {
    expect(canThrow('PIEDRA', from, to(299), null)).toBe(true);
    expect(canThrow('PIEDRA', from, to(300), null)).toBe(false);
    expect(canThrow('TABACO', from, to(200), null)).toBe(true);
    expect(canThrow('TABACO', from, to(201), null)).toBe(false);
    expect(canThrow('PIEDRA', from, to(100, 200), null)).toBe(false);
    expect(canThrow('PIEDRA', from, to(100, 199), null)).toBe(true);
  });

  it('con sectores: el destino debe ser de tipo 0-2 sin flags 0xC14', () => {
    const verts: [number, number][] = [[0, 0], [0, 100], [100, 0], [100, 100], [200, 0], [200, 100], [300, 0], [300, 100]];
    const quad = (i: number, extra: object = {}): { verts: number[] } => ({ verts: [i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1], ...extra });
    const sectors = new SectorMap(parseSec(secBytes({ verts, a: [quad(0), quad(1, { type: 3 }), quad(2, { flags: 0x400 })] })));
    const at = (x: number): { x: number; y: number; z: number; sector: ReturnType<SectorMap['at']> } => ({ x, y: 50, z: 0, sector: sectors.at(x, 50) });
    expect(canThrow('PIEDRA', { x: 10, y: 50, z: 0 }, at(50), sectors)).toBe(true);
    expect(canThrow('PIEDRA', { x: 10, y: 50, z: 0 }, at(150), sectors)).toBe(false);
    expect(canThrow('PIEDRA', { x: 10, y: 50, z: 0 }, at(250), sectors)).toBe(false);
    expect(canThrow('PIEDRA', { x: 10, y: 50, z: 0 }, { x: 50, y: 50, z: 0, sector: null }, sectors)).toBe(false);
  });
});

describe('Packs', () => {
  it('gana el soldado más cercano; al que iba le llega NO_VENGAS; el muerto no cuenta; lo recogido desaparece', () => {
    const packs = new Packs();
    const p = packs.drop(100, 0);
    const far = smoker(400);
    const near = smoker(150);
    expect(packs.claim(p, far)).toBe(true);
    expect(packs.claim(p, near)).toBe(true); // más cerca que el anterior
    expect(p.claimant).toBe(near);
    expect(packs.claim(p, far)).toBe(false); // el otro está más cerca
    expect(packs.claim(p, near)).toBe(true); // el mismo puede repetir
    near.hurt('MIRILLA', mk(0));
    expect(packs.claim(p, far)).toBe(true); // el muerto ya no cuenta
    packs.take(p);
    expect([p.taken, packs.list.length, packs.claim(p, far)]).toEqual([true, 0, false]);
    packs.take(p); // idempotente
  });
});

describe('Soldier: piedra', () => {
  it('BAP1 (no camina): 1.ª pedrada mira 100 ciclos, 2.ª mira 200 y nunca va hacia el lanzador', () => {
    const s = new Soldier('A', mk(0, 0, 'A'), null, { walks: false });
    const t = mk(300, 0, 'T');
    s.hurt('PIEDRA', t);
    expect([s.order, s.unit.body.ang, s.dead, s.unit.energy]).toEqual([Order.Investigate, 0, false, 100]);
    run(s, world(), 99);
    expect(s.order).toBe(Order.Investigate);
    run(s, world(), 400);
    expect(s.order).toBe(Order.Patrol);
    s.pedrada(t);
    s.pedrada(t);
    s.pedrada(t);
    expect(s.unit.target).toBeNull();
  });

  it('BAP2: desde la 3.ª pedrada camina hacia el lanzador; no reacciona atontado, apuntando o controlado', () => {
    const s = new Soldier('A', mk(0, 0, 'A'), null);
    const t = mk(300, 0, 'T');
    s.pedrada(t);
    s.pedrada(t);
    expect(s.unit.target).toBeNull();
    s.pedrada(t);
    expect(s.unit.target).not.toBeNull();
    const aim = new Soldier('B', mk(0, 0, 'B'), null);
    aim.order = Order.Aim;
    aim.pedrada(t);
    expect(aim.order).toBe(Order.Aim);
    const down = new Soldier('C', mk(0, 0, 'C'), null);
    down.hurt('PUNO', t);
    down.pedrada(t);
    expect(down.stun).toBeGreaterThan(0);
  });

  it('el artillero del nido solo gira hacia el lanzador', () => {
    const s = new Soldier('N', mk(0, 0, 'N'), null, { fixed: true });
    s.pedrada(mk(0, 300, 'T'));
    expect([s.order, s.unit.body.ang]).toEqual([Order.Patrol, 90]);
  });

  it('Battle.stone: ruido de radio 125 (atención) y pedrada solo al soldado que está en el punto', () => {
    const victim = new Soldier('V', mk(500, 0, 'V'), null, { walks: false });
    const near = new Soldier('N', mk(560, 0, 'N'), null, { walks: false });
    const far = new Soldier('F', mk(800, 0, 'F'), null, { walks: false });
    const b = new Battle([victim, near, far], [], null, () => 0);
    b.stone(500, 0, mk(0, 0, 'T'));
    expect(STONE_NOISE).toBe(125);
    expect([victim.order, near.order, far.order]).toEqual([Order.Investigate, Order.Investigate, Order.Patrol]);
    b.stone(2000, 0, mk(0, 0, 'T')); // cae sin víctima ni oyentes
    expect(victim.unit.energy).toBe(100);
  });
});

describe('Soldier: cajetilla y tabaco', () => {
  it('BAP2 la ve, camina, la recoge (RECOGER), vuelve al puesto y a los 60 ciclos fuma 500 y repite', () => {
    const packs = new Packs();
    const s = smoker(0);
    const w = world({ packs });
    const p = packs.drop(100, 0);
    run(s, w, 1);
    expect([s.order, p.claimant]).toEqual([Order.Pack, s]);
    for (let i = 0; i < 300 && !p.taken; i++) run(s, w, 1);
    expect([p.taken, s.tobacco, packs.list.length]).toEqual([true, true, 0]);
    expect(s.order).toBe(Order.Return);
    for (let i = 0; i < 300 && s.order !== Order.Smoke; i++) run(s, w, 1);
    expect(s.order).toBe(Order.Smoke);
    expect(s.unit.anim.name).toBe('FUMAR');
    run(s, w, 498);
    expect(s.order).toBe(Order.Smoke);
    run(s, w, 2);
    expect(s.order).not.toBe(Order.Smoke);
    run(s, w, 400);
    expect(s.order).toBe(Order.Smoke); // rng() = 0 → 370 ciclos hasta el siguiente
  });

  it('BAP1 no va a por la cajetilla; si llega otro más cerca al primero se le llama NO_VENGAS; un comando a la vista corta todo', () => {
    const packs = new Packs();
    const base = new Soldier('B1', mk(0, 0, 'B1'), null, { tobacco: true });
    packs.drop(100, 0);
    run(base, world({ packs }), 3);
    expect(base.order).toBe(Order.Patrol);
    packs.take(packs.list[0] as Parameters<Packs['take']>[0]);
    const a = smoker(0);
    const b = smoker(80, 0);
    const p = packs.drop(100, 20);
    run(a, world({ packs }), 1);
    expect(a.order).toBe(Order.Pack);
    run(b, world({ packs }), 1);
    expect([a.order, b.order, p.claimant]).toEqual([Order.Return, Order.Pack, b]);
    const c = smoker(0, 300);
    const q = packs.drop(100, 300);
    run(c, world({ packs }), 1);
    const cmd = mk(60, 300, 'COMANDO');
    run(c, world({ packs, commandos: [cmd] }), 2);
    expect([c.order, q.claimant]).toEqual([Order.Aim, null]);
  });

  it('la cajetilla tomada por otro lo devuelve al puesto; fumando oye ruidos', () => {
    const packs = new Packs();
    const s = smoker(0);
    const p = packs.drop(100, 0);
    run(s, world({ packs }), 1);
    packs.take(p);
    run(s, world({ packs }), 1);
    expect(s.order).toBe(Order.Return);
    const sm = smoker(0, 900);
    sm.tobacco = true;
    // fuerza la orden de fumar a mano con el atajo del primer ciclo: recoge y espera 60
    const pk = packs.drop(30, 900);
    run(sm, world({ packs }), 100);
    expect(pk.taken).toBe(true);
    run(sm, world({ packs }), 40);
    expect(sm.order).toBe(Order.Smoke);
    sm.hear(300, 900);
    expect(sm.order).toBe(Order.Investigate);
  });

  it('takeTobacco: solo un muerto con tabaco, una vez', () => {
    const s = smoker(0);
    expect(s.takeTobacco()).toBe(false); // vivo
    s.kill();
    expect([s.takeTobacco(), s.takeTobacco()]).toEqual([true, false]);
    const sin = new Soldier('X', mk(0, 0, 'X'), null);
    sin.kill();
    expect(sin.takeTobacco()).toBe(false);
  });
});

describe('Control alemán', () => {
  it('solo un esposado: se levanta, va dentro del anillo de 400 y al soltarlo queda esposado', () => {
    const owner = mk(0, 0, 'COMANDO');
    const s = new Soldier('G', mk(100, 0, 'G'), null);
    expect(s.control(owner)).toBe(false); // libre
    s.hurt('ESPOSAS', owner);
    expect(s.cuffed).toBe(true);
    expect(s.controlGo({ x: 10, y: 0 })).toBe(false); // sin dueño
    expect(s.control(owner)).toBe(true);
    expect([s.cuffed, s.controlled]).toEqual([false, owner]);
    expect(s.controlGo({ x: 1000, y: 0 })).toBe(true); // recortado a 399,9
    run(s, world(), 400);
    expect(s.x).toBeGreaterThan(300);
    expect(s.x).toBeLessThan(CONTROL_RADIUS + 5); // el paso final puede pasarse unas unidades
    expect(s.controlGo({ x: 150, y: 0 })).toBe(true); // dentro del anillo: tal cual
    run(s, world(), 100);
    s.hear(50, 50);
    s.pedrada(owner);
    expect(s.order).toBe(Order.Patrol);
    s.releaseControl();
    expect([s.cuffed, s.controlled]).toEqual([true, null]);
    s.releaseControl(); // sin control no hace nada
    s.kill();
    expect(s.control(owner)).toBe(false);
  });

  it('un soldado a menos de 120 de un controlado se queda charlando 10 ciclos sin vigilar', () => {
    const owner = mk(0, 0, 'COMANDO');
    const ctl = new Soldier('G', mk(100, 0, 'G'), null);
    ctl.hurt('ESPOSAS', owner);
    ctl.control(owner);
    const guard = new Soldier('H', mk(160, 0, 'H'), null);
    const far = new Soldier('F', mk(900, 0, 'F'), null);
    const b = new Battle([ctl, guard, far], [owner], null, () => 0);
    b.tick();
    expect([guard.chatLeft > 0, far.chatLeft, guard.unit.body.ang]).toEqual([true, 0, 180]);
    const before = guard.x;
    for (let i = 0; i < 9; i++) b.tick();
    expect(guard.x).toBe(before);
    guard.order = Order.Aim;
    guard.chat(0, 0, 10); // apuntando no charla
    expect(guard.chatLeft).toBeLessThan(10);
    ctl.kill();
    b.tick(); // el controlado muerto ya no hace charlar
  });
});

describe('Arpón y botiquín', () => {
  const quiet: AttackWorld = {
    sectors: null,
    noise: () => {
      throw new Error('el arpón no hace ruido');
    },
    onShot: () => undefined,
  };
  it('arpón: alcance 200, un tiro mata sin ruido y deja 60 ciclos de recarga', () => {
    const s = new Soldier('S', mk(150, 0, 'S'), null);
    const c = mk(0);
    const a = new Attack(c, s, 'ARPON');
    for (let i = 0; i < 100 && !a.done; i++) {
      a.tick(quiet);
      c.tick();
    }
    expect([a.done, s.dead, c.coolDown > 0 && c.coolDown <= ARPON_RELOAD]).toEqual([true, true, true]);
    const s2 = new Soldier('S2', mk(150, 20, 'S2'), null);
    const a2 = new Attack(c, s2, 'ARPON');
    a2.tick(quiet); // recargando: no dispara
    expect(s2.dead).toBe(false);
  });

  it('botiquín: +34 con tope en el máximo, gasta una cura; sin curas, muerto o completo no cura', () => {
    const healer = mk(0, 0, 'FRANCOT');
    const patient = mk(10, 0, 'COMANDO');
    patient.energy = 50;
    healer.medkits = 2;
    expect(healer.treat(patient, 200)).toBe(true);
    expect([patient.energy, healer.medkits, MEDKIT_HEAL]).toEqual([84, 1, 34]);
    patient.energy = 190;
    expect(healer.treat(patient, 200)).toBe(true);
    expect([patient.energy, healer.medkits]).toEqual([200, 0]);
    expect(healer.treat(patient, 200)).toBe(false); // sin curas
    healer.medkits = 1;
    expect(healer.treat(patient, 200)).toBe(false); // completo
    patient.energy = 10;
    patient.hit(1e9);
    expect(healer.treat(patient, 200)).toBe(false); // muerto
  });
});

describe('Francotirador en el bote', () => {
  const seated = (): Unit => {
    const u = mk(0, 0, 'FRANCOT');
    u.board(new Boat(0, 0, 0, 0, [{ entry: [0, 0], exit: [10, 0], angle: 0 }], null), 0);
    return u;
  };
  const shots: number[] = [];
  const w: AttackWorld = { sectors: null, noise: () => undefined, onShot: () => shots.push(1) };

  it('la mirilla dispara al instante desde el bote, un tiro por clic, sin caminar ni animar', () => {
    const sniper = seated();
    const s = new Soldier('S', mk(800, 0, 'S'), null);
    const a = new Attack(sniper, s, 'MIRILLA');
    const pose = sniper.anim.name;
    a.tick(w);
    expect([a.done, s.dead, shots.length, sniper.boat !== null, sniper.anim.name]).toEqual([true, true, 1, true, pose]);
    expect(sniper.target).toBeNull();
  });

  it('fuera de alcance (1000) el disparo se rechaza sin acercarse', () => {
    const sniper = seated();
    const s = new Soldier('S', mk(1500, 0, 'S'), null);
    const a = new Attack(sniper, s, 'MIRILLA');
    a.tick(w);
    expect([a.done, s.dead, sniper.target]).toEqual([true, false, null]);
  });
});
