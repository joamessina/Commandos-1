/** ClassSplash: 500 plazas, hasta 30 por ciclo durante 20 ciclos, vida base 30, dispersión ±90°, posición ±20 y gravedad -0,4 (FUN_00637C30/00636CC0/00637090).
 * shortcut: distribución entre clases, velocidad individual y tabla de color aproximadas; mejorar al portar ClassSplash completo. */
import { lcg } from '../engine/sound.ts';

export const SPLASH_CYCLES = 80;
export interface WaterDrop { readonly x: number; readonly y: number; readonly color: string }

export function waterSplash(x: number, y: number, tick: number): WaterDrop[] {
  if (tick < 0 || tick >= SPLASH_CYCLES) return [];
  const rand = lcg((Math.trunc(x) * 65537 + Math.trunc(y)) >>> 0);
  const drops: WaterDrop[] = [];
  for (let i = 0; i < 500; i++) {
    const birth = Math.floor(i / 30);
    const angle = (rand() % 360) * Math.PI / 180;
    const radius = rand() % 21;
    const speed = (rand() % 301) / 100;
    const upward = 5 + (rand() % 701) / 100;
    const shade = 63 + (rand() % 64);
    const life = i % 2 === 0 ? 60 : 30;
    const age = tick - birth;
    if (age < 0 || age >= life) continue;
    const z = upward * age - 0.2 * age * (age + 1);
    if (z < 0) continue;
    const distance = radius + speed * age;
    drops.push({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.643 - z * 0.766, color: `rgb(0,${shade.toString()},${shade.toString()})` });
  }
  return drops;
}
