# Formatos gráficos: RLE, WAD, ANM (cerrados contra los archivos reales de Legacy)

Verificación reproducible: `py -I tools/rle_check.py <DATOS>`, `tools/wad_check.py`, `tools/bnm_dump.py --all <ELEM>`, `tools/wad_render.py` (PNG para mirar). Datos extraídos con `tools/inventario.py`.
Cada afirmación lleva **[exe]** (leída en el decompilado del exe de la raíz) y/o **[datos]** (verificada en todos los archivos).
> **Correcciones posteriores (2026-10-27, lectura del exe por agentes; ver `docs/engine/graficos-mapa.md`):**
> - Tipo 7 **no** "activa anclajes": es `NHOTSPOTS`; tipo 8 es `HOTSPOT (x,y,k)` (máx. 5 por fotograma), no un anclaje. Los anclajes son los tipos 9/10/11 (`ANCLAJES/ANCLAJE/ANCLAJESEC`). Tipos: 0 NUM_SEQUENCES · 1 SEQUENCE (cíclica) · 2 NLSEQUENCE (no cíclica) · 3 CHAINSEQUENCE (2 enlaces) · 4 FRAME · 5 SPRITE · 6 SIZESPRITE.
> - Ranuras de los tipos 1–3: `a` = período en **distancia** (unidades de mapa por ciclo, locomoción) y `b` = período en **ticks** de 1/20 s; paso = `(trunc(n·t/b) + trunc(n·d/a)) mod n`. Mi hipótesis de "velocidad" para ANDAR 33/CORRER 55 era incompleta: es distancia por ciclo de animación.
> - Cabecera de 400 B del WAD = `int32[100]` (tabla de ranuras de paleta; en 168 de 245 archivos es basura de memoria que el cargador no usa). Campos del sprite: +0x48 alto, +0x4C ancho, +0x50 bits, +0x54 compresión (4 = RLE, 0 = crudo). Los 506 `.BMP` cumplen `len = h·(w+2)+1`.
> - **Nombres de sprite:** el WAD registra cada sprite sin UN guion inicial, pero el `TILE` del `.VOL` se busca con el nombre exacto: `-RUINA06.RLE` no se encuentra y el tile no se dibuja (así el mapa arranca con edificios sanos). Ver `docs/engine/graficos-mapa.md` §7.
> - El mapa gráfico lo dibuja el **`.VOL`** (polígonos con TILE `x,y,w,h,sx,sy,g,"sprite","flags"`); los `.TIL` **no los lee el juego** (`NTILE` no existe en el exe). `.SEC` (NIBS) cerrado al byte en los 11 archivos.


## 1. `.RLE` suelto (88 archivos) — 88/88 [datos]
BMP 8 bpp con `biCompression = 4` (no estándar). **Paleta siempre 256 × 4 B** en 54..1078 aunque `biClrUsed` diga otra cosa (en 5 archivos dice 29/50/171).
```
1078: tag[4]  (etiqueta libre; "LIBR","mano","text"… se ignora)
1082: u32 w   1086: u32 h
1090: u32 fila_off[h]      (relativo al inicio de datos = bfOffBits = 1090 + 4h)
datos: filas concatenadas
```
Fila: `FF n` = n píxeles transparentes · `FE n` + n bytes = n píxeles **mezclados 50 % con el fondo** (sombras; `(src>>1 & 0x7BEF) + (dst>>1 & 0x7BEF)` en RGB565) · byte `n < FE` + n bytes = n píxeles opacos. Cada fila suma exactamente `w`. **[exe]** blitter `FUN_00659c80`, que además pasa cada índice por una de 256 tablas de 256 colores RGB565 elegida por un mapa de luz por píxel (iluminación). Totales: 147 046 saltos, 137 144 opacos, 106 246 mezclas.

## 2. `.WAD` (236 en el DIR + 9 `Fase000N.WAD` sueltos) — 245/245 sin bytes sobrantes [datos]
Contenedor de **sprites con nombre** y sus **paletas**. Layout **[exe]** `FUN_005d02b0` + `FUN_00647580/00645fb0` + `FUN_00648360/00648000`:
```
cab[400]                                   (sin decodificar; 0xFF… en CARAS/FONTS/SPRITES)
u32 A ; A x { pal[512] = 256 x RGB565 ; nombre[13] }
u32 B ; B x sprite
sprite = nombre[32] ; u32 s1 ; u32 s3 ; u32 tipo(@+0x3c) ; u32 basura(@+0x44) ;
         campos[16] = {u32 h?, u32 w?, u32 basura, u32 flag} ;      (64 B hasta aquí)
         buf1[s1] ; si flag: u32 s2 + buf2[s2] ; buf3[s3] ; i32 paleta
```
- `buf1` = filas RLE (mismas operaciones que §1); `buf2` = índice `tag[4], u32 w, u32 h, u32 fila_off[h]` (`len = 12 + 4h` exacto); `paleta` (i32 final) es el **índice en la lista A** (en [0, A) en los 11 483 sprites RLE).
- 11 627 sprites: **11 483 `.RLE`** decodifican y cierran fila a fila; el campo de 16 B cuenta `(h, w)` y no `(w, h)` (en 11 225 casos distintos de cuadrados); `tipo = 3` en todos los RLE.
- **144 sprites `.BMP`** (carpeta `CARAS`, `flag = 0`, sin `buf2`): datos crudos de `w·h + 77` bytes (p. ej. 38×19 → 799). **Sin decodificar.**
- Campos `basura` (@+0x44, @+0x50) son punteros de memoria volcados al disco: no significan nada.
- **Prueba visual:** `SOLDADO.WAD` renderizado con `wad_render.py` muestra los soldados alemanes en 8 poses con colores y sombras correctos.

## 3. `.ANM` = flujo `BNM ` (166 archivos) — 166/166, cada flujo termina exactamente en su último byte [datos]
Es un **flujo de llamadas a métodos registrados** **[exe]** `FUN_00622bc0/00622cf0/006225a0`:
```
'BNM ' ; luego registros hasta hdr == 0xFF000000
hdr u32: tamaño datos = hdr & 0xFFFF ; nslots = (hdr>>16) & 0xF ; tipo = hdr >> 24
mask u32 ; slots[nslots] i32 (bit i de mask: ranura = offset relativo a los datos) ; datos[tamaño]
```
Tipos (cada tipo tiene siempre la misma cantidad de ranuras en los 166 archivos):
| Tipo | Ranuras | Significado |
|---|---|---|
| 0 | `[n]` | cabecera: nº total de secuencias con nombre (59 en SOLDADO) |
| 1 | `[nombre, pasos, a, b]` | animación principal (ANDAR, CORRER, FUMAR…); `pasos` = cantidad de tipo-4 |
| 2 | `[nombre, pasos, a, b]` | subanimación (MUERTE1, EMBARCADO, ATONTADO…) |
| 3 | `[nombre, pasos, a, b, enlace1, enlace2]` | subanimación con enlaces a otras (ESCALAR_FIN → ESCALAR_CICLICO / ANDAR) |
| 4 | `[n]` | un paso con `n` fotogramas (8 = direcciones; 1 = sin dirección) |
| 5 | `[sprite.RLE, hx, hy, espejo]` | fotograma; (hx, hy) hot-spot con signo; `espejo = 1` ⇒ volteo horizontal (solo se guardan 5 de las 8 direcciones: 3 reutilizan sprites espejados) |
| 6 | `[sprite.RLE, hx, hy, w, h, espejo]` | fotograma con caja (w, h) |
| 7 | `[n]` | `NHOTSPOTS` (corregido, ver nota arriba) |
| 8 | `[x, y, k]` | `HOTSPOT` por fotograma, tipo `k` (FUMAR: brasa `k=5`; `0,0,0` = ninguno) |
| 9 | `[]` | (1 vez, en LEON) |
| 10, 11 | `[a, b]` | pares de vectores por fotograma (animales: LEON) |
- Para animaciones de locomoción (ANDAR 33, CORRER 55, CORRER_DESNUDO 52) la ranura 2 del tipo 1 parece una **velocidad**; para el resto la ranura 3 parece la **duración total en ticks** (FUMAR 20 pasos → 80 = 4 por paso; RECOGER 4 → 8). **[hip]** — falta confirmar en el exe qué campo del manejador la consume.
- Nombre del sprite → se busca **dentro del `.WAD` homónimo** (`SOLDADO.ANM` → `SOLDADO.WAD`, `FUN_004e4100` cambia la extensión); numeración `SAND00xx`: bloques de 8 por dirección almacenada.

## 4. Pendiente de cerrar (no leído)
1. Cabecera de 400 B del `WAD` y los 4 B `tipo`. 2. Los 144 sprites `.BMP` de `CARAS`. 3. Nombre real de las ranuras a/b del tipo 1/2/3 y de los tipos 9–11 (hay que leer los manejadores registrados). 4. `ZOM` (8 archivos de ~630 kB, magia `C2010000`) y la composición del mapa (cómo `TIL` coloca estas piezas).

Resuelto después de escribir lo anterior: los **9 `Fase000N.WAD` sueltos** (en `DATOS\recursos\bmps\map_mp\`, fuera del DIR) usan **el mismo formato** (9/9 sin bytes sobrantes; 110–341 sprites y 39–271 paletas cada uno). Son los **atlas de piezas del mapa** (`ROCA0005.RLE`, `CASA0000.RLE`, `-RUINA06.RLE`, `MAR0DST.BMP`…), los mismos nombres que `TIL` lista en `NTILE`. Renderizados con `wad_render.py`: rocas, terreno y muros con sus sombras, correctos.
