# Mapa general del exe — funciones y líneas

Fecha: 2026-10-30. Exe de referencia: `coman_mp.exe` de la raíz; exportación local de Ghidra `all2`, con `bigfn.c` si está disponible.

Inventario comprobado en esta exportación: **37,026 funciones**, **2,787,187 bytes** declarados por sus cabeceras. No equivale al tamaño del exe ni a cobertura de lectura semántica.

Las líneas son del **C exportado por Ghidra**, numeradas desde 1; el exe binario no tiene líneas fuente. Cada fila enlaza la cabecera real, da el intervalo completo de la función y enlaza la nota previa que explica su atribución. Se comprobó existencia, dirección, nombre y tamaño de todas las anclas; eso no significa releer íntegramente todos sus cuerpos en esta tarea. Los nombres funcionales en español son descripciones nuestras, no símbolos recuperados del original.

La exportación inicial `all` conserva 29.304 funciones y declara 13.395 B para `FUN_00786e60`; `all2` declara 37.808 B, igual que `bigfn.c`. **Ese tamaño no garantiza que el C represente todos sus bloques**: las escrituras de mochila en 0x78B6D0…0x78BCD1 aparecen en el ensamblador y no en ese C (ver [cierre-70.md](lectura/cierre-70.md) §2). No mezclar líneas entre exportaciones. El generador solo sustituye la entrada por `bigfn.c` si su tamaño declarado es mayor, sin contarla dos veces.

## Arquitectura para orientarse

El arranque prepara recursos y configuración; el núcleo coordina ciclos mediante llamadas virtuales. Las entidades reúnen acciones, órganos y simulación. Las acciones reciben mensajes; los órganos resuelven órdenes según prioridad; motores y simuladores separan intención y desplazamiento. La intendencia mantiene objetivos, eventos y patrullas. Render y audio tienen consumidores propios. Esta organización resume las lecturas enlazadas abajo; no es un grafo de llamadas completo ni prueba un orden global entre subsistemas.

Lecturas de referencia: [IA y mensajes](engine/ia-mensajes.md), [simulación](lectura/sim-vehiculos.md), [intendencia](lectura/mision-intendencia.md), [render](lectura/render.md), [sonido](lectura/sonido.md).

## Arranque y núcleo

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_005c2790` / `0x005C2790` | Inicio: cámara, recursos, configuración y pantallas | [fn_005c0000.c:1296](<D:/Joaquin/research-c1/ghidra/all2/fn_005c0000.c:1296>) · 1296–1505; 1631 B | [render.md:13](<D:/Joaquin/commandos1-web/docs/lectura/render.md:13>) |
| `FUN_005c47d0` / `0x005C47D0` | Ciclo general y limitador de frecuencia | [fn_005c0000.c:2342](<D:/Joaquin/research-c1/ghidra/all2/fn_005c0000.c:2342>) · 2342–2450; 779 B | [exe-lectura.md:23](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:23>) |
| `FUN_006bffe0` / `0x006BFFE0` | Bomba de mensajes de Windows | [fn_00680000.c:45858](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:45858>) · 45858–45881; 126 B | [exe-lectura.md:24](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:24>) |
| `FUN_0062d050` / `0x0062D050` | Opciones por defecto, incluido MAXFPS | [fn_00600000.c:32899](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:32899>) · 32899–32913; 29 B | [exe-lectura.md:23](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:23>) |
| `FUN_00786e60` / `0x00786E60` | Inicialización de globales e ítems IT_* | [fn_00780000.c:795](<D:/Joaquin/research-c1/ghidra/all2/fn_00780000.c:795>) · 795–3560; 37808 B | [exe-lectura.md:15](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:15>) |

## Archivos y scripts

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_005d02b0` / `0x005D02B0` | Carga WAD | [fn_005c0000.c:10752](<D:/Joaquin/research-c1/ghidra/all2/fn_005c0000.c:10752>) · 10752–10882; 562 B | [exe-lectura.md:25](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:25>) |
| `FUN_0060ad60` / `0x0060AD60` | Construcción del bloque de script de misión | [fn_00600000.c:8391](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:8391>) · 8391–8503; 414 B | [mision-intendencia.md:9](<D:/Joaquin/commandos1-web/docs/lectura/mision-intendencia.md:9>) |
| `FUN_0060b190` / `0x0060B190` | Búsqueda de clave en un bloque de script | [fn_00600000.c:8618](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:8618>) · 8618–8649; 95 B | [mision-intendencia.md:10](<D:/Joaquin/commandos1-web/docs/lectura/mision-intendencia.md:10>) |

## Entidades y mensajes

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_0050bf30` / `0x0050BF30` | Actualización de la lista de acciones del bicho | [fn_00500000.c:7897](<D:/Joaquin/research-c1/ghidra/all2/fn_00500000.c:7897>) · 7897–8050; 658 B | [ia-mensajes.md:10](<D:/Joaquin/commandos1-web/docs/engine/ia-mensajes.md:10>) |
| `FUN_0050bea0` / `0x0050BEA0` | Reparto de mensajes a las acciones del bicho | [fn_00500000.c:7871](<D:/Joaquin/research-c1/ghidra/all2/fn_00500000.c:7871>) · 7871–7896; 105 B | [ia-mensajes.md:10](<D:/Joaquin/commandos1-web/docs/engine/ia-mensajes.md:10>) |
| `FUN_00508900` / `0x00508900` | Lectura de ACCIONES del bicho | [fn_00500000.c:5803](<D:/Joaquin/research-c1/ghidra/all2/fn_00500000.c:5803>) · 5803–5915; 698 B | [ia-mensajes.md:15](<D:/Joaquin/commandos1-web/docs/engine/ia-mensajes.md:15>) |
| `FUN_00649e70` / `0x00649E70` | Fábrica de acciones por nombre | [fn_00640000.c:7226](<D:/Joaquin/research-c1/ghidra/all2/fn_00640000.c:7226>) · 7226–7288; 315 B | [ia-mensajes.md:15](<D:/Joaquin/commandos1-web/docs/engine/ia-mensajes.md:15>) |
| `FUN_006119b0` / `0x006119B0` | Consulta de identificador de mensaje por nombre | [fn_00600000.c:13244](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:13244>) · 13244–13295; 151 B | [ia-mensajes.md:21](<D:/Joaquin/commandos1-web/docs/engine/ia-mensajes.md:21>) |

## IA y percepción

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_004364a0` / `0x004364A0` | AcBap: llamador del buscador de ruta | [fn_00400000.c:422105](<D:/Joaquin/research-c1/ghidra/all2/fn_00400000.c:422105>) · 422105–422204; 576 B | [buscador.md:3](<D:/Joaquin/commandos1-web/docs/lectura/buscador.md:3>) |
| `FUN_006afc10` / `0x006AFC10` | Clasificación de lo visto | [fn_00680000.c:34921](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:34921>) · 34921–35059; 655 B | [pendientes.md:21](<D:/Joaquin/commandos1-web/tasks/pendientes.md:21>) |
| `FUN_0061c5b0` / `0x0061C5B0` | Escaneo de Vista01 | [fn_00600000.c:21773](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:21773>) · 21773–21896; 579 B | [organos.md:17](<D:/Joaquin/commandos1-web/docs/lectura/organos.md:17>) |
| `FUN_0061b580` / `0x0061B580` | Oclusión de Vista01 por sectores y obstáculos | [fn_00600000.c:21260](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:21260>) · 21260–21293; 267 B | [organos.md:16](<D:/Joaquin/commandos1-web/docs/lectura/organos.md:16>) |
| `FUN_0061a830` / `0x0061A830` | Mensajes de Oido01 | [fn_00600000.c:20706](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:20706>) · 20706–20760; 399 B | [organos.md:8](<D:/Joaquin/commandos1-web/docs/lectura/organos.md:8>) |
| `FUN_006196a0` / `0x006196A0` | Envejecimiento de recuerdos de Memoria01 | [fn_00600000.c:19876](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:19876>) · 19876–19902; 54 B | [organos.md:5](<D:/Joaquin/commandos1-web/docs/lectura/organos.md:5>) |

## Movimiento, rutas y colisión

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_00447200` / `0x00447200` | Mensajes de AcBuscador | [fn_00440000.c:4483](<D:/Joaquin/research-c1/ghidra/all2/fn_00440000.c:4483>) · 4483–4751; 1925 B | [buscador.md:9](<D:/Joaquin/commandos1-web/docs/lectura/buscador.md:9>) |
| `FUN_006283d0` / `0x006283D0` | Solicitud de ruta | [fn_00600000.c:30041](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:30041>) · 30041–30068; 118 B | [buscador.md:12](<D:/Joaquin/commandos1-web/docs/lectura/buscador.md:12>) |
| `FUN_0057e950` / `0x0057E950` | Pasadas de simulación de los bichos | [fn_00540000.c:40269](<D:/Joaquin/research-c1/ghidra/all2/fn_00540000.c:40269>) · 40269–40390; 613 B | [sim-vehiculos.md:6](<D:/Joaquin/commandos1-web/docs/lectura/sim-vehiculos.md:6>) |
| `FUN_0057e6e0` / `0x0057E6E0` | Movimiento con limitación y colisión | [fn_00540000.c:40178](<D:/Joaquin/research-c1/ghidra/all2/fn_00540000.c:40178>) · 40178–40268; 497 B | [sim-vehiculos.md:6](<D:/Joaquin/commandos1-web/docs/lectura/sim-vehiculos.md:6>) |
| `FUN_005f17c0` / `0x005F17C0` | Tick del motor común de vehículo | [fn_005c0000.c:31891](<D:/Joaquin/research-c1/ghidra/all2/fn_005c0000.c:31891>) · 31891–31975; 676 B | [sim-vehiculos.md:14](<D:/Joaquin/commandos1-web/docs/lectura/sim-vehiculos.md:14>) |
| `FUN_005f9820` / `0x005F9820` | Recorrido de sectores para visibilidad | [fn_005c0000.c:36556](<D:/Joaquin/research-c1/ghidra/all2/fn_005c0000.c:36556>) · 36556–36691; 1099 B | [organos.md:16](<D:/Joaquin/commandos1-web/docs/lectura/organos.md:16>) |

## Jugador, armas y daño

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_004eff40` / `0x004EFF40` | Carga de armas y munición desde MAC | [fn_004c0000.c:30434](<D:/Joaquin/research-c1/ghidra/all2/fn_004c0000.c:30434>) · 30434–30605; 1315 B | [au-disparar.md:21](<D:/Joaquin/commandos1-web/docs/lectura/au-disparar.md:21>) |
| `FUN_004f1a50` / `0x004F1A50` | Máquina de estados de AUDisparar | [fn_004c0000.c:31349](<D:/Joaquin/research-c1/ghidra/all2/fn_004c0000.c:31349>) · 31349–31471; 793 B | [au-disparar.md:24](<D:/Joaquin/commandos1-web/docs/lectura/au-disparar.md:24>) |
| `FUN_006771a0` / `0x006771A0` | Raycast de disparo | [fn_00640000.c:42854](<D:/Joaquin/research-c1/ghidra/all2/fn_00640000.c:42854>) · 42854–42912; 447 B | [au-disparar.md:19](<D:/Joaquin/commandos1-web/docs/lectura/au-disparar.md:19>) |
| `FUN_0045f400` / `0x0045F400` | Recepción de daño por energía y blindaje | [fn_00440000.c:19937](<D:/Joaquin/research-c1/ghidra/all2/fn_00440000.c:19937>) · 19937–19960; 53 B | [impactos.md:9](<D:/Joaquin/commandos1-web/docs/lectura/impactos.md:9>) |
| `FUN_005986a0` / `0x005986A0` | Envío de MSGA_IMPACTO a la víctima | [fn_00580000.c:18833](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:18833>) · 18833–18870; 186 B | [impactos.md:20](<D:/Joaquin/commandos1-web/docs/lectura/impactos.md:20>) |

## Misión, eventos y objetivos

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_0059eaa0` / `0x0059EAA0` | Tick de la intendencia base | [fn_00580000.c:24459](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:24459>) · 24459–24488; 180 B | [mision-intendencia.md:34](<D:/Joaquin/commandos1-web/docs/lectura/mision-intendencia.md:34>) |
| `FUN_0059cf00` / `0x0059CF00` | Evaluador de fin de misión | [fn_00580000.c:23073](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:23073>) · 23073–23103; 110 B | [mision-intendencia.md:35](<D:/Joaquin/commandos1-web/docs/lectura/mision-intendencia.md:35>) |
| `FUN_0059a2a0` / `0x0059A2A0` | Despacho de eventos por tipo y slot virtual | [fn_00580000.c:20865](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:20865>) · 20865–20908; 251 B | [sonido.md:75](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:75>) |
| `FUN_0059a060` / `0x0059A060` | Difusión de eventos a patrullas y escuchas | [fn_00580000.c:20791](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:20791>) · 20791–20864; 461 B | [sonido.md:3](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:3>) |
| `FUN_005a2760` / `0x005A2760` | Reposición de grupos desde casas | [fn_00580000.c:26577](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:26577>) · 26577–26670; 700 B | [mision-intendencia.md:39](<D:/Joaquin/commandos1-web/docs/lectura/mision-intendencia.md:39>) |

## Render y animación

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_005b7ec0` / `0x005B7EC0` | Construcción de la matriz de cámara | [fn_00580000.c:43789](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:43789>) · 43789–43817; 140 B | [render.md:6](<D:/Joaquin/commandos1-web/docs/lectura/render.md:6>) |
| `FUN_00591de0` / `0x00591DE0` | Actualización de capas y posición gráfica del bicho | [fn_00580000.c:13438](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:13438>) · 13438–13635; 1148 B | [render.md:20](<D:/Joaquin/commandos1-web/docs/lectura/render.md:20>) |
| `FUN_006bcda0` / `0x006BCDA0` | Proyección del volumen a pantalla | [fn_00680000.c:43529](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:43529>) · 43529–43555; 232 B | [render.md:14](<D:/Joaquin/commandos1-web/docs/lectura/render.md:14>) |
| `FUN_006bced0` / `0x006BCED0` | Dibujo de los tiles del volumen | [fn_00680000.c:43556](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:43556>) · 43556–43673; 786 B | [render.md:24](<D:/Joaquin/commandos1-web/docs/lectura/render.md:24>) |
| `FUN_00659c80` / `0x00659C80` | Blitter RLE con mapa de luz | [fn_00640000.c:22289](<D:/Joaquin/research-c1/ghidra/all2/fn_00640000.c:22289>) · 22289–22429; 759 B | [exe-lectura.md:25](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:25>) |

## HUD y pantallas

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_0068e210` / `0x0068E210` | Visibilidad de ítems en vehículo | [fn_00680000.c:10868](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:10868>) · 10868–11070; 1092 B | [verificacion-exe.md:10](<D:/Joaquin/commandos1-web/tasks/verificacion-exe.md:10>) |
| `FUN_006f4150` / `0x006F4150` | Espejo de la mochila | [fn_006c0000.c:36599](<D:/Joaquin/research-c1/ghidra/all2/fn_006c0000.c:36599>) · 36599–36633; 132 B | [verificacion-exe.md:15](<D:/Joaquin/commandos1-web/tasks/verificacion-exe.md:15>) |
| `FUN_005bf6b0` / `0x005BF6B0` | Cambios de estado de pantallas y música | [fn_00580000.c:49143](<D:/Joaquin/research-c1/ghidra/all2/fn_00580000.c:49143>) · 49143–49289; 766 B | [sonido.md:23](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:23>) |

## Guardado y preferencias

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_005c34a0` / `0x005C34A0` | Lectura de bloques de partida y preferencias | [fn_005c0000.c:1804](<D:/Joaquin/research-c1/ghidra/all2/fn_005c0000.c:1804>) · 1804–2328; 3883 B | [exe-lectura.md:42](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:42>) |
| `FUN_0062d530` / `0x0062D530` | Lectura del bloque PREFERENCES | [fn_00600000.c:33108](<D:/Joaquin/research-c1/ghidra/all2/fn_00600000.c:33108>) · 33108–33168; 398 B | [exe-lectura.md:23](<D:/Joaquin/commandos1-web/docs/exe-lectura.md:23>) |

## Audio y ruido de IA

| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |
|---|---|---|---|
| `FUN_00682970` / `0x00682970` | Tick de fuentes de ambiente | [fn_00680000.c:2406](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:2406>) · 2406–2441; 112 B | [sonido.md:16](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:16>) |
| `FUN_0067f9c0` / `0x0067F9C0` | Reproducción de sonido posicional | [fn_00640000.c:48590](<D:/Joaquin/research-c1/ghidra/all2/fn_00640000.c:48590>) · 48590–48599; 27 B | [sonido.md:38](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:38>) |
| `FUN_00680530` / `0x00680530` | Consulta de la tabla de radios de ruido | [fn_00680000.c:257](<D:/Joaquin/research-c1/ghidra/all2/fn_00680000.c:257>) · 257–318; 230 B | [sonido.md:82](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:82>) |
| `FUN_006ffae0` / `0x006FFAE0` | Sensor de sonidos por zona | [fn_006c0000.c:45066](<D:/Joaquin/research-c1/ghidra/all2/fn_006c0000.c:45066>) · 45066–45090; 98 B | [sonido.md:75](<D:/Joaquin/commandos1-web/docs/lectura/sonido.md:75>) |

## Límites y zonas a investigar

La [atribución global](exe-cobertura.md) histórica deja 10.093 funciones (27,9 % de bytes de funciones) sin dueño. Es una medición de esa clasificación, no de cuánto comportamiento falta portar. Red, editor, CRT y limpieza de excepciones aparecen allí; este mapa no les asigna funciones concretas sin lectura adicional. Tampoco cierra SAVB, el núcleo completo ni todas las reacciones de AcBap2. Consultar [pendientes](../tasks/pendientes.md) y los cierres de cada lectura: varias secciones antiguas de exe-lectura.md conservan dudas ya resueltas después.

No se reconstruyó el entry point PE/CRT ni se verificó el flujo jugando o leyendo memoria. Una llamada virtual requiere resolver la vtable antes de afirmar qué implementación ejecuta; los thunks requieren seguir su salto. Ghidra puede omitir argumentos FPU y reconstruir mal switches. Las direcciones VA son la referencia estable; las líneas cambian al reexportar.

## Reproducir y validar las referencias

Desde la raíz: `py tools/mapa-exe.py D:/Joaquin/research-c1/ghidra/all2`. El generador falla si falta una función, hay direcciones repetidas o la nota citada no contiene su dirección. Solo lee la exportación y los docs; escribe este mapa. No copia cuerpos ni bytes del juego al repo.

Huellas SHA-256 de los archivos C usados (para detectar cambios de líneas):

- `fn_00400000.c: b1390da9ed3b013ff0f925130cf3ced56749a72e9396b2a5c5081a03c2eca78e`
- `fn_00440000.c: 9c8f89c10d2e6abe35e671429f62bd5138cae29911967dc76206a50be557bfda`
- `fn_00480000.c: 72c348972dd6579b3882617691a4c5bfe6e7bef7361311bba6ad6ca8aa26fda4`
- `fn_004c0000.c: da06f4257d0d3077d6e9bf800a8995191411d845985fc9aeac674cb3d582833e`
- `fn_00500000.c: 67bda9285b86a35c086eae28f57d3588cd272a91494c2103ae79e4d4152bf023`
- `fn_00540000.c: 626014ef8cf4fb36e7e793e3bd95d1f96cfdd19a41ace799538bcade53ac9aba`
- `fn_00580000.c: 90483e36ac72cf2569ad2b0432aea9370041849048d9e1dc936ed8a49b662ce6`
- `fn_005c0000.c: 4e032aa03adad5b685251716dd0975fdaed119fe1d38ec1a4fc0454a26f155fe`
- `fn_00600000.c: c69451c24df4e5d37bffbc9c3318a0653b66855c896db92019ebd07eec2df974`
- `fn_00640000.c: 047c40e44cadb91418b8d9f66523502c36e339b3644914625a676db0aa0e59f7`
- `fn_00680000.c: 12fc040ab3dcfda2f04e8992abb142eb4d761a78dbb97a613ae908ab7ff48f2c`
- `fn_006c0000.c: 0eeb702a6865f8cf40e8417f1d557e3d88b27853458c67eeb407e075d22e73aa`
- `fn_00700000.c: c80deab8f1119da1b9a65bd28e3855127c2931c814b58f292d7003ee8f8cbe9c`
- `fn_00740000.c: 64f1094efaa08c4adbd2256dd5c84bbb690a1d47c7bf60c076c76b6c7593881f`
- `fn_00780000.c: 096dabbb10dc59fa10c982774147364f1be2fe46dbd7829db09e0942c23bdaac`
- `bigfn.c: 94b5793fce015a0e57aba78d273cfd528cbc0261c906694a2a6977bf15a11086`
