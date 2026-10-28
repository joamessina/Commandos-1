# Prioridades (Q1 = lo más urgente, Q4 = lo que puede esperar)

Meta que ordena todo: **misión 0 jugable de punta a punta, 1:1 con el original**. Hoy hay un visor del mapa estático (edificios sanos, sin personajes). Criterio de orden: (1) ¿destraba lo que viene después? (2) ¿se puede hacer ya, con lo leído? (3) ¿cuánto riesgo de rehacerlo si se hace tarde?
Lo que pide la misión 0 (medido en `MAPA0000.MIS`): 82 macros de 18 tipos (todos con `.MAC` presente): `MINASUB` 22, `BANPE1` 13, `BAP2` 6, `BAP1` 5, `CASA` 4, `ESCALA` 4, `BANPE2` 4, `BOMBAACT` 4, `METRBASE` 3, `NIDOMET` 3, `CUARTEL` 3, `BARRIL` 3, `BANDERA` 3, `TESTIGO`, `ZODIAC5`, `SEGNUELO`, `CEPO`, `BOYA`; 4 comandos aliados; 22 rutas de patrulla; 1 tripline; `acExplotaCasa`, `AcPilotaje` (lancha), `AcAscensor`. Es decir: soldados que patrullan y ven/oyen, minas, escaleras, barriles/bombas, una lancha y un ascensor.

---
## A. IMPLEMENTACIÓN

### Q1 — Ya: es la ruta crítica para ver y mover un comando
| # | Qué | Por qué es urgente | Listo cuando | Depende de |
|---|---|---|---|---|
| I1 | **Parser `.CLAVE [ ]` en TS** (`MIS`, `MAC`, `DAT`, `cfg`) con tests | Sin él no se instancia nada: ni comandos, ni enemigos, ni objetos. Gramática ya cerrada (`sonido-parsers.md`, verificada en 117/117) | Árbol de las 19 `MIS` y 96 `MAC`; `$Variable` resuelta contra la instancia | — |
| I2 | **Parser `ANM` (`BNM`) + animador en TS** (secuencias, 8 direcciones con espejo, hotspots, período por distancia y por ticks) | Un personaje en pantalla es el siguiente hito visible; formato y semántica ya cerrados (`graficos-mapa.md` §1) | `COMANDO` parado y caminando en 8 direcciones, igual que el original | el `WAD` ya hecho (no necesita I1) |
| I3 | **Bucle de juego a 20 Hz** (paso fijo, `1000/MAXFPS`, el render interpola o no) + cámara con scroll | Todo lo demás cuelga del tick; es lo más caro de cambiar después | Tick estable, scroll por mouse/bordes, canvas sin parpadeo | — |
| I4 | **Cargar la misión**: `.ELEMENTOS` → objetos con `.XYZ`, `.NIVEL`, macros, bando | Pone los 4 comandos y los 82 objetos en el mapa | Misión 0 con todo en su sitio (aún quieto) | I1 |
| I5 | **Parser `.SEC`** (sectores: plano de suelo `z=ax+by+c`, tipos LAND/WATER…, flags) + `CHOQ*.VOL` | Altura de suelo y colisión salen de acá; sin esto el movimiento sería inventado | `sec_check` del TS cierra al byte en los 11; suelo de un punto del mapa 0 | — |
| I6 | **Movimiento de un comando con clic** (Empuje 2,5/ciclo, giro máx. 45°/ciclo, anim por distancia, pathfinding por grafo de sectores) | Es el "primer momento jugable" | Un comando llega a un punto esquivando muros | I2, I3, I5 + **R1, R2, R3** |
| I7 | **`git push` + CI mínima** (typecheck, lint, test) | Hoy hay 4 commits solo locales: un disco roto pierde todo | Remoto al día; el check corre solo | decisión del usuario |

### Q2 — Después: que el mundo reaccione
| # | Qué | Listo cuando |
|---|---|---|
| I8 | Orden de dibujo de personajes y objetos sobre el mapa (z-order) | Un comando pasa "detrás" de un edificio correctamente |
| I9 | Selección y comandos básicos: seleccionar, agacharse, tumbarse, correr, cursor contextual | Se maneja a un comando como en el original |
| I10 | Enemigos con **patrullas** (22 rutas) y órganos: vista (cono 800/150/70°/90), oído (48 ruidos con radio), memoria | Un guardia patrulla y reacciona a lo que ve/oye |
| I11 | Mensajes entre acciones + prioridad `CARISMA` (órdenes a órganos) | La IA de `BANPE1/BAP1/BAP2` funciona |
| I12 | Daño, muerte y armas del jugador (pistola 40, fusil 100…; energía 100) | Se puede matar y morir |
| I13 | Objetos de la misión 0: minas, barriles, bombas (`BOMBAACT` radio 250), escaleras, cuerpos, `AcAscensor` | Cada uno hace lo que hace en el original |
| I14 | **Destrucción de edificios**: `acExplotaCasa` + `CAMBIATILES` + volúmenes `*EXP1` | La bomba del zapador o un barril derriba un edificio y cambian los sprites |
| I15 | Fin de misión y puntuación (`Intendencia00`, estrellas por tiempo y energía) | Se gana y se pierde la misión 0 |

### Q3 — Luego: que se sienta como el juego
I16 HUD e interfaz (libretas, caras, mochila, 47 ítems `IT_*`, 1280×720 y 640×480) · I17 sonido (Web Audio: tabla de 152 sonidos, atenuación lineal radio 800, pan, música por misión, voces de los 9 personajes) · I18 efecto de agua (`.WATER`) y luz/noche (ambiente 1,0→0,4 entre las 20 y 21 h, focos) · I19 vehículos y lancha (`AcPilotaje`, motores `Auto/Lancha`) · I20 trepar, bucear, esposar y las demás acciones AU · I21 habilidades por comando (Boina Verde, Francotirador, Marino, Zapador, Conductor, Espía) · I22 las otras 8 misiones, una por una · I23 completar la calidad de C2 (`dep-cruiser`, Stryker, `size-limit`, `gitleaks`, `osv-scanner`, `semgrep`).

### Q4 — Al final
Menús, briefing y créditos · tutorial `.ROL` · partidas guardadas (`.SAV` es texto `.CLAVE`; `SAVB` binario con CRC32) · videos `AVI` (probablemente transcodificar) · multijugador/red · opciones, accesibilidad, PWA y despliegue en Vercel · pulido visual.

---
## B. INVESTIGACIÓN

### Q1 — Lo que traba la ruta crítica (cada una destraba un ítem de arriba)
| # | Pregunta | Destraba | Dónde mirar | Cómo se sabe que está resuelta |
|---|---|---|---|---|
| R1 | **Velocidad efectiva real de caminata/carrera/gateo del jugador**: ¿`StdVel` pelado o filtrado por inercia/amortiguación? ¿qué `SETVEL` emite el jugador? (los agentes no lo cerraron) | I6 | `FUN_00573600`, `FUN_00575F60`, `FUN_005DCF70`, `FUN_0066B240` (`Sim::Mover`), emisor de `MSGO_MOTOR_SETVEL` | Número por ciclo para andar/correr/arrastrarse, **medido** contra el original corriendo (`sample_game.py` sobre el exe de la raíz) |
| R2 | **Orden de dibujo (z-order)** de personajes/objetos contra los tiles y proyección isométrica/cámara | I8, I3 | `ClassListaRender`, `DibuTile`, `ClassVolMapa`, `cz` de los polígonos | Regla exacta de orden; render de un comando detrás/delante de un edificio igual al original |
| R3 | **Algoritmo de pathfinding** (`TPathTool` 0x6262E0–0x62A700): grafo de sectores, costos, suavizado | I6 | `FUN_00624B90`, `GridSeek*`, `SeekToPoint` | Pseudocódigo + una ruta de ejemplo reproducida |
| R4 | **Semántica de `.SEC`**: tipos de sector, 16 flags (`NTrans`, `NCamin`, `NVista`, `NCorri`, `SoloAg`, `Cubierto`…), listas 2, grupos y colas `TW1/2/3` | I5, I6 | `FUN_005FBEA0` y sus consumidores | Tabla de qué hace cada flag en movimiento, visión y colisión |
| R5 | **Qué cubre el patio sin pintar del mapa 0** (12 % de píxeles de una zona) y cómo se renderizan los tiles `L` (0x08) / `g` | fidelidad del mapa | `ClassTile`, `ClassColorFilter`, flags `L`; volúmenes `NONAME` con `EXTRAINFO` | El patio se ve como en el original |
| R6 | **Verdad terreno dinámica** del original (¿corre el exe de la raíz con Steam? medir velocidades, tiempos y radios en vivo, solo lectura de memoria) | valida R1, I10, I12 | `tools/from-c2/sample_game.py` | Tabla "predicho vs medido" |

### Q2 — Para enemigos y combate (se necesitan antes de I10–I13)
| # | Pregunta | Fuente |
|---|---|---|
| R7 | Acciones de combate y alarma sin leer: `AcFusilador`, `AcDisparar` (alcance enemigo, torretas), `AcBuscador`, `AcDetenido`, `AcPerro`, `AcMuerte`; la cadena que dispara `REAC_ALARMA`; `FUN_006AFC10` (clasificador de lo visto, códigos 0–0xF) |
| R8 | **Percepción pendiente**: camuflaje/disfraz/uniforme sobre la vista, ruido de pisadas y disparos por id, quién escribe en `Memoria01`, focos y `LightConeVolDynamic`, `Vista02` |
| R9 | Armas: **discrepancia de la ballesta (200 vs 800)**, campos +0x24/+0x28/+0x74 de la tabla `0x8143C0`, ruido del disparo hacia la IA, metralleta y lanzallamas del jugador |
| R10 | Objetos de la misión 0: `MINASUB`, `BOMBAACT` (defaults de radio y potencia), `ESCALA`, `AcAscensor`, `TRIPLINES`, `BANDERA`, `TESTIGO` |
| R11 | Máquinas de estado de `AcpAndar/Patrullero/Sargento` y de `EXIT/JUMP/STOPPED` de las rutas; unidades de `DISTANCIA`/`TOLERANCIA` |
| R12 | Lógica de objetivos de `Intendencia00` y qué "unidad" es el ticks de la puntuación |

### Q3 — Para pulir y para las otras misiones
R13 efecto `.WATER` (algoritmo) · R14 mapa de luz por píxel del blitter y `ClassColorFilter/PalFX` · R15 `.ZOM`, `.FNT`, `.RLC`, los 144 sprites `.BMP` de `CARAS` · R16 tabla de atajos de teclado y cursor→acción · R17 botones del HUD (`ClassBoton*`, `ClassVisorMundo`) · R18 trepar, bucear, vehículos (aceleración, giro, `MotorAuto/Tanque/Lancha`) · R19 las 9 `ClassIntendencia` restantes · R20 categorías de volumen del sonido y fades · R21 las 8 `AU` sin leer (`PutaDistrae`, `Robar`, `Quietorrr`, `ArrestadoUsar`, `BeAtHome`, `CogeTabacoDeMuerto`, `CogeMisil`, `TomarControlAleman`).

### Q4 — Última prioridad
R22 formato binario `SAVB` (CRC32 + compresión) · R23 menús y secuencia de pantallas · R24 red (`CRed_*`, `LLRed`) · R25 **equivalencia Legacy ↔ raíz**: el exe de Legacy (2009) está cifrado y no se puede leer; hay que verificar que el comportamiento del exe de la raíz (2016) coincide, comparando partidas reales cuando se pueda · R26 las 10 `ClassIntendencia` y los `.TIL` (no usados por el juego).

---
## C. Ruta crítica en una línea
`I1 + I2 + I3 + I5` en paralelo → `I4` → `R1/R2/R3` cerradas → `I6` (un comando camina por el mapa 0) → `I8–I11` (mundo que reacciona) → `I12–I15` (misión 0 completa). Primer hito visible: **un comando animado sobre el mapa** (I2 + I3), que no necesita ninguna investigación pendiente.

## D. Riesgos a vigilar
- **Port 1:1 de movimiento sin R1 cerrada**: se estaría inventando la velocidad; no avanzar I6 sin esa medida.
- **Equivalencia Legacy ↔ raíz (R25)**: toda la lógica sale del exe 2016; datos idénticos (1226/1227 archivos), lógica sin comprobar.
- **Los informes de agentes son parciales**: cada dato crítico se verifica contra el exe o los archivos antes de portarlo (ya pasó con `CARISMA`, los tipos de `ANM` y los `.TIL`).
- **Sin respaldo remoto** hasta I7.
