/** Presentación por guion: FUN_005B34A0, FUN_005B7BD0 y docs/lectura/intro-briefing.md. */
import { IntroSequence, type IntroHost } from '../engine/intro.ts';
import { parseIntro, type IntroCommand } from '../formats/intro.ts';
import { parseZom, type ZoomBitmap } from '../formats/zom.ts';
import { zoomPixels } from '../render/zom.ts';
import { convertIntroVideo } from './intro-video.ts';
import type { Resolution } from './viewport.ts';

export interface TacticalIntro {
  draw(canvas: HTMLCanvasElement): void;
  setPos(target: string): void;
  setZoom(zoom: number): void;
  goto(target: string): void;
  zoom(target: string): void;
  moving(): boolean;
  zooming(): boolean;
  tick(): void;
  stop(): void;
}
interface Fade { from: ImageBitmap; to: ImageBitmap; age: number; duration: number }
interface MapZoom { bitmap: ZoomBitmap; bg: ImageBitmap; x: number; y: number; w: number; h: number; frames: number; age: number; x0: number; y0: number; x1: number; y1: number; z0: number; z1: number }
type Loose = (path: string) => Promise<Uint8Array | undefined>;

export async function playIntro(view: HTMLElement, script: string, read: (path: string) => Uint8Array | undefined, loose: Loose, tactical: TacticalIntro, report: (message: string) => void, resolution: Resolution): Promise<void> {
  const commands = parseIntro(script);
  const imageNames = new Set<string>();
  const mapNames = new Set<string>();
  const audioNames = new Set<string>();
  const videoNames = new Set<string>();
  for (const c of commands) {
    const words = c.args.split(/\s+/);
    if (c.name === 'STARTBLENDFADE' || c.name === 'STARTBLENDFADESTOP') for (const name of words.slice(0, 2)) if (name) imageNames.add(name.toUpperCase());
    if (c.name === 'STARTZOOMBITMAP') {
      if (words[0]) mapNames.add(words[0].toUpperCase());
      if (words[1]) imageNames.add(words[1].toUpperCase());
    }
    if (/^STARTWAVE(?:[123M])?$/.test(c.name) && words[0]) audioNames.add(`DATOS/BRIEF_MP/${c.name.endsWith('M') ? 'MUSICA' : 'WAVE'}/${words[0].toUpperCase()}`);
    if (c.name === 'STARTVIDEO' && words[0]) videoNames.add(`VIDEO/${words[0].toUpperCase()}`);
  }
  const images = new Map<string, ImageBitmap>();
  const maps = new Map<string, ZoomBitmap>();
  const urls = new Map<string, string>();
  const ownedUrls: string[] = [];
  const missing: string[] = [];
  for (const name of imageNames) {
    const data = read(`DATOS/BRIEF_MP/${name}`);
    if (data) images.set(name, await createImageBitmap(new Blob([data.slice().buffer], { type: 'image/bmp' })));
    else missing.push(name);
  }
  for (const name of mapNames) {
    const data = read(`DATOS/BRIEF_MP/${name}`);
    if (data) maps.set(name, parseZom(data));
    else missing.push(name);
  }
  for (const path of audioNames) {
    const data = await loose(path);
    if (data) {
      const url = URL.createObjectURL(new Blob([data.slice().buffer], { type: 'audio/wav' }));
      urls.set(path, url); ownedUrls.push(url);
    } else missing.push(path);
  }
  for (const path of videoNames) {
    const data = await loose(path);
    if (data) {
      report('Preparando el video original…');
      try {
        const blob = await convertIntroVideo(data);
        const url = URL.createObjectURL(blob); urls.set(path, url); ownedUrls.push(url);
      } catch { missing.push(path); }
    } else missing.push(path);
  }
  report(missing.length ? `Presentación: faltan ${missing.length.toString()} archivos sueltos; Escape saltea la sección.` : 'Presentación original. Escape saltea la sección.');
  const canvas = document.createElement('canvas');
  canvas.width = resolution[0]; canvas.height = resolution[1];
  canvas.style.cssText = 'max-width:100%;max-height:100%;width:auto;height:auto;margin:auto';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el canvas de la presentación');
  const scratch = document.createElement('canvas');
  const video = document.createElement('video');
  video.playsInline = true;
  video.style.display = 'none';
  view.replaceChildren(canvas, video);
  const channels = new Map<string, HTMLAudioElement>();
  const levels = new Map<string, number>();
  let videoActive = false;
  let isTactical = false;
  let background: ImageBitmap | undefined;
  let fade: Fade | undefined;
  let mapZoom: MapZoom | undefined;
  let ticks = 0;
  let frameId = 0;
  let renderedZoom = '';
  const channel = (name: string): string => /(?:WAVE|WAVELEVEL)([123M])$/.exec(name)?.[1] ?? '';
  const audio = (c: IntroCommand): void => {
    const ch = channel(c.name);
    channels.get(ch)?.pause();
    const filename = c.args.split(/\s+/)[0]?.toUpperCase();
    const url = urls.get(`DATOS/BRIEF_MP/${ch === 'M' ? 'MUSICA' : 'WAVE'}/${filename ?? ''}`);
    // shortcut: sin WAV se omite la espera por longitud del subtítulo de FUN_005AEDC0.
    if (!url) { channels.delete(ch); return; }
    const a = new Audio(url);
    a.loop = ch === 'M';
    a.volume = 0.75;
    channels.set(ch, a);
    a.play().catch(() => { report('El navegador pausó el sonido; hacé clic en la presentación para habilitarlo.'); });
  };
  const host: IntroHost = {
    start(c) {
      const words = c.args.split(/\s+/);
      if (c.name === 'VIDEO') isTactical = c.args[0] !== '0';
      else if (c.name === 'STARTVIDEO') {
        const url = urls.get(`VIDEO/${(words[0] ?? '').toUpperCase()}`);
        videoActive = !!url;
        if (url) { video.src = url; video.play().catch(() => { videoActive = false; report('El navegador no pudo reproducir el video de la presentación.'); }); }
      } else if (/^STARTWAVE(?:[123M])?$/.test(c.name)) audio(c);
      else if (/^STARTWAVELEVEL(?:[123M])?$/.test(c.name)) {
        const a = channels.get(channel(c.name));
        const value = Number(words[0]);
        if (a && Number.isFinite(value)) levels.set(channel(c.name), Math.max(0, Math.min(1, value)));
      } else if (/^SETWAVELEVEL(?:[123M])?$/.test(c.name)) {
        const a = channels.get(channel(c.name));
        const value = Number(words[0]);
        if (a && Number.isFinite(value)) a.volume = Math.max(0, Math.min(1, value));
      } else if (/^STOPWAVE(?:[123M])?$/.test(c.name)) {
        const ch = channel(c.name);
        channels.get(ch)?.pause(); channels.delete(ch); levels.delete(ch);
      } else if (c.name === 'STARTBLENDFADE' || c.name === 'STARTBLENDFADESTOP') {
        const from = images.get((words[0] ?? '').toUpperCase());
        const to = images.get((words[1] ?? '').toUpperCase());
        const duration = Number(/\$(\d+)/.exec(c.args)?.[1] ?? 1);
        if (from && to) { fade = { from, to, age: 0, duration: Math.max(1, duration) }; background = to; mapZoom = undefined; }
      } else if (c.name === 'STARTZOOMBITMAP') {
        const bitmap = maps.get((words[0] ?? '').toUpperCase());
        const bg = images.get((words[1] ?? '').toUpperCase());
        const n = words.slice(2).map(Number);
        if (bitmap && bg && n.length >= 11 && n.every(Number.isFinite)) {
          mapZoom = { bitmap, bg, x: n[0] ?? 0, y: n[1] ?? 0, w: n[2] ?? 0, h: n[3] ?? 0, frames: n[4] ?? 1, age: 0, x0: n[5] ?? 0, y0: n[6] ?? 0, x1: n[7] ?? 0, y1: n[8] ?? 0, z0: n[9] ?? 1, z1: n[10] ?? 1 };
          fade = undefined; renderedZoom = '';
        }
      } else if (c.name === 'SETPOS') tactical.setPos(c.args);
      else if (c.name === 'SETZOOM') tactical.setZoom(Number(words[0]));
      else if (c.name === 'STARTGOTO') tactical.goto(c.args);
      else if (c.name === 'STARTZOOM') tactical.zoom(c.args);
    },
    waiting(c) {
      if (c.name === 'WAITVIDEO') return videoActive;
      if (c.name === 'WAITFADE') return !!fade;
      if (c.name === 'WAITZOOMBITMAP') return !!mapZoom && mapZoom.age < mapZoom.frames;
      if (c.name === 'WAITGOTO') return tactical.moving();
      if (c.name === 'WAITZOOM') return tactical.zooming();
      if (/^WAITWAVELEVEL(?:[123M])?$/.test(c.name)) return levels.has(channel(c.name));
      if (/^WAITWAVE(?:[123M])?$/.test(c.name)) { const a = channels.get(channel(c.name)); return !!a && !a.paused && !a.ended; }
      return false;
    },
    update() {
      ticks++;
      if (videoActive && (video.ended || video.error)) videoActive = false;
      if (fade && ++fade.age >= fade.duration) fade = undefined;
      if (mapZoom && mapZoom.age < mapZoom.frames) mapZoom.age++;
      for (const [ch, value] of levels) {
        const a = channels.get(ch);
        if (!a) { levels.delete(ch); continue; }
        const delta = value - a.volume;
        if (Math.abs(delta) <= 0.1) { a.volume = value; levels.delete(ch); }
        else a.volume += Math.sign(delta) * 0.1;
      }
      tactical.tick();
    },
  };
  const sequence = new IntroSequence(commands, host);
  const stopMedia = (): void => {
    video.pause(); videoActive = false;
    for (const [ch, a] of channels) if (ch !== 'M') { a.pause(); channels.delete(ch); levels.delete(ch); }
    fade = undefined; mapZoom = undefined; tactical.stop();
  };
  const keyup = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && ticks > 10) { stopMedia(); sequence.skip(); ticks = 0; e.preventDefault(); }
    else if (e.key === ' ' && videoActive) { video.pause(); videoActive = false; e.preventDefault(); }
  };
  const pointer = (): void => {
    if (videoActive && video.paused) video.play().catch(() => undefined);
    for (const a of channels.values()) if (a.paused && !a.ended) a.play().catch(() => undefined);
  };
  window.addEventListener('keyup', keyup);
  canvas.addEventListener('pointerdown', pointer);
  let last = performance.now();
  let accumulated = 0;
  return new Promise((resolve) => {
    const done = (): void => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keyup', keyup);
      canvas.removeEventListener('pointerdown', pointer);
      stopMedia();
      for (const a of channels.values()) a.pause();
      for (const u of ownedUrls) URL.revokeObjectURL(u);
      for (const image of images.values()) image.close();
      resolve();
    };
    const render = (now: number): void => {
      accumulated = Math.min(500, accumulated + now - last); last = now;
      while (accumulated >= 50) {
        if (!sequence.tick()) { done(); return; }
        accumulated -= 50;
      }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.dataset['intro'] = isTactical ? 'tactical' : videoActive ? 'video' : mapZoom ? 'zoom' : 'history';
      if (isTactical) tactical.draw(canvas);
      else {
        // shortcut: los recursos 4:3 se ajustan a la resolución elegida preservando proporción.
        const scale = Math.min(canvas.width / 640, canvas.height / 480);
        ctx.save();
        ctx.translate((canvas.width - 640 * scale) / 2, (canvas.height - 480 * scale) / 2);
        ctx.scale(scale, scale);
        if (videoActive && video.readyState >= 2) ctx.drawImage(video, 0, 0, 640, 480);
        else if (fade) {
          ctx.drawImage(fade.from, 0, 0);
          ctx.save(); ctx.globalAlpha = fade.age / fade.duration; ctx.drawImage(fade.to, 0, 0); ctx.restore();
        } else if (mapZoom) {
          ctx.drawImage(mapZoom.bg, 0, 0);
          const t = Math.min(1, Math.max(0, (mapZoom.age - 1) / Math.max(1, mapZoom.frames - 1)));
          const x = mapZoom.x0 + (mapZoom.x1 - mapZoom.x0) * t;
          const y = mapZoom.y0 + (mapZoom.y1 - mapZoom.y0) * t;
          const z = 1 / (1 / mapZoom.z0 + (1 / mapZoom.z1 - 1 / mapZoom.z0) * t);
          const key = `${mapZoom.x0.toString()}|${mapZoom.y0.toString()}|${mapZoom.x1.toString()}|${mapZoom.y1.toString()}|${mapZoom.age.toString()}`;
          if (key !== renderedZoom) {
            renderedZoom = key;
            scratch.width = mapZoom.w; scratch.height = mapZoom.h;
            const pixels = new ImageData(mapZoom.w, mapZoom.h);
            pixels.data.set(zoomPixels(mapZoom.bitmap, x, y, z, mapZoom.w, mapZoom.h));
            scratch.getContext('2d')?.putImageData(pixels, 0, 0);
          }
          ctx.drawImage(scratch, mapZoom.x, mapZoom.y);
        } else if (background) ctx.drawImage(background, 0, 0);
        ctx.restore();
      }
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
  });
}
