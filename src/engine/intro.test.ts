import { describe, expect, it, vi } from 'vitest';
import { parseIntro } from '../formats/intro.ts';
import type { IntroCommand } from '../formats/intro.ts';
import { IntroSequence } from './intro.ts';

describe('secuencia de introducción', () => {
  it('inicia la siguiente orden al completar cada retardo y actualiza las acciones simultáneas', () => {
    const start = vi.fn<(command: IntroCommand) => void>();
    const update = vi.fn();
    const sequence = new IntroSequence(parseIntro('0 VIDEO #0\n2 STARTWAVE #a\n0 BREAK'), { start, update, waiting: () => false });
    expect(sequence.tick()).toBe(true);
    expect(start.mock.calls.map(([c]) => c.name)).toEqual(['VIDEO', 'STARTWAVE']);
    expect(sequence.tick()).toBe(true);
    expect(start).toHaveBeenCalledTimes(2);
    expect(sequence.tick()).toBe(true);
    expect(start).toHaveBeenCalledTimes(3);
    expect(sequence.tick()).toBe(false);
    expect(update).toHaveBeenCalledTimes(4);
  });
  it('el retardo de WAIT transcurre mientras espera el recurso', () => {
    let busy = true;
    const start = vi.fn();
    const sequence = new IntroSequence(parseIntro('2 WAITVIDEO\n0 BREAK'), { start, update: () => undefined, waiting: () => busy });
    expect(sequence.tick()).toBe(true);
    expect(sequence.tick()).toBe(true);
    expect(sequence.tick()).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    busy = false;
    expect(sequence.tick()).toBe(true);
    expect(start).toHaveBeenCalledTimes(2);
    expect(sequence.tick()).toBe(false);
  });
  it('termina un guion vacío y permanece terminado', () => {
    const sequence = new IntroSequence([], { start: () => undefined, update: () => undefined, waiting: () => false });
    expect(sequence.tick()).toBe(false);
    expect(sequence.tick()).toBe(false);
  });
  it('salta hasta BREAK sin ejecutar las instrucciones intermedias', () => {
    const start = vi.fn<(command: IntroCommand) => void>();
    const sequence = new IntroSequence(parseIntro('20 VIDEO #0\n0 STARTWAVE #a\n0 BREAK\n0 VIDEO #1'), { start, update: () => undefined, waiting: () => false });
    sequence.tick();
    sequence.skip();
    expect(sequence.tick()).toBe(true);
    expect(start.mock.calls.map(([c]) => c.name)).toEqual(['VIDEO', 'VIDEO']);
    sequence.skip();
    expect(sequence.tick()).toBe(false);
  });
});
