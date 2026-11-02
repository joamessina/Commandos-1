import { expect, it } from 'vitest';
import { Alarm } from './alarm.ts';

it('enciende una sola vez, atenúa y apaga a los 500 ciclos', () => {
  const alarm = new Alarm();
  alarm.tick();
  expect(alarm.volume).toBe(0);
  alarm.trigger();
  alarm.tick();
  alarm.trigger();
  expect(alarm.volume).toBeCloseTo(0.7485);
  for (let i = 1; i < 500; i++) alarm.tick();
  expect(alarm.volume).toBe(0);
  alarm.trigger();
  expect(alarm.volume).toBe(0);
});
