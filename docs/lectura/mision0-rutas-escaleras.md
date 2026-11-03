# Misión 0: costo y filtro de las escaleras en rutas

Lectura estática de `coman_mp.exe` de la raíz y contraste con `MAPA0000.MIS` de `WAR_MP.DIR` de la raíz. `[hecho]` indica una operación comprobada; no significa que el port ya la implemente ni que se haya observado una partida original.

## Instancias reales [hecho]

`node --experimental-transform-types tools/mision0-aristas.ts` lee directamente el contenedor y muestra los bloques. Las coordenadas son del mundo; la caja, cuando existe, es de selección en pantalla.

| Token | Pie `(x,y,z)` | Arriba `(x,y,z)` | Caja explícita | Buzo |
|---|---|---|---|---|
| ESCALA01 | 882, 2543, 0 | 872, 2516, 70 | 865, 1567, 27, 65 | 0 |
| ESCALA02 | 1911, 939, 355 | 1898, 920, 462 | 1892, 240, 23, 91 | 0 |
| ESCALA03 | 2078, 1706, 0 | 2070, 1695, 65 | no | 1 |
| ESCALA04 | 447, 1730, 70 | 454, 1722, 165 | no | 0 |

La caja ausente no significa que no sea seleccionable: `FUN_004A75F0` la calcula a partir de la arista (`q1-escaleras.md` §4). La disponibilidad posterior también depende del estado de la escalera, por ejemplo ESCALA02 tras la destrucción de CASA04.

## Filtro de rutas de soldados [hecho]

1. `FUN_006283D0` (`fn_00600000.c:25791`) construye un contexto de 0x1c bytes: callback `0x40FDFD` y flag `param_6` en el offset 0xc. El salto `0x40FDFD` lleva a `FUN_00611030`, no a `FUN_006112B0`, usado por el camino a pie de `FUN_00628470`.
2. En `FUN_00611030` (`fn_00600000.c:11616`), contexto+0xc cero usa `FUN_00610F00`; distinto de cero usa `FUN_00610F80`. Este último sustituye los umbrales normales de subida y bajada por 1 000 000 **solo si `arista+0x14 & 2`** (`0x610F83–0x610FA8`); en el resto conserva +15/−20. El destino sigue sujeto a las demás restricciones: no agua profunda, `sector+0x48 < 1`, sin NTrans, NCamin ni SoloAg (`FUN_00610F80`, `fn_00600000.c:11585`). No interpretar el gran umbral como permiso para atravesar cualquier muro.
3. El mismo callback mide las dos puntas con `FUN_00577770` y el filtro ordinario `FUN_00610F00`. Los márgenes son 4 o 11 por punta; además de sus bits 0 y 1, si `arista+0x14 & 2` añade **bit 4 al registro de ruta** (`FUN_00611030`, líneas 11654–11692). Son bits en estructuras distintas: bit 2 de la arista y bit 4 del resultado.
4. La búsqueda recta/A* exige que la suma de márgenes no supere el ancho del portal (`FUN_00624B90`, `fn_00600000.c:23640–23655`). El bit de escalera no elimina por sí solo esta prueba.

## Costo [hecho]

En `FUN_00624370` la decompilación omite la mayor parte de la aritmética de punto flotante. El ensamblador `0x624370–0x624430` muestra que toma el punto medio XY de la arista de entrada (o el punto inicial en el primer sector), el punto medio XY de la salida, calcula la distancia euclidiana y multiplica por `sector+0x1C`. La constante `0x794660` es 0,5 en doble. No añade altura ni un recargo específico por la escalera en esa función. El cargador pone costo 1,0 por sector, como ya constaba en `docs/research/q1-rutas.md`.

`FUN_00624B90` suma ese resultado a `g` (`fn_00600000.c:23655–23656`). Por tanto el comentario del port que pide leer el costo antes de mejorar rutas de escalera está desactualizado: **el cálculo ya era conocido y quedó comprobado nuevamente en asm**. Esto no demuestra que una ruta concreta sea siempre óptima: la búsqueda tiene atajo recto y su criterio de parada descritos en `q1-rutas.md`.

En la construcción de puntos, una arista especial usa el punto guardado en la arista (`FUN_00625750`); después `FUN_00626710/00626810` ajustan los puntos a ambos lados usando la normal y 10 unidades, y `FUN_00627990` ejecuta el trepar. El costo A* usa los **puntos medios de aristas**, no necesariamente ese punto fijo de trepada. Confundir ambas posiciones cambiaría la elección de ruta.

## Diferencia respecto del port y límite

`src/engine/unit.ts` primero busca ruta solo a pie y prueba una sola escalera únicamente si esa ruta falla; compara recorridos separados y no integra las aristas especiales en `src/engine/path.ts`. Esto no reproduce la selección del original cuando compiten varias rutas o hay más de una escalera. Para portarlo queda conectar las aristas reales al grafo, conservar el filtro y márgenes del callback de soldados, la reconstrucción especial y las restricciones de estado; luego contrastar recorridos reales, incluida la desactivación. No se ejecutó el original para comparar recorridos.
