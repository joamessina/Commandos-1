import { describe, expect, it } from 'vitest';
import { parseCampaign, parseMissionInfo } from './campaign.ts';

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
});
