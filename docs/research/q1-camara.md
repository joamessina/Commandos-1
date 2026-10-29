# Q1 — Cámara y scroll del mundo (punto C)

Fuente: exe de la raíz (`py -I tools/showfn.py D:/Joaquin/research-c1/ghidra/all2 <hex>`). **[hecho]** = leído con dirección; **[hip]**; **NO LEÍDO**. Objetivo: reemplazar el atajo del visor (scroll a 600 px/s con teclas, sin límites del original, sin scroll por borde).

## Objetos [hecho]
- **Visor del mundo** `ClassVisorMundo` (ctor `FUN_006B3A50`, cuadro `FUN_006B3590`, actualización por cuadro `FUN_006B3FF0` = vtable slot 19). Campos del scroll: `+0x20,+0x24` = posición de la cámara en píxeles de mapa (float) · `+4,+8` = lo mismo redondeado (int) · `+0xC,+0x10` = tamaño de la ventana en píxeles · `+0x14` = objeto cámara (0x78 B, `FUN_005F8B80`): `+0x24,+0x28` = origen de scroll, `+0x2C` = zoom, `+0x4C`, matriz de proyección en `+0x64..+0x70` · `+0x18` = **scroll con inercia activo (vale 1 al construirse)** · `+0x1C` = velocidad máxima · `+0x28,+0x2C` = velocidad actual (x,y) · `+0x30,+0x34` = impulso pendiente (x,y).
- El mundo (`DAT_0083FEA0`): `+0x100,+0x104` = ancho y alto del mapa (`MAPDIMXY`).

## Scroll [hecho]
1. **Entrada por cuadro** (`FUN_006EDB60`, ventana del juego): lee el estado de teclado/modificadores `DAT_0083FE90` (bits 1/2/4/8 = flechas arriba/abajo/derecha/izquierda según qué método llaman; 0x30 y 0xC0 = los dos pares de modificadores, ver `ui-misiones-guardado.md` §sondeo de teclas: CTRL→`-34/-30`, SHIFT→`-27/-26`).
   - **Paso `n` por cuadro** = **16** px; con el par `0x30` = **4**; con el par `0xC0` = **32**; con ambos = **64**.
   - **Scroll por borde de pantalla**: si no hay flechas apretadas y la ventana tiene el cursor (condición por `DAT_0083FE94+0xC`, `DAT_0083D658+0x143C/0x1440`, no leída: ¿opción de scroll con mouse?), con la posición del cursor `(cx, cy)` (`FUN_0058AC80`): `cx == 0` → izquierda, `cy == 0` → arriba, `cx ≥ ancho−2` → derecha, `cy ≥ alto−2` → abajo; mismo paso `n` (16).
   - Zoom: NUM+ (`0x200`) suma el paso, NUM− (`0x400`) resta, NUM* (`0x2000`) vuelve a 1.0. Paso = **0.1** (`0x794A20`), 0.02 con el par `0x30`, 0.25 con `0xC0`, 0.4 con ambos; con zoom < 1 el paso se reduce a la mitad.
2. **Cada dirección** (`FUN_006B3CA0/3D00/3D60/3DC0` → `FUN_006B2EE0/2F90/3050/3110`):
   - Con inercia (`+0x18 ≠ 0`, caso normal): `Vmax = n·1.5` (`+0x1C`, doble `0x793830`) y **`impulso += ±n·1.5·0.125`** (`0x79A3E0`) en el eje. Con zoom < 1 el paso `n` se reemplaza por un valor entero calculado en `FUN_0070A910` (conversión float→int; qué valor exacto, no leído).
   - Sin inercia: `posición ± n` directo (`FUN_006B2AC0`) y se recorta.
3. **Integración por cuadro** (`FUN_006B2C60`, desde `FUN_006B3FF0`): el impulso se limita a ±`Vmax`; si el impulso de un eje es 0 → `v *= 0.7` (`0x795C48`, doble) y si `|v| < 1` → 0; si no → `v += impulso` (limitada a ±`Vmax`) y el impulso queda en 0. Si alguna velocidad ≠ 0: `pos += v` → `FUN_006B20D0` (guarda `+0x20/+0x24`, redondea a `+4/+8`) → `FUN_006B2120` (recorte). Si la cámara se movió, se vuelve a emitir `MSG_MOUSEMOVE` (0x2A) para que el cursor del mundo se recalcule (`FUN_006B3BE0`).
   - Con las teclas sostenidas el impulso es `n·0.1875` = **3 px** por cuadro (n=16): la velocidad sube 3 por cuadro hasta el tope `Vmax` = **24 px/cuadro** (n=16) y al soltar decae ×0.7 por cuadro. Con CTRL/SHIFT: n=4 → tope 6 (impulso 0.75); n=32 → tope 48 (impulso 6); n=64 → tope 96 (impulso 12).
4. **Límites** (`FUN_006B2120`): el origen no puede ser negativo (`x < 0 → 0`, `y < 0 → 0`) y la ventana (`ancho/zoom`, `alto/zoom`, más 0.5) no puede pasar del borde del mapa (`MAPDIMXY` pasado por la matriz de cámara, con el mapa en pantalla = `MAPDIMXY`): si `x + ancho/zoom + 0.5 > Wmapa` se corre hacia adentro; idem en y. Mismo recorte que el visor actual (0 ≤ x ≤ W − vw).
5. **Posicionar la cámara** (SETPOS del `.MIS`, "ir al personaje", HOME): `FUN_006B2630/6B26C0` ponen el **centro** de la ventana en el punto (origen = punto − tamaño/2 · zoom) y recortan con `FUN_006B2120`.
6. **Zoom** (`FUN_006B2520` → `FUN_006B23A0`): `zoom > 0`; con zoom < 1 el mínimo es `max(ancho_ventana/Wmapa, alto_ventana/Hmapa)` (no se puede alejar más que el mapa entero); el tope superior sale de dos constantes (`0x7B2744`/`0x7B2748`, floats 3.4 / 2.0, o dobles ≈2.0 / ≈3.4 según cómo se lean): **máximo exacto sin resolver**. Se vuelve a centrar sobre el mismo punto al cambiar el zoom.

## Qué hace falta para portarlo (cuando se decida)
- Reemplazar el scroll lineal de 600 px/s por la integración de arriba (16/24 px por cuadro, decaimiento 0.7). **[hip]** El cuadro es el de la interfaz (no los 20 ciclos de lógica): hay que ver la frecuencia con que corre `FUN_006EDB60` (probablemente por cuadro de dibujo, 30-60 Hz) para convertir a px/s. Hoy el visor usa 600 px/s ≈ 20-30 px/cuadro a 20-30 Hz: del mismo orden.
- Añadir scroll por borde de pantalla (cursor en el borde) y los modificadores (CTRL = lento, SHIFT = rápido).
- Zoom con NUM+/NUM−/NUM* (hoy es un selector).

## NO LEÍDO
Frecuencia de `FUN_006EDB60`; condición exacta que habilita el scroll por borde (opción del menú o ventana con el cursor); máximo de zoom; `FUN_005D0E20/5D0ED0` (aplican origen y escala a la lista de render: desplazamiento de las capas con parallax, `ClassListaRender +0x1C`); transiciones de cámara en las cinemáticas (`SETPOS/STARTZOOM/WAITZOOM`).
