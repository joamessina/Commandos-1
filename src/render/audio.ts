/** Reproducción con Web Audio (el original usa Miles): efectos con volumen y pan, y música en bucle. Los WAV los aporta el jugador (`DATOS/RECURSOS/SONIDO/WAVE` del contenedor y `DATOS/MUSICA`). */
export class Sfx {
  private ctx: AudioContext | null = null;
  private music: AudioBufferSourceNode | null = null;
  /** `VOLEFECTOS` y `VOLMUSICA` de `Comando.cfg` (por defecto 0,75, docs/lectura/sonido.md §4). */
  volEffects = 0.75;
  volMusic = 0.75;

  /** Crea o reanuda el contexto: el navegador solo lo permite tras un gesto del usuario. */
  unlock(): void {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  /** Decodifica un WAV (PCM de 8 o 16 bits, con o sin chunk `smpl`); null si el navegador no puede. */
  async decode(bytes: Uint8Array): Promise<AudioBuffer | null> {
    this.ctx ??= new AudioContext();
    try {
      return await this.ctx.decodeAudioData(bytes.slice().buffer);
    } catch {
      return null;
    }
  }

  /** Suena una vez (o en bucle) con `volume` 0..1 y `pan` −1..1, ya multiplicados por el volumen de efectos. Devuelve el nodo para poder cortarlo. */
  play(buffer: AudioBuffer, volume: number, pan: number, loop = false): AudioBufferSourceNode | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const gain = ctx.createGain();
    gain.gain.value = volume * this.volEffects;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    src.connect(gain).connect(panner).connect(ctx.destination);
    src.start();
    return src;
  }

  /** Música de la misión (o jingle de fin con `loop = false`): corta la anterior sin fundido, como el original (docs/lectura/sonido.md S2.3). */
  playMusic(buffer: AudioBuffer, loop: boolean): void {
    this.stopMusic();
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const gain = ctx.createGain();
    gain.gain.value = 0.75 * this.volMusic;
    src.connect(gain).connect(ctx.destination);
    src.start();
    this.music = src;
  }

  stopMusic(): void {
    try {
      this.music?.stop();
    } catch {
      // ya había terminado
    }
    this.music = null;
  }
}
