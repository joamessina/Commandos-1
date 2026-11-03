/**
 * Filtros de pantalla del juego: una capa WebGL encima del canvas 2D del juego que lo vuelve a dibujar con otro escalado. El canvas del juego queda debajo (transparente) y sigue
 * recibiendo el mouse y el cursor, así que el resto del código no cambia. Con 'none' o si la imagen se achica (factor < 1) la capa se oculta y manda el suavizado del navegador.
 *  - sharp: bilinear "afilado" (Themaister): cada píxel conserva su color en el centro y solo se mezcla en el borde, el ancho de un píxel de pantalla; sirve con factores fraccionarios.
 *  - scale2x: EPX (Scale2x) duplica la imagen reconstruyendo diagonales con los cuatro vecinos, y esa imagen se ajusta al tamaño final con el mismo bilinear afilado.
 * shortcut: no se atiende la pérdida del contexto WebGL ni se mide el costo de subir el canvas cada cuadro. Cuándo mejorar: si aparece un cuadro negro tras suspender la GPU o la medición lo pide.
 */
export type FilterMode = 'none' | 'sharp' | 'scale2x';

export const FILTER_MODES: readonly FilterMode[] = ['none', 'sharp', 'scale2x'];

export const parseFilterMode = (value: string | null): FilterMode => FILTER_MODES.find((m) => m === value) ?? 'none';

/** ¿La capa actúa? Solo si hay filtro y la imagen se agranda o queda igual (`scale` = tamaño en pantalla / tamaño del canvas). */
export const filterActive = (mode: FilterMode, scale: number): boolean => mode !== 'none' && scale >= 1;

const VERTEX = `
attribute vec2 p;
uniform float flip;
varying vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, flip > 0.5 ? p.y * 0.5 + 0.5 : 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SHARP = `
precision highp float;
uniform sampler2D tex;
uniform vec2 size;
uniform float scale;
varying vec2 uv;
void main() {
  float s = max(scale, 1.0);
  vec2 p = uv * size;
  vec2 cd = fract(p) - 0.5;
  float rr = 0.5 - 0.5 / s;
  vec2 q = (cd - clamp(cd, -rr, rr)) * s + 0.5;
  gl_FragColor = texture2D(tex, (floor(p) + q) / size);
}`;

const EPX = `
precision highp float;
uniform sampler2D tex;
uniform vec2 size;
varying vec2 uv;
vec4 at(vec2 c) { return texture2D(tex, (c + 0.5) / size); }
void main() {
  vec2 p = uv * size;
  vec2 c = floor(p);
  vec2 r = fract(p);
  vec4 P = at(c);
  vec4 A = at(c + vec2(0.0, -1.0));
  vec4 B = at(c + vec2(1.0, 0.0));
  vec4 C = at(c + vec2(-1.0, 0.0));
  vec4 D = at(c + vec2(0.0, 1.0));
  vec4 o = P;
  if (r.y < 0.5) {
    if (r.x < 0.5) { if (C == A && C != D && A != B) o = A; }
    else { if (A == B && A != C && B != D) o = B; }
  } else {
    if (r.x < 0.5) { if (D == C && D != B && C != A) o = C; }
    else { if (B == D && B != A && D != C) o = D; }
  }
  gl_FragColor = o;
}`;

interface Program {
  readonly prog: WebGLProgram;
  readonly flip: WebGLUniformLocation | null;
  readonly size: WebGLUniformLocation | null;
  readonly scale: WebGLUniformLocation | null;
}

function must<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`WebGL: no se pudo crear ${what}`);
  return value;
}

function build(gl: WebGLRenderingContext, fragment: string): Program {
  const compile = (type: number, source: string): WebGLShader => {
    const shader = must(gl.createShader(type), 'un shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`WebGL: ${gl.getShaderInfoLog(shader) ?? 'shader inválido'}`);
    return shader;
  };
  const prog = must(gl.createProgram(), 'un programa');
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(prog, 0, 'p');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`WebGL: ${gl.getProgramInfoLog(prog) ?? 'programa inválido'}`);
  return { prog, flip: gl.getUniformLocation(prog, 'flip'), size: gl.getUniformLocation(prog, 'size'), scale: gl.getUniformLocation(prog, 'scale') };
}

export class ScreenFilter {
  /** Capa que se agrega al contenedor del juego (posicionada sobre el canvas, sin recibir el mouse). */
  readonly canvas = document.createElement('canvas');
  private readonly source: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext | null;
  private readonly sharp: Program | null = null;
  private readonly epx: Program | null = null;
  private readonly sourceTex: WebGLTexture | null = null;
  private readonly bigTex: WebGLTexture | null = null;
  private readonly fbo: WebGLFramebuffer | null = null;
  private bigW = 0;
  private bigH = 0;
  private mode: FilterMode = 'none';

  constructor(source: HTMLCanvasElement) {
    this.source = source;
    this.canvas.style.cssText = 'position:absolute;pointer-events:none;display:none';
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = this.canvas.getContext('webgl', { alpha: false, antialias: false });
      if (gl) {
        this.sharp = build(gl, SHARP);
        this.epx = build(gl, EPX);
        const quad = must(gl.createBuffer(), 'un buffer');
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.sourceTex = this.texture(gl);
        this.bigTex = this.texture(gl);
        this.fbo = must(gl.createFramebuffer(), 'un framebuffer');
      }
    } catch {
      gl = null; // sin WebGL el juego sigue con el canvas 2D
    }
    this.gl = gl;
  }

  private texture(gl: WebGLRenderingContext): WebGLTexture {
    const tex = must(gl.createTexture(), 'una textura');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private static filter(gl: WebGLRenderingContext, tex: WebGLTexture | null, linear: boolean): void {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  }

  setMode(mode: FilterMode): void {
    this.mode = mode;
  }

  /** Coloca la capa en el contenedor (hay que repetirlo si el contenedor se vacía). */
  attach(view: HTMLElement): void {
    view.append(this.canvas);
  }

  /** Vuelve a dibujar el cuadro del juego con el filtro; llamarlo después de pintar cada cuadro. */
  present(): void {
    const { gl, source, sharp, epx } = this;
    const scale = source.clientWidth / Math.max(1, source.width);
    if (!gl || !sharp || !epx || !filterActive(this.mode, scale)) {
      source.style.opacity = '';
      this.canvas.style.display = 'none';
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(source.clientWidth * dpr));
    const h = Math.max(1, Math.round(source.clientHeight * dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const css = this.canvas.style;
    css.display = 'block';
    css.left = `${source.offsetLeft.toString()}px`;
    css.top = `${source.offsetTop.toString()}px`;
    css.width = `${source.clientWidth.toString()}px`;
    css.height = `${source.clientHeight.toString()}px`;
    source.style.opacity = '0';
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const sw = source.width;
    const sh = source.height;
    let from = this.sourceTex;
    let fw = sw;
    let fh = sh;
    if (this.mode === 'scale2x') {
      this.resizeBig(gl, sw * 2, sh * 2);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, sw * 2, sh * 2);
      gl.useProgram(epx.prog);
      gl.uniform1f(epx.flip, 0);
      gl.uniform2f(epx.size, sw, sh);
      ScreenFilter.filter(gl, this.sourceTex, false);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      from = this.bigTex;
      fw = sw * 2;
      fh = sh * 2;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(sharp.prog);
    gl.uniform1f(sharp.flip, from === this.bigTex ? 1 : 0); // lo que sale de un framebuffer queda con el eje vertical invertido
    gl.uniform2f(sharp.size, fw, fh);
    gl.uniform1f(sharp.scale, w / fw);
    ScreenFilter.filter(gl, from, true);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private resizeBig(gl: WebGLRenderingContext, w: number, h: number): void {
    if (w === this.bigW && h === this.bigH) return;
    this.bigW = w;
    this.bigH = h;
    gl.bindTexture(gl.TEXTURE_2D, this.bigTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bigTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
