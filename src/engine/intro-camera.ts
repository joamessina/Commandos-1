/** Cámara del guion: FUN_005C9BC0 y FUN_005C8BF0; velocidades de FUN_005B0540/005B0F70. */
type Speed = 'L' | 'M' | 'N' | 'R';
const moveSpeeds: Record<Speed, readonly [number, number]> = { L: [25, 1.75], M: [10, 0.7], N: [50, 3.5], R: [90, 6.3] };
const zoomSpeeds: Record<Speed, readonly [number, number]> = { L: [0.0075, 0.015], M: [0.00325, 0.0075], N: [0.015, 0.03], R: [0.03, 0.06] };
const speed = (s: string): Speed => s === 'L' || s === 'M' || s === 'R' ? s : 'N';

export class IntroCamera {
  private moveTarget: { x: number; y: number; max: number; acceleration: number; velocity: number } | null = null;
  private zoomTarget: { value: number; low: number; high: number } | null = null;
  constructor(public x: number, public y: number, public scale = 1) {}
  setPos(x: number, y: number): void { this.x = x; this.y = y; this.moveTarget = null; }
  setZoom(value: number): void { if (Number.isFinite(value) && value > 0) { this.scale = value; this.zoomTarget = null; } }
  goto(x: number, y: number, mode: string): void {
    const [max, acceleration] = moveSpeeds[speed(mode)];
    this.moveTarget = { x, y, max, acceleration, velocity: 0 };
  }
  zoom(value: number, mode: string): void {
    if (!Number.isFinite(value) || value <= 0) return;
    const [low, high] = zoomSpeeds[speed(mode)];
    this.zoomTarget = { value, low, high };
  }
  get moving(): boolean { return this.moveTarget !== null; }
  get zooming(): boolean { return this.zoomTarget !== null; }
  stop(): void { this.moveTarget = null; this.zoomTarget = null; }
  tick(): void {
    const m = this.moveTarget;
    if (m) {
      const dx = m.x - this.x;
      const dy = m.y - this.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 3) { this.x = m.x; this.y = m.y; this.moveTarget = null; }
      else {
        m.velocity = Math.min(m.max, m.velocity + m.acceleration);
        const step = Math.min(distance, m.velocity);
        this.x += dx / distance * step;
        this.y += dy / distance * step;
      }
    }
    const z = this.zoomTarget;
    if (z) {
      const step = this.scale <= 1 ? z.low : z.high;
      const delta = z.value - this.scale;
      if (Math.abs(delta) <= step) { this.scale = z.value; this.zoomTarget = null; }
      else this.scale += Math.sign(delta) * step;
    }
  }
}
