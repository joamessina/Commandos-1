/**
 * Sonido de la misión en marcha: ambiente del `.MIS` (engine/sound.ts), música y los efectos de los disparos y explosiones que ve la partida.
 * shortcut: suenan VMUE, ALRM y AL07 ya emitidas por BAP, disparos, explosiones y jingles; faltan otras voces, pasos, objetos y emisores. Mejorar al portar las acciones restantes.
 *           Falta el sonido de las casas (XCA*). Cuándo mejorar: al portar sus emisores.
 */
import { AmbientSource, attenuate, BASE_VOLUME, isPositional, lcg, parseAmbient, parseMusic, type AmbientDef } from '../engine/sound.ts';
import { SOUND_WAV } from '../engine/sound-table.ts';
import type { Sfx } from '../render/audio.ts';
import type { VoiceSound } from '../engine/battle.ts';
import type { Blast } from '../engine/demolition.ts';

/** Lo que `GameSound` necesita de la partida en cada ciclo. */
export interface SoundView {
  readonly camX: number;
  readonly camY: number;
  readonly tracers: readonly { readonly fromX: number; readonly fromY: number; readonly tag?: string }[];
  readonly blasts: readonly Pick<Blast, 'x' | 'y' | 'tag'>[];
  readonly voices: readonly VoiceSound[];
  /** Fin de la misión: 'win' = victoria, 'lose' = derrota, null = sigue. */
  readonly end: 'win' | 'lose' | null;
}

export interface SoundSource {
  /** WAV de efectos por nombre (`DATOS/RECURSOS/SONIDO/WAVE/<nombre>`). */
  readonly effect: (name: string) => Uint8Array | undefined;
  /** Archivo suelto de `DATOS/MUSICA/`. */
  readonly music: (name: string) => Promise<Uint8Array | undefined>;
}

export class GameSound {
  private readonly sfx: Sfx;
  private readonly src: SoundSource;
  private readonly project: (x: number, y: number, z: number) => { px: number; py: number };
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();
  private ambient: { readonly def: AmbientDef; readonly source: AmbientSource; readonly buffer: AudioBuffer }[] = [];
  private readonly seen = new WeakSet();
  private voiceTail: Promise<void> = Promise.resolve();
  private ended = false;
  private alive = true;

  /** Falso tras `stop()`; un método para que las comprobaciones tras un `await` no se den por siempre verdaderas. */
  private isLive(): boolean {
    return this.alive;
  }

  constructor(sfx: Sfx, src: SoundSource, project: (x: number, y: number, z: number) => { px: number; py: number }) {
    this.sfx = sfx;
    this.src = src;
    this.project = project;
  }

  /** WAV de un tag de la tabla del exe (decodificado una vez); null si el tag o el archivo no existen. */
  private tag(tag: string): Promise<AudioBuffer | null> {
    let p = this.cache.get(tag);
    if (!p) {
      const name = SOUND_WAV[tag];
      const bytes = name ? this.src.effect(name) : undefined;
      p = bytes ? this.sfx.decode(bytes) : Promise.resolve(null);
      this.cache.set(tag, p);
    }
    return p;
  }

  /** Prepara el ambiente y la música de la misión. */
  async init(misText: string): Promise<void> {
    const rand = lcg(Date.now());
    const built: typeof this.ambient = [];
    for (const def of parseAmbient(misText)) {
      const buffer = await this.tag(def.tag);
      // `dur` = duración del WAV en ciclos de 50 ms (`FUN_0067DDC0 / 0x32`)
      if (buffer) built.push({ def, source: new AmbientSource(def, Math.floor((buffer.duration * 1000) / 50), rand), buffer });
    }
    if (!this.isLive()) return;
    this.ambient = built;
    const music = parseMusic(misText);
    const bytes = music ? await this.src.music(music) : undefined;
    const buffer = bytes ? await this.sfx.decode(bytes) : null;
    if (buffer && this.isLive()) this.sfx.playMusic(buffer, true);
  }

  /** Corta todo (cambio de misión). */
  stop(): void {
    this.alive = false;
    this.sfx.stopMusic();
  }

  private playBuffer(buffer: AudioBuffer | null, x: number, y: number, z: number, v: SoundView): void {
    if (!buffer || !this.isLive()) return;
    const p = this.project(x, y, z);
    const mix = attenuate(p.px - v.camX, p.py - v.camY, BASE_VOLUME);
    if (mix) this.sfx.play(buffer, mix.volume, mix.pan);
  }

  /** Suena `tag` en el punto del mundo, atenuado respecto de la cámara. */
  private playAt(tag: string, x: number, y: number, z: number, v: SoundView): void {
    this.tag(tag).then((buffer) => { this.playBuffer(buffer, x, y, z, v); }).catch(() => undefined);
  }

  /** Decodifica en paralelo, pero inicia las voces en el orden en que se emitieron. */
  private playVoice(voice: VoiceSound, v: SoundView): void {
    const ready = this.tag(voice.tag).catch(() => null);
    this.voiceTail = this.voiceTail.then(() => ready).then((buffer) => { this.playBuffer(buffer, voice.x, voice.y, voice.z, v); }).catch(() => undefined);
  }

  /** Un ciclo de juego: ambiente, disparos nuevos, explosiones nuevas y el jingle de fin. */
  tick(v: SoundView): void {
    for (const a of this.ambient) {
      const r = a.source.tick();
      if (!r) continue;
      const pos = isPositional(a.def);
      const p = this.project(a.def.x, a.def.y, a.def.z);
      const mix = pos ? attenuate(p.px - v.camX, p.py - v.camY, a.def.volume) : { volume: a.def.volume, pan: 0 };
      if (mix) this.sfx.play(a.buffer, mix.volume, mix.pan, r === 'loop');
    }
    for (const t of v.tracers) {
      if (this.seen.has(t) || !t.tag) continue;
      this.seen.add(t);
      this.playAt(t.tag, t.fromX, t.fromY, 0, v);
    }
    for (const b of v.blasts) {
      if (this.seen.has(b)) continue;
      this.seen.add(b);
      this.playAt(b.tag, b.x, b.y, 0, v);
    }
    for (const voice of v.voices) this.playVoice(voice, v);
    if (v.end && !this.ended) {
      this.ended = true;
      this.sfx.stopMusic();
      this.src
        .music(v.end === 'win' ? 'MCOMPLET.WAV' : 'MUERTE.WAV')
        .then((bytes) => (bytes ? this.sfx.decode(bytes) : null))
        .then((buffer) => {
          if (buffer && this.isLive()) this.sfx.playMusic(buffer, false);
        })
        .catch(() => undefined);
    }
  }
}
