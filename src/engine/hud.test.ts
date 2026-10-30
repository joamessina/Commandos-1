import { describe, expect, it } from 'vitest';
import { bloodHeight, faceNumber, HUD_BAR, HUD_COLUMN, hudMode, overHud, slotAt, slotRect, viewRect } from './hud.ts';

describe('hud', () => {
  it('elige el WAD de interfaz más grande que cabe', () => {
    expect(hudMode(1568, 760)).toEqual([1280, 720]);
    expect(hudMode(1568, 640)).toEqual([800, 600]);
    expect(hudMode(1100, 800)).toEqual([1024, 768]);
    expect(hudMode(300, 200)).toEqual([512, 384]);
  });

  it('el mundo ocupa lo que dejan la tira superior y la columna', () => {
    expect(viewRect(1280, 720)).toEqual({ x: 0, y: HUD_BAR, w: 1280 - HUD_COLUMN, h: 720 - HUD_BAR });
    expect(overHud(10, 10, 1280)).toBe(true);
    expect(overHud(1250, 300, 1280)).toBe(true);
    expect(overHud(600, 300, 1280)).toBe(false);
  });

  it('cara por energía: 1 sano … 9 casi muerto, 10 calavera', () => {
    expect(faceNumber(200, 200, false)).toBe(1);
    expect(faceNumber(100, 200, false)).toBe(5);
    expect(faceNumber(1, 200, false)).toBe(9);
    expect(faceNumber(0, 200, false)).toBe(10);
    expect(faceNumber(150, 200, true)).toBe(10);
    expect(faceNumber(999, 200, false)).toBe(1);
  });

  it('barra de sangre proporcional a la energía y nunca desaparece con vida', () => {
    expect(bloodHeight(200, 200)).toBe(37);
    expect(bloodHeight(100, 200)).toBe(19);
    expect(bloodHeight(1, 200)).toBe(1);
    expect(bloodHeight(0, 200)).toBe(0);
  });

  it('slotAt devuelve la ranura bajo el punto', () => {
    expect(slotAt(10, 10, 4)).toBe(0);
    expect(slotAt(70, 10, 4)).toBe(1);
    expect(slotAt(70, 10, 1)).toBe(-1);
    expect(slotAt(10, 60, 4)).toBe(-1);
    expect(slotAt(63, 10, 4)).toBe(-1); // hueco entre marcos
    // con el 1.º seleccionado (marco ancho) los siguientes se corren 24
    expect(slotAt(70, 10, 4, 0)).toBe(0);
    expect(slotAt(90, 10, 4, 0)).toBe(1);
    expect(slotRect(2, 0).x).toBe(1 + 126 + 24);
  });
});
