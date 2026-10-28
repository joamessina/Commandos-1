# Q1 — R2: orden de dibujo (z-order) de personajes y objetos contra el mapa

Fuente: exe de la raíz (`py -I tools/showfn.py D:/Joaquin/research-c1/ghidra/all2 <hex>`). **[hecho]** = leído con dirección; **[hip]** = hipótesis; **NO LEÍDO**.
Estado: **encontrado el mecanismo (pintor por pares entre volúmenes con capas) y la regla para dos cilindros; la regla personaje↔edificio (polígono) está leída pero sin mapear los campos del objeto.** El z-order por `y` de los pies que usa hoy el visor equivale al caso "cilindro vs cilindro del mismo z"; no alcanza para pasar detrás de un edificio.

## Quién dibuja qué [hecho]
- Cuadro: `ClassVisorMundo` `FUN_006B3590` → `FUN_00613710` (dibujo del mundo) → `FUN_005D2640` → **`ClassListaRender::Render` `FUN_005D22A0`**.
- La lista de render tiene dos listas: `+0x1C` (capas de fondo con escala propia `item+0x10`, p. ej. parallax) y `+0x14` (los **volúmenes**: edificios `ClassVolMapa` y dinámicos `ClassVolDinamic`). Cada ítem lleva su rectángulo en pantalla (enteros x,y,w,h en `+0xE4` o `+0xF8`); solo entra si se cruza con el viewport.
- Cada ítem visible se encola con `FUN_005D20C0` (**máximo 600 por cuadro**, `DAT_00840644 != 600`) → `FUN_005D1C40` lo inserta en una **lista doblemente enlazada ordenada por nivel** (`entrada+0x10`). Al final `FUN_005D14A0` recorre la lista en orden y llama a `ítem->vtable[1](dispositivo, cámara)` (el dibujo).
- Los personajes no se ordenan como sprites sueltos: cada uno tiene un **volumen de render** `.RENDERVOL [ CILINDRO [ .R 10 .H 40 ] ]` (cadenas del exe en 0x79E53C; clase `ClassVolDinamic`), y compite contra los volúmenes del mapa.

## Comparador por pares [hecho]
Para dos ítems A y B (`FUN_005D1C40` recorre los ya puestos):
1. `FUN_005D0F90(a,b)`: **0 (no se comparan)** si ambos tienen el bit 2 de `+4` y el mismo `+0x44`; o si sus rectángulos de pantalla no se cruzan; si se cruzan, sigue con la intersección de polígonos `FUN_0062DAF0` (NO LEÍDA).
2. `FUN_0062F820(a,b)` elige la regla por la cantidad de aristas `n = obj+0x1C`:
   - `n(A) ≥ 2` → `FUN_0062EF30(B, 0)`; `n(A) < 2` y `n(B) < 2` → `FUN_0062EDF0(A,B)`; `n(A) < 2` y `n(B) ≥ 2` → `−FUN_0062EF30(A, 0)`.
   - La variante de volúmenes dinámicos `FUN_006BCD10` **compara primero la capa** (`+0xE0`): si difieren, gana la menor; recién con capas iguales usa lo anterior.
3. Resultado **+1 = A se dibuja antes que B**, **−1 = después** (convención deducida de `FUN_0062EDF0`, ver abajo; el sentido exacto de cómo `FUN_005D1C40` lo usa para subir de nivel no está verificado).
4. El nivel de un ítem nuevo es **1 + el mayor nivel entre los ítems que quedan detrás de él** (reordenamiento topológico en capas); el dibujo va por nivel ascendente.

### Cilindro vs cilindro `FUN_0062EDF0(A,B)` [hecho el algoritmo; significado de los campos hip]
Con `base = obj+0x44`, `alto = obj+0xC` y, si `obj+0x14 ≠ 0` y `obj+0x18 > 0`, además `+0x18`: `techo = base + alto (+ obj+0x18)`; `ybase = obj+0x38 + obj+0x40`.
- Si `techo(A) ≤ base(B)` → **+1** (A está por debajo de B: se dibuja antes).
- Si no, y `base(A) < techo(B)` (se solapan en altura): `d = ybase(B) − ybase(A)`; `d > 0` → +1; `d = 0` → +1 si `A.+8 < B.+8` (radio/clave), si no −1; `d < 0` → −1. Es decir: **el que tiene la `y` más al sur (mayor) se dibuja después**.
- Si `base(A) ≥ techo(B)` (A encima de B) → **−1**.

### Polígono vs otro `FUN_0062EF30(P, Q, modo)` [hecho a grandes rasgos]
`P` tiene `n` rectas (a,b,c) en `P+0x4C` (12 B cada una) y un casco en `P+0x48`. Con el punto de referencia de `Q` `(Q.+0x34 + Q.+0x3C, Q.+0x38 + Q.+0x40)` y el radio `Q.+8`, se evalúa cada recta `a·x + b·y + c`: si `Q` queda del lado exterior de alguna arista, el resultado es `±1` según el signo de la componente `b` de la normal (arista que mira al sur → Q delante; al norte → detrás); si hay aristas que discrepan o `Q` está dentro de la tolerancia → 0 y se desempata por altura (`techo`/`base` como arriba) y, si sigue en 0, por el radio `+8` o por el resultado inverso. **No se mapearon los campos con los datos del `.VOL`** (¿las rectas salen de los `POINT` del polígono?).

## NO LEÍDO (R2)
Constructor y campos de `ClassVolMapa`/`ClassVolDinamic` (`+0x34..0x44`, `+0x4C`, `+0xE0`); `FUN_0062DAF0/62D7E0/62D8C0` (intersección de polígonos); cómo `FUN_005D1C40` convierte el resultado en niveles (lista manipulada en el código, solo leída por encima); `vtable[1]` de los ítems (el dibujo de los tiles); `FUN_005D0E20/5D0ED0` (desplazamiento/escala de capas); cámara y scroll (`FUN_006C54C0`, `FUN_006C41F0`, `ClassCamaraActiva`), límites y velocidad de scroll; cuándo se oculta un sprite ("Sprite's Hiding" es solo un conmutador de depuración en `ClassEngine`).

## Qué puede hacerse ya y qué no
- Ya: pasar de "ordenar por `y`" a **cilindro vs cilindro** con la regla de arriba (base/techo/`y` de pie/radio) para personajes entre sí.
- Falta para pasar detrás de un edificio: mapear los campos del polígono (siguiente lectura: el constructor de `ClassVolMapa` desde el `.VOL`, `FUN_006BC0D0` y vecinos en 0x6BC000–0x6BE000).
