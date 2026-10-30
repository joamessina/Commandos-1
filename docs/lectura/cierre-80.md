# Investigación del lote ≥80 % — 2026-10-30

Alcance congelado al comenzar: **22 filas** de `tasks/pendientes.md` (14 de A y8 de B), agrupadas por reglas compartidas. Aunque algunas estén en «misión0», se investigan las clases y datos de **todo el juego**. No incluye automáticamente IA completa55 %, campaña60 %, menús30 % ni HUD global20 %. No se implementaron reglas.

Fuentes: exe de raíz, Ghidra `research-c1/ghidra/all2`, RTTI, tablas y WAR_MP.DIR de raíz. Las líneas siguientes son del C exportado; los rangos `0x…` son direcciones de ensamblador. `[hecho]` identifica evidencia positiva; `[previo]` evita presentar una lectura anterior como nueva; `[pendiente]` delimita lo que queda. No se hizo validación audiovisual ni lectura de memoria nueva.

## 1. Matriz del encargo

| Fila de pendientes al comenzar | % previo | Investigación de esta pasada |
|---|---:|---|
| Escaleras/ascensor | 85 | §7: consumidor del piolet, buzo y enlaces ANM; ascensor ya leído. |
| Buceo | 80 | §7: selección de destino desde agua, cursores y cancelación. |
| Plantar bombas | 90 | §7: espera hasta duración real de animación, no cuadro supuesto. |
| Destrucción de ocupantes por sector | 90 | §6: filtros y cadena MATABICHOSSECTOR. |
| Zodiac | 90 | §3: límites de la selección de destino; dinámica y pinchado previos. |
| Nidos/armas fijas | 85 | §4: máquina del cañonero y separación de estados/subestados. |
| Casas/cuarteles | 95 | §6: reserva descontada solo al crear correctamente un soldado. |
| Cadáveres vistos | 80 | §5: muerto, esposado y atontado toman ramas diferentes de BAP. |
| Objetos, puertas, focos | 80 | §4: compuerta, puente, interfono y Testigo. |
| Eventos/patrullas | 95 | §6: límite entre código común y rutas por misión; datos de eventos. |
| Munición/armas | 90 | §5: permisos FLAGSUSAR y AUArrestadoUsar, ropa y cachiporra. |
| HUD de gameplay investigado | 95 | §2: estado presionado/hover y selección nominal de paletas. |
| Resultados/puntuación | 85 | §8: orden y origen de tres contadores, separación de sprites. |
| Noche/luces | 85 | §8: estados del reloj y condiciones de eventos, datos reales. |
| Vehículos | 90 | §3: NOVERHASTA controla tick de vista; prueba006BB320. |
| Animales | 90 | §1b: consumidor positivo del bit de recinto en máscaras combinadas. |
| Presos/testigos/escoltas/policía | 85 | §4/§6: Testigo completo y revisión de receptor de custodia previo. |
| Estados de soldados | 80 | §5: detección de tabaco, fumar y animaciones de aturdido/desnudo. |
| Oído | 90 | §5: sonidos persistentes y ciclo de vida del señuelo. |
| Camuflaje/uniformes/control | 80 | §5: condiciones y fases de enterrarse; comparación de rangos. |
| Armas/objetos del jugador | 90 | §5/§7: mismos receptores y contexto; no duplicar reglas. |
| Controles | 85 | §7: cancelación por acción; caminar, bucear, escalar, transportar y vehículo. |

La tabla registra trabajo y límites, **no22 subsistemas cerrados al100 %**. Los resultados reproducibles y las deudas concretas están al final.

## 1b. Recinto de animales: consumidor encontrado [hecho]

Los setters `FUN_00429380` (`fn_00400000.c:413835`) / `FUN_004655B0` (`fn_00440000.c:24312`) actualizan bit **0x01000000 de bicho+0x23C** según pertenencia del sector actual al recinto. El consumidor no busca ese literal aislado: varias pruebas usan **0x07000000**, combinando los bits24/25/26.

`py tools/audita-cierre80.py` busca instrucciones TEST/BT sobre `+0x23C` con ese bit, imprime contexto y atribución al C. Es un barrido de evidencia positiva de instrucciones reconocidas, no prueba de ausencia de otros consumidores.

| Consumidor leído | Archivo, líneas | Efecto |
|---|---|---|
| `FUN_00430A90` | `fn_00400000.c:418918–418926` | Predicado `(flags&0x07000000)!=0`. |
| `FUN_00432F60` | mismo:420371–420405 | BAP admite el animal si pasa la máscara y prioridad/distancia; guarda blanco/posición, marca reacción; si bit25 está activo añade bit26. |
| `FUN_00433090` | mismo:420409–420439 | Arranca reacción y emite AL10 si el blanco conserva alguno de esos bits. |
| `FUN_004428E0` | `fn_00440000.c:1479–1493` | Bunker acepta al aliado no detenido o al objeto con máscara animal; en el segundo caso marca acción+0x88&1. |
| `FUN_00443FD0` | mismo:2356–2436 | Consume ese caso y el clasificador0xD, asigna respuesta específica. |
| `FUN_0044A760` | mismo:6386–6400 | Predicado equivalente del cañonero; marca acción+0x70&1. |
| `FUN_004DAF80` | `fn_004c0000.c:15405–15414` | Sargento deriva ese estímulo a004D8630. |

Otros TEST localizados: `0x4330E4`, `0x44B63B`, `0x4725A9`, `0x47B304` (la salida del script da sus funciones). **Corrección:** el bit de fuera de recinto participa de la **reacción de los enemigos al animal**. Un animal dentro del recinto todavía puede pasar la máscara por los otros dos bits. Esto **no demuestra una barrera de navegación** y no autoriza «solo ataca dentro de su recinto». La restricción física queda pendiente; la afirmación de que no se conocía ningún consumidor queda resuelta.

## 2. Botones de mochila: hover, pulsación y paletas [hecho]

`FUN_00519DE0`, `fn_00500000.c:17647–17750`, reparte mensajes numéricos:0x24 BOTON1 pone `botón+0x80|=1`;0x26 BOTON1RELEASE limpia ese bit;0x2A MOUSEMOVE pone bit2. Bit4 habilita este manejo. Los identificadores se corresponden con la tabla0x81A5B8 de `q1-controles.md`. `FUN_0051A480` (17856–17891) limpia bit2 cuando el botón ya no coincide con el objetivo actual del ratón. **Bit1=pulsado; bit2=hover**, no «tiene munición».

`FUN_0051E480` (20956–21004), con botón y padre activos:

| Condición, en orden | estado+0x10C |
|---|---:|
| pulsado (`+0x80&1`) | 1 |
| sin pulsar, hover y sprite alternativo+0x118 presente | 3 |
| restante | 2 |
| override+0xE4 activo | fuerza1 |

`FUN_0051E5E0` (21008–21098) dibuja sprite+0x114 con paleta nominal **+0x11C si estado1, +0x120 en otro caso**; estado3 añade sprite+0x118. Indices nominales<100 se resuelven por tabla de banco+0x128; inválido da puntero0. No se suma0,4 al RGB.

`FUN_0051E820` (21102–21205) fija ambos índices mediante **nombre de paleta**; cadena vacía/nula →−1. `FUN_005CDF70`, `fn_005c0000.c:8923–8943`, busca ese nombre entre100 slots válidos. El asm `0x51E820…0x51E87E` confirma qué argumento escribe+0x120 y cuál+0x11C; el C es confuso por argumentos ocultos. `FUN_006F4200`, `fn_006c0000.c:36634–36655`, pasa desde el registro del ítem: sprite principal+0x28, alternativo+0x88, paleta pulsado+0x48, paleta restante+0x68, y limpia override+0xE4.

**Pendiente:** reconstruir y contrastar todas las paletas concretas de los bancos y estados de contexto del HUD. El mecanismo de hover/pulsación y procedencia nominal ya está leído; el95 % de este ámbito no se traslada a toda la interfaz del juego.

### BMP/RLE del tutorial [hecho parcial]

Cadena seguida:006F84E0 →005D0990 (`fn_005c0000.c:11024`) →005CFFC0 (10621–10748) →00648580 (`fn_00640000.c:5928`) →00647BA0 (5139–5242) →00543850/00543710/00543620/00543460/00542BC0 (`fn_00540000.c:1972,2480,2561,2598,2658`). La búsqueda del contenedor00542BC0 compara el **nombre completo** de cada componente; no hay sustitución BMP→RLE en esa comparación. El loader gráfico comprueba cabecera BM y compresión, no basta la extensión.

Los siete TUT nombran LIBR0008.BMP y el DIR raíz trae LIBR0008.RLE (`cierre-faltantes-70.md`). Sigue pendiente comprobar el resultado en ejecución y rutas alternativas/recursos ya cargados; **no implementar un alias universal por la discrepancia**.

## 3. Vehículos: visión, movimiento y destino [hecho]

`FUN_00508410(activar)`, `fn_00500000.c:5524`, escribe bicho+0x224=(argumento==0). El consumidor **`FUN_0050BF30`**, mismo archivo7897–8050, solo ejecuta órgano de vista+0x214, virtual+0x10, si+0x224!=0 (7920–7922); luego procesa acciones y otros órganos por su cuenta. Se cierra el significado de NOVERHASTA de CTanque: **suprime el tick de vista** hasta activación, no toda la IA ni la física. TRIGGER_REACT limpia la condición (`004578A0`, `fn_00440000.c:14530`);0044D070 (7876–7963) también activa vista al entrar el cañonero al habitáculo.

Lancha: `FUN_00452DD0` (`fn_00440000.c:11606–11653`) dispara y solo para/pausa patrulla si **desplazamientoXY>0**. El getter0050A540 (`fn_00500000.c:7028–7045`) devuelve módulo entre posición actual y anterior del motor, no velocidad configurada. `0x452E51` compara **dword0,0** de0x7930D0. Se cierra el umbral FPU que faltaba.

`FUN_006BB320`, `fn_00680000.c:42231–42282`, lectura completa con asm0x6BB320…0x6BB477:

1. Si this+8 contiene un objetivo, acepta solo identidad con el argumento objetivo.
2. Sin objetivo fijado, exige **distanciaXY²<radio²** (`+0xC/+0x10` centro, +0x1C radio): el borde no entra.
3. Si el argumento objetivo es no nulo, devuelve1 tras esa prueba. Para un punto vacío levanta ambos extremos **29 unidades en Z** (`fld qword0x7B2848`) y llama00677D50.
4. Si esa prueba devuelve no cero, devuelve1. Si devuelve0, reconstruye caché si+0x874!=0 y delega en006B7380 con **this+0x20**, confirmado en0x6BB46B.

006B7380 (`fn_00680000.c:39827–39872`) compara distancia al origen del caché (+0x818/+0x81C), radio+0x814 y cruces de segmento con la lista+0x848 mediante006B5320. No es simplemente «dentro del mapa» ni un permiso por tipo de vehículo. **Pendiente:** todos los contextos de llamada y validación visual, otras familias de conductor y borde de agua; no extrapolar esta prueba a cualquier orden.

## 4. Mecanismos del escenario y artillero

### Compuerta [hecho]

`FUN_00454100` (`fn_00440000.c:12382–12538`) y00454520 (12542–12665): estado+0x28=0 extremo abierto,1 extremo cerrado,2 espera de cierre sin obstáculo,3 abre reduciendo ancho+0x3C hasta0,4 cierra aumentándolo hasta100. Los nombres abiertos/cerrados se justifican por BARRERA_ABRE→3, TEST_BARRERA devuelve estado0 y los bits de sector. Si+0xB8 y sector+0xC0 existen, al cambiar estado coloca o limpia **bits4/0x100 en sector+0x50** y avisa al gestor de rutas. Replica ancho a elementos enlazados con00453E80 (12256–12279). Cierre espera que no haya aviso de visto+0x60; no cierra inmediatamente sobre un objeto visible aceptado.

Con aceleración+0xBC, usa contador² y coeficiente+0xA8; sin ella paso+0x40. Al cerrar completamente manda BARRERA_BAJADA al dueño+0xC4. La apertura deja contador100 en+0x18; BARRERA_BAJA solicita cierre por+0x2C y se descuenta en estado0. No inventar un tiempo universal para todas las compuertas.

### Puente de M7 [hecho]

`CAcPuenteLevadizo`: parser004A1580 (`fn_00480000.c:19854–20211`) lee ABIERTO, FRAMECOUNT y sectores/vectores; **M7 fija FRAMECOUNT6**. Tick004A29D0 (20545–20563) alterna+0x350 una sola vez al arrancar y despacha movimiento/posición/dibujo.

004A2630 (20376–20419) valida antes de mover. Al abrir prepara sectores y recoge candidatos de004A23E0; al cerrar usa004A22A0 para detectar elementos que impiden hacerlo.004A23E0 (20285–20335) permite clases específicas o estados muerto/esposado/atontado (`+0x23C&0x204004`), registra elementos con bit0x10000000 y rechaza otros ocupantes; SANGRE se trata aparte.004A22A0 (20215–20281) comprueba sectores inferiores y excluye el propio token.

004A0AB0 (19451–19521): con pasos pendientes mueve cada **tres llamadas** (recarga2 y dos retornos), avanza ocho veces la animación y ajusta plano/altura de los elementos asociados; al terminar vuelve a reposo y finaliza004A0600.004A0D20 (19547–19624) mueve los elementos con el puente y los libera cuando pasan a otro sector. **Pendiente:** fórmulas completas de los ocho tiles y contraste visual, no sustituir el puente por solo animación decorativa.

Control **CAcCtPuenteLev**:00455C30 (`fn_00440000.c:13364–13453`) oye categoría AMBIENTE **CLBA**, guarda emisor, va al interruptor y actúa al colisionar;00455F90 (13457–13481) recuerda si el emisor pasó por ambos sectores y vuelve al interruptor;00456010 (13486–13523) maneja activación/desactivación secundaria. Es un protocolo distinto de una puerta clicable genérica.

### Interfono y Testigo [hecho]

Interfono004756C0 (`fn_00440000.c:34030–34083`): clic en reposo0→1; clic en estado2→0 y apaga indicador. LLAMAR_INTERFONO→2 y prende indicador.00475850 (34087–34114) descuenta el temporizador; al llegar a0 emite **TELF categoría1**, consume contador+0x2C y recarga temporizador20. Agotado el contador+0x2C, restablece20 y vuelve0. No es automáticamente un evento de alarma de peligro.

Testigo:004B35A0 (`fn_00480000.c:31004–31071`) ACTIVAR pide estado0, DESACTIVAR1, GET_ESTADO devuelve visibilidad+0x2C; HE_VISTO_EL_TESTIGO solo se admite si estaba visible y en estado3, guarda observador+0x30 y pasa2.004B3940 (31171–31224):0 muestra/activa,1 oculta/desactiva,2 manda **MSG_VISIONDINAMICA al engine con el observador**, luego oculta; al final vuelve3.004B38E0 (31151–31167) inicializa bit+0x240&0x400 y oculto. No confundir «testigo» con un soldado que grita ni activar una alarma inventada.

### AcCanonero [hecho parcial ampliado]

Tick0044BC20 (`fn_00440000.c:7164–7204`) retiene contenedor+0x74, orientación y arco. Estado principal+0x28:1→0044AF00;2→0044B1D0;3→0044B2E0;4→0044AEA0;5 aplica actualización solo con flag+0x70&2. **+0x2C es subestado**, no otro estado principal.

0044AF00 (6722–6815) sigue puntos/blancos según subestado0…7; al dejar de recibir aviso y agotar+0x44 vuelve a7. Subestado7 tiene contador20 antes de retorno/orientación.0044B1D0 (6819–6849), asm0x44B247, manda **MSGA_DISPARAR al arma+0x74** con dato+0x7C, limpia bit8 y vuelve principal1/subestado0.0044B2E0 (6853–6910) trata giro solicitado y límites del arco;0044AEA0 (6698–6718) vuelve0 si alcanzó ángulo de origen, o1/7 si no. No reemplazar esta máquina por «ve y dispara» inmediato.

Pendiente: completar todos los receptores anidados y giro físico contra ejecución. CANYON.MAC contiene AcCanonero; las otras familias enemigas siguen delimitadas por sus filas propias.

## 5. Acciones, estados, camuflaje y oído

### Tabaco y cuerpos [hecho]

`FUN_004370D0`, `fn_00400000.c:422615–422680`: en VISTA_ELEMENTOVISIBLE usa clasificador2→004326B0 una sola vez por flag+0xC4;3→004329C0;4/5→004326B0; **0xB (cajetilla)→00434460** si+0x178==0. También la colisión con objeto `+0x240&0x800` guarda referencia (422603). Por tanto hay entrada **visual y por colisión** al tabaco; no se demuestra por ruido.

00434460 (421043–421090) consulta PUEDO_IR_A_COGERTE; solo aceptado guarda posición/sector, referencia, flag+0x12C y opciones del objeto. La negociación por distancia de CAcTabaco ya estaba en `cierre-70.md` §5.3.004326B0 (420089–420129) guarda estímulo y distingue muerto/atontado al fijar+0xEC;004329C0 (420178–420222) usa otros campos para esposado. No son estímulos intercambiables.

00438A40 (423235; estado5 en423316–423334) configura FUMAR, contador **500** y LOOKSCAN_FACTOR50.00436140 (421916–421977) separa FUMAR, ATONTADO, ATONTADO_ESTATICO, variantes desnudas y ESPOSAS_DESNUDO. Esto no implica que toda animación FUMAR tenga duración500: el caminador004C3AA0 (`fn_004c0000.c:2021–2144`) puede elegir FUMAR tras **>200 ticks quieto** si su permiso+0x3C está activo. Son desencadenantes distintos.

### Uniformes, cachiporra y camuflaje [hecho]

004FF180 (`fn_004c0000.c:40412–40488`) resuelve uniforme de la tabla, comunica ESTAS_DESNUDO al blanco y solo equipa el nuevo si no tenía uno o su rango previo es **menor**; igualdad conserva el anterior y registra el nuevo.0062CA20 (`fn_00600000.c:32558–32564`) compara **rangoObservador>rangoDisfraz** (argumentos, no nombre de clase); su llamada en BAP controla un contexto de reconocimiento. No equiparar uniforme a invisibilidad general.

004EA590 (`fn_004c0000.c:26603–26639`) compara token exacto ESPIA: si coincide acción+0x198=0; si no,1 y precarga CACH. Se aclara la redacción contradictoria anterior: **ESPIA no emite CACH por esa rama**, los otros sí; el alcance del sonido IA sigue dependiendo del emisor usado.

004EB610 (`fn_004c0000.c:27343–27465`) cancela camuflarse si está siendo visto (`bicho+0x23C&0x800000`) en fases1/4/7, restaura pose y vuelve0. Fase1 anima CAMUFLARSE,7 espera duración+0x8CC con ENTE una sola vez;4 retira listas de render/choque mediante006157B0/00615750, añade lista00616080 y marca dueño+0x230=1;6 revierte listas mediante00616140/00616020/00615780. **No se extiende a fase5** la condición inicial de cancelación: ahí el código usa otro aviso de salida.

### AUArrestadoUsar y señuelo [hecho parcial ampliado]

004E7000 (`fn_004c0000.c:24319–24370`) lee FLAGSUSAR: FL_GRANADAS→0x100, FL_METRALLETA→0x200, FL_BALASFRANCOT→0x400.004E7B30 (24746–24903) comprueba permiso00513420 al aproximarse, cancela si blanco desaparece/muere/entra en otro objeto; al llegar gira con004E7180 (24389–24428), espera tolerancia angular o contador3 y ejecuta MSG_ACTUASOBRE; acción seleccionada1 usa SACA_DEL_VEHICULO_A_TODOS_LOS_OCUPANTES. No es permiso incondicional a disparar estando preso: es una acción con blancos y contexto. Parser/tick están leídos; otros mensajes siguen parciales.

Persistentes00681BE0: referencias C positivas en00442E00 (MET1, categoría3),00487C70 (NIDO,3),004A8CB0 (DCOY,2),004BB590 (PASW,1) y constructor genérico00676970. No declarar ausencia global de más emisores con este listado.

Señuelo004A9060 (`fn_00480000.c:24404–24507`): ONOFF solo si no está roto+0x34; encendido actualiza posición y habilita sonido, apagado lo detiene. IMPACTO lo rompe y apaga; ENTRADAENCONTENEDOR detiene sonido, borra roto y restituye bit+0x240&0x80. No asumir que todo señuelo nace encendido ni que romperlo y recogerlo sean el mismo estado. PASW y los48 radios mantienen las conclusiones de `cierre-faltantes-70.md` §2.

## 6. Refuerzos, eventos y destrucción [hecho / previo]

005A2AD0 (`fn_00580000.c:26671–26734`) pide CASA_GET_NREGENSOLDIERS y entrada de casa; crea mediante0059F7E0. **Solo al éxito** aumenta contador del grupo y manda CASA_SUBSTRACT_NREGENSOLDIERS(1). El C dice void: asm **0x5A2C2D…0x5A2C8B** confirma retorno booleano en EAX.005A3500 (27101–27120, asm0x5A3500…0x5A353B) resuelve grupo y repite; primer fallo corta devolviendo0. No descontar reserva antes del intento ni continuar generando tras un fallo.

0059E900 (24394–24455) atiende destrucción del elemento que dispara MATABICHOSSECTOR y llama0059D490 por cada sector configurado.0059D490 (23314–23360) recorre lista del mundo, exige sector idéntico y virtual+8>0; envía **impacto tipo1,1000 de daño, emisor y víctima el propio elemento**. No equivale a borrar indiscriminadamente cualquier sprite del edificio.

**[previo revisado]** Eventos comunes:0059A2A0→0059CEA0/0059A060; rutas y esperas en `patrulla.md`; custodia, cárcel y escolta en `detenido.md`, `policia.md` y `presos-testigos.md`. No se presenta como nueva lectura de esos cuerpos. La orden EXIT de patrulla termina la ruta; sus consecuencias por misión no se cierran con la clase sola. Queda pendiente un inventario de todos esos consumidores; no inventar desaparición automática para todas las rutas EXIT.

## 7. Escaleras, buceo, bombas y cancelaciones

**[hecho]**00689BC0 (`fn_00680000.c:7847–7863`) exige00513440(1), prueba franja con0052BE30 y, si pide ejecutar, delega00688440. El filtro geométrico completo y buzo ya estaban leídos en `q1-escaleras.md` **§4c**: los «faltantes del piolet» de notas anteriores eran deuda de índice, no una regla ausente. No duplicar la investigación como si fuera nueva.

Datos reales COMANDO.ANM: ESCALAR_EMPIEZA=2 pasos/b4, enlaces ANDAR y ESCALAR_CICLICO; ESCALAR_CICLICO=8 pasos/b14; ESCALAR_FIN=6 pasos/b16, enlaces ESCALAR_CICLICO y ANDAR. Esos enlaces confirman el ciclo; no asignar los ticks b como «un cuadro por tick» por intuición.

004E93D0 (`fn_004c0000.c:25859–25889`) usa cursor0x15 para escalera con bicho+0x1FC,0x4A para objeto+0x254&0x1000,0x14 por defecto.004E9F40 (26363–26483) admite colisión con ese destino y marca salir del agua; derecho pone bit2 en acción+0x198. Se mantiene el requisito de agua en todos los sectores para iniciar buceo, frente a **alguno** para el audio PASW.

004FA800 (`fn_004c0000.c:37022–37103`): al alinearse solicita PONEBOMBA vel1/prioridad6 y pasa a fase5; incrementa contador y **espera duración bicho+0x8CC** antes de activar el objeto y avisar MANIPULA_BOMBA si corresponde. El tiempo no es una constante universal de plantado.

| Acción / función | Líneas | Efecto de derecho confirmado |
|---|---|---|
| AUEscalar004F3C70 | `fn_004c0000.c:32768–32778` | Trepando: pausa motor y animación; aproximación: cancela. |
| AUBucear004E9F40 | mismo:26466–26481 | Marca solicitud de salir; no termina teletransportando. |
| AUArrastrar004F5430 | mismo:33675–33712 | Depende de estado: cancela aproximación, intenta soltar o salir del habitáculo y luego soltar. |
| AUUsarVehiculo005034A0 | `fn_00500000.c:2345–2367` | Si dueño+0x138 existe, limpia orden pendiente+0x1B8 y marca+0x1BC; no salida universal del vehículo. |
| AUGoto004F68A0 | `fn_004c0000.c:34346–34415` | Delega a004BB830; esta enumera ARGG/llegada/crisis/colisión/cambio-sector/ALIADO_PARA_EL_MOTOR/sustitución, no BOTON2VIRTUAL. |

**Pendiente:** reconstruir todas las capas del emisor y las acciones restantes antes de aplicar «derecho siempre para caminar». La tabla documenta cada receptor; no impone un efecto global idéntico.

## 8. Resultados y reloj

### Pantalla de resultados [hecho]

00570510 (`fn_00540000.c:32187–32238`) omite estadísticas si no hay objeto/flag o estado+0x58 es8/0xB. Centro de pantalla(cx,cy):

| Fila | Posición | Getter y campo de Intendencia |
|---|---|---|
| primera baja | (cx+30,cy−177) |0063CB40→+0x27C |
| segunda baja | (cx+30,cy−138) |0063CB60→+0x714 |
| tercera baja | (cx+30,cy−99) |0063CB80→+0x4C8 |
| estrellas tiempo / energía | (cx−11,cy−31)/(cx−11,cy+9) |0063CBA0/0063CC00 |
| estrellas rango misión | (cx−11,cy+50) |0063CC40 |
| progreso campaña | (cx−164,cy+97) |0063CD50 |

Getters `fn_00600000.c:44068–44092`. **Origen de las bajas:**0059A5B0 (`fn_00580000.c:21031–21052`) y0059E900 (24394) incrementan según **bicho+0x244**: valor4→primera,2→segunda,1→tercera. No son lecturas de energía ni el bando actual+0x108. Los nombres/textos de esas categorías y su clasificación inicial quedan por contrastar; no etiquetar filas civiles/alemanes/aliados sin ese paso.

005703D0 (32127–32153) repite sprite+0x40 con paso igual a ancho;00570470 (32157–32183) usa sprite+0x44 y paso ancho+1. No usar el mismo espaciado en todas las estrellas.005BCE30 (`fn_00580000.c:48144–48176`) busca misión siguiente y llama generador00623E30; sus retornos en C son incompletos. Códigos de fin y condiciones comunes permanecen en `mision-intendencia.md` §6 y el cierre previo; falta presentación exacta y contraste en pantalla.

### Noche [hecho / previo revisado]

005AB4B0 (`fn_00580000.c:33238–33295`): ATAR pone+0x4870=1 y fija inicio; ANOC pone+0x4878 si todavía no llegó al umbral, o cambia modo+0x486C e inicio si ya llegó. **ANOC no es simplemente «activar noche inmediatamente»**.005AB7B0 (33385–33423): sin+0x4870 devuelve hora fija+0x487C; con reloj activo usa argumentoTicks×24/DURACIONCICLO, flags de etapa y topes. Ctor005AB8E0 (33436) inicia hora9.

Los datos reales solo definen ILUMINADA1 en M9 y HORAENCENDIDO20.50 en sus focos; eso no equivale a emitir ATAR/ANOC. Curvas y sobrescritura de discos ya están leídas en `render.md` Cierre2. **Pendiente audiovisual:** activación real, solapes y aspecto de bancos; no introducir hora21 como sustitución de una regla no confirmada.

## 9. Verificación y límites

`node --experimental-transform-types tools/verifica-cierre80.ts` leyó directamente **19 MIS+96 MAC,166 ANM y1.321 secuencias**. Se imprimen solo metadatos/valores de reglas, no se guardan assets. Hallazgos:

- Puente y control: AcPuenteLevadizo/AcCtPuenteLevadizo en M7; FRAMECOUNT6.
- NOVERHASTA en cinco macros de vehículos (PNZ2/PNZ3/SDK/TAN2DES/TANQUETA).
- ESCALAMUROS17 usos, ESCALAUSABLEPORBUZO25, ZONARECINTO9.
- FLAGSUSAR7 usos, valores presentes FL_BALASFRANCOT/FL_METRALLETA; FLAGSRECOGER10, además FL_GRANADAS. El parser admite una opción que estos datos no usan en FLAGSUSAR.
- ENVIAREVENTO13; EXITHOME_EVENTS52; REACT_EVENTS47.
- No hay coincidencia literal de AcControlCompuerta/AcInterfono/AcContInterfono en esos115 scripts; esto corrige la afirmación previa de «una aparición cada una», **sin demostrar que no se puedan crear por código/otro recurso**.

Las22 filas tienen revisión explícita; unas recibieron lectura nueva y otras contraste de reglas ya documentadas. Quedan los pendientes concretos indicados, en particular todas las familias/contextos de vehículos y acciones, navegación del recinto, paletas completas y prueba audiovisual. La investigación no constituye implementación ni100 % de conocimiento del exe.

Verificación del repositorio: `npm run check:task` completo en verde (26 archivos,245 pruebas; cobertura de ramas90,26 %). No se modificó código del motor ni parsers.
