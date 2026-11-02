/**
 * Partículas de agua de FUN_006788C0 / ClassFireBolt: 16, hasta 5 por ciclo,
 * ángulo -90 ±32°, gravedad 0,2..0,599 y vida 10..19 (FUN_00632530/00632750).
 * shortcut: la escala de velocidad por partícula y la fase de la tabla de color son aproximadas; mejorar al portar el emisor completo.
 */
import { lcg } from '../engine/sound.ts';

export interface WaterDrop {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

/** Posiciones de pantalla relativas a la superficie para una explosión y un ciclo. */
export function waterSplash(x: number, y: number, tick: number): WaterDrop[] {
  if (tick < 0) return [];
  const rand = lcg((Math.trunc(x) * 65537 + Math.trunc(y)) >>> 0);
  const gravity = 0.2 + (rand() % 400) / 1000;
  const life = 10 + (rand() % 10);
  const drops: WaterDrop[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = ((-90 + (rand() % 65) - 32) * Math.PI) / 180;
    const speed = 4 * (0.6 + (rand() % 401) / 1000);
    const age = tick - Math.floor(i / 5);
    if (age < 0 || age >= life) continue;
    const fade = age / life;
    const g = Math.round(255 - 105 * fade);
    const b = Math.round(255 - 95 * fade);
    drops.push({ x: Math.cos(angle) * speed * age, y: Math.sin(angle) * speed * age + gravity * age * (age + 1) / 2, color: `rgb(0,${g.toString()},${b.toString()})` });
  }
  return drops;
}
