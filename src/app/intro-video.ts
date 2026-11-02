/** Convierte el AVI Cinepak del jugador a un formato reproducible por el navegador, en memoria. */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

export async function convertIntroVideo(input: Uint8Array): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  try {
    await ffmpeg.load({ coreURL, wasmURL });
    await ffmpeg.writeFile('entrada.avi', input);
    const result = await ffmpeg.exec(['-i', 'entrada.avi', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', 'faststart', 'salida.mp4']);
    if (result !== 0) throw new Error('No se pudo convertir el video de introducción');
    const output = await ffmpeg.readFile('salida.mp4');
    if (typeof output === 'string') throw new Error('Video convertido inválido');
    return new Blob([output.slice().buffer], { type: 'video/mp4' });
  } finally {
    ffmpeg.terminate();
  }
}
