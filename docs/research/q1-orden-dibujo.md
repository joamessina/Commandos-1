# Q1 — R2: orden de dibujo (z-order) de personajes y objetos contra el mapa

Fuente: exe de la raíz (`py -I tools/showfn.py D:/Joaquin/research-c1/ghidra/all2 <hex>`). **[hecho]** = leído con dirección; **[hip]** = hipótesis; **NO LEÍDO**.
Estado: **mecanismo, convención de signo y regla personaje↔edificio completos (ver "Resolución" al final, 2026-10-28)**; falta solo la prueba de intersección de contornos en pantalla (D7E0/D8C0) y el orden de inserción. El z-order por `y` de los pies que usa hoy el visor equivale al caso "cilindro vs cilindro del mismo z"; no alcanza para pasar detrás de un edificio.

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

## Resolución (2026-10-28): campos de los volúmenes y regla exacta [hecho]
**Cómo nace un volumen de edificio** (callback `POLY` del `.VOL`, `FUN_006128E0`; `POLYRAMPA`, `FUN_00612A20`): `new ClassVolMapa` (0x108 B, `FUN_006BD620`), nombre (`FUN_006BBC80`), `+0xC = altura` (cuarto número de la cabecera `cx,cy,cz,alt`), reserva de vértices (`FUN_0062E9F0`: `+0x1C` cantidad, `+0x20` puntos locales 8 B, `+0x24` rectas locales 12 B, `+0x48` puntos de mundo, `+0x4C` rectas de mundo), `RADIO r` → `+8`, cada `POINT x,y` llena `+0x20`, `EXTRAINFO` → bytes `+0xFC..0x103`. Al cerrar el POLY (`FUN_00612820`): `FUN_0062F870` calcula centro del bbox local (`+0x34,+0x38`), el radio circunscrito (`+8` = mayor distancia al origen) y la **recta de cada arista `a=(y2−y1)/L, b=−(x2−x1)/L, c=−(a·x1+b·y1)`**, y `FUN_0062EBD0` coloca el volumen: `+0x3C,+0x40 = (cx, cy)`, **`+0x44 = cz`**, puntos de mundo = centro + locales, recta de mundo con `c' = −(a·xw + b·yw)`. `POLYRAMPA` además pone `+0x14 = 1` y `+0x18 = max(altOff, −alto)`. Luego `FUN_005D1030` lo mete en la lista de render y `FUN_0062DC50` arma el **contorno en pantalla** (`+0x50` cantidad, `+0x54…` puntos; para cilindros un rombo de 4 puntos) que usa el prefiltro.
**Los 2703 POLY con ≥3 puntos de los 10 mapas son antihorarios (área > 0)**, así que `(a,b)` apunta hacia **afuera** y `d = a·x+b·y+c > 0` = punto fuera de esa arista (coherente con cómo lo usa el código). Hay 518 POLY con < 2 puntos: se comportan como cilindros (`RADIO`).
**Volumen dinámico** (personaje): `+8 = R` (10), `+0xC = H` (40), `+0x3C,+0x40 = x,y`, **`+0x44 = z del suelo`** (plano del sector), `+0x1C = 0` (sin vértices → rama "cilindro"); `FUN_006BCDA0` lo posiciona cada cuadro (rect en pantalla `+0xF8/+0xFC` + tamaño `+0x100/+0x104`, capa `+0xE0`).
**Convención de signo (cerrada con `FUN_005D1C40`)**: `FUN_0062F820(A=nuevo, B=ya puesto)`; **+1 = A se dibuja ANTES (detrás) de B**; −1 = A después → su nivel pasa a `nivel(B)+1`. Se dibuja por nivel ascendente.
**Regla polígono P (edificio) contra cilindro Q (personaje)** = `FUN_0062EF30(P,Q)` (si el que viene primero es el cilindro se llama con los roles cambiados y se niega el resultado):
1. Centro de Q = `(Q.+0x34+Q.+0x3C, Q.+0x38+Q.+0x40)` (para un cilindro `+0x34/38` valen 0 → su posición). Por cada arista de P: `d = a·cx+b·cy+c`. Si `d > 0` (Q fuera de esa arista): `fuera=true` y `v_ult = (b ≥ 0 ? +1 : −1)`; ante un `−1` ya no se actualiza.
2. Veredicto de aristas **V**: de las aristas con `d > R` (Q enteramente afuera por más del radio), `V = signo(b)` (+1 si `b ≥ 0`); si dos de esas aristas discrepan, `V = 0`. (Para Q cilindro las aristas con `d ≤ R` no cuentan.)
3. Veredicto de altura **H**: `techo(X) = X.+0x44 + X.+0xC` (más `X.+0x18` si es rampa y ese valor es < 0). Si `Q.base > techo(P)` → **H=+1** (Q encima: P va antes); si `techo(Q) < P.base` → **H=−1** (Q debajo: Q va antes); si no, H=0.
4. Resultado: si `V ≠ 0`: si `H ≠ 0` y `H ≠ V` → **0 (sin relación)**, si no `V`. Si `V = 0`: si `H ≠ 0` → `H`; si `H = 0`: con Q dentro del polígono (ninguna arista lo deja afuera) → comparar radios (`Q.R < P.R` → −1, si no +1); con Q fuera pero sin veredicto → `v_ult`.
**Cilindro contra cilindro** (`FUN_0062EDF0`): ya descrito arriba (altura, luego `y` de los pies, luego radio).
**Prefiltro** (`FUN_005D0F90`): no se comparan dos volúmenes si ambos tienen el bit 2 de `obj+4` y el mismo `+0x44`, ni si sus rectángulos de pantalla no se cruzan, ni si sus contornos (`+0x50…`) no se cortan (`FUN_0062DAF0` = algún vértice de uno dentro del otro o aristas que se cruzan, `FUN_0062D7E0/62D8C0`; **[hip]** no leídas a fondo).

### Lo que implica para el visor
- Los `POLY` del `.VOL` son **planos horizontales a la altura `cz` con espesor `alt`**, cuyo `(cx,cy)` es la proyección en ese plano (por eso `py = 0.6428·y − 0.766·z` los coloca bien). Un personaje en el suelo (`z` bajo) queda **debajo** (H=−1, se dibuja antes) de cualquier techo/volumen de `cz` mayor cuyo contorno en pantalla lo toque; si además su centro cae fuera de todas las aristas del lado sur el veredicto V=+1 contradice a H y queda sin relación (se dibuja en el orden de inserción, es decir después = por delante). Detrás del edificio: Q dentro del polígono → `H` manda → el edificio lo tapa.
- Para portarlo hay que separar el mapa en capas por `POLY` (hoy está compuesto en un solo lienzo): dibujar fondo, y por cada personaje los polys que lo tapan por encima. Los tiles de cada POLY ya están agrupados en `vol.polys[i].tiles`.
- **Sin leer**: orden de inserción de la lista (estáticos primero o por `cz`), el significado del bit 2 de `obj+4`, la capa `+0xE0`, `FUN_0062F2E0` (rampas), y los contornos `FUN_0062D7E0/62D8C0`.
