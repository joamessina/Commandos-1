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
| P1 | **Acciones del jugador `AU*`** (35: disparar, acuchillar, agacharse, coger, usar, camuflarse, disfraz, esposas, garfio, etc.) | lo que el jugador puede hacer | `0x4E5000–0x505000` (~128 KB; AUEscalar y AuGoTo ya leídos) |
| P2 | **Cerebro del soldado** `AcBap/Bap1/Bap2/Banpe*`, `AcFusilador` | reacciones del enemigo | `0x42F4A0–0x438A40` y vecinos |
| P3 | Enemigos: `AcGuarda` `0x4703D0–0x472FD0`, `AcVigilar` `0x4C0A60–0x4C1B90`, `AcPatrulla`, `AcDisparar` `0x45A020–0x45B200`, `AcDetenido` `0x458920–0x459970`, `AcMuerte` `0x4846B0–0x485850`, `AcBuscador` `0x445850–0x447200`, `AcPerro` `0x48E8C0–0x491DE0` | patrulla, alarma, disparo, arresto, muerte, perros | rangos indicados |
| P4 | Objetos de la misión: `AcMina`, `AcBomba`, `AcCasa`/`AcUsaHabitaculo` `0x4B71D0–0x4BA760`, `AcZodiac`, `AcAscensor`, cuartel, metralleta, nido | contenedores (bote, casas), explosivos | por clase |
| P5 | Misión / intendencia / puntuación (558 funcs, 62 KB) | objetivos y fin de misión | familia `#13` |
| P6 | Motores (97 KB) y Simulación/bichos (67 KB) | vehículos y cuerpos | familias `#14`, `#22` |
| P7 | HUD de selección e inventario; cámara/zonas de selección (60 KB) | selección, mochila, cursor | familias `#10` (subconjunto), `#6` |
| P8 | Núcleo del motor (55 KB) | bucle, mensajes, bicho base | familia `#15` |
| P9 | Sonido (qué suena y con qué atenuación) | ambiente | familia `#23` |
