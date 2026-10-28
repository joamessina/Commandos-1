# Q1 render: proyección, orden de dibujo, fidelidad del mapa (R2 + R5)

Marcas: **[hecho]** = leído en el exe (dirección) o medido en los archivos reales; **[hip]** = hipótesis; **NO LEÍDO** = sin evidencia.
Scripts nuevos (prefijo `q1b_`): `tools/q1b_crop.py` (recorta PNG + marcas, sin PIL), `tools/q1b_vol_wrap.py` (copia de `vol_render.py` con textura BMP repetida). Los de ajuste están en el scratchpad (no versionados): se describe el método abajo.

## 0. Resumen (lo que se cerró y lo que no)
| punto | estado |
|---|---|
| **R2.1 mundo→pantalla** | **[hecho, empírico, 93 volúmenes]** `px = x` ; `py = 0.6428·y − 0.7660·z` (= `cos 50°`, `sin 50°`), sin offset. Error medido: edificios ±3 px en Y y ±3 en X. Las constantes `cos50°`/`sin50°` (float) existen en `.rdata` (0x7A5B00, 0x7A9350) y el código de picking compara la matriz de cámara contra `m[0]=1`, `m[4]=cos50°` (0x5F7DC7). Falta ver el **constructor** de la matriz (NO LEÍDO). |
| **R2.2 orden de dibujo** | **Parcial.** Hecho: cada tile se pasa al blitter con un "nivel" `d = g + cz_vol + zoff_dispositivo` (o `g + 0x10` si flag `L`); el blitter lo usa para elegir tablas de luz por píxel, **no** como painter. Orden entre personajes y tiles: **NO LEÍDO** (no se encontró la lista de render que intercala sprites móviles). |
| **R2.3 cámara** | **NO LEÍDO** (solo se vio que el origen de scroll vive en `cam+0x30/+0x34` y que `cam+0x48 != 0` activa zoom, `+0x40/+0x44` es el origen del modo zoom). |
| **R2.4 hotspot/sombra** | **NO LEÍDO** (no se llegó). Ver "Para el port" abajo. |
| **R5a patio negro** | **RESUELTO: es un bug de NUESTRO render, no del juego.** Los tiles `SUELO01.BMP` (y todo BMP) son **textura repetida**: `sx`,`sy` pueden ser negativos y se toman módulo (ancho, alto) del sprite. Con esa regla el negro del patio baja de 16,2 % a 1,2 %. |
| **R5b `L`, `g`, EXTRAINFO** | `g` y `L` resueltos (ver §4). EXTRAINFO: NO LEÍDO el consumidor. |
| **R5c luz/filtro** | Hecho solo el mecanismo (17 tablas RGB565 elegidas por un byte por píxel). Si la misión 0 usa tabla distinta de la identidad: **NO LEÍDO**. |

## 1. Proyección mundo→pantalla (R2.1)
### 1.1 Fórmula
```
px = x                                   (x del .XYZ / del centro cx del POLY)
py = y * 0.6428 - z * 0.7660             (0.6428 = cos 50°, 0.7660 = sin 50°)
```
`(x,y,z)` = `.XYZ [x y z]` del MIS, o `(cx,cy,cz)` + POINT relativos del `POLY`. `(px,py)` = píxel del mapa renderizado (el mismo espacio que `TILE x,y` y `MAPDIMXY`). Es proyección oblicua: X no se toca, Y se comprime por cos50° y la altura Z sube por sin50°.

### 1.2 Cómo se midió [hecho]
Método (script de ajuste en el scratchpad, reproducible con `vol_render.parse_vol`):
1. De `MAPA0000.VOL` se toma cada POLY con ≥3 POINT y tiles visibles (no `-`): `(cx,cy,cz)`, esquinas de la base `(cx+px, cy+py)` y la caja de píxeles de sus tiles.
2. Regresión lineal libre de `y_pantalla_abajo` contra `(cx,cy,cz,1)` sobre 93 volúmenes (sin AGUA/BASE): `0.003·cx + 0.634·cy − 0.771·cz + 40`, y para el centro X: `1.001·cx`. Los coeficientes 0.634/0.771 y 1.0 delatan cos/sin(50°).
3. Con la fórmula fijada, para la **esquina de base más baja en pantalla** `max(0.6428·(cy+py) − 0.766·cz)` contra el borde inferior de los tiles del volumen, **sin offset**:

| volumen | cz | error Y (tile_abajo − predicho) | error X izq / der |
|---|---|---|---|
| FARO01 | 310 | +2,2 | 0 / +3 |
| CASA01 | 310 | +0,3 | 0 / +1 |
| CASA02 | 310 | −1,0 | 0 / −1 |
| CASA03 | 355 | −2,1 | −1 / +3 |
| CASA06B | 254 | +1,1 | 24* / +1 |
| ANTENA | 462 | +2,6 | +2 / +2 |
| ANTI01/03/05 | 254–310 | +1,1 / +1,3 / +0,2 | +2/+1 |
| NONAME 254 (muros, ~20 volúmenes) | 254 | −2,8 … +1,0 (mediana ≈ −1) | ≈0 / +1 |

(*) outliers en X son volúmenes cuyo tile más a la izquierda es un voladizo/sombra. Hay NONAME aislados con error mayor (−46, −32, −23: sprites con base visible más alta que el footprint, p. ej. tejados). Los volúmenes sumergidos (cz −70…−140) tienen error de ±20: [hip] su bbox incluye espuma/sombra. **Conclusión: la fórmula reproduce la base de los edificios con ±3 px.**

### 1.3 Aplicado a los comandos de la misión 0 (MAPA0000.MIS)
| objeto | `.XYZ` | píxel de mapa `(px,py)` |
|---|---|---|
| FRANCOT (francotirador) | 1696 1673 160 | (1696, 952,8) — sobre el acantilado, plausible (z alto) |
| LANCHERO | 409 1800 70 | (409, 1103) — borde del agua, izquierda |
| COMANDO | 2089 1703 0 | (2089, 1094,6) — en el mar, a la derecha del muelle |
| BOMBA4 (aliado) | 1161 1990 255 | (1161, 1081,3) |
Nota: la comprobación visual de estos 4 puntos es solo de plausibilidad (el sprite del bicho no está dibujado en nuestro visor). La validación fuerte son los 93 volúmenes. Sin la proyección (usar `py = y`) los comandos caen en el mar: lo que se vio en la prueba inicial era ese error.

Observación [hecho datos]: las z típicas del MIS (255, 310, 160, 70, −70…) coinciden con los `cz` de los volúmenes (254, 310, 355, 70, −70…): **z del MIS y cz del VOL están en la misma escala**.

### 1.4 Inversa (cursor→mundo) [hecho, estructura]
`FUN_005F70C0` (picking, 2566 B) recibe una matriz 3×3 `m[0..8]` con `sx = m0·x + m3·y + m6·z`, `sy = m1·x + m4·y + m7·z`, profundidad `m2·x+m5·y+m8·z`, y resuelve el punto del mundo cuyo `z` cae en el plano del sector (`FUN_005F6C60`, `sector+0x20/0x24/0x28` = plano A,B,C: `z = A·x + B·y + C`). `FUN_005F7D50` es el atajo para la cámara estándar (compara `m[0]≈1` y `m[4]≈cos50°`, 0x5F7DC7) usando `FUN_005F5590`. Llamador de UI: `FUN_0053DEF0` (cursor, guarda posición mundo en `obj+0x150..0x158` y sector bajo el cursor en `+0x170`). Consecuencia para el port: **el z de un personaje sale del plano del sector** en el que está, y el píxel sale de §1.1.

## 2. Orden de dibujo (R2.2)
### 2.1 Lo leído [hecho]
- Volumen de mapa (`ClassVolMapa::Draw`, `FUN_006BC690`, y variantes `FUN_006BC920`; `ClassVolDinamic/Dibu*`: `FUN_006BCED0`, `FUN_006BD2B0`): recorre el array de tiles del volumen (registro de **0x58 B** en `vol+0xE0`, cantidad en `+0xDC`) **en el orden del archivo**, descarta los que no cruzan el rectángulo de recorte (`FUN_00585620`: origen de cámara `cam+0x30/0x34`), y llama al blitter del dispositivo (`FUN_00580910`, 9 args, elige entre `FUN_00658420` sin mapa, `FUN_0057FB80` sprite RLE, `FUN_0057F770` sprite BMP). Posición en pantalla = `(tile.x − cam.x, tile.y − cam.y)` (ya proyectada, nada que calcular); con zoom (`cam+0x48 != 0`) usa `FUN_006BBAB0`.
- Argumento de "nivel" por tile: `d = tile.g + vol.cz_base(+0xD4) + disp[9]` (`disp[9]` = `render_ctx+0x24`); si el flag del tile tiene `L` (bit 0x08): `d = tile.g + 0x10`. Los tiles de un volumen llevan además el puntero de volumen `vol+0xF4/+0x110` (callback post-dibujo).
- Qué hace `d` en el blitter [hecho 57F770/57FB80]: arma una tabla de 16 punteros `T[k] = FUN_006459C0( min( max(L, d), max(k, d) ) )` con `k = 0..15` y `L = mapa[3]`; `FUN_006459C0(n)` construye/cachea una **tabla de 256 entradas RGB565 (0x200 B)** por nivel `n` (0..16; 16 = identidad guardada en `+0xA4`). El blitter (`FUN_00518910` BMP, `FUN_0065A3E0` RLE) recibe las 16 tablas y un **mapa de bytes por píxel** (`mapa[0]` base, `mapa[1]` stride): el byte `k` del píxel destino elige `T[k]`. Es decir, `d` NO es una clave de ordenamiento: es un tope de **nivel de luz/sombra** por píxel (mecanismo de "mapa de luz por píxel con tablas RGB565" mencionado en graficos-mapa §6). Que `d` se pase tal cual (valores 253..462) a `FUN_006459C0` que solo acepta 0..16 queda **sin explicar** (puede que `FUN_006459C0` sature; NO LEÍDO el cuerpo completo).
- Dentro del volumen: tiles pintados en el orden del archivo (verificado con render, ya documentado en graficos-mapa §3.3/§5). Entre volúmenes: orden de archivo = `cz` creciente (AGUA −300, BASE −150, …, ANTENA 462).

### 2.2 NO LEÍDO (lo que falta para I8)
- Dónde se intercalan bichos/objetos/sombras con los volúmenes: no se encontró el bucle de `ClassListaRender` (su único método visible es el destructor `FUN_005D2B40`) ni el llamador de `ClassVolMapa::Draw` (se invoca por vtable). Candidatos para continuar: `ClassVisorMundo` (vtable 0x7B1C5C… slots en 0x6C4EC0–0x6C5B10), `FUN_00591790` (actualizador por cuadro del objeto gráfico), `ClassRenderDevice2d` (0x63FE30–0x641D00).
- Clave de orden y regla de oclusión por volumen (`.OCLU`, `ClassVolDinamic`): NO LEÍDO.
- **[hip, no verificada]** como el mapa estático ya está ordenado por `cz` y la proyección usa `z` en el eje Y de pantalla, lo más probable es que un bicho se ordene por su `(y, z)` proyectado (sprite más abajo = más adelante) contra el `cz` de cada volumen; no hay evidencia directa. Para el port inmediato (I8) se puede hacer: dibujar al personaje después del volumen de mayor `cz` cuya caja de base lo contenga o por `py` de pie; marcarlo `shortcut`.

## 3. Cámara y hotspots (R2.3, R2.4): NO LEÍDOS
Solo se vio: origen de scroll `cam+0x30,+0x34` (enteros, píxeles de mapa), `cam+0x40/0x44` origen en zoom, `cam+0x48` flag de zoom, `cam+0x60` parámetro pasado a los blits con zoom (`FUN_00580A30`). Tamaño de viewport por resolución, límites y velocidad de scroll: no encontrados. El `MAPDIMXY` es el tamaño del lienzo (2700×2100 en misión 0).
Para el hotspot del bicho: el sprite del ANM se posiciona con `(x,y)` del `HOTSPOT`/SPRITE `hx,hy` (graficos-mapa §1); lo natural dada §1 es que el punto del mundo proyectado `(px,py)` coincida con el hotspot (pie) del fotograma, pero **no se verificó** (hay que mirar `FUN_00591DE0`, que pone `obj+0x58..0x64`).

## 4. R5: fidelidad del mapa
### 4.1 Patio negro: causa y arreglo [hecho, verificado con render]
**Causa**: `vol_render.py` (y por eso el visor TS `src/render/map.ts`, si copia la regla) trata los sprites BMP como recortes lineales. En el exe (`FUN_0057F770`) el recorte BMP se **repite**: `src_x = (sx_efectivo) mod ancho_sprite`, `src_y = ... mod alto_sprite` con corrección de negativos (`si v<0: v = N − (−v mod N)`), y el blitter (`FUN_00518910`) recibe los pasos de envoltura; el stride de fila es `ancho+2`. Los tiles del patio son `SUELO01.BMP` de la poly `BASE`, con **`sx`,`sy` negativos** (p. ej. `TILE 685,579,21,19,-24,-134,0,"SUELO01.BMP"`), que el render lineal descartaba (`if not 0 <= sy < sh: continue`).
**Prueba**: con módulo para BMP (`tools/q1b_vol_wrap.py`) la zona x 560–999, y 560–999 pasa de **16,2 %** negro (31 292 px) a **1,2 %** (2 268 px); el recorte (`png/mapa0_wrap.png` completo) muestra el patio con suelo de arena y muros continuos. El 1,2 % restante son parches negros pequeños junto a las cajas del patio [hip: sombras de caja con alfa o tiles `-RUINA`/`-EXPLO` (ocultos) bajo ellas; los 2 268 px quedan bajo tiles de `CASA08EXP1`/`ANTI02EXP1`/`ANTI03EXP1` ocultos y `CAOC000x.RLE` visibles; no se identificó cuál los pinta]. Los tres arreglos para el port: aplicar el módulo a todo sprite sin RLE (compresión 0) y reportar el 1,2 % residual como abierto.
**No** hay polígonos de otro banco, ni sectores "sin suelo": la hipótesis de agujero por diseño queda descartada (el negro era el render). No se miró `CHOQ0000.VOL`/`MAPA0000.SEC` porque la explicación bastó.

### 4.2 Semántica de `g` y `L` [hecho]
- Constructor de tile (`FUN_00613230`, orden de TILE `x,y,w,h,sx,sy,g,"sprite","flags"`; el escritor del editor `FUN_00613BE0` imprime los mismos campos en ese orden): `tile+0x38 = g` (campo [14]) y `tile+0x14 = flags` (bits `L`=0x08, `X`=0x10 espejo H, `Y`=0x20 espejo V; 0x01 se testea en `FUN_006BCED0` junto a `tile+0x48` para una rama alternativa con rotación `blit +0x20`, uso NO LEÍDO). **Corrige graficos-mapa §3.2** ("`g` no se pasa al constructor"): sí se guarda y se usa.
- `g` = **desplazamiento del nivel** del tile: `d = g + cz_base + zoff` (§2.1). En los datos g=0 salvo 3 casos (−1).
- `L` = el tile **ignora el `cz` del volumen**: `d = g + 0x10`, nivel fijo bajo (alineado con "luz" por ser el nivel 16 = identidad en la tabla de §2.1). [hip] `L` = "layer fijo / no recibe sombra del volumen". 277 tiles `L` en los 18 VOL.
- Nombres terminados en `EXP1` (`FUN_00612820`, compara los últimos 4 bytes con 0x31505845): el volumen recibe `flags |= 1` al crearse (estado "explotado" oculto). Corrobora graficos-mapa §7.
- Polys del VOL: el callback POLY (`FUN_006128E0`) guarda `altura` en `vol+0x0C` y deja `(cx,cy,cz)` como floats en `loader+0x290/0x294/0x298`; `FUN_0062EBD0` coloca los vértices (rotación `0` en el mapa).

### 4.3 EXTRAINFO [NO LEÍDO el consumidor]
Datos (MAPA0000): ceros en AGUA/BASE/NONAME; en edificios son 4–6 enteros de rango 2..26 seguidos de ceros, p. ej. `CASA07 [18,10,9,16,12,0,0,0]`, `CASA03 [26,4,9,12,18]`, `FARO01 [2,9,7,16,23,12]`, `ANTENA [4,7]`, `CASA06A [12,9,10,16]`. Parecen **ids/índices** (lista de hasta 8) y no alturas, [hip] referencias a otros volúmenes o a efectos del edificio; el parser solo los guarda en `vol+0xFC..0x103`. Hay que buscar el lector de `vol+0xFC` en `ClassVolMapa`.

### 4.4 Luz/filtro de color (R5c)
- Mecanismo [hecho]: `FUN_006459C0` genera 17 tablas de 256 entradas RGB565; `FUN_0057F770/0057FB80` las eligen por byte de máscara por píxel (§2.1). `FUN_0063FF20` devuelve el puntero/stride de la superficie destino según modo (`+0x24` = 0/1/2).
- NO LEÍDO: `ClassColorFilter`, `ClassNightColorFilter`, `ClassPalFX`, contenido real de las tablas (¿identidad o oscurecen?), y si el mapa de la misión 0 (día) usa niveles distintos de 16. El render de referencia usa colores directos de la paleta del sprite sin tabla; no se pudo comparar con el juego en vivo.

## 5. Para el port (lo que ya se puede usar)
1. Poner a un personaje: `px = x`, `py = 0.6428·y − 0.766·z` (z del plano del sector del bicho, §1.4) menos el hotspot del fotograma (NO verificado, §3).
2. Fondo: componer volúmenes del VOL en orden de archivo; **BMP con módulo** (§4.1); tiles con nombre que empieza por `-` no se dibujan (graficos-mapa §7); volúmenes `*EXP1` ocultos.
3. Ordenamiento con personajes: pendiente (§2.2).

## 6. Hallazgos para otros
- **Movimiento/sectores**: el z de un bicho = plano del sector `z = A·x + B·y + C` (`sector+0x20/0x24/0x28`); la proyección usa ese z. Confirma el uso del `.SEC` como suelo.
- **Graficos-mapa.md** debería corregirse: §3.2 (g sí se guarda y se usa; `L` = nivel fijo 0x10), §5 (la proyección NO es "ya horneada" para objetos: tiles sí, personajes/objetos usan §1.1), §7 (abierto del patio: resuelto, ver §4.1).
- **`vol_render.py` / `map.ts`**: aplicar módulo a sprites BMP (sin RLE). Ya hay una copia con el arreglo en `tools/q1b_vol_wrap.py` y la salida en `research-c1/png/mapa0_wrap.png`.
- Los `.XYZ` de los 142 MACRO del MIS y las 22 minas (`z=-70`, bajo el agua) caen en el espacio de §1.1: se pueden usar como verificación visual cuando haya sprites.

## 7. NO LEÍDO (resumen)
Constructor de la matriz de cámara; cámara/viewport/scroll; orden de dibujo bichos↔volúmenes y regla de oclusión; hotspot/sombra de bicho; cuerpo de `FUN_006459C0` para `d>16`; consumidor de EXTRAINFO y del bit 0x01 de flags de tile; tablas de luz y `ClassColorFilter/Night/PalFX`; origen del 1,2 % negro residual del patio; `CHOQ0000.VOL` y `.SEC` del patio (no hizo falta).


> **Nota del coordinador (2026-10-28):** las direcciones `0x7A5B00` y `0x7A9350` que este informe da para cos50°/sin50° **no contienen esos floats** (se leyó basura); la proyección `py = 0,6428·y − 0,7660·z` sí está verificada empíricamente (19 edificios, mediana 0,3 px). Buscar las constantes reales si hace falta.
