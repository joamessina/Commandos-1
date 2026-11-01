import { describe, expect, it } from 'vitest';
import { AmbientSource, ambientWait, attenuate, HEAR_RADIUS, isPositional, lcg, parseAmbient, parseMusic } from './sound.ts';
import { SOUND_WAV } from './sound-table.ts';

const mis = `.MISSION [ .MUSICA FASES.WAV .INTENDENCIAINFO [ .AMBIENTE [
  [ .SOUNDID OLEA .POS [ 1762 2106 0 ] .VOLUMEN 0.6 .DELAY 20 ]
  [ .SOUNDID WIND .POS [ 467 647 0 ] .VOLUMEN 0.15 ]
  [ .SOUNDID RIO1 .POS [ 270 3484 0 ] .VOLUMEN 0.05 .BUCLADO 1 ]
  [ .SOUNDID LARGO .VOLUMEN 1 ]
  [ .VOLUMEN 1 ]
] ] ]`;

describe('atenuación', () => {
  it('pleno en el centro, lineal hasta 800 y mudo desde ahí', () => {
    expect(attenuate(0, 0, 0.75)).toEqual({ volume: Math.round(0.75 * 127) / 127, pan: 0 });
    const mitad = attenuate(HEAR_RADIUS / 2, 0, 1);
    expect(mitad?.volume).toBeCloseTo(0.5, 1);
    expect(mitad?.pan).toBeCloseTo(0.5, 1);
    expect(attenuate(HEAR_RADIUS, 0, 1)).toBeNull();
    expect(attenuate(600, 600, 1)).toBeNull();
  });

  it('pan negativo a la izquierda y volumen y pan en los escalones de Miles (127 y 63)', () => {
    const m = attenuate(-200, 0, 0.75);
    expect(m?.pan).toBeLessThan(0);
    expect(((m?.volume ?? 0) * 127) % 1).toBeCloseTo(0, 6);
    expect(((m?.pan ?? 0) * 63) % 1).toBeCloseTo(0, 6);
  });
});

describe('LCG y espera del ambiente', () => {
  it('lcg sigue s·0x343FD + 0x269EC3 y devuelve 15 bits', () => {
    const r = lcg(0);
    expect(r()).toBe((0x269ec3 >>> 16) & 0x7fff);
    for (let i = 0; i < 50; i++) expect(r()).toBeLessThan(0x8000);
  });

  it('la espera es dur + DELAY ± hasta DELAY/2 según la paridad del primer azar', () => {
    const impar = [1, 3];
    expect(ambientWait(60, 20, () => impar.shift() ?? 0)).toBe(60 - 3 + 20);
    const par = [2, 3];
    expect(ambientWait(60, 20, () => par.shift() ?? 0)).toBe(60 + 20 + 3);
    const rand = lcg(7);
    for (let i = 0; i < 200; i++) {
      const w = ambientWait(60, 20, rand);
      expect(w).toBeGreaterThanOrEqual(60 + 20 - 10);
      expect(w).toBeLessThanOrEqual(60 + 20 + 10);
    }
  });
});

describe('.MIS', () => {
  it('parseAmbient lee posición, volumen, delay y bucle e ignora SOUNDID que no mide 4 letras o falta', () => {
    const a = parseAmbient(mis);
    expect(a.map((d) => d.tag)).toEqual(['OLEA', 'WIND', 'RIO1']);
    expect(a[0]).toEqual({ tag: 'OLEA', x: 1762, y: 2106, z: 0, volume: 0.6, delay: 20, loop: false });
    expect(a[1]?.delay).toBe(1);
    expect(a[2]?.loop).toBe(true);
    expect(parseAmbient('.MISSION [ ]')).toEqual([]);
  });

  it('parseMusic devuelve el .MUSICA o null; sin POS la fuente no es posicional', () => {
    expect(parseMusic(mis)).toBe('FASES.WAV');
    expect(parseMusic('.MISSION [ ]')).toBeNull();
    expect(isPositional({ tag: 'X', x: 0, y: 0, z: 0, volume: 1, delay: 1, loop: false })).toBe(false);
    expect(isPositional({ tag: 'X', x: 0, y: 4, z: 0, volume: 1, delay: 1, loop: false })).toBe(true);
  });
});

describe('AmbientSource', () => {
  const def = { tag: 'OLEA', x: 1, y: 1, z: 0, volume: 0.5, delay: 20, loop: false };

  it('suena de inmediato y vuelve a sonar tras la espera', () => {
    const s = new AmbientSource(def, 60, lcg(1));
    expect(s.tick()).toBe('play');
    let n = 0;
    while (s.tick() === null) n++;
    expect(n).toBeGreaterThanOrEqual(60 + 20 - 10 - 1);
    expect(n).toBeLessThanOrEqual(60 + 20 + 10);
  });

  it('un bucle arranca una sola vez', () => {
    const s = new AmbientSource({ ...def, loop: true }, 60, lcg(1));
    expect([s.tick(), s.tick(), s.tick()]).toEqual(['loop', null, null]);
  });
});

describe('tabla de sonidos', () => {
  it('trae las 152 entradas del exe con los tags de armas, explosiones y ambiente', () => {
    expect(Object.keys(SOUND_WAV)).toHaveLength(152);
    expect([SOUND_WAV['PIPA'], SOUND_WAV['MIRI'], SOUND_WAV['XPLO'], SOUND_WAV['OLEA'], SOUND_WAV['PEDL']]).toEqual(['PISTOLA2.WAV', 'FRANCO.WAV', 'EXPLOSI.WAV', 'OLEAJE.WAV', 'PIEDTERR.WAV']);
  });
});
