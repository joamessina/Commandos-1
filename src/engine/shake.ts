/** 0063F760/0063F790: curva de sacudida de la bomba, tabla 0x81CEB0 y escala temporal 150. */
const CURVE: readonly (readonly [number, number])[] = [[0, 0], [10, 1], [20, 2], [25, 3], [30, 2], [35, 1], [45, 3], [50, 9], [55, 5], [75, 2], [85, 1], [100, 0], [150, 0]];

export function bombShake(cycle: number): number {
  if (cycle < 0 || cycle > 10) return 0;
  const position = (cycle % 10) * 15;
  for (let i = 1; i < CURVE.length; i++) {
    const a = CURVE[i - 1], b = CURVE[i];
    if (!a || !b || position > b[0]) continue;
    return a[1] + (b[1] - a[1]) * (position - a[0]) / (b[0] - a[0]);
  }
  return 0;
}
