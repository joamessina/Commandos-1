# Q1 — Escaleras y trepar (con la cancelación a mitad de camino)

Fuente: exe de la raíz (`py -I tools/showfn.py D:/Joaquin/research-c1/ghidra/all2 <hex>`), datos de `ESCALA.MAC` y `MAPA0000.MIS`. **[hecho]** = leído con dirección; **[hip]** = hipótesis; **NO LEÍDO** = pendiente. Nada de esto está portado: es investigación previa a implementar (pedido del usuario, 2026-10-28).
Origen de la pregunta: en el original se hace clic en una escalera, el comando camina, sube con la animación de escalar, y **si se cancela (botón derecho) antes de terminar, queda congelado a mitad de la escalera**; con otro clic sigue o se da vuelta.

## 1. Quién interviene [hecho]
| Pieza | Dónde | Qué hace |
|---|---|---|
| Objeto escalera `ClassAcEscala` | macro `ESCALA` (`ESCALA.MAC`: `.PUNTOBAJO`, `.PUNTOALTO`, `.CAJASELECCION`, `.ESCALAUSABLEPORBUZO`, `.CARISMA 100`, `.DESENRROLLADA 1`); mensajes en `FUN_004A8830` | Se hace clic en su `CAJASELECCION` (rectángulo `[x y ancho alto]` en píxeles del mapa). Responde `MSGA_ESCALA_GETINFO` (dos punteros: `+0x30` y `+0x34`, las **aristas de sector** de abajo y de arriba), `MSGA_ESCALA_GET_PUNTOS` (dos puntos de acceso con su sector), `MSG_ACTUASOBRE` (si está en estado 2 contesta al que actúa con `MSG_SOY_UNA_ESCALA`), `MSGA_DESACTIVAR_ESCALA`, `MSGA_OBJETO_RECOGER`. |
| Acción del comando `AUEscalar` (`.CARISMA 200`) | tick `FUN_004F4180`, mensajes `FUN_004F3C70`, arranque `FUN_004F37A0`, aproximación `FUN_004F3A40` | Máquina de estados `+0x188`: 0 libre · 2 caminando hacia la escalera · 3 terminando (anim `ANDAR`) · **4 trepando**. |
| Motor `MotorAndante` (`+0x88` = 4 es "trepando", `+0x8C` = subestado) | órdenes `FUN_005DB5A0` (`MSGO_MOTOR_SETTREPAR`), consulta `FUN_005DB900` (`GETTREPAR`), movimiento `FUN_005DA440`, arranque `FUN_005D9DF0` | Hace subir/bajar de verdad. La pausa es el flag `+0x124`. |
| Sim `SimEscalador` (ctor `FUN_00668130`) | `FUN_00668060(dz)` escribe `sim+0x34 = dz` | Aplica la velocidad vertical que fija el motor. |

La escalera **no es un objeto con geometría propia**: son **dos aristas especiales de sector** (una en el sector de abajo, otra en el de arriba, con su vecino a otra altura; bit 4 de `bits` en el filtro de rutas y punto fijo en `edge+0x1C..0x24`). `.SECTORS [ [.XYZ …] [.XYZ …] ]` de `MAPA0000.MIS` (p. ej. `ESCALA02`: `(1908,934,355)` y `(1897,922,462)`) y `.PUNTOBAJO/.PUNTOALTO` las ubican. En el mapa 0 hay 4 escaleras: `ESCALA01` (0→70 de alto), `ESCALA02` (355→462), `ESCALA03` (0→65, **`ESCALAUSABLEPORBUZO 1`**, la del mar), `ESCALA04` (70→165).

## 2. El flujo completo [hecho salvo lo marcado]
1. **Clic en la escalera** → la interfaz emite `MSGA_ACTUASOBREELEMENTO` (o `…DBLCLK` si fue doble clic) a los comandos seleccionados (`FUN_00694370`, que reparte a todos los seleccionados; `…MULTIPLE…` si son varios).
2. La acción (base `FUN_00501A00`) pide a la escalera `MSGA_ESCALA_GET_PUNTOS` (dos puntos con su sector) y elige **a cuál de los dos ir** según la altura media de ambos contra la z del comando (si la media queda por debajo del comando toma el segundo punto, si no el primero; **no está leído cuál es el de arriba**). Camina hasta ahí con el movimiento normal (rutas R3) y, con la escalera activa, llega `MSG_ACTUASOBRE` [la secuencia de la aproximación es **[hip]**: se ve que la acción manda ir al punto y espera la colisión/llegada].
3. La escalera contesta `MSG_SOY_UNA_ESCALA` (con ella misma). `AUEscalar` (`FUN_004F3A40`): pide `ESCALA_GETINFO` (dos aristas) y elige una u otra según si el comando está en la mitad de abajo o de arriba de la escalera (`z_comando ≤ z_escalera + alto·0.5`), **coloca al comando pegado a la arista** (proyección sobre la arista + normal·(radio + 0.1)) y manda `SETTREPAR`.
4. `FUN_004F37A0`: dirección = **+1 (subir) si el sector vecino a la arista está a ≥ la altura del comando, −1 (bajar) si no**. Envía `MSGO_MOTOR_SETTREPAR {dir, hayEscalera, arista, ok}`. Si el motor acepta: `AUEscalar` pasa a estado 4, marca al bicho (`+0x23C |= 0x80000` = trepando; `+0x824 |= 0x4000`) y si sube lanza la animación **`ESCALAR_EMPIEZA`** (si baja, queda para el siguiente cuadro). Si el motor rechaza: la acción termina con resultado 3.
5. **Cada ciclo en estado 4** (`FUN_004F32B0`): pide `GETTREPAR` al motor y sincroniza la animación según lo que devuelve: **0** (no trepa) → la acción termina (resultado 2) · **2 (subiendo) y −3 (último tramo de bajada)** → si todavía no arrancó la animación, `ESCALAR_EMPIEZA` a velocidad 1 · **3 (remate arriba)** → `ESCALAR_FIN` a velocidad 1 (modo 2) · **−2 (bajando)** → `ESCALAR_FIN` a velocidad **−1.0** (`0x794688`: la animación se pasa al revés; modo 10) · los demás valores solo marcan que ya arrancó. En todos los casos la velocidad de animación es **0 si el flag de pausa `AUEscalar+0x1B0` está puesto**. `ESCALAR_CICLICO` no se pide desde la acción: **[hip]** sale encadenada por los enlaces de la propia `.ANM` tras `ESCALAR_EMPIEZA`. Al terminar vuelve a `ANDAR` (`FUN_004F4180`, estado 3).
6. **Motor al trepar** (`MotorAndante`, `FUN_005DA440`; el que usa el jugador): subestados `+0x8C` ↔ valor de `GETTREPAR` **6→1, 7→2, 8→3, 9→4, 10→−1, 11→−2, 12→−3**:
   - **6** gira hasta quedar de cara a la escalera (ángulo `+0x114`, termina cuando |Δ| < 0.001, `0x793228`) → 7.
   - **7** *sube*: `dz = +2.0` por ciclo (`0x795740`) mientras `z + off ≤ z_tope + 15` (`off = +0x120`, arranca en **40.0**, `0x7938DC`; o sea hasta ~25 u antes del tope, `z_tope = +0x104`); el último paso es el justo para quedar en esa marca → 8.
   - **8** *remate arriba*: `off` baja 4.0 por ciclo (`0x79BBE0`); `dz = +4.0` (`0x7941BC`) mientras `z ≤ z_tope`, y cuando ya lo pasó el paso justo para posarse en `z_tope` → 9.
   - **9** *sale por arriba*: lleva `off` hacia `+0x11C` de a 8.0 por ciclo (`0x796170`) y al llegar fija la posición de salida con `FUN_0066B350` (+2.0 en z, `0x794A70`) → estado 0 (parado). **[estructura leída; los números exactos de este tramo a confirmar]**
   - **10** *baja (arranque)*: `off` baja de a 8 hasta ≤ 15 y entonces se acerca a la arista (punto `+0xFC/+0x100`) → **11**.
   - **11** *baja*: `dz = −4.0` (`0x7A4E40`) mientras `z_origen − 15 < z` (`+0x110`), `off` sube 4 por ciclo → 12.
   - **12** *remate abajo*: `dz = −3.0` (`0x797914`) o lo justo para llegar a `+0x104` → estado 0.
   - `+0x104`/`+0x110` = alturas de llegada y de partida; el motor intercambia los puntos `+0xFC…+0x110` al dar vuelta (§3).
7. **Condición para que arranque** (`FUN_005D9DF0`): la arista debe tener sector vecino sin `NTrans`, el motor no puede estar ya trepando, el comando debe estar de cara y a menos de cierta distancia (`+0x128`/`+0x12C`, no leídas), con diferencia de alturas > umbral, y la prueba de colisión `FUN_0057E520` (no leída) debe dar libre.

## 3. La cancelación (lo que describió el usuario) [hecho]
- El botón derecho llega a la acción como **`MSG_BOTON2VIRTUAL`** (`FUN_004F3C70`):
  - **Si el comando está trepando (estado 4):** manda `SETTREPAR` con dirección **2 = pausa** y velocidad 0 y pone `AUEscalar+0x1B0 = 1` (parado a propósito). El motor (`FUN_005DB5A0` caso 2) **pone el flag de pausa `+0x124 = 1`**: `FUN_005DA440` vuelve de inmediato en cada ciclo, así que el comando **queda congelado a la altura que tenga**, y `FUN_004F32B0` pasa velocidad **0** a la animación `ESCALAR_*` (queda en el mismo fotograma). Eso es el "se queda a mitad de la escalera".
  - **Si todavía no trepa** (caminando hacia la escalera): la acción termina con resultado 2 (cancelada) y el comando se queda donde esté.
- **Seguir después** (el comando está pausado en la escalera): un clic izquierdo sobre un punto o elemento (`MSGA_ACTUASOBREPUNTO`, `…ELEMENTO`, y sus `DBLCLK`) con la acción en estado 4 manda `SETTREPAR` **+1 si el punto clickeado está más alto que el comando, −1 si más bajo** (`FUN_004F3C70`). `FUN_005DB5A0` borra la pausa (`+0x124 = 0`) y, si ya estaba trepando, **da vuelta** al movimiento: del subestado 10 pasa a 9, del 11 a 8, del 12 a 7 u 8 según lo que falte, e intercambia el punto de arranque con el de llegada (`+0xFC..+0x110`). O sea: desde la mitad se puede terminar de subir, o volver a bajar.
- `MSGA_COLISION_DINAMICA` durante el trepar: si lo que choca es un bicho vivo, `AUEscalar` envía `MSGA_ME_ESTAS_IMPACTANDO` (probablemente un enemigo que lo empuja/descubre; detalle no leído).

## 4. Qué no está leído (hay que leerlo antes de portar)
- **Cómo se aplica `dz` en `SimEscalador`**: `FUN_00668060` solo guarda `sim+0x34`; falta ver el paso del Sim (¿se integra como velocidad con las constantes 0.3/0.8/0.2 del peatón o se suma tal cual?). Sin eso no se sabe si "2.0" es u/ciclo exactos. Un chequeo en vivo (R6) lo resolvería rápido; el usuario la salteó.
- La búsqueda de las dos aristas de la escalera al cargar (`FUN_004A7950`, `FUN_004A75F0` en `FUN_004A7C30`/`FUN_004A8640`) y cómo se relaciona con los sectores `.SECTORS` del `.MIS` y con los pares `TW2` del `.SEC`.
- Distancias de arranque `+0x128`/`+0x12C` y `FUN_00574BC0`, `FUN_0057E520` (colisión).
- **Escalar muros** (`AUEscalar` con `.ESCALAMUROS SI`, `MSGA_ESCALAMURO`, `FUN_004F3050`): otro modo (¿el boina verde?). No leído.
- `ESCALAUSABLEPORBUZO` (ESCALA03 es la del mar en el mapa 0: el buzo la usa desde el agua) y `MSGA_ESCALA_SET/GET_ESCALABLE`.
- Enemigos: `BUSCADOR_IRA_CONESCALAS/SINESCALAS`, `ENTRAS_EN_ESCALERA/SALES_DE_ESCALERA` y `MotorX` de soldado (`FUN_005DF1A0`, mismo esquema con otros offsets: pausa en `+0xB4`).
- Cámara y `CAJASELECCION` al seleccionar (cómo se arma el rectángulo de clic).

## 5. Controles: lo que se aprendió de pasada (afecta a lo ya portado)
- `AuGoTo` (`FUN_004F68A0`): al recibir `MSGA_ACTUASOBREPUNTO` o `…DBLCLK` manda al buscador de rutas el punto, el sector y **`correr = (mensaje == …DBLCLK)`**; en un elemento igual. O sea **el doble clic es lo que hace correr**, no una tecla.
- Qué botón físico emite esos mensajes y cuál emite `MSG_BOTON2VIRTUAL`/`BOTON1…`/`…SELECCION` **no está leído** (emisor `FUN_0069A4F0/0069A790`, repartidor `FUN_00694370`, UI `FUN_006ED460`/`FUN_005BD030`). Medido en vivo con el original: clic izquierdo = mover; el derecho no movió nada (R6, sesión anterior). Con lo leído hoy el derecho sería "cancelar/parar" (como en la escalera). **El visor hoy usa derecho = mover y Mayús/doble derecho = correr: está en contradicción con esto y habría que cambiarlo cuando se lea el repartidor.**

## 6. Cómo portarlo (cuando se decida)
1. Estado de trepada en `Unit` (`climb: null | {edge, dir, fase, pausa}`) con las fases 6…12 y `dz` por ciclo; z interpolada entre el sector de abajo y el de arriba.
2. Animaciones `ESCALAR_EMPIEZA/CICLICO/FIN` (hay `ESCAL3.ANM`/`.WAD` en `ELEM`; comprobar que el `.ANM` del comando trae las secuencias) con velocidad de animación 1 / 0 (pausa) / −1 (bajar).
3. Clic en `CAJASELECCION` (mapa de píxeles) → camina al extremo → sube; botón de cancelar → pausa; clic en punto más alto/bajo → reanuda/da vuelta.
4. Aristas de escalera en el buscador de rutas (bit 4) para que los enemigos y el `AuGoTo` puedan usarlas (`IRA_CONESCALAS`).
