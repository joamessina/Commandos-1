import { describe, expect, it, vi } from 'vitest';
import { attenuate, BASE_VOLUME } from '../engine/sound.ts';
import type { Sfx } from '../render/audio.ts';
import { GameSound, type SoundView } from './gamesound.ts';

const view = (voices: SoundView['voices']): SoundView => ({ camX: 0, camY: 0, tracers: [], blasts: [], voices, end: null });
const buffer = { duration: 1 } as AudioBuffer;

describe('voces de la misión', () => {
  it('inicia la sirena en bucle, actualiza el volumen y la detiene', async () => {
    const handle = { setVolume: vi.fn(), stop: vi.fn() };
    const fake = { decode: vi.fn(() => Promise.resolve(buffer)), loop: vi.fn(() => handle), stopMusic: vi.fn() };
    const effect = vi.fn(() => new Uint8Array([1]));
    const sound = new GameSound(fake as unknown as Sfx, { effect, music: () => Promise.resolve(undefined) }, (x, y) => ({ px: x, py: y }));
    sound.tick({ ...view([]), alarmVolume: 0.75 });
    await vi.waitFor(() => { expect(fake.loop).toHaveBeenCalledWith(buffer, 0.75); });
    expect(effect).toHaveBeenCalledWith('SIRENA01.WAV');
    sound.tick({ ...view([]), alarmVolume: 0.5 });
    expect(handle.setVolume).toHaveBeenCalledWith(0.5);
    sound.tick(view([]));
    expect(handle.stop).toHaveBeenCalledOnce();
    sound.stop();
  });
  it('reproduce una vez el WAV propio de cada explosión, incluso las encadenadas', async () => {
    const fake = { decode: vi.fn(() => Promise.resolve(buffer)), play: vi.fn(), stopMusic: vi.fn() };
    const effect = vi.fn((name: string) => name ? new Uint8Array([1]) : undefined);
    const sound = new GameSound(fake as unknown as Sfx, { effect, music: () => Promise.resolve(undefined) }, (x, y) => ({ px: x, py: y }));
    const state: SoundView = { ...view([]), blasts: [{ x: 0, y: 0, tag: 'EBAR' }, { x: 10, y: 0, tag: 'XPLO' }] };
    sound.tick(state);
    sound.tick(state);
    await vi.waitFor(() => { expect(fake.play).toHaveBeenCalledTimes(2); });
    expect(effect.mock.calls.map((args) => args[0])).toEqual(['BARRILEX.WAV', 'EXPLOSI.WAV']);
  });
  it('reproduce AL07 con ALE07.WAV y reutiliza el buffer en voces repetidas', async () => {
    const fake = { decode: vi.fn(() => Promise.resolve(buffer)), play: vi.fn(), stopMusic: vi.fn() };
    const effect = vi.fn((name: string) => name === 'ALE07.WAV' ? new Uint8Array([1]) : undefined);
    const sound = new GameSound(fake as unknown as Sfx, { effect, music: () => Promise.resolve(undefined) }, (x, y) => ({ px: x, py: y }));
    sound.tick(view([{ tag: 'AL07', x: 0, y: 0, z: 0 }, { tag: 'AL07', x: 20, y: 0, z: 0 }]));
    await vi.waitFor(() => { expect(fake.play).toHaveBeenCalledTimes(2); });
    expect(effect).toHaveBeenCalledOnce();
    expect(effect).toHaveBeenCalledWith('ALE07.WAV');
  });

  it('reproduce cada voz con el WAV, la altura y la atenuación de su emisor', async () => {
    const fake = { decode: vi.fn(() => Promise.resolve(buffer)), play: vi.fn(), stopMusic: vi.fn() };
    const effect = vi.fn((name: string) => name ? new Uint8Array([1]) : undefined);
    const project = vi.fn((x: number, y: number, z: number) => ({ px: x, py: y + z }));
    const sound = new GameSound(fake as unknown as Sfx, { effect, music: () => Promise.resolve(undefined) }, project);
    sound.tick(view([{ tag: 'VMUE', x: 100, y: 20, z: 300 }, { tag: 'ALRM', x: 50, y: 0, z: 0 }, { tag: 'VMUE', x: 900, y: 0, z: 0 }]));
    await vi.waitFor(() => { expect(fake.play).toHaveBeenCalledTimes(2); });
    await vi.waitFor(() => { expect(project).toHaveBeenCalledWith(900, 0, 0); });
    expect(effect.mock.calls.map((args) => args[0])).toEqual(['MUERTO.WAV', 'VOZALARM.WAV']);
    expect(project).toHaveBeenCalledWith(100, 20, 300);
    expect(project).toHaveBeenCalledWith(900, 0, 0);
    const mix = attenuate(100, 320, BASE_VOLUME);
    expect(fake.play).toHaveBeenCalledWith(buffer, mix?.volume, mix?.pan);
  });

  it('conserva el orden de emisión aunque el segundo WAV se decodifique primero', async () => {
    let finishAlarm: (value: AudioBuffer | null) => void = () => undefined;
    let finishCorpse: (value: AudioBuffer | null) => void = () => undefined;
    const alarm = { duration: 1 } as AudioBuffer;
    const corpse = { duration: 2 } as AudioBuffer;
    const fake = {
      decode: vi.fn((bytes: Uint8Array) => new Promise<AudioBuffer | null>((resolve) => {
        if (bytes[0] === 1) finishAlarm = resolve;
        else finishCorpse = resolve;
      })),
      play: vi.fn((played: AudioBuffer) => played),
      stopMusic: vi.fn(),
    };
    const effect = (name: string): Uint8Array => new Uint8Array([name === 'VOZALARM.WAV' ? 1 : 2]);
    const sound = new GameSound(fake as unknown as Sfx, { effect, music: () => Promise.resolve(undefined) }, (x, y) => ({ px: x, py: y }));
    sound.tick(view([{ tag: 'ALRM', x: 0, y: 0, z: 0 }, { tag: 'VMUE', x: 0, y: 0, z: 0 }]));
    finishCorpse(corpse);
    await Promise.resolve();
    expect(fake.play).not.toHaveBeenCalled();
    finishAlarm(alarm);
    await vi.waitFor(() => { expect(fake.play).toHaveBeenCalledTimes(2); });
    expect(fake.play.mock.calls.map((args) => args[0])).toEqual([alarm, corpse]);
  });

  it('reutiliza el WAV, omite voces fuera de rango y no reproduce una carga terminada después de parar', async () => {
    let finish: (value: AudioBuffer | null) => void = () => undefined;
    const fake = { decode: vi.fn(() => new Promise<AudioBuffer | null>((resolve) => { finish = resolve; })), play: vi.fn(), stopMusic: vi.fn() };
    const effect = vi.fn(() => new Uint8Array([1]));
    const sound = new GameSound(fake as unknown as Sfx, { effect, music: () => Promise.resolve(undefined) }, (x, y) => ({ px: x, py: y }));
    sound.tick(view([{ tag: 'VMUE', x: 900, y: 0, z: 0 }, { tag: 'VMUE', x: 0, y: 0, z: 0 }]));
    expect(effect).toHaveBeenCalledTimes(1);
    sound.stop();
    finish(buffer);
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.play).not.toHaveBeenCalled();
    expect(fake.stopMusic).toHaveBeenCalledOnce();
  });
});
