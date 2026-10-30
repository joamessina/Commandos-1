import { describe, expect, it } from 'vitest';
import { DEFAULT_PAR, energyStars, parsePar, score, timeStars } from './score.ts';

describe('parsePar', () => {
  it('lee PUNTUACIONES de INTENDENCIAINFO y usa 4000/3000 si falta', () => {
    expect(parsePar('.MISSION [ .INTENDENCIAINFO [ .PUNTUACIONES [ .PAR_TICKS_FACIL 16932 .PAR_TICKS_DIFICIL 17290 ] ] ]')).toEqual({ easy: 16932, hard: 17290 });
    expect(parsePar('.MISSION [ .INTENDENCIAINFO [ .PUNTUACIONES [ .PAR_TICKS_FACIL 10 ] ] ]')).toEqual({ easy: 10, hard: DEFAULT_PAR.hard });
    expect(parsePar('.MISSION [ ]')).toEqual(DEFAULT_PAR);
  });
});

describe('estrellas', () => {
  it('tiempo: 3 si t/par < 1,5; 2 si < 2,5; 1 si < 3,5; 0 después; t muy bajo no pasa de 3', () => {
    expect(timeStars(0, 1000)).toBe(3);
    expect(timeStars(1499, 1000)).toBe(3);
    expect(timeStars(1500, 1000)).toBe(2);
    expect(timeStars(2499, 1000)).toBe(2);
    expect(timeStars(2500, 1000)).toBe(1);
    expect(timeStars(3500, 1000)).toBe(0);
    expect(timeStars(99999, 1000)).toBe(0);
  });

  it('energía: 3 sin pérdida, baja una por cuarto perdido y 0 con todo perdido', () => {
    expect(energyStars(0, 4)).toBe(3);
    expect(energyStars(199, 4)).toBe(3);
    expect(energyStars(200, 4)).toBe(2); // 25 %
    expect(energyStars(400, 4)).toBe(1);
    expect(energyStars(600, 4)).toBe(0);
    expect(energyStars(800, 4)).toBe(0);
    expect(energyStars(5000, 4)).toBe(0);
  });

  it('score: segundos a 20 ciclos/s y rango = mitad de la suma redondeada hacia abajo', () => {
    expect(score(17290, 17290, 0, 4)).toEqual({ seconds: 864, time: 3, energy: 3, rank: 3 });
    expect(score(17290 * 2, 17290, 400, 4)).toMatchObject({ time: 2, energy: 1, rank: 1 });
  });
});
