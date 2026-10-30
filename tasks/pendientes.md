# Pendientes (lista maestra para ir tachando)

Última actualización: 2026-10-30 (tras HUD, armas, cursores, balsa, refuerzos y lectura de los 19 .MIS y 96 .MAC). Marcá `[x]` lo que quede hecho. Reglas: nada inventado (lo no leído del exe se marca `shortcut:` en el código), solo commits locales hasta tener algo estable, el usuario hace las pruebas en el juego.

**Revisión de investigación ≥70 % (2026-10-30):** se revisaron las 23 filas que cumplían ese umbral, incluidas las implementadas. Resultados, funciones y líneas: [`docs/lectura/cierre-70.md`](../docs/lectura/cierre-70.md). Los porcentajes ajustados siguen siendo estimaciones; no se marcaron implementaciones por haber leído su regla. Las notas de ese cierre prevalecen sobre las frases históricas que contradigan sus correcciones (piedra, recargas, presos, mochila y sensor de sonido).

**% investigado** = cuánto de la regla está leído del exe/datos (docs en `docs/lectura/`, `docs/research/`). **Dificultad**: Baja = sale rápido (menos de 1 sesión) · Media = 1 sesión · Alta = más de una sesión. Son estimaciones mías, no mediciones.

**Continuación de faltantes (2026-10-30):** [`cierre-faltantes-70.md`](../docs/lectura/cierre-faltantes-70.md) documenta minimapa, PASW de agua, pérdida/selección de objetivo vehicular y22 grafos reales. Los porcentajes de las cuatro áreas se actualizan abajo; recinto final, otras familias y validación audiovisual siguen abiertos.

**Barrido ≥80 % (2026-10-30):** [`cierre-80.md`](../docs/lectura/cierre-80.md) revisa las22 filas A/B que cumplían el umbral al comenzar, con funciones, VA y líneas. Incluye consumidores del recinto y NOVERHASTA, paletas/hover, compuerta/puente/Testigo, acciones y resultados. Contraste directo:115 scripts y166 ANM/1.321 secuencias. Los porcentajes previos se conservan: revisión no significa cierre total ni implementación. Este informe prevalece sobre pendientes históricos contradictorios.

## A. Misión 0 (la que se juega hoy)

| ✔ | Qué falta | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [x] | Escaleras y ascensor (`AcEscala`, `AcAscensor`) | 85 % | Media-alta (1-2 sesiones) | `q1-escaleras.md`, `obj-contenedores.md`. Desbloquea la antena y el objetivo CASA04. Hecho: ESCALA01-04 y montacargas (tecla L); ESCALA02 se desactiva al caer CASA04. |
| [x] | Buceo (traje, nadar, minas con buzo) | 80 % | Media (1 sesión) | `au-jugador.md`; falta el modo agua del movimiento y el volumen reducido del buzo. Hecho (tecla N / tirarse del bote parado / derecho = salir): solo LANCHERO, modo agua, visión a la mitad, mina mata al buzo. shortcut: recto sin rutas, sin R×2/H×0,125 de render ni `ESCALAUSABLEPORBUZO`. |
| [x] | Zapador: caminar hasta el sitio y animar `PONEBOMBA` | 90 % | Baja | `au-jugador.md` (ManejaBomba). Hoy la bomba se planta al instante. Hecho: camina, anima PONEBOMBA y planta. |
| [x] | CASA04: matar a los de adentro al caer (`MATABICHOSSECTOR`) | 90 % | Baja | `mision-intendencia.md`. Hecho (`KillZone`, `destroyed`). |
| [ ] | Zodiac: varada en tierra, hundimiento por impacto, pilotaje real (`AcPilotaje`) | 90 % | Media-alta | `cierre-70.md` §3: reparto de daño, pinchado y cambio SimBalsa/SimObjeto leídos; plazas ya documentadas. Falta portarlos y verificar la transición de orilla en pantalla. Solo el marine pilota en M0. |
| [x] | Nidos de ametralladora (`NIDOMET`, 3 en el mapa) | 85 % | Media | `obj-armas-fijas.md`. Hecho: artillero fijo, vista `.MOD`/`.ANG`, ruido 500. |
| [ ] | Casas y cuarteles (`AcCasa`, `AcUsaHab`, refuerzos con alarma) | 95 % | Media-alta | Entrar/salir y grupos de M0 implementados. Regeneración individual/de grupo ya leída; `cierre-70.md` §4 cierra sensor → slot7 de intendencia → difusión. Falta implementación completa y validación en juego. |
| [ ] | Alarma y voces de los soldados (grito, cadáver avisa a los demás) | 65 % | Alta | **Hecho:** BAP1/BANPE1 miran el estímulo y BAP2/BANPE2 caminan (`soldado-acbap2.md` §0). Falta la cadena de reacciones de `AcBap2`, alarma por voces y qué sonidos son de peligro (`sonido.md` cierre 3). |
| [x] | Reacción a cadáveres vistos | 80 % | Baja-media | `FUN_006AFC10` releído (`cierre-70.md` §7): muerto/esposado/atontado son categorías distintas. Port parcial (investigan una vez); falta reacción específica completa por cerebro. |
| [ ] | Objetos del mapa: BOYA, BANDERA, SEGNUELO, TESTIGO, CEPO, puertas, focos | 80 % | Media | **Hecho:** BOYA/BANDERA animadas; **CEPO y SEGNUELO** colocables desde la mochila (`engine/traps.ts`: el cepo mata, el señuelo hace ruido de radio 300). `cierre-80.md` §4 lee Testigo, compuerta, puente y control; falta portarlos, focos y contraste visual. |
| [ ] | Eventos de misión y patrullas (`EVENTO`, `ENLAZAR`, `ESPERAEVENTO`, cambio de ruta) | 95 % | Media | `cierre-70.md` §4: tipo6 → `FUN_0059CEA0` → `FUN_0059A060`, máscaras del sector. Rutas/esperas/cambio por evento ya leídos en `patrulla.md`; falta portarlos para otras misiones. M0 tiene REAC y patrulla libre. |
| [x] | Energía real de los alemanes (hoy 100 por defecto, sin leer) | 30 % | Baja | Hay que leer `ENEGIA` por defecto del cargador del bicho. Hecho: 100 confirmado en `ClassBicho`. |
| [ ] | Munición y armas de los comandos | 90 % | Media | `cierre-70.md` §5: recarga pistola1/metralleta10, piedra no atonta600 como puño; granada y tabaco contrastados. Falta portar acciones restantes y corregir piedra. Reglas previas en `au-jugador.md`; límites de investigación por receptor/contexto en el cierre. |
| [ ] | Explosiones: cráteres, partículas, temblor de cámara | 60 % | Media | `obj-explosivos.md`, `render.md` (temblor leído). |
| [ ] | Sonido de la misión (olas, disparos, explosiones, voces) | 65 % | Media-alta | `sonido.md`; falta todo Web Audio. |
| [ ] | HUD real (libretas, caras, mochila, tooltips) | 95 % | Alta | Tabla por personaje y balas en `cierre-70.md` §2; transformación, clic y marcadores del minimapa en `cierre-faltantes-70.md` §1,9 libretas reales validadas. Hover/pulsación y paletas nominales leídos en `cierre-80.md` §2. Falta portar, colores concretos de bancos, contextos restantes y contraste en pantalla; alias BMP/RLE pendiente. |
| [x] | Fin de misión: pantalla de resultados, puntuación por tiempo y energía, textos | 85 % | Media | Port de estrellas/rango/FINM/ALMU. `cierre-70.md` §8 confirma rango de campaña ya leído (score/6, tope4); falta portarlo. Restan presentación de bajas, códigos de fin y validación en pantalla. |
| [ ] | Sombras de personajes y partículas de agua (estelas) | 50 % | Media | `render.md`. |
| [ ] | Noche y luces (la misión 0 es de día: baja prioridad) | 85 % | Media | Curvas leídas en `render.md` cierre 2. |

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
| [ ] | HUD e interfaz completos (47 ítems, caras, libretas, 1280×720 y 640×480) | 20 % | Alta (2+ sesiones) | Tabla de ítems leída; consumidores no. |
| [ ] | Sonido y música: Web Audio, 152 sonidos, atenuación, pan, música por misión, voces | 65 % | Media-alta (1-2 sesiones) | `sonido.md`. |
| [x] | Cámara: paso del scroll con zoom menor a 1 | 50 % | Baja | `q1-camara.md` (valor "no leído"). Hecho: `trunc(n/zoom)`. |
| [ ] | Guardado de partidas (`.SAV` texto, `SAVB` binario con CRC32) | 40 % | Media-alta | `.SAV` leído; `SAVB` no. |
| [ ] | Menús, briefing, créditos, pantallas de fin | 30 % | Media-alta | `ui-misiones-guardado.md`. |
| [ ] | Tutorial (`.ROL`, `TUT00..06`) | 30 % | Media | |
| [ ] | Videos `AVI` (probablemente transcodificar) | 10 % | Media | |
| [ ] | Multijugador / red (`CRed_*`) | 10 % | Alta (3+ sesiones), probablemente fuera de alcance | |

## C. Lectura del exe aún pendiente

- [x] Mapa general con funciones, VA y líneas de Ghidra: `docs/exe-mapa-general.md` (2026-10-30, 49 anclas verificadas; inventario `all2`: 37.026 funciones). Índice reproducible con `tools/mapa-exe.py`; no implica lectura completa del núcleo ni de las funciones sin atribuir.

| ✔ | Qué | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [ ] | Colores y tipo de cada rebanada del cono de visión | 40 % | Media-alta | `render.md` cierre 7c; el decompilado esconde argumentos FPU. |
| [ ] | Contorno exacto de volúmenes de más de 14 vértices y rombo del cilindro | 60 % | Media | `volorder.ts` (atajo declarado). |
| [ ] | Oclusión real de la vista: volúmenes `FUN_0063E200`, `FUN_005F51A0`, `FUN_005F5B80` | 65 % | Media-alta | `FUN_005F9820` ya portada (`Nav.sight`: pendiente sobre bordes de sector, alturas de ojo). Falta lo demás. |
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
