import { describe, expect, it } from 'vitest';
import { bagRect, bloodHeight, columnX, FaceAnim, faceNumber, HUD_BAR, HUD_COLUMN, hudMode, ITEM_WAD, overHud, parseInterface, slotAt, slotRect, viewRect } from './hud.ts';

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
    // con la columna a la izquierda el mundo se corre 36 y el borde derecho queda libre
    expect(viewRect(1280, 720, true)).toEqual({ x: HUD_COLUMN, y: HUD_BAR, w: 1280 - HUD_COLUMN, h: 720 - HUD_BAR });
    expect(overHud(10, 300, 1280, true)).toBe(true);
    expect(overHud(1250, 300, 1280, true)).toBe(false);
    expect([columnX(1280, false), columnX(1280, true)]).toEqual([1244, 0]);
    expect(bagRect(1280, 720, true)).toEqual({ x: 0, y: 571, w: 112, h: 149 });
    expect(bagRect(1280, 720, false).x).toBe(1168);
  });

  it('la cara se prende (gris de perfil a naranja de frente) al seleccionar y se apaga al soltar; muerto = calavera', () => {
    const f = new FaceAnim();
    expect(f.of(0)).toBe(1);
    for (let i = 0; i < 3; i++) f.tick(2, 0);
    expect([f.of(0), f.of(1)]).toEqual([4, 1]);
    for (let i = 0; i < 20; i++) f.tick(2, 0);
    expect(f.of(0)).toBe(9);
    f.tick(2, 1);
    expect([f.of(0), f.of(1)]).toEqual([8, 2]);
    expect([faceNumber(9, false), faceNumber(0, false), faceNumber(4.4, false), faceNumber(9, true)]).toEqual([9, 1, 4, 10]);
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
    expect(slotRect(2).x).toBe(1 + 126);
  });
});

describe('parseInterface', () => {
  const MIS = `.MISSION [ .INTERFACE [ .SUBINTERFACES [
    [ SUBINTERFACEMULTIPLE [ .TOKEN MULTIPLE .ELEMUSABLES [ ZODIAC5 ] ] ]
    [ SUBINTERFACEALIADO [ .TOKEN COMANDO .CARETO CARA0001.RLE .ITEMS [ [ .TOKEN IT_PISTOLA ] [ .TOKEN IT_TABACO .DISPONIBLE NO ] [ .TOKEN IT_MANO ] ] ] ]
    [ SUBINTERFACEALIADO [ .ITEMS [ [ .TOKEN IT_X ] ] ] ]
    [ SUBINTERFACEALIADO [ .TOKEN LANCHERO .ITEMS [ [ .X 1 ] [ .TOKEN IT_TRAJEBUZO ] ] ] ]
  ] ] ]`;

  it('lee los ítems de cada comando en orden, con .DISPONIBLE NO como oculto; ignora MULTIPLE y subinterfaces sin token', () => {
    const m = parseInterface(MIS);
    expect([...m.keys()]).toEqual(['COMANDO', 'LANCHERO']);
    expect(m.get('COMANDO')?.items).toEqual([
      { token: 'IT_PISTOLA', available: true },
      { token: 'IT_TABACO', available: false },
      { token: 'IT_MANO', available: true },
    ]);
    expect(m.get('LANCHERO')?.items).toEqual([{ token: 'IT_TRAJEBUZO', available: true }]);
    expect(parseInterface('.MISSION [ ]').size).toBe(0);
  });

  it('cada ítem de la misión 0 con dibujo propio tiene archivo en OPCIONES', () => {
    expect(ITEM_WAD['IT_TRAJEBUZO']).toBe('TRAJEBU');
    expect(ITEM_WAD['IT_MANO']).toBe('PUNO');
    expect(ITEM_WAD['IT_GOLPEAR']).toBeUndefined();
  });
});

