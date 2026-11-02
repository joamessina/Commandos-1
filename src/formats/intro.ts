/** Guiones de introducción: FUN_005B34A0 y FUN_005B7BD0, docs/lectura/intro-briefing.md. */
export interface IntroCommand {
  readonly delay: number;
  readonly name: string;
  /** El exe entrega al constructor todo lo que sigue al primer #. */
  readonly args: string;
  readonly line: number;
}

const names = new Set([
  'VIDEO', 'BREAK', 'SETPOS', 'STARTGOTO', 'WAITGOTO', 'SETZOOM', 'STARTZOOM', 'WAITZOOM',
  'STARTVIDEO', 'WAITVIDEO', 'STARTBLENDFADE', 'STARTBLENDFADESTOP', 'WAITFADE', 'STARTFADEOUT',
  'STARTZOOMBITMAP', 'WAITZOOMBITMAP', 'STARTFOCO', 'MM',
  ...['', '1', '2', '3', 'M'].flatMap((channel) => ['STARTWAVE', 'WAITWAVE', 'STOPWAVE', 'SETWAVELEVEL', 'STARTWAVELEVEL', 'WAITWAVELEVEL'].map((name) => name + channel)),
  ...['', '1', '2', '3', '4'].flatMap((channel) => ['STARTBMP', 'STARTMM'].map((name) => name + channel)),
]);

export function parseIntro(text: string): IntroCommand[] {
  const out: IntroCommand[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    let source = lines[i] ?? '';
    while (lines[i + 1]?.startsWith('\\')) {
      i++;
      source += (lines[i] ?? '').slice(1);
    }
    const match = /^\s*([+-]?\d+)\s+(\S+)/.exec(source);
    if (!match?.[1] || !match[2] || !names.has(match[2])) continue;
    const hash = source.indexOf('#');
    out.push({ delay: Number(match[1]), name: match[2], args: hash < 0 ? '' : source.slice(hash + 1).trim(), line });
  }
  return out;
}
