# Q1 — R3: pathfinding (`TPathTool`)

Fuente: exe de la raíz, decompilado en `D:\Joaquin\research-c1\ghidra\all2` (`py -I tools/showfn.py D:/Joaquin/research-c1/ghidra/all2 <hex>`). **[hecho]** = leído con dirección; **[hip]** = hipótesis; **NO LEÍDO**.
Estado: **estructura completa del buscador (A* sobre sectores) y de sus reglas de paso; PORTADO a `src/engine/path.ts` (2026-10-28).** El suavizado se portó con un embudo estándar (el exacto no se leyó). No se probó contra el original en vivo (R6, salteada por decisión del usuario), así que ninguna ruta está comparada con la real; sí contra los 11 `.SEC` (`npm run verify:real`).

## Flujo [hecho]
`ClassAcUsuarioGoto` → `FUN_00628470(x,y,z,sector, agua, agachado)` → `TPathTool::buscaCamino` `FUN_00627490`:
1. Sector origen = `bicho+0xE4`; sector destino = `FUN_005F6C60(x,y)` si no viene dado (el destino debe estar en un sector que contenga el punto).
2. Si ya está a menos de 2 u (`d² < 4.0`, `0x7941BC`) del destino → "ignorado (ya estaba en el destino)". Si el destino coincide con el de la ruta vigente y el origen no cambió, se reutiliza.
3. `FUN_00624B90` (buscador) → cadena de sectores `{sector, índice de arista de salida, w1, w2, bits}` (0x14 B por paso). `0` = éxito.
4. `FUN_006262E0` arma los **puntos de ruta** (inicio, intermedios, destino) y llama al suavizado `FUN_00625AF0`; `FUN_00626710(i)` fija el punto actual.
5. Cada ciclo `mandaGoto` (`FUN_00629EF0`) → estado 0 `FUN_00628720`: manda al motor `BUSCADORGOTOPUNTO` (punto) o `GotoSector` (si el punto cae en un sector con arista especial); contador de atasco `+0x14`: si el motor no avanza (distancia² al punto < `0x79BD10`) lo incrementa; **a los 9 ciclos atascado re-planifica** (`FUN_006281A0`). Estados `1` y `2` = escalera/trepar (`MSGO_MOTOR_SETTREPAR/GETTREPAR`).

## Buscador `FUN_00624B90` [hecho]
Entradas: mapa de sectores, posición de inicio (x,y,z) y sector, destino (x,y,z) y sector, **filtro** (`código`, `contexto`) y salida.
- Origen o destino nulos → fallo (−1). Mismo sector → ruta de 1 paso.
- **Atajo de línea recta** `FUN_00624840`: recorre la recta inicio→destino arista a arista (`FUN_00624530`: busca la arista por donde sale el segmento); en cada arista cruzada llama al filtro y exige `(w1+w2)² ≤ largo²`. Si llega al sector destino, esa cadena es la ruta (no hay A*).
- **A\*** si la recta falla. Nodo = 0x2C B: `[0] sector, [1] g, [2] h, [3]/[4] enlaces de la lista, [5] padre, [6] arista de entrada, [7..9] w1,w2,bits`; el nodo de un sector se guarda en `sector+0x70` (un nodo por sector; se limpia al final en `FUN_006244D0`). Pool de nodos acotado (`DAT_00874E9C`); si se agota, se deja de expandir ese nodo.
  - Se saca el nodo de **menor f = g + h** (lista ordenada por `FUN_00623FF0`; ante empate sale primero el más viejo).
  - Para cada arista del sector con vecino (`+0x18 ≠ 0`): filtro → `(w1+w2)² ≤ largo²` → vecino.
  - **g(vecino) = g(nodo) + dist(punto medio de la arista de entrada, punto medio de la arista de salida) × `sector.costo(+0x1C)`**; la entrada del primer sector es el punto de inicio (`FUN_00624370`: puntos medios = (v0+v1)·0.5, `0x794660`). **h = distancia en planta del centroide (`+8,+0xC`) del vecino al destino** (`FUN_00624470`).
  - Si el vecino aún no tiene nodo: se crea y se inserta ordenado. Si ya lo tiene y el g nuevo es menor: se **actualiza el nodo sin reordenar la lista** y sin reabrirlo.
  - **Corta en cuanto genera el sector destino** (no al sacarlo): la ruta no es necesariamente la óptima.
- Reconstruye la cadena desde el destino por los padres (`FUN_00624050`).

## Filtro de aristas (callbacks) [hecho]
Dos variantes, elegidas por `FUN_00628470`: a pie (`FUN_006112B0`, contexto `{0xC, fn, agachado}`) y agua (`FUN_00611470`, contexto `{8, fn}`).
- **A pie** `FUN_00611220(ctx, sector, arista)` devuelve "bloqueada" salvo que el **vecino** cumpla: tipo ≠ 3 (DEEPWATER), sin **NTrans (0x4)** ni **NCamin (0x8)**, `FUN_00610D40(15, 20)` verdadero (escalón, abajo), y (agachado o sin **SoloAg 0x400**).
- `FUN_00610D40(subida=15, bajada=20)`: si ni el sector ni el vecino son inclinados (`flags&1`): `z_centroide_vecino` ∈ [`z_sector − 20`, `z_sector + 15`]. Si alguno lo es: se comparan los dos extremos de la arista con el plano de cada sector, mismo rango.
- **Agua** `FUN_00611410`: ambos sectores tipo 1 o 3 y vecino sin NTrans ni NCamin.
- **Márgenes** (solo si la arista pasa): por cada extremo de la arista se busca (`FUN_00577770`, BFS por vecinos en radio **11.0** = `0x7A68CC`, radio del cuerpo + 1) si hay una arista **bloqueada** cerca; `w1` (extremo 0) y `w2` (extremo 1) valen **11.0** si la hay y **4.0** (`0x7941BC`) si no; `bits` = bit0/bit1 por extremo. Entonces el **ancho mínimo de un portal es 8 (libre), 15 (pared en un extremo) o 22 (en ambos)**.
- Nota: el escalón de la ruta (+15/−20) es el mismo de `Unit` (`STEP_UP/STEP_DOWN` en `sectors.ts`).

## Puntos de ruta y suavizado [hecho en diseño, detalle NO LEÍDO]
- Cada paso aporta un **portal** (arista de salida) recortado: desde el extremo 0 se avanza `w1/largo` y desde el extremo 1 `w2/largo` (`FUN_00625750`; si el largo ≤ 1 se toma 0.49, `0x7A89C0`). Si el paso lleva el bit **4** (arista especial: escalera) el portal es un punto fijo guardado en la arista (`+0x1C..0x24`).
- `FUN_00625AF0` es un **embudo (string-pulling)** sobre esos portales con intervalos angulares (`FUN_00674B40/674E60/674CA0`, `atan2`·constante); deja los puntos de giro necesarios entre inicio y destino. `FUN_00625900` calcula el punto de cruce del rayo con el portal y le resta un desplazamiento (`+8,+0xC` de la arista) por lado. **No leí** la lógica exacta de `FUN_00674B40/6749B0/674A10`; un embudo geométrico estándar con estos portales debería dar los mismos puntos de giro, pero no está comprobado.
- Longitud total de la ruta = suma de tramos (`+0x14`).

## Qué debe construir un port
1. `findPath(start, startSector, goal, goalSector, mode)` = atajo de recta + A* como arriba, con el filtro a pie/agua y márgenes 11/4.
2. Portales recortados + embudo → lista de puntos; el comando va punto a punto con `stepBody` (llegada con la tolerancia del motor, ya portada).
3. Atasco: 9 ciclos sin avanzar → re-planificar.
4. Escaleras (aristas con bit 4, `SETTREPAR`) y `GotoSector`: no portar hasta leerlas.

## Lo leído al portar (2026-10-28) [hecho]
- **Normales de arista** `FUN_005F3D00`: `a=-(y1-y0)/L`, `b=(x1-x0)/L`, `c=-(a·x0+b·y0)`; en los 11 `.SEC` todos los polígonos son antihorarios (área > 0), así que la distancia es **positiva hacia el interior**. Los vecinos son simétricos por índice de vértice.
- **Margen de pared** `FUN_00577770`: BFS por vecinos desde el sector que se deja; en cada arista con distancia `d ∈ [-0.01, 11)` al extremo y proyección dentro del segmento (o a < 11 de un extremo) llama al filtro `FUN_00610710`: **hay pared si la arista no tiene vecino o el filtro a pie la bloquea**. Corta en la primera; no reexpande por aristas bloqueadas. Cola de 1023.
- **Costo** `FUN_00624370`: `dist(punto medio de la arista de entrada o el inicio, punto medio de la arista de salida) × sector+0x1C`; ese costo vale 1.0 para todos (lo fija el cargador `FUN_005F9EC0`). Lista abierta `FUN_00623FF0`: inserción ordenada por `f=g+h` fijada al insertar (empate: el nuevo va después).
- **Atajo de recta** `FUN_00624530`: arista de salida = primera arista con `cruz(v_i−p, d) ≥ 0` y `cruz(v_{i+1}−p, d) < 0`; `t` del cruce (0.1 si el rayo es casi paralelo). Éxito si `t > 1`.
- **Avance de punto**: no hay lógica propia de distancia; el motor avisa `msgPuntoAlcanzado` (`FUN_00628C40`) al llegar (d² < 1) y entonces `FUN_00626810` pasa al punto siguiente (`FUN_00626710(i+1)`); si el punto alcanzado es el destino final la ruta termina. **Contador de atasco** (`FUN_00629EF0`): suma 1 cada ciclo en que la posición cambió menos que `1e-4` (d²), **sin reiniciarse mientras se mueve**; a los 9, `FUN_006281A0` (no leída).
- **Sector por vecinos** `FUN_005F9E60`→`FUN_005F6F70`: si el punto queda del lado interior de todas las aristas es ese sector; si no, recursión por los vecinos (primero por las aristas que lo dejan afuera, luego las otras) con sello contra bucles; si falla, búsqueda global. Es lo que permite subir a un puente/piso B enlazado desde un A (22 aristas A→B).
- Puntos de ruta del original: uno por **cada portal** (cruce del rayo con el portal, desplazado 1 u por la normal, `FUN_00625900`), más los puntos de giro; el port emite solo giros y destino (los intermedios son colineales).

## Cierre del punto E (2026-10-28) [hecho]
- **No existe el re-plan.** `FUN_006281A0` se llama `TPathTool::abandona` (cadena del propio exe): para el motor (`vtable+0x50` con la prioridad de la orden) y, si hay ruta y la distancia² al **destino final es < 100** (`0x793538`, 10 u), da la orden por cumplida (estado 2→0); si no, hace `TPathTool::reset` (`FUN_00627230`: limpia todo y vuelve a idle). El contador de atasco de `FUN_00629EF0` (9 ciclos con `FUN_00626630` < 1e-4) llama a `abandona`, **no** a un buscador. El port tenía "re-planificar hasta 3 veces" (invento mío): quitado; ahora a los 9 ciclos sin avanzar se abandona la orden.
- **Embudo**: está hecho con **intervalos angulares** en grados (`FUN_00674D00/674E60` arman `[inicio, fin, ancho]` desde un vector con `atan2·57.29578`; `FUN_00674B40` intersecta el cono acumulado con el del siguiente portal y devuelve −1/0/+1 según de qué lado quedó afuera; `FUN_006749B0/674A10` normalizan y ajustan el ancho; `FUN_00674CA0` prueba un punto contra el cono). Es el algoritmo de embudo clásico expresado con ángulos: los puntos de giro coinciden con el embudo estándar salvo en empates numéricos (cuando el cono se degenera `FUN_00625AF0` desempata comparando longitudes). Además emite **un punto por cada portal** (`FUN_00625900`: cruce del rayo con el portal, corrido 1 u por la normal de la arista hacia el sector siguiente). El port emite solo los giros y el destino (el resto es colineal).
- **Agua/buceo** (`FUN_00611470`, filtro `FUN_00611410`): la arista pasa si **ambos sectores son tipo 1 (WATER) o 3 (DEEPWATER)** y el vecino no tiene NTrans ni NCamin (sin la regla de escalón ni SoloAg); los márgenes 11/4 y bits se calculan igual con la búsqueda `FUN_00577770` usando ese filtro. Portarlo es cambiar el predicado `blocked` de `Nav` por modo.
- **`BuscadorPuntoAPunto`, `GridSeek`, `GridSeekAroundObstacles`, `SeekToNextSec`, `BuscadorRegresoACamino`, `BuscadorAuxiliar`**: no son otro planificador de rutas sino **controladores del motor** (el `BUSCADORGOTOPUNTO` que ya portamos con `stepBody`, `GotoSector` cuando el punto cae en un sector con arista especial, y movimientos locales de la IA). `AcBuscador` (enemigos) usa el mismo `TPathTool` (manda `MSGO_MOTOR_GOTO`/`GETTREPAR`). Sus cuerpos no se leyeron.

## NO LEÍDO (R3)
`FUN_00627CD0/627990` (estados escalera: ver `q1-escaleras.md`), el detalle numérico de `FUN_006749B0/674A10`, `FUN_00610A10` (rayo con filtro, usado al resincronizar), `FUN_00623E80/6242A0` (buffers) y la capacidad del pool de nodos (`DAT_00874E9C`). Cerrados: avance de punto (por `msgPuntoAlcanzado`), re-plan (no existe), `GridSeek*` (controladores del motor).

## Cierre del embudo (2026-10-29) [hecho en estructura; transcripción literal no necesaria]
- **Intervalo angular** (`FUN_00674D00` ctor, `FUN_006749B0` ancho): `[a0, a1]` en grados (`atan2·57.2958`, `0x793900`), ancho `w = norm(a1 − a0)` con `norm` = módulo 360 (`FUN_00441030`) llevado a (−180, 180] (`FUN_0048AD30`: si ≥ 180 resta 360); **`w < 0` = intervalo vacío**.
- `FUN_00674A10(intervalo, ang)` clasifica un ángulo: **0 = dentro**, **−1 = antes de `a0`**, **+1 = después de `a1`** (con el caso de cruce de 360° resuelto por el lado más cercano); un intervalo vacío devuelve −1. `FUN_00674CA0(punto)` = lo mismo con el ángulo de un punto (`atan2`).
- `FUN_00674B40(A, B)` **recorta `A` con `B`** (intersección): si `B` empieza después de `A.a0` sube `A.a0 = B.a0` (devuelve +1), si `B` termina antes de `A.a1` baja `A.a1 = B.a1` (devuelve −1), recalcula el ancho y devuelve 0 si queda no vacío (si `B` es vacío, `A` pasa a ser `B`).
- **Embudo `FUN_00625AF0`** (para cada punto de giro): desde el ancla actual (`x,y,z`) toma el cono hacia el primer portal (`FUN_00625750` → extremos izquierdo/derecho del portal recortados y su centro; en escaleras, el punto fijo de la arista), y para cada portal siguiente recorta el cono; en cada portal recuerda el último extremo derecho/izquierdo que sigue visible (`f0/108…` y `114/fc…`). **Cuando el cono se vuelve vacío** el punto de giro es el extremo recordado del lado que lo cerró (si ambos extremos colapsan a la vez, se elige el más lejano al ancla comparando sumas de distancias²); ese punto pasa a ser el ancla y se reescribe la lista (`FUN_00625900` calcula el cruce del rayo ancla→punto con el portal y le resta el desplazamiento `(edge+8, edge+0xC)`). Al terminar los portales se prueba el destino contra el cono.
- Es el algoritmo de **cuerda tensada (string-pulling)** con conos angulares: da los mismos puntos de giro que un embudo estándar (izquierda/derecha) salvo en casos degenerados (portales colineales con el ancla). Por eso `path.ts` (embudo estándar + recorte de portales + desplazamiento de arista) es equivalente; las discrepancias esperables son sub-píxel en rectas casi alineadas.
- `FUN_00610A10`, `FUN_00623E80/6242A0` y la capacidad del pool (`DAT_00874E9C`) son infraestructura (rayo con filtro para resincronizar, buffers): no cambian la ruta devuelta.
