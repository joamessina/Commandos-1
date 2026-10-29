# Lectura del exe — Pathfinding / búsqueda local (`GridSeek*`, `Seek*`, `BuscadorAuxiliar`): 48 funciones, 7.5 KB (tanda 20261029-002313)

**[hecho]** leído con dirección. Importante: aparte de `TPathTool` (A* por sectores, `q1-rutas.md`) existe un **buscador en rejilla** que se usa para movimientos locales con obstáculos.

## `GridSeek` (base, `FUN_00592B30`) [hecho]
Búsqueda por **ondas (BFS en rejilla)**: rejilla de `w × h` celdas de 1 byte (`+4` datos, `+0x10` filas), celda libre = 0, visitada = número de onda. Arranca desde la celda inicial con onda 1 y expande hasta onda **254** (`0xFE`), en dos capas de a lo sumo **64** celdas por onda; a cada vecino lo valida por el virtual `+8` (`puedoPasar(celdaA, celdaB)`) y cada celda por el virtual `+4` (`esMeta(celda)`). Vecinos 4-conexos siempre; los **diagonales** solo si las dos celdas laterales ya están marcadas con onda ≤ la actual (no se corta esquinas). Al llegar a una meta guarda la celda (`+0x14/+0x18`) y la distancia (`+0x1C`) y devuelve 1; si agota las ondas, 0. `FUN_00593780` reconstruye el camino **hacia atrás por las ondas decrecientes** devolviendo un arreglo de puntos de mundo (12 B cada uno, `x,y,0`) con el centro de cada celda.
- Geometría de la rejilla (`FUN_00593230`): origen `(x0 − c, y0 − c)`, tamaño de celda `c` (`+0x3C`), dimensiones `+0x2C/+0x30` = enteros de `(x1−x0)/c`; celda ↔ mundo `x = ox + c·(i + 0.5)` (`FUN_005931F0`).
- `FUN_00593520(celda, sector)`: la celda es transitable si su centro cae dentro del polígono del sector y **a más de `0x793734` (5.0)** de cada recta de arista (margen de 5 u de las paredes de ese sector).
- `FUN_00593600`: la celda está bloqueada si algún **cuerpo** de la lista (`+0x24` cuenta, `+0x28` punteros) toca su círculo (`FUN_0057C400`, el mismo contacto círculo-cuerpo del Sim); `FUN_00593A30` recoge los cuerpos candidatos: hasta `+0x20`, excluyendo los que tienen `+0x23C & 1` y los que no tienen `…->+4 > 1` (los de masa movible).

## Subclases (todas con el mismo esquema) [hecho]
- **`SeekToPoint`** (`FUN_00504AA0` init, `FUN_00504DC0` paso): meta = la celda de un punto; el paso `A→B` es válido si ambas celdas son libres y, tras mapear las dos celdas a mundo (`×0x79BB00 − ×0x79BAF0`, corrección fina) y buscar el sector con `FUN_005F9E60`, el **rayo con filtro** `FUN_00610A10` (el mismo de las rutas) no atraviesa aristas bloqueadas. Rejilla de tamaño `radio·2 + margen`, centrada en el punto de partida; `FUN_00504FB0` es la entrada pública (usa 600² si la distancia² > 200², `0x794D30`).
- **`SeekBackToPath`** (`FUN_00505420/505570/505970`): meta = **cualquier celda alrededor de los puntos de la ruta** que quedan por delante (hasta 16 puntos, solo los que están a más de `radio·0.25` del punto actual, o el último), para volver a la ruta después de un desvío.
- **`SeekToNextSec`** (`FUN_00505BC0/505C50`): meta = celda dentro del sector A o del sector B (cruzar al siguiente sector).
- **`BuscadorAuxiliar`** (`FUN_00504730`, `FUN_005048B0`): contenedor de una lista de puntos `{x,y,z}` (12 B) con serialización de partidas (guarda/lee `n` y los puntos).

## Cómo encaja
`TPathTool` decide la cadena de sectores y los puntos de giro; los `Seek*` se usan **dentro de un sector/tramo** para esquivar cuerpos (cajas, vehículos, otros soldados) y volver a la ruta; son los "controladores" que el motor nombra `BUSCADORGOTOPUNTO`, `GotoSector`, `RegresoACamino`. El port actual no los necesita mientras no haya cuerpos móviles que bloqueen el paso.
