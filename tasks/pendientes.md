# Pendientes (lista maestra para ir tachando)

Última actualización: 2026-10-30. Marcá `[x]` lo que quede hecho. Reglas: nada inventado (lo no leído del exe se marca `shortcut:` en el código), solo commits locales hasta tener algo estable, el usuario hace las pruebas en el juego.

**% investigado** = cuánto de la regla está leído del exe/datos (docs en `docs/lectura/`, `docs/research/`). **Dificultad**: Baja = sale rápido (menos de 1 sesión) · Media = 1 sesión · Alta = más de una sesión. Son estimaciones mías, no mediciones.

## A. Misión 0 (la que se juega hoy)

| ✔ | Qué falta | % investigado | Dificultad | Notas |
|---|---|---|---|---|
| [ ] | Escaleras y ascensor (`AcEscala`, `AcAscensor`) | 85 % | Media-alta (1-2 sesiones) | `q1-escaleras.md`, `obj-contenedores.md`. Desbloquea la antena y el objetivo CASA04. |
| [ ] | Buceo (traje, nadar, minas con buzo) | 80 % | Media (1 sesión) | `au-jugador.md`; falta el modo agua del movimiento y el volumen reducido del buzo. |
| [ ] | Zapador: caminar hasta el sitio y animar `PONEBOMBA` | 90 % | Baja | `au-jugador.md` (ManejaBomba). Hoy la bomba se planta al instante. |
| [ ] | CASA04: matar a los de adentro al caer (`MATABICHOSSECTOR`) | 90 % | Baja | `mision-intendencia.md`. |
| [ ] | Zodiac: varada en tierra, hundimiento por impacto, pilotaje real (`AcPilotaje`) | 70 % | Media-alta | `sim-vehiculos.md` leído; las acciones `AcCLancha/AcPilotaje` no. |
| [ ] | Nidos de ametralladora (`NIDOMET`, 3 en el mapa) | 85 % | Media | `obj-armas-fijas.md`. |
| [ ] | Casas y cuarteles (`AcCasa`, `AcUsaHab`, refuerzos con alarma) | 80 % | Media-alta | `obj-contenedores.md`. |
| [ ] | Alarma y voces de los soldados (grito, cadáver avisa a los demás) | 60 % | Alta | `soldado-acbap.md`; `AcBap2` (17 funciones) sin leer. |
| [ ] | Reacción a cadáveres vistos | 70 % | Baja-media | Clasificador `FUN_006AFC10` leído. |
| [ ] | Objetos del mapa: BOYA, BANDERA, SEGNUELO, TESTIGO, CEPO, puertas, focos | 75 % | Media | `obj-explosivos.md`, `obj-puertas.md`; se dibujan pero no hacen nada. |
| [ ] | Eventos de misión y patrullas (`EVENTO`, `ENLAZAR`, `ESPERAEVENTO`, cambio de ruta) | 80 % | Media | `patrulla.md`, `mision-intendencia.md` §5. |
| [ ] | Energía real de los alemanes (hoy 100 por defecto, sin leer) | 30 % | Baja | Hay que leer `ENEGIA` por defecto del cargador del bicho. |
| [ ] | Munición y armas de los comandos (hoy infinita; faltan granada, piedra, tabaco…) | 80 % | Media | `au-disparar.md`. |
| [ ] | Explosiones: cráteres, partículas, temblor de cámara | 60 % | Media | `obj-explosivos.md`, `render.md` (temblor leído). |
| [ ] | Sonido de la misión (olas, disparos, explosiones, voces) | 65 % | Media-alta | `sonido.md`; falta todo Web Audio. |
| [ ] | HUD real (libretas, caras, mochila, tooltips) | 20 % | Alta | Marco de ventanas leído; reglas del HUD no. |
| [ ] | Fin de misión: pantalla de resultados, puntuación por tiempo y energía, textos | 75 % | Media | `ui-misiones-guardado.md` §3 (fórmulas). |
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
| [ ] | Oído: pisadas, disparos por id, los 48 radios de ruido | 70 % | Baja-media | `percepcion.md`, `obj-explosivos.md` §0 (tabla de ruidos). |
| [ ] | Camuflaje, uniformes, señuelos, `TomarControlAleman` | 70 % | Media | `au-jugador.md`. |
| [ ] | Armas y objetos del jugador: ballesta, escopeta, lanzallamas, metralleta, cloroformo, esposas, garfio, botiquín, alicate | 80 % | Media (2 sesiones) | `au-disparar.md`, `au-jugador.md`. |
| [ ] | Habilidades por comando (Boina Verde, Francotirador, Marino, Zapador, Conductor, Espía) | 60 % | Media-alta | Tabla de energía y armas leída; reglas por personaje parciales. |
| [ ] | Controles del original (izquierda = orden, doble clic = correr, derecha = selección/cancelar) | 70 % | Baja | `q1-controles.md`. |
| [ ] | HUD e interfaz completos (47 ítems, caras, libretas, 1280×720 y 640×480) | 20 % | Alta (2+ sesiones) | Tabla de ítems leída; consumidores no. |
| [ ] | Sonido y música: Web Audio, 152 sonidos, atenuación, pan, música por misión, voces | 65 % | Media-alta (1-2 sesiones) | `sonido.md`. |
| [ ] | Cámara: paso del scroll con zoom menor a 1 | 50 % | Baja | `q1-camara.md` (valor "no leído"). |
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
| [ ] | Oclusión real de la vista (`FUN_005F9820`, volúmenes `FUN_0063E200`) | 40 % | Alta | Hoy: sectores Ocluso + altura de los pies. |
| [ ] | Núcleo del motor (bucle, mensajes, listas) | 10 % | Alta | |
| [ ] | `AcBap2` (`0x43A0E0…0x43C7F0`) | 0 % | Alta | |
| [ ] | `FUN_006BB320` (zona permitida del vehículo del jugador) | 0 % | Baja-media | |
| [ ] | Fase inicial del barrido de cabeza (hoy casi sincronizada) | 70 % | Baja | `vigilar-vigilante.md`; revisar si el original se ve desfasado. |

## D. Cosas mías (opcionales, no cambian el juego)

| ✔ | Qué | Dificultad | Notas |
|---|---|---|---|
| [ ] | Listar y pulir los atajos `shortcut:` del código (`/ponytail-debt`) | Baja (listar) / varía (pulir) | |
| [ ] | Herramientas de calidad: `dep-cruiser`, Stryker, `size-limit`, `gitleaks`, `osv-scanner`, `semgrep` | Media | Conviene antes de subir algo a git. |

## E. Descartado por decisión del usuario

- Revisar el exe de Legacy (cifrado): olvidado.
- Mediciones en vivo del juego original: las hace el usuario cuando sea jugable.
- `git push` / CI: solo commits locales hasta que haya algo estable.
