import { describe, expect, it } from 'vitest';
import { missionNames, parseCampaign, parseMissionFiles, parseMissionInfo } from './campaign.ts';

describe('campaña', () => {
  it('MISIONES.DAT da el orden de juego, no el del archivo; ignora entradas que no son MAPAnnnn.MIS', () => {
    const dat = '.DATOSMISIONES [ .LISTA [ [ .FICHEROMISION MAPA0000.MIS .HTIT 3N00 ] [ .FICHEROMISION MAPA0005.MIS .HTIT 3N05 ] [ .FICHEROMISION TUT00.MIS ] [ .HTIT 3N01 ] [ .FICHEROMISION MAPA0001.MIS ] ] ]';
    expect(parseCampaign(dat)).toEqual(['0000', '0005', '0001']);
    expect(parseCampaign('.OTRA [ ]')).toEqual([]);
  });

  it('MBnn.STR trae fecha, lugar y título tras el marcador de fin de texto', () => {
    const str = '0000 - DESTROY THE ANTENNA\r\n0001 %k#end of text marker DATE JUL 14, 1940 PLAC GUERNSEY, ENGLAND TITL DYING LIGHT\r\n\x1aresto';
    expect(parseMissionInfo(str)).toEqual({ date: 'Jul 14, 1940', place: 'Guernsey, England', title: 'Dying Light' });
    expect(parseMissionInfo("DATE A PLAC B TITL EAGLE'S NEST")?.title).toBe("Eagle's Nest");
    expect(parseMissionInfo('sin datos')).toBeNull();
  });

  it('los archivos de mapa salen del propio .MIS (MAPA0010 y los tutoriales usan los de MAPA0008)', () => {
    const mis = '.MISSION [ .DATOSFICHEROSMISION [ .VOLUMENES MAPA0008.VOL .SECTORES TUT.SEC .WADMAP FASE0008.WAD ] ]';
    expect(parseMissionFiles(mis)).toEqual({ vol: 'MAPA0008.VOL', sec: 'TUT.SEC', wad: 'FASE0008' });
    expect(parseMissionFiles('.MISSION [ ]')).toEqual({ vol: undefined, sec: undefined, wad: undefined });
  });

  it('missionNames lista MAPA, MAPF y TUT, ordenadas, e ignora el resto', () => {
    const paths = ['DATOS/MISIONES/TUT01.MIS', 'DATOS/MISIONES/MAPA0005.MIS', 'DATOS/MISIONES/mapf0001.mis', 'DATOS/MISIONES/MAPA0005.SEC', 'DATOS/MISIONES/ZODIAC.MAC', 'OTRO/MAPA0001.MIS'];
    expect(missionNames(paths)).toEqual(['MAPA0005', 'MAPF0001', 'TUT01']);
  });
});
