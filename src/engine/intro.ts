/** Secuencia principal de ClassIntroScript: FUN_005B7BD0 y FUN_005AE950. */
import type { IntroCommand } from '../formats/intro.ts';

export interface IntroHost {
  start(command: IntroCommand): void;
  /** Estado de las operaciones que los WAIT correspondientes deben terminar de esperar. */
  waiting(command: IntroCommand): boolean;
  /** Actualiza los procesos paralelos después del paso principal, como FUN_005B6CE0. */
  update(): void;
}

export class IntroSequence {
  private index = -1;
  private remaining = 0;
  constructor(private readonly commands: readonly IntroCommand[], private readonly host: IntroHost) {}

  private next(): void {
    this.index++;
    const command = this.commands[this.index];
    if (command) {
      this.remaining = command.delay;
      this.host.start(command);
    }
  }

  /** Devuelve false cuando no quedan instrucciones. */
  tick(): boolean {
    if (this.index < 0) this.next();
    const command = this.commands[this.index];
    if (command) {
      this.remaining--;
      if (this.remaining < 1 && !this.host.waiting(command)) this.next();
    }
    this.host.update();
    return this.index < this.commands.length;
  }

  /** Escape busca el siguiente BREAK; FUN_005AFED0 y FUN_005B7BD0. */
  skip(): void {
    let next = this.index + 1;
    while (next < this.commands.length && this.commands[next]?.name !== 'BREAK') next++;
    this.index = next;
    this.remaining = 0;
  }
}
