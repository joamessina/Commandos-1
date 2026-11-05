# Pendientes (lista maestra para ir tachando)

**Contraste de colisiones y nidos:** `contraste-colisiones-nidos-m0.md` compara exe, MIS/MAC/SEC/ANM originales y port. El arma usa la secuencia base `DISPARA`; el operador reproduce `CANONERODISPARA`; su ciclo se inicia con el disparo simplificado y falta la lógica original de ráfaga. El efecto enemigo original tiene cilindro de radio 5 y altura 5. Falta contraste del juego original en ejecución.

**Nidos, giro y disparo:** `obj-armas-fijas.md` documenta la tolerancia de 2°, el giro permitido, la posibilidad de empezar la ráfaga durante el giro y la diferencia entre los trazados aliado y enemigo. El tiro aliado aplica impacto 100 a un candidato que supera sus filtros; el efecto del disparo enemigo puede aplicar 30 por colisión dinámica. Falta contrastar la interacción completa en partida y las demás vías del artillero.

**BAP2 ante sonidos:** `soldado-acbap2.md` §4b precisa el límite horizontal de 400 unidades, la prueba de sectores y los casos en que emite `AL01` o mira el lugar durante 100 ciclos. La marca `acción+0x134` se actualiza al oír atención según si el emisor es una piedra; falta contrastar la reacción en partida.

**Sonido de derrumbes de M0 (2026-11-03):** `obj-explosivos.md` identifica los tags seleccionados por radio y `.SONFIS`; la antena y los seis edificios principales de `AUTOEXPCASAS` seleccionan `XCA1`/`DERRUMBE` con sus geometrías declaradas. Los otros tres volúmenes transmiten impactos al principal; se calcularon las posiciones de emisión a partir de los volúmenes reales. Falta comprobar creación y audio en el original.

**Rutas de escalera de M0 (2026-11-03):** [`mision0-rutas-escaleras.md`](../docs/lectura/mision0-rutas-escaleras.md) contrasta las cuatro instancias reales con el filtro de soldados y verifica en ensamblador el costo de A*. El costo ya estaba leído; sigue pendiente integrar las aristas especiales al buscador y comparar trayectos con el original. No implica cierre de las demás áreas de M0.

**Colisión y objetivos de M0 (2026-11-03):** `q1-colision.md` corrige la interpretación de los tres intentos de movimiento y demuestra que el MIS no declara `CHOQ` separado; aún faltan contraste geométrico y dinámico. `refuerzos-m0.md` incorpora un auditor de los siete objetivos y los tres edificios de cuartel en ambas dificultades; no sustituye una partida completa.

**Edificios de cuartel:** `refuerzos-m0.md` identifica la generación automática de volúmenes `CASA` en el exe, incluidos `CASA06A`, `CASA08` y `CASA05`, ausentes de los sitios creados por el port. Documenta sus impactos y sonidos según los radios; falta el contraste jugable y la implementación.

**Antena y objetivo:** `refuerzos-m0.md` distingue `EXPL_ANTENA` del bicho `CASA04`, que se genera desde el VOL y es el objetivo y el disparador de `ESCALA02`. El auditor cruza alturas, sectores y muestras aproximadas de colocación y propagación de una bomba; falta contrastar una colocación y sus impactos en ejecución y corregir la implementación, que vincula ambos por cambio de tiles.

**Cerebros y alarma (2026-11-03):** `audita-vtables-bap.py` contrasta los 44 slots de BAP1/BANPE1 y BAP2/BANPE2; `alerta-m0.md` identifica el receptor y las voces de `AcMetrallero` de los nidos, distintos de `AcBunker`. Falta cerrar las ramas de apuntado y comprobarlas en ejecución.

**Artillero y contacto (2026-11-03):** `obj-armas-fijas.md` identifica `CANONERODISPARA`, la secuencia real de 3 pasos × 24 direcciones y vías que habilitan el disparo ante impactos, sonidos y cambios de objetivo; `q1-colision.md` sigue el mensaje 3 (`MSG_CHOQUE`) hasta ambas fichas y corrige una rama inalcanzable. Falta completar condiciones de disparo y de presencia en la búsqueda espacial.

**Buceo y minas (2026-11-03):** `au-jugador.md` precisa la prueba geométrica del cambio de modo y la contrasta con dos puntos de la costa real; falta la lista de sectores pisados. `obj-explosivos.md` verifica la masa 100 de los cuatro aliados, el umbral 60 de las 22 minas y corrige que la igualdad también activa el contacto; falta comprobar la entrega efectiva de la colisión por contexto.

**Minas y Zodiac, continuación:** las dos macros declaran `CHOC`, el cargador registra ambas y la mina se retira al explotar. Al embarcar, el pasajero se retira de `CHOC`; una vía de salida permite restaurarlo. Se contrastaron masas, cilindros y posiciones declaradas; siguen pendientes posiciones y daños en ejecución.

**Sectores pisados del buzo:** `hud-consumidores.md` identifica la lista, su límite de ocho y el orden de actualización: limpieza, vecinos por contactos no bloqueantes y finalmente sector central. El HUD consulta después de la simulación en los ciclos y estados indicados. Falta contrastar los bordes concretos en ejecución.

**Banderas de explosión y salpicadura:** `render.md` documenta la traducción en ensamblador de la bandera del ANM: bit 1 refleja y bit 2 activa el flag interno `0x08` de suma. En los recursos reales, los 14 fotogramas de explosión llevan 2; el agua lleva ocho 2 y un 0 al final. La suma está confirmada en las rutas RLE normales y con zoom, con y sin mapa de luz. El parser del port pierde esa distinción; falta contrastar el resultado en pantalla.

**Partículas de agua:** `obj-explosivos.md` incorpora selección de los dos tipos, velocidades iniciales, integración con gravedad, factor individual y construcción de tablas de color. Falta reproducir la precisión y comparar el efecto en ejecución.

**Visión y trazado de disparos (2026-11-03):** `organos.md` precisa que cero significa visión despejada y documenta la particularidad de los retornos recursivos de volúmenes; `au-disparar.md` corrige el filtro de candidatos y el retorno del trazado de cuerpos. Falta contrastar la distribución de obstáculos en el árbol y el efecto posterior de cada arma.

**Vista y disparos (2026-11-02):** corregida la lectura del barrido vacío y conectada `.VIGILARDEF` para patrullas; los soldados reales de M0 barren con su amplitud configurada. Armas de fuego: una orden por clic, incluido terreno y agua, sin repetición automática; los límites de cadencia y raycast están en `verificacion-exe.md`.

**Arpón (2026-11-02):** corregido el clic sobre el icono de la mochila que coincidía con la columna, y corregidos impacto letal, munición y recarga. Selección y disparo verificados en navegador con M0; la recarga se muestra en el texto de depuración.

**Piedra e impactos (2026-11-02):** lanzamiento vuelve a reposo; efecto y sonido de caída reales, reacción `NSHERIDO` sin daño y `HERIDO1` con pausa de la animación. La pedrada y la herida emiten `HERI`; las pedradas repetidas también pueden emitir `AL01` según el cerebro. Detalles y límites en `armas-restantes.md`, `muerte.md` y `verificacion-exe.md`.

**Bombas (2026-11-02):** el zapador recupera bombas plantadas con la mano y `PONEBOMBA` al revés; se dibujan con `CARTUCHO` a la altura del suelo. Comprobado en navegador con M0 y archivos reales.

**Mochila (2026-11-02):** los controles normales toman clics por rectángulo y la mochila no deja pasar clics al terreno. La bombona se filtra por bote o agua somera; el límite de sectores pisados queda en `verificacion-exe.md`.

**Carga y altura (2026-11-02):** pantalla de carga con recursos originales y barra durante la preparación. Pistola, mirilla y arpón comprueban alcance y desniveles; quedan volúmenes y cuerpos interpuestos (`docs/lectura/carga-armas-altura.md`).

**Menú e introducción (2026-11-02):** primera versión navegable, guion audiovisual de la primera misión y ficha de objetivos Alt+B conectados, con recursos del jugador y resolución aplicada en menú, presentación y partida. Quedan contraste audiovisual, comandos exclusivos de otros guiones y el resto de opciones; ver atajos en `verificacion-exe.md` y `docs/lectura/intro-briefing.md`.

Última actualización: 2026-10-30 (tras HUD, armas, cursores, balsa, refuerzos y lectura de los 19 .MIS y 96 .MAC). Marcá `[x]` lo que quede hecho. Reglas: nada inventado (lo no leído del exe se marca `shortcut:` en el código), solo commits locales hasta tener algo estable, el usuario hace las pruebas en el juego.

**Revisión de investigación ≥70 % (2026-10-30):** se revisaron las 23 filas que cumplían ese umbral, incluidas las implementadas. Resultados, funciones y líneas: [`docs/lectura/cierre-70.md`](../docs/lectura/cierre-70.md). Los porcentajes ajustados siguen siendo estimaciones; no se marcaron implementaciones por haber leído su regla. Las notas de ese cierre prevalecen sobre las frases históricas que contradigan sus correcciones (piedra, recargas, presos, mochila y sensor de sonido).

**% investigado** = cuánto de la regla está leído del exe/datos (docs en `docs/lectura/`, `docs/research/`). **Dificultad**: Baja = sale rápido (menos de 1 sesión) · Media = 1 sesión · Alta = más de una sesión. Son estimaciones mías, no mediciones.

**Continuación de faltantes (2026-10-30):** [`cierre-faltantes-70.md`](../docs/lectura/cierre-faltantes-70.md) documenta minimapa, PASW de agua, pérdida/selección de objetivo vehicular y22 grafos reales. Los porcentajes de las cuatro áreas se actualizan abajo; recinto final, otras familias y validación audiovisual siguen abiertos.

**Barrido ≥80 % (2026-10-30):** [`cierre-80.md`](../docs/lectura/cierre-80.md) revisa las22 filas A/B que cumplían el umbral al comenzar, con funciones, VA y líneas. Incluye consumidores del recinto y NOVERHASTA, paletas/hover, compuerta/puente/Testigo, acciones y resultados. Contraste directo:115 scripts y166 ANM/1.321 secuencias. Los porcentajes previos se conservan: revisión no significa cierre total ni implementación. Este informe prevalece sobre pendientes históricos contradictorios.

**Misión 0 — cierre de lectura compartida (2026-10-30):** [`cierre-mision-0.md`](../docs/lectura/cierre-mision-0.md) cruza los documentos anteriores para cerrar reglas compartidas de focos/día, sombras/agua, explosivos, regeneración, eventos, voces y Zodiac. No equivale a validar el port: quedan expresamente los cruces por instancia en MAPA0000, el inventario de emisores por cerebro y la comprobación jugable.

**Continuación de misión 0 (2026-10-31):** `cierre-mision-0.md` amplía el cruce de los cuatro aliados y emisores de atención/peligro; `hud-consumidores.md` la temporización del panel y selección de dos variantes de cursor; `render.md` los emisores de agua, sangre y humo y el ANM real de explosión; `organos.md` la búsqueda espacial de volúmenes y planos de sector. Son avances parciales de investigación: todavía no cierran todas las acciones, emisores ni la verificación visual.

## A. Misión 0 (la que se juega hoy)

| ✔ | Qué falta | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [x] | Escaleras y ascensor (`AcEscala`, `AcAscensor`) | 85 % | Media-alta (1-2 sesiones) | `q1-escaleras.md`, `obj-contenedores.md`. Desbloquea la antena y el objetivo CASA04. Hecho: ESCALA01-04 y montacargas (tecla L); ESCALA02 se desactiva al caer CASA04. |
| [x] | Buceo (traje, nadar, minas con buzo) | 80 % | Media (1 sesión) | `au-jugador.md` amplía el cambio de modo y filtros geométricos de tierra/agua profunda; `hud-consumidores.md` cruza la escalera y el cursor. Hecho parcial (tecla N / tirarse del bote parado / derecho = salir): solo LANCHERO, modo agua, visión a la mitad, mina mata al buzo; ruta acuática con filtro del exe probada en M0. shortcut: sin R×2/H×0,125 de render ni `ESCALAUSABLEPORBUZO`. |
| [x] | Zapador: caminar hasta el sitio y animar `PONEBOMBA` | 90 % | Baja | `au-jugador.md` (ManejaBomba). Hoy la bomba se planta al instante. Hecho: camina, anima PONEBOMBA y planta. |
| [x] | CASA04: matar a los de adentro al caer (`MATABICHOSSECTOR`) | 90 % | Baja | `mision-intendencia.md`. Hecho (`KillZone`, `destroyed`). |
| [x] | Zodiac: varada en tierra, hundimiento por impacto, pilotaje real (`AcPilotaje`) | 100 % | Media-alta | Lectura estática completa: `sim-vehiculos.md` §5, `vehiculos.md` y `cierre-70.md` §3, contrastados con ZODIAC5 y la instancia única en MAPA0000 por `tools/investiga-mision0.ts`/`mac-catalogo.ts`. Hecho (2026-11-01): reparto de impacto a bordo, pinchado, motor apagado y bloqueo de plazas (`FUN_004942B0`/`004C2850`), probado con ZODIAC5 real. Sin hacer (atajos en `verificacion-exe.md`): hundimiento a 20 ciclos, reinflado/recogida, balsa varada (SimObjeto) e intercambio de plazas (en M0 solo hay un marino). |
| [ ] | Nidos de ametralladora (`NIDOMET`, 3 en el mapa) | 85 % | Media | `obj-armas-fijas.md`. Los tres artilleros de la macro se cargan con la postura `CANONERO`, vigilan y disparan; sus armas giran y se animan. Falta portar la ráfaga original, el uso por comandos y las demás reglas del habitáculo. |
| [ ] | Casas y cuarteles (`AcCasa`, `AcUsaHab`, refuerzos con alarma) | 100 % | Media-alta | Port parcial: cabo más NSOLDIERS, salida escalonada, reposición individual, relevo básico y regeneración de grupos con reserva compartida; comprobados en MAPA0000. Faltan migración completa y soldados ocultos en la casa; límites en `refuerzos-m0.md` y `verificacion-exe.md`. |
| [ ] | Alarma y voces de los soldados (grito, cadáver avisa a los demás) | 80 % | Alta | Port parcial: BAP1 emite ALRM/VMUE al ver un cadáver; BAP2 emite VMUE y después ALRM al mirar alrededor. Se reproducen sus WAV, igual que AL07 al ir por tabaco. `alarma-global.md` documenta sirena SIRN en bucle, linterna, sensores, posición y cadencia condicionadas por el contexto de dibujo; implementados y comprobados con sectores y recursos reales de M0; falta contrastar la cadencia y otros emisores en el original. Faltan otras reacciones y emisiones, como ALTO y VESP. |
| [x] | Reacción a cadáveres vistos | 80 % | Baja-media | `FUN_006AFC10` releído (`cierre-70.md` §7): muerto/esposado/atontado son categorías distintas. Port parcial (investigan una vez); falta reacción específica completa por cerebro. |
| [ ] | Objetos del mapa: BOYA, BANDERA, SEGNUELO, TESTIGO, CEPO, puertas, focos | 100 % | Media | Lecturas en `obj-puertas.md`, `obj-explosivos.md`, `cierre-80.md` §4 y `cierre-mision-0.md`. El catálogo real confirma que MAPA0000 no instancia focos (FOCO/FOCODEST/INTERFOC solo MAPA0009). Pendiente port e integración de objetos ya leídos. |
| [ ] | Eventos de misión y patrullas (`EVENTO`, `ENLAZAR`, `ESPERAEVENTO`, cambio de ruta) | 100 % | Media | Port parcial: sensor CAMPAMENTO→REAC, salidas de grupos, `EVENTO` de punto, espera y cambio de ruta por evento/enlace. Contraste con MIS reales y caso REXT de M1. En M0 los 11 `ESPERAEVENTO` y 7 `ENLAZAR` valen 0 y no hay `EVENTO`. Faltan otros receptores y contenedores; `patrulla.md`. |
| [x] | Energía real de los alemanes | 90 % | Baja | `cierre-mision-0.md` (Energía de los alemanes): ninguna instancia de M0 pisa `.ENEGIA`, los soldados no están en la tabla `0x815198`, valen 100 (`FUN_0050F020`/`FUN_0050C490`/`FUN_00513D60`). Hecho. Falta solo NIDOMET 200 si se hace destruible. |
| [ ] | Munición y armas de los comandos | 95 % | Media | `au-disparar.md` y `cierre-mision-0.md` cruzan los cuatro aliados, armas, cantidades por defecto y consumo; `cierre-70.md` §5 corrige la piedra. Port (2026-10-31): piedra sin daño ni atontamiento (ruido PEDL 125 + reacción por pedrada), tabaco completo (robar a cadáveres, lanzar cajetilla, BAP2/BANPE2 la recogen y fuman), arpón, botiquín (FRANCOT, 10 curas), control alemán sobre esposados. Faltan granada del jugador (nadie la tiene en M0) y los receptores restantes de la mano. Detalle: `armas-restantes.md`, `tabaco-control.md`. |
| [ ] | Explosiones: cráteres, partículas, temblor de cámara | 100 % | Media | Reglas de mina/bomba/barril/cráter/daño en `obj-explosivos.md`; materiales de CASA04 en `render.md` §4; M0 confirma cuatro bombas y `EXPL_ANTENA` en `cierre-mision-0.md`. Pendiente integración/contraste del port. |
| [ ] | Sonido de la misión (olas, disparos, explosiones, voces) | 90 % | Media-alta | `cierre-mision-0.md` vincula sensor CAMPAMENTO con piedras, señuelo, nidos, bombas, minas, barriles y disparos de las armas de M0; mirilla/arpón no registran ruido de disparo para IA. Web Audio reproduce ambiente, música, jingles, disparos, explosiones y las voces ALRM/VMUE/AL07 con WAV reales y atenuación. Faltan otras voces, pasos, objetos y demás tags; falta validación auditiva. |
| [ ] | HUD de misión 0 (libretas, caras, mochila, tooltips) | 80 % | Alta | Tabla por personaje y minimapa en cierres70; cara/muerte y temporización/posición del panel de ayuda en `hud-consumidores.md`; hover/pulsación en `cierre-80.md`. Faltan variantes de cursor por acción, contextos, contraste en pantalla y alias BMP/RLE. No representa el HUD completo compartido. |
| [x] | Fin de misión: pantalla de resultados, puntuación por tiempo y energía, textos | 85 % | Media | Port de estrellas/rango/FINM/ALMU. `cierre-70.md` §8 confirma rango de campaña ya leído (score/6, tope4); falta portarlo. Restan presentación de bajas, códigos de fin y validación en pantalla. |
| [ ] | Sombras de personajes y partículas de agua (estelas) | 90 % | Media | `render.md` §§2–3/Cierres6–7b y `cierre-mision-0.md`: sombras horneadas/ANM y hotspots. Corregida mezcla FE de tiles; restan detalles finos de partículas y validación visual del port. |
| [ ] | Noche y luces (la misión 0 es de día: baja prioridad) | 100 % | Media | Mecanismo en `render.md` Cierre 2 y `obj-puertas.md` §5; MAPA0000 no tiene foco ni ILUMINADA (solo M9 usa el reloj de noche). Port visual pendiente. |

## B. Resto del juego (no es la misión 0)

| ✔ | Qué falta | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [ ] | Misión 1 a 10: cargar y jugar cada una (MIS, Intendencia, objetivos, victoria) | 60 % | Alta (1 sesión por misión) | Intendencias leídas, mundo ya carga por macros. |
| [ ] | Vehículos: tanque, camión, jeep, lancha, tren, avión | 90 % | Alta (2-3 sesiones) | `cierre-80.md` §3 cierra consumidor de+0x224 (tick de vista) y umbral de lancha; selección/adopción/pérdida CLancha/CTanque en cierres previos. Faltan otras familias/contextos y verificación de vehículos/orilla en juego. |
| [ ] | Animales: perro, león, avestruz, gallina, gaviota | 90 % | Media | `cierre-70.md` §6 + `cierre-faltantes-70.md` §4:22 grafos/211 bases/470 conexiones reales; conservar duplicados. `cierre-80.md` §1b encuentra consumidores de recinto en máscaras0x07000000 de reacción enemiga. Falta validar navegación, vuelo/sombras en pantalla. No está demostrado confinamiento físico ni ataque restringido al recinto. |
| [ ] | Presos, testigos, escoltas (`AcVigilante`), policía y sus refuerzos | 85 % | Media | `cierre-70.md` §7 corrige huida: ruta libre y ausencia de vigilantes activos, no consulta directa de alarma. Custodia, escolta y refuerzos tienen lectura previa; falta integración por misión y validación real. |
| [ ] | Enemigos: cadena de reacciones completa de `AcBap1/2`, `AcBanpe`, Gestapo | 55 % | Alta (2-3 sesiones) | `soldado-acbap.md`, `soldado-acbap2.md`. |
| [ ] | Estados del soldado: esposado, atontado, desnudo, fumar, charlar | 80 % | Media | `cierre-70.md` §§5/7: diferenciar pedrada, cachiporra y animación de cuerpo ya caído. Custodia y estados previos en `detenido.md`/`soldado-acbap.md`; falta port completo por familia. |
| [ ] | Oído: pisadas, disparos por id, los 48 radios de ruido | 90 % | Baja-media | Los48 radios, filtro XY y sensor por sector en `cierre-70.md` §4. `cierre-faltantes-70.md` §2 cierra PASW: bucle de agua0,3, sin radio IA. Faltan otras locomociones y emisores/categorías; huellas visuales separadas. |
| [ ] | Camuflaje, uniformes, señuelos, `TomarControlAleman` | 80 % | Media | `au-jugador.md` + `cierre-70.md` §5: condición de control y receptor por estado comprobados; falta port completo y detalle de todos los contextos de disfraz/visibilidad. |
| [ ] | Armas y objetos del jugador: ballesta, escopeta, lanzallamas, metralleta, cloroformo, esposas, garfio, botiquín, alicate | 90 % | Media (2 sesiones) | `cierre-70.md` §5 corrige contradicciones de recarga/piedra y revisa granada/tabaco. Acciones previas en AU; falta implementación y comprobar contextos/receptores restantes. |
| [ ] | Habilidades por comando (Boina Verde, Francotirador, Marino, Zapador, Conductor, Espía) | 60 % | Media-alta | Tabla de energía y armas leída; reglas por personaje parciales. |
| [x] | Controles del original (izquierda = orden, doble clic = correr, derecha = selección/cancelar) | 85 % | Baja | `cierre-70.md` §8 cierra clic sobre aliado: puede seleccionar según modo/acción actual. Resto en `q1-controles.md`; falta contraste completo de modos/atajos y acciones de cancelación. |
| [ ] | HUD e interfaz compartidos entre misiones (47 ítems, caras, libretas y resoluciones) | 65 % | Alta (2+ sesiones) | `docs/lectura/hud-consumidores.md`: vida/muerte, alarma, CIRC con Mayús, postura, posiciones, panel de ayuda y81 cursores. Recursos contrastados en69 WAD del DIR raíz. Implementados ojo, mira del arpón y cursor de mano; faltan otros cursores por orden y validación en ejecución/tutorial BMP-RLE. |
| [ ] | Sonido y música: Web Audio, 152 sonidos, atenuación, pan, música por misión, voces | 65 % | Media-alta (1-2 sesiones) | `sonido.md`. |
| [x] | Cámara: paso del scroll con zoom menor a 1 | 50 % | Baja | `q1-camara.md` (valor "no leído"). Hecho: `trunc(n/zoom)`. |
| [ ] | Guardado de partidas (`.SAV` texto, `SAVB` binario con CRC32) | 40 % | Media-alta | `.SAV` leído; `SAVB` no. |
| [ ] | Menús, briefing, créditos, pantallas de fin | 30 % | Media-alta | `ui-misiones-guardado.md`. |
| [ ] | Tutorial (`.ROL`, `TUT00..06`) | 30 % | Media | Los 7 mapas ya se cargan y juegan desde el selector (2026-11-02; usan MAPA0008 con `TUT.SEC`; cada uno trae al comando de su prefijo de voz). Falta reproducir el `.ROL` (entrada grabada) con las frases de `rolling/wave`. |
| [ ] | Videos `AVI` (probablemente transcodificar) | 10 % | Media | |
| [ ] | Multijugador / red (`CRed_*`) | 10 % | Alta (3+ sesiones), probablemente fuera de alcance | |

## C. Lectura del exe aún pendiente

- [x] Mapa general con funciones, VA y líneas de Ghidra: `docs/exe-mapa-general.md` (2026-10-30, 49 anclas verificadas; inventario `all2`: 37.026 funciones). Índice reproducible con `tools/mapa-exe.py`; no implica lectura completa del núcleo ni de las funciones sin atribuir.

| ✔ | Qué | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [ ] | Colores y tipo de cada rebanada del cono de visión | 40 % | Media-alta | `render.md` cierre 7c; el decompilado esconde argumentos FPU. |
| [ ] | Contorno exacto de volúmenes de más de 14 vértices y rombo del cilindro | 60 % | Media | `volorder.ts` (atajo declarado). |
| [ ] | Oclusión real de la vista: volúmenes `FUN_0063E200`, `FUN_005F51A0`, `FUN_005F5B80` | 65 % | Media-alta | `organos.md` documenta prueba de polígonos y altura, y recupera salida `t` de `005F51A0` por asm. M0 inicial no tiene sectores secundarios ni cubiertos; faltan límites/callbacks de volúmenes, integración y contraste. |
| [ ] | Núcleo del motor (bucle, mensajes, listas) | 10 % | Alta | |
| [ ] | `AcBap2` (`0x43A0E0…0x43C7F0`) | 0 % | Alta | |
| [ ] | `FUN_006BB320` (prueba de objetivo/zona) | 80 % | Baja-media | `cierre-80.md` §3: identidad, radio estricto, prueba elevada29Z y caché006B7380 leídos con asm. Falta atribuir todos los contextos de llamada; no es permiso vehicular universal. |
| [x] | Fase inicial del barrido de cabeza (hoy casi sincronizada) | 70 % | Baja | `vigilar-vigilante.md`; revisar si el original se ve desfasado. Hecho: confirmada (suma de chars del nombre &15). |

## D. Cosas mías (opcionales, no cambian el juego)

| ✔ | Qué | Dificultad | Notas |
|---|---|---|---|
| [ ] | Listar y pulir los atajos `shortcut:` del código (`/ponytail-debt`) | Baja (listar) / varía (pulir) | |
| [ ] | Herramientas de calidad: `dep-cruiser`, Stryker, `size-limit`, `gitleaks`, `osv-scanner`, `semgrep` | Media | Conviene antes de subir algo a git. |

## E. Descartado por decisión del usuario

- Revisar el exe de Legacy (cifrado): olvidado.
- Mediciones en vivo del juego original: las hace el usuario cuando sea jugable.
- `git push` / CI: solo commits locales hasta que haya algo estable.
