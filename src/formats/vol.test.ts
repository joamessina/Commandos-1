import { describe, expect, it } from 'vitest';
import { must } from '../testing/builders.ts';
import { parseVol, VolError } from './vol.ts';

const SAMPLE = `; comentario
MAPDIMXY 100,50
MAPTABPOLYS
{
POLY "CASA",10,20,0,114,2,1   ; nombre,cx,cy,cz,alt,#vért,#tiles
  POINT 1,2
  POINT -3,4
  RADIO 4
  EXTRAINFO 0,0,0,0,0,0,0,0
  TILE 5,6,7,8,0,0,0,"CASA0000.RLE","XY"
}
POLYRAMPA "RAMPA",0,0,0,10,5,0,1
  TILEID 1,2,3,4,5,6,-1,"R.RLE","   ","id7"
EXTRASPRITE "EXTRA.RLE"
`;

describe('parseVol', () => {
  it('lee dimensiones, volúmenes, puntos, radio, extrainfo, tiles y sprites extra', () => {
    const v = parseVol(SAMPLE);
    expect([v.width, v.height, v.polys.length]).toEqual([100, 50, 2]);
    const p = must(v.polys[0]);
    expect([p.name, p.ramp, p.header]).toEqual(['CASA', false, [10, 20, 0, 114, 2, 1]]);
    expect(p.points).toEqual([{ x: 1, y: 2 }, { x: -3, y: 4 }]);
    expect([p.radio, p.extraInfo]).toEqual([4, [0, 0, 0, 0, 0, 0, 0, 0]]);
    expect(p.tiles[0]).toEqual({ x: 5, y: 6, w: 7, h: 8, sx: 0, sy: 0, g: 0, sprite: 'CASA0000.RLE', flags: 'XY' });
    expect(v.polys[1]?.ramp).toBe(true);
    expect(v.polys[1]?.tiles[0]?.g).toBe(-1);
    expect(v.extraSprites).toEqual(['EXTRA.RLE']);
  });

  it('acepta CRLF', () => {
    expect(parseVol(SAMPLE.replace(/\n/g, '\r\n')).polys).toHaveLength(2);
  });

  it('rechaza líneas desconocidas, datos sin POLY y falta de MAPDIMXY', () => {
    expect(() => parseVol('MAPDIMXY 1,1\nBASURA 1')).toThrow(/no reconocida/);
    expect(() => parseVol('MAPDIMXY 1,1\nPOINT 1,2')).toThrow(/sin POLY/);
    expect(() => parseVol('POLY "A",0,0,0,0,0,0')).toThrow(/MAPDIMXY/);
  });

  it('rechaza cantidades de tiles que no coinciden con la cabecera', () => {
    expect(() => parseVol('MAPDIMXY 1,1\nPOLY "A",0,0,0,0,0,2')).toThrow(/2 tiles declarados, 0 leídos/);
  });

  it('rechaza números inválidos en la cabecera', () => {
    expect(() => parseVol('MAPDIMXY 1,1\nPOLY "A",x,0,0,0,0,0')).toThrow(VolError);
  });

  it('rechaza entradas con demasiadas líneas', () => {
    expect(() => parseVol('\n'.repeat(2_000_001))).toThrow(/demasiadas/);
  });
});
