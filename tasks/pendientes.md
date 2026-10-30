# Pendientes (lista maestra para ir tachando)

Última actualización: 2026-10-30 (tras HUD, armas, cursores, balsa, refuerzos y lectura de los 19 .MIS y 96 .MAC). Marcá `[x]` lo que quede hecho. Reglas: nada inventado (lo no leído del exe se marca `shortcut:` en el código), solo commits locales hasta tener algo estable, el usuario hace las pruebas en el juego.

**% investigado** = cuánto de la regla está leído del exe/datos (docs en `docs/lectura/`, `docs/research/`). **Dificultad**: Baja = sale rápido (menos de 1 sesión) · Media = 1 sesión · Alta = más de una sesión. Son estimaciones mías, no mediciones.

## A. Misión 0 (la que se juega hoy)

| ✔ | Qué falta | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [x] | Escaleras y ascensor (`AcEscala`, `AcAscensor`) | 85 % | Media-alta (1-2 sesiones) | `q1-escaleras.md`, `obj-contenedores.md`. Desbloquea la antena y el objetivo CASA04. Hecho: ESCALA01-04 y montacargas (tecla L); ESCALA02 se desactiva al caer CASA04. |
| [x] | Buceo (traje, nadar, minas con buzo) | 80 % | Media (1 sesión) | `au-jugador.md`; falta el modo agua del movimiento y el volumen reducido del buzo. Hecho (tecla N / tirarse del bote parado / derecho = salir): solo LANCHERO, modo agua, visión a la mitad, mina mata al buzo. shortcut: recto sin rutas, sin R×2/H×0,125 de render ni `ESCALAUSABLEPORBUZO`. |
| [x] | Zapador: caminar hasta el sitio y animar `PONEBOMBA` | 90 % | Baja | `au-jugador.md` (ManejaBomba). Hoy la bomba se planta al instante. Hecho: camina, anima PONEBOMBA y planta. |
| [x] | CASA04: matar a los de adentro al caer (`MATABICHOSSECTOR`) | 90 % | Baja | `mision-intendencia.md`. Hecho (`KillZone`, `destroyed`). |
| [ ] | Zodiac: varada en tierra, hundimiento por impacto, pilotaje real (`AcPilotaje`) | 75 % | Media-alta | `sim-vehiculos.md`. **Hecho:** solo el piloto (marino, `AcUsaHab .HABILIDAD BALSA`) maneja la balsa, los demás van de pasajeros desde la plaza 1 (`FUN_004B74D0`, `FUN_005034A0`). Falta intercambio de plazas, varada, hundimiento por impacto. |
| [x] | Nidos de ametralladora (`NIDOMET`, 3 en el mapa) | 85 % | Media | `obj-armas-fijas.md`. Hecho: artillero fijo, vista `.MOD`/`.ANG`, ruido 500. |
| [ ] | Casas y cuarteles (`AcCasa`, `AcUsaHab`, refuerzos con alarma) | 85 % | Media-alta | **Hecho:** entrar/salir, ocultos, cuartel mortal y **refuerzos por evento de zona**: al dispararse una pistola dentro de la zona `CAMPAMENTO` salen los grupos de `CASA_REACT_01..03` (`engine/groups.ts`, `mis-todos.md`). Falta regeneración (`NUMREGENSOLDIERS`) y el sensor de sonido real. |
| [ ] | Alarma y voces de los soldados (grito, cadáver avisa a los demás) | 65 % | Alta | **Hecho:** BAP1/BANPE1 miran el estímulo y BAP2/BANPE2 caminan (`soldado-acbap2.md` §0). Falta la cadena de reacciones de `AcBap2`, alarma por voces y qué sonidos son de peligro (`sonido.md` cierre 3). |
| [x] | Reacción a cadáveres vistos | 70 % | Baja-media | Clasificador `FUN_006AFC10` leído. Hecho: investigan una vez. |
| [ ] | Objetos del mapa: BOYA, BANDERA, SEGNUELO, TESTIGO, CEPO, puertas, focos | 80 % | Media | **Hecho:** BOYA/BANDERA animadas; **CEPO y SEGNUELO** colocables desde la mochila (`engine/traps.ts`: el cepo mata, el señuelo hace ruido de radio 300). Falta `AcTestigo` (activar/desactivar y objetivos), focos, puertas. |
| [ ] | Eventos de misión y patrullas (`EVENTO`, `ENLAZAR`, `ESPERAEVENTO`, cambio de ruta) | 85 % | Media | La misión 0 no usa `ESPERAEVENTO`/`ENLAZAR`/`.CASA` (todos 0); son de las misiones 1–10 (`mis-todos.md`). **Hecho** lo que sí usa: grupos `.PATRULLAS` con evento `REAC` y patrulla libre. |
| [x] | Energía real de los alemanes (hoy 100 por defecto, sin leer) | 30 % | Baja | Hay que leer `ENEGIA` por defecto del cargador del bicho. Hecho: 100 confirmado en `ClassBicho`. |
| [ ] | Munición y armas de los comandos | 85 % | Media | **Hecho:** pistola, mirilla (retícula `C_MIRILL`, balas), cuchillo, **puño** (atonta 600 ciclos), **esposas**, **piedra** (100), cepo, señuelo, bomba; clic en el ítem de la mochila + cursor del arma. Falta granada (zapador), tabaco, mano (`AuCoger`), control alemán, arpón, botiquín, lanzallamas. Shortcuts en `tasks/verificacion-exe.md`. |
| [ ] | Explosiones: cráteres, partículas, temblor de cámara | 60 % | Media | `obj-explosivos.md`, `render.md` (temblor leído). |
| [ ] | Sonido de la misión (olas, disparos, explosiones, voces) | 65 % | Media-alta | `sonido.md`; falta todo Web Audio. |
| [ ] | HUD real (libretas, caras, mochila, tooltips) | 80 % | Alta | **Hecho:** tira, columna, caras+sangre, mochila con ítems por comando (posiciones y flags leídos de la memoria del juego), ítems en vehículo, foto solo en vehículo, balas del francotirador, iluminado, cursores. Falta libreta/minimapa (`LIBRnnnn.RLE`), botones de postura, tooltips, mochila a la izquierda sin captura, zapador con 3 posiciones de captura. |
| [x] | Fin de misión: pantalla de resultados, puntuación por tiempo y energía, textos | 75 % | Media | `ui-misiones-guardado.md` §3 (fórmulas). Hecho en `engine/score.ts`: estrellas de tiempo/energía, rango, FINM/ALMU, par de `PUNTUACIONES`. Faltan rango de campaña, bajas por tipo y los códigos 2/3/6/7/8/0xB. |
| [ ] | Sombras de personajes y partículas de agua (estelas) | 50 % | Media | `render.md`. |
| [ ] | Noche y luces (la misión 0 es de día: baja prioridad) | 85 % | Media | Curvas leídas en `render.md` cierre 2. |

## B. Resto del juego (no es la misión 0)

| ✔ | Qué falta | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [ ] | Misión 1 a 10: cargar y jugar cada una (MIS, Intendencia, objetivos, victoria) | 60 % | Alta (1 sesión por misión) | Intendencias leídas, mundo ya carga por macros. |
| [ ] | Vehículos: tanque, camión, jeep, lancha, tren, avión | 75 % | Alta (2-3 sesiones) | `sim-vehiculos.md`; acciones `AcCLancha/AcCTanque/AcPilotaje/AcTiroAlBlanco` sin leer. |
| [ ] | Animales: perro, león, avestruz, gallina, gaviota | 70 % | Media | `animales.md`, `perro.md`; avestruz/gaviota a fondo sin leer. |
| [ ] | Presos, testigos, escoltas (`AcVigilante`), policía y sus refuerzos | 70 % | Media | `presos-testigos.md`, `policia.md`. |
| [ ] | Enemigos: cadena de reacciones completa de `AcBap1/2`, `AcBanpe`, Gestapo | 55 % | Alta (2-3 sesiones) | `soldado-acbap.md`, `soldado-acbap2.md`. |
| [ ] | Estados del soldado: esposado, atontado, desnudo, fumar, charlar | 70 % | Media | `detenido.md`, `soldado-acbap.md`. |
| [ ] | Oído: pisadas, disparos por id, los 48 radios de ruido | 70 % | Baja-media | `percepcion.md`, `obj-explosivos.md` §0 (tabla de ruidos). **Parcial:** Hecho radios por sonido (PIPA 600, FUSL 400, NIDO 500, XPLO 1200); faltan pisadas y el resto de la tabla. |
| [ ] | Camuflaje, uniformes, señuelos, `TomarControlAleman` | 70 % | Media | `au-jugador.md`. |
| [ ] | Armas y objetos del jugador: ballesta, escopeta, lanzallamas, metralleta, cloroformo, esposas, garfio, botiquín, alicate | 80 % | Media (2 sesiones) | `au-disparar.md`, `au-jugador.md`. |
| [ ] | Habilidades por comando (Boina Verde, Francotirador, Marino, Zapador, Conductor, Espía) | 60 % | Media-alta | Tabla de energía y armas leída; reglas por personaje parciales. |
| [x] | Controles del original (izquierda = orden, doble clic = correr, derecha = selección/cancelar) | 70 % | Baja | `q1-controles.md`. Hecho: izq=orden, doble clic=correr, derecho corto=cancelar, arrastrado=selección. |
| [ ] | HUD e interfaz completos (47 ítems, caras, libretas, 1280×720 y 640×480) | 20 % | Alta (2+ sesiones) | Tabla de ítems leída; consumidores no. |
| [ ] | Sonido y música: Web Audio, 152 sonidos, atenuación, pan, música por misión, voces | 65 % | Media-alta (1-2 sesiones) | `sonido.md`. |
| [x] | Cámara: paso del scroll con zoom menor a 1 | 50 % | Baja | `q1-camara.md` (valor "no leído"). Hecho: `trunc(n/zoom)`. |
| [ ] | Guardado de partidas (`.SAV` texto, `SAVB` binario con CRC32) | 40 % | Media-alta | `.SAV` leído; `SAVB` no. |
| [ ] | Menús, briefing, créditos, pantallas de fin | 30 % | Media-alta | `ui-misiones-guardado.md`. |
| [ ] | Tutorial (`.ROL`, `TUT00..06`) | 30 % | Media | |
| [ ] | Videos `AVI` (probablemente transcodificar) | 10 % | Media | |
| [ ] | Multijugador / red (`CRed_*`) | 10 % | Alta (3+ sesiones), probablemente fuera de alcance | |

## C. Lectura del exe aún pendiente

| ✔ | Qué | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [ ] | Colores y tipo de cada rebanada del cono de visión | 40 % | Media-alta | `render.md` cierre 7c; el decompilado esconde argumentos FPU. |
| [ ] | Contorno exacto de volúmenes de más de 14 vértices y rombo del cilindro | 60 % | Media | `volorder.ts` (atajo declarado). |
| [ ] | Oclusión real de la vista: volúmenes `FUN_0063E200`, `FUN_005F51A0`, `FUN_005F5B80` | 65 % | Media-alta | `FUN_005F9820` ya portada (`Nav.sight`: pendiente sobre bordes de sector, alturas de ojo). Falta lo demás. |
| [ ] | Núcleo del motor (bucle, mensajes, listas) | 10 % | Alta | |
| [ ] | `AcBap2` (`0x43A0E0…0x43C7F0`) | 0 % | Alta | |
| [ ] | `FUN_006BB320` (zona permitida del vehículo del jugador) | 0 % | Baja-media | |
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
