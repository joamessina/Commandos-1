# Lectura del exe — `ClassAcPatrulla` (rutas de patrulla): `0x48ACE0–0x48E600`

**Contraste puntual de M0:** `node --experimental-transform-types tools/audita-cuarteles-m0.ts` encuentra en el MIS raíz 11 `ESPERAEVENTO`, todos 0; 7 `ENLAZAR`, todos 0; ninguna clave exacta `EVENTO` ni `VELOCIDADTRAMO`. Esto no elimina la necesidad de implementar esas claves para otras misiones. El cálculo de velocidad hacia atrás es `FUN_0048ADA0` (`fn_00480000.c:6447`): en PINGPONG con sentido negativo usa el punto anterior, y en el resto el punto de destino. Portado y cubierto con tramos de velocidad distinta; en Chrome con M0 se verificó que `BAP1_MUELLE1` sigue patrullando a 1.5, pero sus datos no prueban velocidades distintas por tramo.

El port lee `EVENTO` y lo emite después de la espera del punto (`FUN_0048DF00`, fase 3); el despachador lo entrega a salidas de grupos y a rutas inscritas mediante `REACTIVIDADES`/`REACT_EVENTS`. `node --experimental-transform-types tools/audita-eventos-ruta.ts` lo contrastó con rutas reales de nueve MIS, por ejemplo `HUGE` y `GEPE` en MAPA0001. M0 no tiene puntos con `EVENTO`, y en la carga de MAPA0001 no se hallaron soldados activos con esos puntos: la emisión se probó con una ruta sintética, no jugando la misión 1 completa.

El motor acepta `ESPERAEVENTO` y solicitudes de ruta por nombre: `FUN_0048C870` registra `TRIGGER_REACT`, y `FUN_0048E530`/`FUN_0048D2D0` aplican la solicitud en un punto `ENLAZAR` o durante la espera. En Chrome, con MAPA0001, `BAP2_REACT_PUERTA_ESTE` esperaba `REXT` y empezó su ruta después de emitir ese evento; el soldado se colocó desde desarrollo cerca del primer punto. El auditor encuentra 5 esperas y 8 enlaces no nulos en MAPA0001. Faltan receptores de clases distintas de soldados, los contenedores y sus tiempos, y entregar eventos a grupos todavía representados como pendientes dentro de casas.

Cubre personas y vehículos (sirve para soldados con ruta, camiones, barcas...). **[hecho]** = leído; **[hip]** = interpretación. Constantes verificadas en `.rdata`. Los mensajes `MSGA_PATRULLA_*` son los que `AcBap`/`AcGuarda` mandan al bicho para pausar/reanudar/cambiar su patrulla (ver `soldado-acbap.md`, `guarda.md`).

## 0. Clase y datos [hecho]
Overrides sobre `ClassAccion`: `+0x00` destructor `FUN_0048C3F0` (→`FUN_0048B130`) · `+0x04` MAC `FUN_0048D880` · `+0x10` **tick** `FUN_0048E530` · `+0x14` mensajes `FUN_0048C870` · `+0x28` serialización. Ctor `FUN_0048D5B0`.
Campos del acc: `+0x28` ruta actual · `+0x2C` ruta pedida · `+0x30` cantidad de rutas · `+0x34` índice del punto actual · `+0x38` índice anterior · `+0x3C` sentido (+1/−1; ctor 1) · `+0x40` **orden** (ctor **5**) · `+0x44` orden guardada al morir · `+0x48` **fase** dentro del punto (ctor **9**) · `+0x4C` contador de espera · `+0x50/+0x54` orden y fase guardadas por la pausa · `+0x58` va dentro de un contenedor · `+0x60` `ESPERAEVENTO` · `+0x64` "ya invertí" · `+0x68` hay cambio de ruta pedido · `+0x6C..0x74` destino actual (x,y,z) · `+0x78` velocidad actual · `+0x7C` elemento al que va (casa/vehículo) · `+0x80` array de rutas (stride 0x30) · `+0x90` 1 = anda con la barra de ruta.
**Ruta** (0x30 B): `+0x00` puntero a los puntos · `+0x04` cantidad de puntos · `+0x08` tipo · `+0x0C` velocidad por defecto (float) · `+0x10` nombre (0x20 B).
**Punto** (0x4C B): `+0x00..0x08` x,y,z · `+0x0C` `ESPERA` (ciclos) · `+0x10` `DELTA` · `+0x14` `CONT` (nombre de un bicho/objeto al que entrar, 0x20 B) · `+0x34` `CASA` (entero) · `+0x38` `ANGULO` (float, grados; 0 = no girar) · `+0x3C` velocidad del tramo · `+0x40` copia de la velocidad original · `+0x44` `EVENTO` (hash de 5 chars) · `+0x48` `ENLAZAR`.

## 1. Parámetros del MAC (`FUN_0048D880`, `FUN_0048B830`) [hecho]
| Clave | Efecto |
|---|---|
| `ESPERAEVENTO` | `+0x60` (entero); si ≠ 0 la orden inicial es **3** (espera un evento antes de empezar) |
| `PATRULLA` | lista de rutas; cada una con `NOMBRE`, `TIPORUTA`, `VEL`, y lista de puntos `XYZ` |
| `NOMBRE` | prefijo `FACIL_` / `DIFICIL_` según la dificultad (`mundo+0x45C`: con valor **0** se aceptan las `FACIL_` y se descartan las `DIFICIL_`; con valor ≠ 0 al revés); sin prefijo vale siempre. El nombre guardado es sin prefijo |
| `TIPORUTA` | `LOOP`→**0** · `JUMP`→**2** · `EXIT`→**3** · `STOPPED`→**4** · cualquier otro texto→**1** (ida y vuelta). Sin la clave: 0 (LOOP) |
| `VEL` | velocidad por defecto de la ruta (float); sin la clave: **1.5** (`0x793E4C`) |
| por punto | `XYZ` (3 valores), `ESPERA`, `DELTA`, `CASA`, `CONT`, `ANGULO`, `ENLAZAR`, `EVENTO`, `VELOCIDADTRAMO` (sin la clave hereda `VEL`) |
Al terminar de leer: llama `FUN_0048ADA0` (fija el destino al primer punto y la velocidad) y `FUN_0048B670` (avisa `MSGA_ROUTE_CHANGED`).

## 2. Órdenes (`acc+0x40`) [hecho]
| Orden | Significado |
|---|---|
| 0 | inactivo / muerto (se guarda la anterior en `+0x44`) |
| 1 | ruta terminada (tipo `EXIT`; sin tick) |
| 3 | espera un evento (`ESPERAEVENTO`) hasta que llegue un `TRIGGER_REACT` que active una ruta |
| **4** | en un punto, ejecutando la secuencia de fases (§3) |
| **5** | **andando hacia el punto siguiente** |
| 6 | espera `+0x4C` ciclos (obstáculo, o 0x19=25 ciclos al entrar a un contenedor) y vuelve a 5 |
| 7 | dentro de un contenedor (casa/vehículo): espera, pregunta `MSGA_SALIR_HABITACULO` cada ciclo; al salir → 5 (fase 9) |
| 9 | **pausada** (`PATRULLA_PAUSE`) |
| 0xA | parada (ruta `STOPPED`) |
| 0xB | ruta abandonada / sin objeto (fin) |
**Tick (`FUN_0048E530`)**: (1) si la ruta tiene punto con `ENLAZAR`≠0 o hay `ESPERAEVENTO`, y llegó un cambio de ruta pedido (`+0x68`), **cambia de ruta** (`FUN_0048D2D0`: punto 0, sentido +1, orden 5, fase 9; si va en contenedor con ocupante espera 25 ciclos en orden 7); (2) orden 4 → máquina de fases `FUN_0048DF00`, y si queda en 5 → `FUN_0048C500` (avanzar de punto); orden 5 con fase 9 → `FUN_0048DC90` (dar la orden de ir); orden 6 → cuenta atrás y vuelve a 5; orden 7 → cuenta y consulta salida; (3) pone **`bicho+0x23C |= 0x40000`** si la fase no es 0 ni 1 (en movimiento), si no lo limpia.

## 3. Fases dentro de un punto (`acc+0x48`, `FUN_0048DF00`) [hecho]
Secuencia normal al llegar (`MSGA_MOTOR_PUNTOALCANZADO`, que pasa la orden a 4 y fase 9→**2**):
| Fase | Qué hace |
|---|---|
| 2 | gira hacia `ANGULO` (si ≠ 0): a pie `MOTOR_PARAR` + `MOTOR_SETANG`; en vehículo `PILOTO_PARAR` + `PILOTO_GIRAR`; pasa a 4 |
| 4 | si el punto tiene `CONT`: busca el bicho por nombre (`FUN_0064A660`); si no existe → orden 0xB; a pie va a su "posición de subida" (`FUN_0048B440`, `MSGA_POS_SUBIDA`, solo si está a < **200** u: `0x797288=40000` de distancia²); en vehículo se detiene (`FUN_0048B340`, espera 25 ciclos). Sin `CONT` → fase 0 |
| 0 | `+0x4C = ESPERA` del punto; si > 0 → fase 1, si no → fase 3 |
| 1 | cuenta `+0x4C` hasta 0 → fase 3 |
| 3 | si el punto tiene `EVENTO`: dispara el evento de misión (`FUN_0059A2A0(0, hash, 0)`) y pasa a la 8; si no, directo a la 8 |
| 8 | orden **5**, fase **9** (sale hacia el siguiente punto) |
| 5/6/7 | variantes de entrada a contenedor (`MSGA_ENTRAR_HABITACULO`, espera 25 ciclos, `MSGA_SALIR_HABITACULO`) |
**Avanzar (`FUN_0048C500`)**: `anterior=idx`; `idx += sentido`; si `idx ≥ puntos` (o negativo) actúa según el tipo: **LOOP(0)** `idx=0`; **ida y vuelta(1)** invierte el sentido; **JUMP(2)** teletransporta: pone al bicho (o a su vehículo) en el punto 0, `MSGO_MOTOR_BORRAFISICA` y parada, ángulo del punto 0 si lo hay, e `idx=1`; **EXIT(3)** orden 1; **STOPPED(4)** orden 0xA y `idx` queda en el anterior. Si sigue en orden 5 recalcula destino y velocidad (`FUN_0048ADA0`: velocidad del punto de **origen** si va hacia atrás con tipo 1, si no la del actual) y manda `MSGA_ROUTE_CHANGED`.
**Ir (`FUN_0048DC90`)**: a pie `MSGO_MOTOR_GOTO(destino)` + `MSGO_MOTOR_SETVEL(0, velocidad)`; en vehículo `MSGA_PILOTO_GOTOVEL(destino, ftol(velocidad))` al conductor. Velocidad de arranque (ctor): **4.0** (`0x7941BC`) para ambos.

## 4. Mensajes (`FUN_0048C870`) [hecho]
| Mensaje | Efecto |
|---|---|
| `MOTOR_PUNTOALCANZADO` | si no está pausada y el punto alcanzado = destino: `+0x64=0`, orden 4 (y fase 9→2); fase 5 → `FUN_0048AF90` (entrar al contenedor) |
| `COLISION_DINAMICA` | en fase 5, si choca con el elemento al que va → entrar (`FUN_0048AF90`) |
| `TRIGGER_REACT(nombre)` | si no está en orden 1: busca una ruta con ese nombre (sin distinguir mayúsculas) distinta de la actual (o si `+0x60`) y pide cambiarla (`+0x2C`, `+0x68=1`) |
| `ARGG`, `VAS_A_SER_TRANSMIGRADO` | guarda la orden en `+0x44` y pasa a 0; `TRANSMIGRATE` la restaura si el bicho no está muerto; `FIN_TRANSMIGRACION` re-registra el observador |
| `PATRULLA_PAUSE` / `PATRULLA_UNPAUSE` | pausa (orden 9, guarda orden y fase) / restaura y responde la velocidad |
| `PATRULLA_SETVEL(v)` / `PATRULLA_VELNORMAL` | pone la velocidad `v` en todos los puntos de la ruta / restaura las originales |
| `PATRULLA_GETNEXTPOINT` | responde el destino (x,y,z), índice, sentido y nombre de ruta |
| `PATRULLA_INVERT_ROUTE` | si va en 4/5, no al final y no invirtió ya: invierte sentido (`+0x64=1`) y avanza |
| `ESPERA_OBSTACULO(flags)` | con bit 4 en orden 5: `+0x4C=2`, para al conductor (`PILOTO_PARAR`); con bit 1 hace sonar la bocina (`MSG_BOCINAZO`); orden 6 |
Todo lo demás pasa a `FUN_004C2A60` (`TRANSMIGRAR`).

## Dudas abiertas
- Cuándo se escribe `acc+0x58` ("va dentro de contenedor") distinto de en `FUN_0048B440`: solo ahí (copia `contenedor+0x198→+0`); sin más lectores. No hay duda de comportamiento.
- Orden 1 (`EXIT`): ningún lector dentro de la clase; el efecto (el bicho sale del mapa / queda detenido) lo decide quien consulte la acción (misión). No se puede cerrar con este rango.


## Cierre 2 (2026-10-29)
Sin cambios en `AcPatrulla`. Dos precisiones para quien la use con patrullas de soldados: (1) la **definición de grupo** (`NSOLDIERS`, `NCOLUMNS`, `FORMX/FORMY`, `TOLERANCIA`, `DISTANCIA`, `HOME/JAIL`, flags `REGENERATE`…) la lee `FUN_0062B6C0`; el mapeo completo está en `policia.md` (Cierre 2) y `RUTADEF` es la lista de rutas que consume esta clase (§1). (2) `ORDEN_PATROL_EXIT` y `TRIGGER_REACT` llegan por los eventos `EXITHOME_EVENTS`/`REACT_EVENTS` de la definición, que `FUN_0059A060` reparte (`mision-intendencia.md` §5). Las dudas sobre `acc+0x58` y la orden 1 (`EXIT`) siguen igual: sin lector dentro de la clase, lo consulta la misión.
