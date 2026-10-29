# Agua animada (`.WATER` del MIS)

Fuente (exe de la raíz): `FUN_006BEF80` (lee el bloque), `FUN_006BE940` (ctor), `FUN_006BED80` (ciclo), `FUN_006491E0` (generador de píxeles, 1671 B), `FUN_006487D0` (tablas senoidales), `FUN_005CDE70` / `FUN_005CFEE0` / `FUN_006483B0` (buscar / clonar / copiar imagen). Estado: **[hecho]** = leído con dirección **y** el generador está verificado píxel a píxel contra el código real emulado con `unicorn` (`tools/emu_agua*.py`, 0 píxeles distintos en 12 casos). **[hip]** = hipótesis declarada.

## 1. Qué hace el efecto
El mar no es un sprite animado: es **un bitmap de 256×256 (paleta) que se reescribe entero en cada ciclo** a partir de una copia intacta de sí mismo, deformándolo con dos senos y un desplazamiento. Los tiles del polígono `AGUA` (cz −300, primer polígono del `.VOL`; 157 tiles en la misión 0) son recortes **módulo 256** de ese bitmap (`MAR0DST.BMP`, crudo en el `FaseNNNN.wad`), así que animar el bitmap anima todo el mar a la vez.

## 2. El bloque del MIS [hecho]
`FUN_006BEF80` lee por clave: `BMPDST`, `TYPE`, `SININC`, y según el tipo `VELINC`/`ANGINC` (tipo 1) o `CENTERX`/`CENTERY`/`DECAY`/`LENGTH`/`SPEED` (tipo 2). **`.BMP` (MAR01.BMP) y `.BMPSRC` (MAR0SRC.BMP) no se leen**: esos archivos no existen en ningún WAD ni en el contenedor.
- Campos del objeto: `[0]` tipo · `[1]` índice del clon-origen · `[2]` índice de `BMPDST` (el bitmap que usan los tiles) · `[3],[4]` desplazamiento (float) · `[5]` SININC · `[6]` fase acumulada · `[7]` VELINC · `[8]` ANGINC · `[9],[10]` centro · `[0xB]` DECAY (**no se usa en el ciclo**) · `[0xC]` LENGTH · `[0xD]` SPEED · `[0xE]` fase del coseno.
- **Origen = clon de destino**: `[2] = FUN_005CDE70(nombre)` busca la imagen en el banco; `[1] = FUN_005CFEE0(...)` **clona** esa imagen (`FUN_006483B0`, copia byte a byte del buffer, con sus colas) y renombra el clon `"OLVIDAME"` (para que ningún tile lo encuentre). O sea: origen = el bitmap tal como viene en el WAD (que ya es un fotograma generado: las 256 filas traen la cola de 2 bytes igual a su cabeza), destino = el que dibujan los tiles.
- Una clave ausente se lee como 0 (los defaults del ctor —centro 800,800; LENGTH 0,5; SPEED 0,04— quedan pisados), salvo `TYPE`, que no tiene rama `else`.
- `.WATER [ ]` vacío (misiones 1, 2 y `MAPF0001`): no hay `BMPDST`, el generador no hace nada (índice −1).

## 3. Ciclo `FUN_006BED80` (1 vez por ciclo lógico de 20/s, desde el paso de misión `FUN_005C47D0`) [hecho]
- **Solo corre si `DAT_00875DA8 != 0`**: el flag lo pone a 1 el ctor y cualquier dibujo que use el bitmap de agua, y lo limpia el ciclo. Si el mar no se dibujó, **ni la fase ni el desplazamiento avanzan**.
- Tipo 2 (y existe el visor, `game+0x99C != 0`): `P` = centro de la ventana en píxeles de mapa (`FUN_006B2970` = `FUN_006B1CE0(w/2, h/2)` = `w/2·zoom + origen`); `f = LENGTH·cos([0xE]) + LENGTH·0,5`; `desp += f·(P − (CENTERX,CENTERY))`; `[0xE] += SPEED`. (En la misión 0: `f` oscila entre −0,25 y 0,75; período del coseno 157 ciclos ≈ 7,9 s.)
- Tipo 1: `desp += (cos(ANGINC·π/180), sin(ANGINC·π/180))·VELINC`.
- Siempre: `fase_nueva = SININC + fase` y se pasa **`fase_nueva`** al generador (la primera llamada usa SININC). Todo se guarda en `float32`.
- Llamada: `generador(origen=[1], destino=[2], fase, &desp, tipo==2 ? 2 : 1)`. Un `TYPE` ausente deja el tipo en un valor ≠1,≠2 **[hip]** (la rama sin `else` hace `ftol` de la pila x87 vacía): el generador usa la variante 1 y el desplazamiento queda en 0 (VELINC/ANGINC ni se leen). Es el caso de las misiones 3–10; la 6 trae `VELINC 0.5 ANGINC 60` que, con esta lectura, **no se aplica**.

## 4. Tablas [hecho]
`FUN_006487D0(8.0)`: ángulo `float32` que parte de 0 y suma `0,02454369…` (=2π/256) por entrada; `s = float32(sin(ángulo))·8`; `S8[i] = trunc(s)` (byte, `0x8761C8`) y `S32[i] = trunc(s·65536)` (dword 16.16, `0x875DC8`). **Truncan hacia cero** (`RC=0xC00`), no redondean. Verificado igual al código emulado.

## 5. Generador `FUN_006491E0` [hecho, verificado por emulación]
Origen: 256×256 con **stride 256** (`fila·256 + col`): al empezar, el generador llama a `FUN_00646830` sobre la imagen de origen, que si `+0x34 ≠ w·h` **reempaqueta el buffer in situ** (copia cada fila `r` de `r·(w+2)` a `r·w`, quita las colas) y fija `+0x34 = w·h`; destino: stride **258** (256 + cola de 2 px = copia de los 2 primeros de la fila; el destino NO se reempaqueta). Bloques de 16×16 (solo es el orden de los bucles; el resultado es por píxel).
- **Tipo 2** (16.16): `p = trunc(fase·65536)`, `a = trunc(offX·65536)`, `b = trunc(offY·65536)` (enteros de 32 bits). Para el destino `dst[i·258 + j]`:
  `y = (j<<16) + S32[((p>>16) + 2i) & 255] + a` ; `k = ((p + y)>>16) & 255` ; `sx = ((i<<16) + S32[k] + b)>>16 & 255` ; `sy = y>>16 & 255` ; **`dst = origen[sy·256 + sx]`**. (Nótese la transposición y que `offX` entra en la coordenada `j` y `offY` en la `i`; la fracción de la fase acarrea al segundo término.)
- **Tipo 1** (bytes): `A = trunc(fase)`, `C = trunc(offX)`, `B = trunc(offY)`. Para `dst[r·258 + c]`:
  `u = (C + c + S8[(A + r)&255]) & 255` ; `v = (B + r + S8[(u + A)&255]) & 255` ; **`dst = origen[u·256 + v]`**.
- Si la imagen no existe (índice <0 o fuera del banco) o el flag está en 0, no hace nada.

## 6. Datos reales
| Misión | `.TYPE` | SININC | resto |
|---|---|---|---|
| 0 | 2 | 1,5 | centro (800,800), LENGTH 0,5, SPEED 0,04 |
| 3, 4, 5, 7, 8, 9, 10 | (ninguno) | 1 | VELINC 0, ANGINC 220 (no se leen) |
| 6 | (ninguno) | 0,5 | VELINC 0,5, ANGINC 60 (no se leen **[hip]**) |
| 1, 2, `MAPF0001` | — | — | `.WATER [ ]` |
Con SININC 1,5 la fase da la vuelta en 171 ciclos (8,5 s); con 1, en 256 ciclos (12,8 s).

## 7. Límites / pendientes
- **[hip]** Valor de `TYPE` ausente (§3).
- Las coordenadas de `P` y de `CENTERX/Y` se tratan como píxeles de mapa (`MAPDIMXY 2700,2100` en la misión 0; el centro 800,800 cae dentro).
- `DECAY` se lee y no se usa.
- Portado en `src/engine/water.ts` (generador, ciclo y lectura) y `src/render/map.ts` (capas agua/tierra); pruebas con valores de referencia sacados de la emulación.
