import { describe, expect, it } from 'vitest';
import type { Poly, Vol } from '../formats/vol.ts';
import { drawOrder } from './volorder.ts';

const tile = { x: 0, y: 0, w: 1000, h: 1000, sx: 0, sy: 0, sprite: 'A.RLE', flags: '' };
/** Polígono rectangular centrado en (cx,cy) de lado `s`, o cilindro (sin puntos) si `s` es 0. */
const poly = (name: string, cx: number, cy: number, cz: number, alt: number, s: number, opts: { tiles?: boolean; rect?: [number, number, number, number]; cw?: boolean; radio?: number | null; header?: number[] } = {}): Poly => {
  const h = s / 2;
  const [x, y, w, hh] = opts.rect ?? [0, 0, 1000, 1000];
  return {
    name,
    ramp: false,
    header: opts.header ?? [cx, cy, cz, alt, s === 0 ? 0 : 4, 1],
    points: s === 0 ? [] : opts.cw === true ? [{ x: -h, y: -h }, { x: -h, y: h }, { x: h, y: h }, { x: h, y: -h }] : [{ x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h }],
    tiles: opts.tiles === false ? [] : [{ ...tile, x, y, w, h: hh } as unknown as Poly['tiles'][number]],
    radio: opts.radio !== undefined ? opts.radio : s === 0 ? 60 : null,
    extraInfo: null,
  };
};
const vol = (...polys: Poly[]): Vol => ({ width: 2000, height: 2000, extraSprites: [], polys });
const names = (v: Vol): string[] => drawOrder(v).map((i) => v.polys[i]?.name ?? '?');

describe('drawOrder', () => {
  it('sin relación se queda el orden del archivo; los volúmenes sin tiles no se dibujan', () => {
    const v = vol(poly('A', 0, 0, 0, 10, 0), poly('B', 900, 900, 0, 10, 0, { rect: [900, 900, 10, 10] }), poly('C', 5, 5, 0, 10, 0, { tiles: false }));
    expect(names(v)).toEqual(['A', 'B']);
  });

  it('cilindros del mismo nivel: el de más al sur (mayor y) se dibuja después', () => {
    expect(names(vol(poly('sur', 0, 100, 0, 40, 0), poly('norte', 0, 50, 0, 40, 0)))).toEqual(['norte', 'sur']);
    expect(names(vol(poly('norte', 0, 50, 0, 40, 0), poly('sur', 0, 100, 0, 40, 0)))).toEqual(['norte', 'sur']);
  });

  it('cilindros a distinta altura: el de abajo se dibuja antes, aunque esté más al sur', () => {
    expect(names(vol(poly('alto', 0, 0, 60, 10, 0), poly('bajo', 0, 40, 0, 10, 0)))).toEqual(['bajo', 'alto']);
    expect(names(vol(poly('bajo', 0, 40, 0, 10, 0), poly('alto', 0, 0, 60, 10, 0)))).toEqual(['bajo', 'alto']);
  });

  it('mismos y y mismo nivel: desempata el radio', () => {
    const v = vol(poly('grande', 0, 0, 0, 40, 0), poly('chico', 0, 0, 0, 40, 0));
    expect(names(v).sort()).toEqual(['chico', 'grande']);
  });

  it('polígonos: el que queda al sur de la arista sur del otro va después (aunque esté antes en el archivo)', () => {
    const v = vol(poly('sur', 0, 150, 0, 80, 40), poly('norte', 0, 100, 0, 80, 40));
    expect(names(v)).toEqual(['norte', 'sur']);
  });

  it('polígono contra cilindro, en ambos sentidos del archivo', () => {
    expect(names(vol(poly('cil', 0, 150, 0, 50, 0), poly('edif', 0, 100, 0, 50, 40)))).toEqual(['edif', 'cil']);
    expect(names(vol(poly('edif', 0, 100, 0, 50, 40), poly('cil', 0, 150, 0, 50, 0)))).toEqual(['edif', 'cil']);
  });

  it('un polígono de suelo (nivel bajo) va antes que el edificio que se apoya sobre él, sea cual sea el orden del archivo', () => {
    const v = vol(poly('edif', 0, 0, 100, 50, 40), poly('suelo', 0, 0, 0, 1, 400));
    expect(names(v)).toEqual(['suelo', 'edif']);
  });

  it('relaciones encadenadas suben de nivel por camino más largo', () => {
    const v = vol(poly('c', 0, 100, 0, 40, 0), poly('b', 0, 60, 0, 40, 0), poly('a', 0, 20, 0, 40, 0));
    expect(names(v)).toEqual(['a', 'b', 'c']);
  });

  it('no se comparan los que no se solapan en pantalla (rect o contorno)', () => {
    const lejos = vol(poly('sur', 0, 100, 0, 40, 0, { rect: [0, 0, 10, 10] }), poly('norte', 0, 50, 0, 40, 0, { rect: [500, 500, 10, 10] }));
    expect(names(lejos)).toEqual(['sur', 'norte']);
    // rects que se cruzan pero contornos (prismas proyectados) separados
    const a = poly('sur', 0, 1000, 0, 5, 20);
    const b = poly('norte', 900, 50, 0, 5, 20);
    expect(names(vol(a, b))).toEqual(['sur', 'norte']);
  });

  it('el sentido de los vértices no importa (horario o antihorario) y un cilindro sin radio ni tamaño se compara igual', () => {
    expect(names(vol(poly('sur', 0, 150, 0, 80, 40, { cw: true }), poly('norte', 0, 100, 0, 80, 40, { cw: true })))).toEqual(['norte', 'sur']);
    expect(names(vol(poly('a', 0, 0, 0, 10, 0, { radio: null }), poly('b', 0, 0, 0, 10, 0, { radio: null })))).toHaveLength(2);
  });

  it('un cilindro bajo un edificio alto va antes que él; uno contenido en el polígono se ordena por radios; la cabecera corta se toma como ceros', () => {
    expect(names(vol(poly('edif', 0, 100, 30, 50, 40), poly('bajo', 0, 100, 0, 10, 0)))).toEqual(['bajo', 'edif']);
    const dentro = names(vol(poly('grande', 0, 0, 0, 40, 400), poly('chico', 0, 0, 0, 40, 40)));
    expect(dentro).toHaveLength(2);
    expect(names(vol(poly('x', 0, 0, 0, 0, 0, { header: [] })))).toEqual(['x']);
  });
});
