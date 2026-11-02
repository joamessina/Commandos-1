/** Intendencia FUN_0059A410 / FUN_0059EAA0: una activación por misión. */
export class Alarm {
  private available = true;
  volume = 0;

  trigger(): void {
    if (!this.available) return;
    this.available = false;
    this.volume = 0.75;
  }

  tick(): void {
    if (this.volume > 0) this.volume = Math.max(0, this.volume - 0.0015);
    if (this.volume < 0.000001) this.volume = 0;
  }
}
