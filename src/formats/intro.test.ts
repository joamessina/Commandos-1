import { describe, expect, it } from 'vitest';
import { parseIntro } from './intro.ts';

describe('guion de introducción', () => {
  it('lee retardos y argumentos, conserva el orden e ignora comentarios y comandos inexistentes', () => {
    expect(parseIntro('* comentario\r\n0 VIDEO #0\r\n20 STARTWAVE #B00.WAV %voz\r\n10 STARGOTO #[5 4] @N\r\n0 WAITWAVE')).toEqual([
      { delay: 0, name: 'VIDEO', args: '0', line: 2 },
      { delay: 20, name: 'STARTWAVE', args: 'B00.WAV %voz', line: 3 },
      { delay: 0, name: 'WAITWAVE', args: '', line: 5 },
    ]);
  });
  it('une líneas con barra inicial y distingue el nombre exacto del comando', () => {
    expect(parseIntro('3 STARTBLENDFADE #A.BMP\n\\ B.BMP $100\n0 video #1\n0 BREAK')).toEqual([
      { delay: 3, name: 'STARTBLENDFADE', args: 'A.BMP B.BMP $100', line: 1 },
      { delay: 0, name: 'BREAK', args: '', line: 4 },
    ]);
  });
  it('acepta los distintos canales y rechaza líneas incompletas', () => {
    expect(parseIntro('STARTWAVE #a\n0\n0 STARTWAVELEVELM #.35\n-2 WAITWAVE2\n0 STARTBMP4 #x')).toEqual([
      { delay: 0, name: 'STARTWAVELEVELM', args: '.35', line: 3 },
      { delay: -2, name: 'WAITWAVE2', args: '', line: 4 },
      { delay: 0, name: 'STARTBMP4', args: 'x', line: 5 },
    ]);
  });
});
