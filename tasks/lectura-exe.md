# Lectura del exe — alcance: lo necesario para jugar casi nativamente

Decisión del usuario (2026-10-29): **no leer el exe entero**, sino lo que hace falta para jugar casi nativamente. Herramienta `tools/readbatch.py`; registro `tasks/lectura-exe.tsv` (qué funciones se leyeron); notas por tema en `docs/lectura/`. `py -I tools/readbatch.py faltan <lo> <hi>` dice cuánto queda en un rango; `rango <lo> <hi> [KB]` saca la tanda.

## Fuera de alcance
Editor interno (restos de diálogos `D_EA_*`), menús/front-end, red, CRT, desenrollado de excepciones, librería estándar, guardado (salvo que se pida).

## Orden de lectura (cada punto: qué se juega con él → rango del exe)
| # | Tema | Por qué | Rango / familia |
|---|---|---|---|
| ✅ | Órganos: vista, oído, memoria | percepción enemiga | `docs/lectura/organos.md` |
| ✅ | Impactos y daño (receptores) | muerte, armas | `docs/lectura/impactos.md` |
| ✅ | Parachoques, búsqueda local | colisión por tipo de cuerpo | `parachoques.md`, `grid-seek.md` |
| ✅ | **Acciones del jugador `AU*`** (todas) | lo que el jugador puede hacer | `docs/lectura/au-jugador.md`, `au-disparar.md`, `vehiculos.md` |
| ✅ (+agente) | **Cerebro del soldado** `AcBap/Bap1/Bap2/Banpe*`, `AcFusilador` | reacciones del enemigo | `0x42F4A0–0x438A40` y vecinos |
| P3 | Enemigos: `AcGuarda` `0x4703D0–0x472FD0`, `AcVigilar` `0x4C0A60–0x4C1B90`, `AcPatrulla`, `AcDisparar` `0x45A020–0x45B200`, `AcDetenido` `0x458920–0x459970`, `AcMuerte` `0x4846B0–0x485850`, `AcBuscador` `0x445850–0x447200`, `AcPerro` `0x48E8C0–0x491DE0` | patrulla, alarma, disparo, arresto, muerte, perros | rangos indicados |
| ✅ | Objetos de la misión (`docs/lectura/obj-*.md`): `AcMina`, `AcBomba`, `AcCasa`/`AcUsaHabitaculo` `0x4B71D0–0x4BA760`, `AcZodiac`, `AcAscensor`, cuartel, metralleta, nido | contenedores (bote, casas), explosivos | por clase |
| ✅ | Misión / intendencia / puntuación | objetivos y fin de misión | `docs/lectura/mision-intendencia.md` |
| P6 | Motores (97 KB) y Simulación/bichos (67 KB) | vehículos y cuerpos | familias `#14`, `#22` |
| P7 | HUD de selección e inventario; cámara/zonas de selección (60 KB) | selección, mochila, cursor | familias `#10` (subconjunto), `#6` |
| P8 | Núcleo del motor (55 KB) | bucle, mensajes, bicho base | familia `#15` |
| P9 | Sonido (qué suena y con qué atenuación) | ambiente | familia `#23` |

## Estado 2026-10-29 (cierre de dudas)
Cerrado con notas: AU*, soldado, enemigos (`guarda`, `vigilar-vigilante`, `patrulla`, `ac-disparar`, `detenido`, `muerte`, `buscador`, `perro`, `soldado-acbap2`), objetos y misión, escaleras (§4c), cámara, orden de dibujo, flags de sector, colisión (formas de contacto), embudo de rutas. En curso: render y sonido (`render.md`, `sonido.md`).
Pendiente declarado: dinámica de los `Sim*` de vehículo (`0x665ED0–0x66C000`: SimAuto/Tanque/Lancha/Balsa/Sub/Ave/Misil), que solo hace falta al portar el primer vehículo; HUD de selección/inventario; núcleo del motor (`FUN_005C47D0` y vecinos); lobby/menús/red (fuera de alcance).
