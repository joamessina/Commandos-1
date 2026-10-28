# Gráficos, mapa y animación (informe parcial, se actualiza por punto cerrado)

Marcas: **[hecho]** = leído en el exe (dirección) y/o verificado en los archivos reales; **[hip]** = hipótesis; **NO LEÍDO** = sin evidencia.
Exe = `coman_mp.exe` de la raíz. Herramientas nuevas en `tools/`: `exedis.py` (desensambla una VA y sigue stubs `jmp`), `jmpchase.py` (resuelve stubs), `callers.py` (quién llama, incluso vía stubs), `bmp_sprite_check.py`.

## 0. Hallazgo de método
`FUN_00622bc0/00622cf0/006225a0` NO es solo el lector de `.ANM`: es un **intérprete genérico "formato → callback"** que sirve también a los parsers de texto (`.VOL`, `.MIS`-parte, etc.). Cada cargador arma una tabla de entradas `{cadena de formato, callback, this}` (12 B) con `FUN_004e1c10` (append). El **índice de registro = el `tipo` del registro BNM** (`FUN_00622cf0` indexa `tabla[hdr>>24]`; `FUN_006225a0` llama al callback con 0..11 ranuras como argumentos). Cadena de formato `%l`=entero, `%s`=cadena. Así se sabe el nombre de cada tipo sin adivinar.

## 1. ANM / BNM: semántica completa [hecho]
Registro en `FUN_004e4100` (cargador, ruta `DATOS\RECURSOS\ELEM\<nombre>.ANM`; el mismo parser entiende el ANM en texto):

| tipo | formato registrado | callback → efecto |
|---|---|---|
| 0 | `NUM_SEQUENCES n` | `4E38F0`: reserva n secuencias de 0x80 B |
| 1 | `SEQUENCE nombre,pasos,a,b` | `4E3CF0→4E39C0`: secuencia **cíclica** (flag +0 = 1) |
| 2 | `NLSEQUENCE nombre,pasos,a,b` | `4E3D30`: **no cíclica** (flag 0) |
| 3 | `CHAINSEQUENCE nombre,pasos,a,b,enlace1,enlace2` | `4E3D70`: no cíclica con enlaces (+0x25 = enlace1, +0x46 = enlace2) |
| 4 | `FRAME n` | `4E3F80`: pasa al paso siguiente y reserva n fotogramas (0x68 B c/u) |
| 5 | `SPRITE nombre,hx,hy,espejo` | `4E3810→4E30C0`: fotograma; sprite buscado por nombre en el WAD (`FUN_005CDE70`, avisa si no existe) |
| 6 | `SIZESPRITE nombre,hx,hy,w,h,espejo` | `4E3840→4E3230`: ídem con caja (w,h) |
| 7 | `NHOTSPOTS n` | `4E1ED0`: nº de puntos calientes por fotograma de la secuencia (`seq+0x7C`, máx 5) |
| 8 | `HOTSPOT x,y,k` | `4E1F00`: guarda (x,y,k) en `frame+0x2C+i*12` (i<5) |
| 9 | `ANCLAJES` | `4E1F60`: `seq+0x70 = 1` (secuencia "anclada") |
| 10 | `ANCLAJE a,b` | `4E1F80`: `frame+0x14/0x18` (solo si secuencia anclada) |
| 11 | `ANCLAJESEC a,b` | `4E1FB0`: `frame+0x1C/0x20`, `frame+0x24=1` |

**Registro de secuencia (0x80 B):** `+0` cíclica(1)/no(0) · `+4` nombre[0x20] · `+0x25` enlace1 · `+0x46` enlace2 · `+0x68` nº de pasos · `+0x6C` pasos (8 B: {nº fotogramas, ptr}) · `+0x70` anclada · `+0x74` **float b** (ranura 3) · `+0x78` **float a** (ranura 2) · `+0x7C` nº hotspots. `FUN_004E2010` arma una tabla de búsqueda {seq, npasos, b, a}.
**Fotograma (0x68 B):** `[0]` índice de sprite, `[1..2]` (hx,hy), `[3..4]` (w,h) si SIZESPRITE, `[5..6]` anclaje, `[7..8]` anclaje sec., `[10]` espejo, `+0x2C..` 5 hotspots (x,y,k).

**Qué son `a` y `b`** (lectura de `FUN_004E1050`, `FUN_004E28D0`, `FUN_004E13F0`; desensamblado verificado, `fistp` con truncado):
- La instancia (`FUN_004E28D0(this, dDist, dTiempo)`) acumula **`acum_dist` (+0x1C)** y **`acum_tiempo` (+0x20)**.
- **`a` = período en distancia** (unidades de mapa recorridas por ciclo; locomoción), **`b` = período en ticks**.
- Paso mostrado = `(trunc(n·acum_tiempo/b) + trunc(n·acum_dist/a)) mod n`, n = nº de pasos. Si a o b = 0 esa división da inf/NaN y `fistp qword` devuelve 0x80000000_00000000 → su parte baja es 0: **el eje con período 0 no aporta** (diseño deliberado).
- Cíclica: `acum` se reduce con fmod a [0, a) / [0, b). No cíclica: si `a>0 && acum_dist>=a` o `b>0 && acum_t>=b` → último paso y se clampa; si `acum<=0` → paso 0.
- **Unidad de tiempo = 1 tick por ciclo de juego**: el actualizador por cuadro `FUN_00591790` llama `FUN_004E28D0(0, 1.0f)`; el ciclo corre a `MAXFPS=20` (exe-lectura §2) ⇒ **b en ticks de 1/20 s**. Locomoción: `FUN_00591DE0` llama `advance(proyección del desplazamiento sobre el rumbo, *param_1)` ⇒ ANDAR/CORRER (a>0, b=0) avanzan por **distancia caminada**, no por tiempo.
- Datos (registros tipo 1–3 de los 166 ANM): a=0,b=0: 23 · **a=0,b>0 (por tiempo): 1155** · **a>0,b=0 (por distancia): 126** · ambos >0: 22 (p. ej. ESPOSAS1/2/3: a=60, b=25). Valores raros: `NEW(0)` de ZODIAC2 con a=-11823.
- Fotograma dentro del paso (`FUN_004E0F60`): ángulo en grados normalizado a [0,360) (`FUN_00441030`), `idx = trunc(ang·n/360 + 0.5)`, si ≥ n resta n. Con n=8 cada fotograma cubre 45° centrado en k·45°. Con n=1 (sin dirección) siempre 0.
- **Enlaces** (`FUN_004E28D0`): al terminar hacia adelante una secuencia no cíclica con `enlace2` → pasa a `enlace2` (`FUN_004E2730`, acumuladores a 0). Si se reproduce hacia atrás (incrementos negativos) y llega a ≤0 con `enlace1` → pasa a `enlace1`. Ej.: `ESCALAR_EMPIEZA [ANDAR, ESCALAR_CICLICO]`: al terminar → ESCALAR_CICLICO; en reversa → ANDAR. `ESCALAR_FIN [ESCALAR_CICLICO, ANDAR]`: adelante → ANDAR; reversa → ESCALAR_CICLICO. `DESENFUNDAR [ANDAR, APUNTAR]`: adelante → APUNTAR. **[hip]** que "reversa" = desenfundar/bajar la escalera (no se vio quién envía dTiempo negativo).
- **Anclada** (tipos 9/10/11, LEON y animales): si `seq+0x70 != 0` el avance no usa dist/tiempo sino `FUN_004E2AC0`, que elige el siguiente paso comparando distancias² entre los anclajes del paso actual y siguiente (el cuerpo se desplaza según el anclaje del fotograma, sin deslizamiento de patas). Detalle fino NO LEÍDO.
- **Hotspots k** (consumidor `FUN_00591DE0`, switch sobre k): `1`,`3`,`5`,`6` posicionan emisores/efectos ligados al personaje (punteros +0x58/+0x5C/+0x60/+0x64 del objeto gráfico; p. ej. FUMAR brasa = k=5 → `FUN_00635650`); `2` guarda un desplazamiento (`[0xD],[0xE]`); `3` actúa cada 2 ciclos. Nombre/clase de cada emisor: NO LEÍDO.
- El valor `3.5f` (`0x795A94`) se pasa como dTiempo en algunos llamadores (vehículos/objetos); uso NO LEÍDO.
- Tipo 7 `[1]` del doc anterior = **NHOTSPOTS** (no "activa anclajes"); tipo 8 `[x,y,k]` = **HOTSPOT**, no anclaje; tipos 9–11 = **ANCLAJES/ANCLAJE/ANCLAJESEC**. Corrige `formats-graficos.md` §3.
- Tipo 6 = SIZESPRITE (caja w,h). Espejo = 4º argumento de SPRITE (flag en `frame[10]`).

## 2. WAD: cabecera de 400 B, campos del sprite [hecho]
- **Cabecera 400 B = `int32[100]` "tabla de ranuras de paleta"** (`FUN_005D02B0` la lee a `banco+0x128`; `FUN_005CD840` cuenta entradas ≠ -1, `FUN_005CDF70` busca la ranura de una paleta, `FUN_005CF2D0` agrega una paleta tomada de un sprite BMP 8 bpp a una ranura). Entradas = índices en la lista A de paletas; -1 = libre. Datos (245 WAD): **17** todo -1 (FONTS, GLOBAL/cursores…), **60** con prefijo válido `0 ≤ v < A` y resto -1 (CARAS, OPCIONES, GLOBAL.WAD: p. ej. `3,4,5`), **168** (159 ELEM + 9 `Fase000N`) con **basura** (volcado de memoria: punteros) que el cargador nunca considera válida (`v ≥ A`) ⇒ efectivamente sin uso. (Clasificación hecha con un script suelto en `research-c1\wh2.py`, no versionado.)
- Sprite (objeto 0x58 B, `FUN_00648000`): `+0x00` nombre[32] (**si empieza con `-` se lo quita al cargar**, p. ej. `-RUINA06.RLE` ⇒ `RUINA06.RLE`; `FUN_005D02B0`) · `+0x34` s1 · `+0x38` s3 · `+0x3C` tipo (**3 en los 11 483 RLE; basura en BMP; consumidor NO LEÍDO**) · `+0x44` basura · `+0x48` alto · `+0x4C` ancho · `+0x50` u16 bits=8 + u16 basura · `+0x54` **compresión: 4 = RLE (hay buf2), 0 = crudo** · buffers: buf1 (+0x20), buf3 (+0x24), buf2 (+0x28) · último i32 = índice de paleta (`+0x2C` pasa a ser el puntero a la paleta, `+0x30` el objeto paleta; índice inválido → sin paleta).
- Orden de campos en archivo: nombre, s1, s3, tipo, basura, (alto, ancho, bits+basura, compresión). Los `Fase000N.WAD` tienen los mismos.
- buf3 (s3 bytes): `FUN_005CF2D0` lo trata como paleta de hasta 256 × 4 B (s3/4) para sprites con bits=8. Qué sprites traen s3>0: NO verificado.

### 2.1 Sprites `.BMP` dentro de WAD (506 en total: CARAS 113, GLOBAL, OPCIONES, ELEM, texturas de `Fase000N`)
- **[hecho datos 506/506]** `len(buf1) == alto·(ancho+2) + 1`, `flag = 0`, sin buf2 (`tools/bmp_sprite_check.py`). 77 B de "extra" en 38×19 = 2·19+1, etc.
- **[hecho render]** leyendo filas de `ancho+2` bytes (los 2 últimos = relleno) con la paleta del sprite salen caras 19×38 correctas (`png/caras_aleman.png`) y las **texturas de suelo** de `Fase0001.WAD` (`SUEL000.BMP`, `GAYG*`, `CRRT*`, caminos con rombos) correctas (`png/fase1_bmp.png`). Son opacos, sin RLE. El byte final y el relleno: **[hip]** margen para el blitter.
- Uso: los `MAR0DST.BMP` los referencia el volumen `AGUA` (agua animada, §3.5); caras en el HUD (`CARAS\*.WAD`, paleta `P_FOTI10.PAL`).

## 3. Mapa: .VOL es el mapa gráfico (no el .TIL)
### 3.1 Qué archivo manda
- `MAPAnnnn.MIS` declara `.VOLUMENES MAPAnnnn.VOL`, `.SECTORES MAPAnnnn.SEC`, `.BOXTOOLTIP *.TIP`, `.WADMAP FASEnnnn.WAD`, `.ESTATICODINAMICOS CHOQnnnn.VOL` (nunca `.TIL`).
- **`NTILE`, `MAPEADO`, `.TIL` no existen como cadenas del exe** ⇒ los 5 `.TIL` (MAPA0002/3/6/7/8) **no los lee el juego** (restos del editor). Misma idea que `VOL TILE`.
- Parser del VOL de mapa: `FUN_00616830` (MAPDIMXY, MAPTABPOLYS, EXTRASPRITE) → `FUN_006159A0` (POLY, POLYRAMPA, POLYZOOM, RADIO, POINT, EXTRAINFO, TILE, TILEID). Parser de `CHOQ*.VOL`: `FUN_006178A0` → `FUN_00617580` (POLY, RADIO, POINT, TILE, EXTRAINFO); allí **TILE y EXTRAINFO son no-ops** (`FUN_00611D50`, `FUN_006126B0` = `ret`): los CHOQ son solo colisión.
- Conteos en los 18 .VOL (8 CHOQ + 10 MAPA): TILE 24 236 · POINT 12 238 · POLY 3 298 · EXTRAINFO 3 397 · RADIO 694 · POLYRAMPA 99 · TILEID 35 · EXTRASPRITE 79. POLYZOOM: 0 usos.

### 3.2 Sintaxis y significado [hecho]
```
MAPDIMXY w,h                     ; tamaño del mapa en píxeles (MAPA0000: 2700,2100)
POLY "nombre",cx,cy,cz,altura,#vért,#tiles
POLYRAMPA "nombre",cx,cy,cz,altura,alturaOff,#vért,#tiles
POINT x,y                        ; vértices de la base, RELATIVOS al centro (float x,y en obj+0x20, 8 B c/u)
RADIO r                          ; si #vért = 0 el volumen es un cilindro de radio r
EXTRAINFO b0..b7                 ; 8 bytes en obj+0xFC..0x103 (semántica NO LEÍDA)
TILE x,y,w,h,sx,sy,g,"sprite","flags"
TILEID ... ,"sprite","flags","id"
EXTRASPRITE "x.RLE"              ; precarga de sprites
```
- **TILE** (`FUN_00614040`→`ClassTile` ctor `FUN_00613230`): **(x,y)** = posición destino en el mapa en píxeles, **(w,h)** = tamaño, **(sx,sy)** = origen del recorte dentro del sprite (si el sprite es RLE: `sx` se toma módulo del ancho del sprite y `w` se recorta a `ancho-sx`), `g` se lee pero **no se pasa al constructor** (en los datos: 0; -1 en 3 casos). El sprite se busca por nombre en el WAD del mapa (`FUN_005CDE70` sobre el banco `*DAT_0083FEB0`). El 2º string son letras: **`L` = 0x08, `X` = 0x10 (espejo horizontal), `Y` = 0x20 (espejo vertical)** (datos: `"   "` 21 658, `X` 1 653, `XY` 375, `Y` 305, `L` 277). `L` (0x08): NO LEÍDO el efecto (¿luz?).
- Verificación visual de la relación x,y,w,h: en AGUA, `e = x-96`, `f = y-1745` constantes; tiras con `x+w = 2700` (borde derecho del mapa) ⇒ x,y,w,h son coordenadas de pantalla de mapa. En edificios (`CASA02`: `FARO0005.RLE` en (1062,259) 107×217, sx=sy=0) y suelo (`BASE`: recortes de `SUEL0000.RLE` con sx,sy ≠ 0) el recorte funciona como se describe.
- El tipo de objeto (volumen) **POLY tiene `cz`**: AGUA -300, BASE -150, edificios 253..355 ⇒ el orden en el archivo está ordenado por `cz` creciente (suelo → edificios). Ver §5 (orden de dibujo).
- CHOQ (`FUN_00616BB0`): crea `STATICDINAMIC_<nombre><contador 5 díg>`; `altura` en +0x58, `nvert` en +0x60, **tipo +0x50 = 2 si no hay vértices (cilindro por RADIO) o 4 si hay (prisma)**.
- MAPDIMXY lo guarda `FUN_00612800` en `mapa+0x100/+0x104`.

### 3.3 Composición del mapa: verificada con render [hecho]
`py -I tools/vol_render.py MAPA0000.VOL Fase0000.wad out.png --skip-water` pinta, **en el orden del archivo**, cada TILE (recorte (sx,sy,w,h) del sprite del `Fase000N.WAD`, flips X/Y, FE = mezcla 50 %) en un lienzo `MAPDIMXY` (2700×2100). Resultado `research-c1\png\mapa0_sinagua.png`: **la isla del faro de la misión 0 sale completa y coherente** (faro, edificios con tejado azul, muros, escaleras, acantilados, rocas sueltas, muelle con grúa). Sobre los 9 mapas con WAD (0–8): el verificador comprueba que **`#tiles` de la cabecera POLY == nº de TILE leídos y `#vért` == nº de POINT** en todos los polys (MAPA0..8: 110/331/491/401/336/294/315/425/181 polys; 821/2572/4012/3542/2874/1872/1548/2862/1117 tiles). MAPA0009 no tiene `Fase0009.WAD` en `map_mp` (no probado).
- Los únicos sprites no hallados en el WAD de la fase (MAPA0000: 277 tiles) son `-EXPLO00.RLE` de los polys `<edificio>EXP1` (estado "explotado"): vive en otro banco (global/sprites), NO LEÍDO cuál.
- Los huecos negros a la izquierda del render y los escombros (`-RUINA*`) apilados sobre los edificios son **estados alternativos** (polys `*EXP1`, `*S`, ruinas) que el juego muestra solo cuando se destruye el edificio (`.CAMBIATILES [ [ .MAPA X .TILES [ a NADA ] ] ]` en la plantilla de los MIS: reemplaza la lista de tiles del volumen por otra). Para dibujar el estado inicial hay que saber qué polys arrancan ocultos: NO LEÍDO (ver `.AUTOEXPCASAS`, `.CASASFUERTES` en el MIS).
- Agua: el poly `AGUA` (cz = -300) usa `MAR0DST.BMP`, tiras (x,y,w,h) a lo largo del borde del mar; el efecto `.WATER` del MIS (`.BMP MAR01.BMP .BMPSRC MAR0SRC.BMP .BMPDST MAR0DST.BMP .TYPE 2 .SININC 1.5 .CENTERX/Y .LENGTH .SPEED`) lo anima: NO LEÍDO el algoritmo.

### 3.4 `.SEC` (magia `NIBS`): sectores de navegación [hecho, 11/11 al byte]
Cargador `FUN_005FBEA0` (hay fallback en texto `FUN_005FC4C0` si no empieza con `NIBS`; "Fichero no encontrado" si falta). Verificado con `py -I tools/sec_check.py <MISIONES>`: **las 11 archivos (MAPA0000–0009 + TUT) cierran exactamente en EOF**.
```
'NIBS' ; u32 nV ; nV x (f32 x, f32 y)                 vértices globales (en memoria 16 B c/u; +8 = z máx calculado)
lista1 ; lista2   (FUN_005F9EC0): u32 n ; n x sector
 sector = 0x24 B { u32 nverts, f32 A, f32 B, f32 C, u32 tipo, u32 ?, u32 ?, u32 flags, u32 namelen }
          name[namelen] ; [si flags&0x20: f32 f32] ; nverts x u32 índice de vértice
          plano del sector: z = A*x + B*y + C ; el cargador calcula centroide, caja XY y rango de z
grupos (FUN_005FA5F0): u32 ng ; ng x { u32 nitems, u32 namelen, name, nitems x (i32 lista(<=0:lista1, >0:lista2), i32 sector) }
pares  (FUN_005F4A40): u32 n ; n x (u32,u32)           (0 en los 11 archivos)
'TW1' ; por cada sector de lista1, por cada vértice: i32 vecino (-1 = ninguno; índice en lista1 ++ lista2)
'TW2' ; { i32 s1 ; i32 arista1 ; i32 s2 ; i32 arista2 } hasta s1 == -1   (conexiones lista1<->lista2; opcional)
'TW3' ; i32 sectores (lista1) hasta EOF (se les pone flag 0x10000; opcional)
```
- Datos (V / lista1 / lista2 / grupos / aristas TW1 / TW2 / TW3): MAPA0000 700/481/0/1/2306/0/0 · MAPA0001 1391/929/0/4/4553 · MAPA0002 1797/1232/0/6/5939 · MAPA0003 1730/1114/14/3/5525/4/41 · MAPA0004 1808/1196/2/4/5912/4/7 · MAPA0005 1200/808/0/6/3949 · MAPA0006 1251/806/0/3/4022 · MAPA0007 1435/924/8/2/4595/10/8 · MAPA0008 478/313/0/0/1530 · MAPA0009 1809/1195/2/4/5909/4/7 · TUT 475/312/0/0/1528.
- Es **la malla de navegación/suelo** (sectores poligonales con plano de altura y adyacencia por arista), no un dato gráfico: lo usan movimiento/colisión/pathfinding (`GridSeek`, `SeekToNextSec`). Semántica de `tipo`, de los 2 u32 `?`, de `flags` (bits 0x4, 0x20, 0x10000…), de lista2 (¿niveles/pisos conectados por TW2?) y de los grupos con nombre (¿zonas como `CAMPAMENTO` de `.SENSORES_SND_ZONA`?): NO LEÍDOS.
- `MATABICHOSSECTOR .SECTORS [.XYZ …]` del MIS referencia sectores por posición (x,y,z) → coherente con z = plano del sector.

### 3.5 Otros formatos del mapa: lo poco que se vio
- **`.TIP`** [hecho datos]: texto, una caja por línea `x y w h CÓDIGO` (p. ej. `3151 1516 206 38 VABL`; códigos `FARO`, `AAGU`, `ANTE`, `VABL`…) = zonas de tooltip en coordenadas de mapa (`.BOXTOOLTIP` del MIS). Consumidor en el exe: NO LEÍDO.
- **`.ZOM`** (8 archivos): cabecera `u32 450, 450, 3, 450, 450, f32 1.0, 1.0, …`; tamaños 628 880 (M0–M4), 628 912 (M5, M7), 645 564 (M6). 628 880 − 450·450·3 (607 500) = 21 380. **[hip]** bitmap de zoom del briefing 450×450×3 B (RGB888) más una cola variable; los guiones `BRIE000n.SCR` usan `STARTZOOM/SETZOOM/…BITMAP` y los `Fase*.WAD` referencian `M0.ZOM`. **No cerrado**; no hay cadena `ZOM` en el exe (el nombre sale del script).
- **`COMANDO.FNT`** (18 215 B): arranca `10 00 01 00 00 00 01 00 00 00 fd ff ff ff fd ff ff ff 0c 00 00 00 20 33 48 00 0f 03 …`: NO LEÍDO (¿tabla de glifos con ancho/offset por carácter; las fuentes gráficas están en `FONTS\*.WAD`).
- **`.RLC`** (créditos, `FICH_*.RLC`): magia `"rlc "` + u32 (0x14C, 0x49…) y luego datos de aspecto comprimido/cifrado: NO LEÍDO.
- **`.TIL`**: ver §3.1 (no lo lee el exe).

## 4. Hallazgos para otros
- **Movimiento / animación**: la velocidad de caminata no es "velocidad de animación": el ANM define **`a` = unidades de mapa por ciclo de la animación**; el motor avanza la animación según el desplazamiento real proyectado sobre el rumbo (`FUN_00591DE0`), así que cambiar la velocidad no desincroniza los pies. El motor de movimiento debe dar `dist` a `FUN_004E28D0`.
- **Acciones del jugador / IA**: los enlaces de CHAINSEQUENCE (`ESCALAR_EMPIEZA`, `DESENFUNDAR`, `ESCALAR_FIN`…) son transiciones automáticas al terminar la secuencia: la acción solo pide el nombre de la 1ª secuencia.
- **Colisión**: los `CHOQ*.VOL` son volúmenes estáticos de colisión: prisma de base poligonal (POINT relativos al centro, altura) o cilindro (`RADIO`); el .VOL de mapa trae además POLY con `cz` y altura (volumen de oclusión/visión; ver percepción).
- **Tiempo**: 1 ciclo de juego = 1 tick = 1/20 s por defecto; las duraciones `b` del ANM están en ticks.

## 5. Orden de dibujo (z-order): lo que hay y lo que no
- **[hecho datos/render]** El mapa estático se compone bien dibujando los volúmenes **en el orden del archivo**, que viene ordenado por `cz` creciente (AGUA -300, BASE -150, edificios 253…355), y dentro de cada POLY los TILE en orden de archivo. La proyección es **isométrica ya horneada**: los TILE llevan coordenadas de pantalla de mapa (px), no hay que proyectar nada para el fondo (MAPDIMXY 2700×2100 en la fase 0).
- **NO LEÍDO**: cómo se intercalan personajes/objetos móviles con los tiles (ClassListaRender, DibuTile/DibuPoly), cuál es la clave de orden (probable: `cz`/profundidad del volumen vs. posición del sprite), cámara/scroll y conversión mundo→pantalla de personajes (hay `EXTRAINFO`, `L`, `TILEID` con id y `POLYRAMPA` con `alturaOff` sin leer).

## 6. NO LEÍDO hasta ahora (resumen)
Orden de dibujo exacto personajes/tiles, proyección y cámara/scroll, mapa de luz por píxel del blitter `FUN_00659C80` (solo la afirmación previa de 256 tablas RGB565), ClassColorFilter/NightColorFilter/PalFX, algoritmo del agua `.WATER`, `.ZOM` (solo cabecera), FNT, RLC, TIP (consumidor), semántica de `EXTRAINFO`, de `g` y de la letra `L` de TILE, del `tipo` @+0x3C del sprite, de `tipo`/`flags`/lista2/grupos del SEC, nombres de los emisores de hotspot k, uso del dTiempo `3.5f`.

## 7. Resuelto (2026-10-27): estado inicial de los edificios = sanos
Los tiles de ruinas y explosión del `.VOL` llevan un **guion inicial** (`-RUINA06.RLE`, `-EXPLO00.RLE`). El cargador del WAD quita UN guion de cada nombre de sprite y lo registra sin él (`FUN_005D02B0`), pero al leer cada `TILE` el juego busca el sprite por el nombre **exacto en mayúsculas, sin quitar el guion** (`FUN_00614040` → `FUN_005CDE70`): `-RUINA06.RLE` no coincide con nada, el tile queda sin gráfico y **no se dibuja** (el exe llama a `FUN_00522560` en ese caso). Resultado: el mapa arranca con los edificios sanos; la acción de explosión (`acExplotaCasa`, armada por `FUN_00526F50`/`FUN_005A55C0`/`FUN_004E4D70` con `.CAMBIATILES` y `.VOLTOKENLLAMAS <nombre>EXP1`; la dispara `.IMPACTOS [ .BOMBA 1 … ]`, p. ej. la bomba del zapador o un barril) es lo que cambia los tiles al destruirse.
- Esto corrige §3.3 (que atribuía los escombros a "estados alternativos" sin saber cuáles ocultar) y el render de referencia `tools/vol_render.py` (ahora aplica esta regla).
- En el mapa 0: 319 de 821 tiles quedan sin gráfico (277 `-EXPLO` en los volúmenes `*EXP1` + 42 `-RUINA` en volúmenes sanos).
- **Abierto:** en el patio de la izquierda del mapa 0 (x 560–1000, y 560–1000) el 12 % de los píxeles no lo pinta ningún tile visible. No se sabe qué lo cubre en el juego. El mar tampoco se ve: los tiles `AGUA` (`MAR0DST.BMP`) son la máscara del efecto `.WATER`, que no está implementado.

## 8. Correcciones tras la investigación Q1 de render (2026-10-28; ver `docs/research/q1-render.md`)
- **Proyección** [hecho, verificada con 19 edificios del mapa 0, mediana 0,3 px]: `px = x`, `py = 0,6428·y − 0,7660·z` (cos 50° y sin 50°); el `z` del MIS y el `cz` del VOL están en la misma escala; el `z` de un bicho sale del plano del sector (`z = A·x + B·y + C`).
- **BMP crudo = textura repetida**: el recorte (`sx`,`sy`) se toma módulo ancho y alto (`FUN_0057F770`); `SUELO01.BMP` de la poly `BASE` trae `sx`,`sy` negativos. Esto explicaba el "patio negro" del mapa 0 (error de nuestro render, ya corregido en `src/render/map.ts` y `tools/vol_render.py`; el mapa 1 también cambió). Queda ~1,2 % de píxeles sin pintar junto a cajas, sin explicar.
- `g` **sí** se guarda (`tile+0x38`) y se usa: el blitter recibe `d = g + cz_vol + zoff`; con flag `L` (0x08) recibe `d = g + 0x10`. `d` es un tope de nivel de luz por píxel, no una clave de orden. Los nombres que terminan en `EXP1` reciben `flags |= 1` (`FUN_00612820`). Esto corrige §3.2.
- Sigue sin leerse: cómo se intercalan bichos, objetos y sombras con los volúmenes al dibujar; cámara (viewport, scroll, centrado); hotspot y sombra del bicho.
