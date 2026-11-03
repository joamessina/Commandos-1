import { describe, expect, it } from 'vitest';
import { BAG, BAG_POS, BULLET, bagItems, bulletX, diveItemVisible, inRect, itemContains, itemPos, photoRect, visibleItems, bagRect, bloodHeight, columnX, FaceAnim, faceNumber, HUD_BAR, HUD_COLUMN, hudMode, hudScale, ITEM_WAD, overHud, parseInterface, slotAt, slotRect, viewRect } from './hud.ts';

describe('hud', () => {
  it('elige el WAD de interfaz más grande que cabe', () => {
    expect(hudMode(1568, 760)).toEqual([1280, 720]);
    expect(hudMode(1568, 640)).toEqual([800, 600]);
    expect(hudMode(1100, 800)).toEqual([1024, 768]);
    expect(hudMode(300, 200)).toEqual([512, 384]);
  });

  it('el HUD se agranda de a medios solo en pantallas mayores que 1280×720', () => {
    expect([hudScale(640, 480), hudScale(1024, 768), hudScale(1280, 720), hudScale(1366, 768)]).toEqual([1, 1, 1, 1]);
    expect([hudScale(1920, 1080), hudScale(2560, 1440), hudScale(3840, 2160)]).toEqual([1.5, 2, 3]);
    expect(hudScale(2560, 1080)).toBe(1.5); // manda el lado que menos crece
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
    // la captura del original muestra a la vez la mano abierta (MANO) y el puño (PUNO): son dos ítems distintos, MANO y GOLPEAR
    expect(ITEM_WAD['IT_MANO']).toBe('MANO');
    expect(ITEM_WAD['IT_GOLPEAR']).toBe('PUNO');
  });

  it('la mochila dibuja los ítems disponibles que tienen archivo y posición medida', () => {
    const iface = new Map([['COMANDO', { items: [
      { token: 'IT_CUCHILLO', available: true },
      { token: 'IT_MANO', available: true },
      { token: 'IT_GOLPEAR', available: true },
      { token: 'IT_TABACO', available: false },
      { token: 'IT_PIEDRA', available: false },
      { token: 'IT_SEGNUELO', available: true },
    ] }], ['SIN_MEDIR', { items: [{ token: 'IT_MANO', available: true }] }]]);
    expect(bagItems(iface).get('COMANDO')).toEqual([{ token: 'IT_CUCHILLO', wad: 'CUCHILLO', sprite: 'MACHETE.RLE', x: -9, y: 1 }, { token: 'IT_MANO', wad: 'MANO', sprite: 'MANO.RLE', x: 49, y: -67 }, { token: 'IT_GOLPEAR', wad: 'PUNO', sprite: 'PUNO.RLE', x: 69, y: 14 }, { token: 'IT_SEGNUELO', wad: 'SENUELO', sprite: 'SENUEL.RLE', x: 63, y: 66 }]);
    expect(bagItems(iface).get('SIN_MEDIR')).toEqual([]);
    expect(Object.keys(BAG_POS)).toEqual(['COMANDO', 'LANCHERO', 'FRANCOT', 'ARTIFIC']);
  });

  it('el interruptor del señuelo, apagado y encendido, usa el archivo del señuelo con su propio dibujo y posición', () => {
    const iface = new Map([['COMANDO', { items: [{ token: 'IT_ACTSENUELOOFF', available: true }, { token: 'IT_ACTSENUELOON', available: true }] }], ['ARTIFIC', { items: [{ token: 'IT_ACTSENUELOON', available: true }] }]]);
    const [off, on] = bagItems(iface).get('COMANDO') ?? [];
    expect([off?.wad, off?.sprite, on?.wad, on?.sprite]).toEqual(['SENUELO', 'INTERRUP.RLE', 'SENUELO', 'P_IN0000.RLE']);
    expect([off?.x, off?.y]).toEqual([on?.x, on?.y]);
    expect(bagItems(iface).get('ARTIFIC')).toEqual([]); // el zapador no tiene interruptor medido
  });

  it('en un vehículo solo se ven los ítems permitidos en vehículos (el francotirador en el bote: solo la mirilla)', () => {
    expect(diveItemVisible(true, false)).toBe(true);
    expect(diveItemVisible(false, true)).toBe(true);
    expect(diveItemVisible(false, false)).toBe(false);
    const iface = new Map([['FRANCOT', { items: [
      { token: 'IT_MANO', available: true },
      { token: 'IT_PISTOLA', available: true },
      { token: 'IT_MIRILLA', available: true },
      { token: 'IT_BOTIQUIN', available: true },
    ] }], ['LANCHERO', { items: [{ token: 'IT_TRAJEBUZO', available: true }, { token: 'IT_PISTOLA', available: true }] }]]);
    const bag = bagItems(iface);
    expect(visibleItems(bag.get('FRANCOT') ?? [], false).map((i) => i.wad)).toEqual(['MANO', 'PISTOLA', 'MIRILLA', 'BOTIQUIN']);
    expect(visibleItems(bag.get('FRANCOT') ?? [], true).map((i) => i.wad)).toEqual(['MIRILLA']);
    expect(visibleItems(bag.get('LANCHERO') ?? [], true).map((i) => i.wad)).toEqual(['TRAJEBU']);
    expect(visibleItems(bag.get('LANCHERO') ?? [], false, true).map((i) => i.wad)).toEqual(['TRAJEBU']);
  });

  it('la posición en pantalla se espeja con la mochila a la izquierda y las balas van en fila de a 15 px', () => {
    const it = { token: 'IT_MIRILLA', wad: 'MIRILLA', sprite: 'MIRATELE.RLE', x: 11, y: -1 };
    const right = bagRect(1280, 720, false);
    const left = bagRect(1280, 720, true);
    expect(itemPos(it, 101, right, false)).toEqual({ x: 1179, y: 570 });
    expect(itemPos(it, 101, left, true)).toEqual({ x: 0, y: 570 });
    expect([0, 1, 4].map((k) => bulletX(k, left, true))).toEqual([13, 28, 73]);
    expect(bulletX(0, right, false)).toBe(1168 + BAG.w - BULLET.w - BULLET.x0);
    expect(photoRect(1280, 720, false)).toEqual({ x: 1210, y: 569, w: 71, h: 91 });
  });

  it('la zona de clic del ítem usa su rectángulo, también en la mochila espejada', () => {
    const it = { token: 'IT_ARPON', wad: 'ARPON', sprite: 'ARPON.RLE', x: 67, y: 5 };
    const right = bagRect(640, 480, false);
    const left = bagRect(640, 480, true);
    expect(itemContains(it, 25, 30, right, false, right.x + 67, right.y + 5)).toBe(true);
    expect(itemContains(it, 25, 30, right, false, right.x + 92, right.y + 5)).toBe(false);
    expect(itemContains(it, 25, 30, left, true, left.x + 20, left.y + 5)).toBe(true);
    expect(inRect(right.x, right.y, right)).toBe(true);
    expect(inRect(right.x - 1, right.y, right)).toBe(false);
  });
});
