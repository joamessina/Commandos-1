# Plan de objetivos (de lo primordial a lo banal)

Regla de oro (CLAUDE.md): primero investigar el formato/regla en archivos o exe, después implementar. Cada hito termina con **verificación contra los archivos reales de Legacy**, no solo tests sintéticos. Datos = `Legacy\WAR_MP.DIR`; lógica = exe de la raíz (el de Legacy está cifrado, ver `docs/formats-texto-y-modelo.md` §0).
Estado: ✅ hecho · 🔶 en curso · ⬜ pendiente. Las hipótesis se marcan **[hip]** hasta confirmarlas.

## Nivel 0 — Sin esto no hay nada
| # | Objetivo | Terminado cuando | Estado |
|---|---|---|---|
| 0.1 | Contenedor `WAR_MP.DIR` leído y verificado | Tabla + datos cierran con el tamaño del archivo, 0 huecos | ✅ (Python) |
| 0.2 | Inventario de todos los archivos y formatos | `docs/inventario.md` | ✅ |
| 0.3 | Exe legible decompilado (raíz) | `research-c1\ghidra\all\*.c` + índice por string | 🔶 |
| 0.4 | Scaffold TS (Vite, Vitest, ESLint estricto, dep-cruiser) con las constraints de C2 | `npm run check:task` en verde con 1 test | ⬜ |
| 0.5 | El jugador **carga sus archivos** (File System Access / `<input>`); el repo no lleva assets | Carga `WAR_MP.DIR` en el navegador sin servidor; ningún byte del juego en git | ⬜ |
| 0.6 | Lector del contenedor en TS (puerto de `tools/inventario.py`) con TDD | Mismo recuento y offsets que Python en los 1227 archivos reales | ⬜ |

## Nivel 1 — Ver el mundo (gráficos y mapa)
| # | Objetivo | Terminado cuando |
|---|---|---|
| 1.1 | Decodificar `RLE` / `BMP` / paleta | Cada `RLE` extraído se dibuja igual que en el juego (comparar contra un `BMP` de referencia) |
| 1.2 | Cerrar formato `WAD` (sprites 16 bpp, fondos `Fase000N.WAD`, caras, fuentes) | 236 + 9 `WAD` parsean con tamaños que cierran al byte |
| 1.3 | Parser de la sintaxis `.CLAVE [ … ]` (`MIS`, `MAC`, `DAT`, `cfg`) | 117 archivos → árbol; re-serializado equivale al original |
| 1.4 | Mapa: `TIL` + `VOL` + `Fase000N.WAD` → render isométrico con cámara/scroll | La fase 0 se ve completa y recorrible |
| 1.5 | `ANM` (`BNM `): secuencias, fotogramas, hot-spots | 166 `ANM` parsean; un soldado "ANDAR" se anima en las 8 direcciones **[hip]** |

**Hito A:** abrir el navegador, cargar archivos, ver el mapa de la fase 0 con un personaje animado.

## Nivel 2 — Mover (tiempo real y control)
| # | Objetivo | Terminado cuando |
|---|---|---|
| 2.1 | Bucle de ticks: ticks/seg y orden de actualización (del exe) | Ritmo medido en el exe; coincide con `PAR_TICKS_*` de `MIS` |
| 2.2 | Colisión y altura (`VOL`, `VOLCOLISION`, `MASA`, `LISTAS`) | Un personaje no atraviesa muros ni sube donde no puede |
| 2.3 | Pathfinding y movimiento por `MOTOR` (Andante/Tanque/Auto/Objeto) | Click-to-move con velocidades del exe, no inventadas |
| 2.4 | Selección, cursor, comandos básicos (mover, agacharse, objetos) | Se maneja un comando como en el original |
| 2.5 | `MIS` `.ELEMENTOS` → instanciar objetos desde las `MAC` | Fase 0 con todos sus elementos en su sitio |

**Hito B:** un comando camina por la fase 0 colisionando bien.

## Nivel 3 — El juego (enemigos, reglas, victoria)
| # | Objetivo | Terminado cuando |
|---|---|---|
| 3.1 | IA: pila de acciones por `CARISMA` **[hip]**; `Muerte/Guarda/Fusilador/Disparar/Vigilar/Buscador/Patrulla…` | Confirmado en exe cómo se elige la acción activa |
| 3.2 | Órganos: `VISTA` (cono/alcance), `OIDO` (ruido), `MOTOR` | Parámetros leídos del exe; un guardia ve/oye a la distancia correcta |
| 3.3 | Alarma y reactividad (`REAC_ALARMA`, `SENSORES_SND_ZONA`, `TRIPLINES`) | Cadena evento→reacción documentada y reproducida |
| 3.4 | Patrullas (`.PATRULLAS`) | Un enemigo recorre su ruta y reacciona |
| 3.5 | Daño, energía, muerte, cuerpos, armas e impactos (`.ENEGIA`, `.IMPACTOS`, `.FUERZA`) | Tabla de armas del exe volcada; muertes coinciden |
| 3.6 | Habilidades de cada comando (7 nombres vistos en archivos de tutorial: ba, dr, gb, ma, sa, sn, sp **[hip]**) | Cada habilidad funciona según el original |
| 3.7 | Vehículos, objetos, mochila/inventario, contenedores, explosivos (`BARRIL`, `MINA`, `BOMBA`) | Interacciones de la fase 0 funcionan |
| 3.8 | Objetivos, fin de misión, puntuación (`INTENDENCIA`, `PAR_TICKS`, `EXITPOINTS`, `STR` GE**) | Se puede ganar y perder la fase 0 |

**Hito C:** la fase 0 es jugable de punta a punta.

## Nivel 4 — Que se sienta como el juego
| # | Objetivo |
|---|---|
| 4.1 | HUD e interfaz (`SYSTEM/*`: caras, libretas, opciones; `Comando.cfg`) |
| 4.2 | Sonido: efectos `WAV` y su asignación a eventos, música, voces; Web Audio |
| 4.3 | Briefing (`SCR`, `ZOM`, fades), menú principal, selección de misión (`MISIONES.DAT`) |
| 4.4 | Las 9 fases (0–8) y la secuencia de campaña |
| 4.5 | Agua, efectos (`WATER`, sangre, humo), luz y sombras |

## Nivel 5 — Banal (al final)
Tutorial hablado (`ROL` + `rolling/wave`), créditos (`CREDITOS`, 72 recursos), videos `AVI` (códecs de 1999: probablemente transcodificar o saltear), partidas guardadas, opciones, 1280×720, multijugador/red, PWA y despliegue en Vercel, accesibilidad y pulido.

## Transversal (desde el día 1)
- TDD con bytes **sintéticos**; ningún byte del juego en el repo.
- Cada formato: `docs/formats/<x>.md` con evidencia (ecuación de tamaño, % que parsea).
- `docs/COVERAGE.md` y `tasks/investigacion-pendiente.md`: lo leído y lo **no** leído.
- Toda lógica de movimiento/IA sale del exe; un atajo lleva `shortcut: <límite>, <cuándo mejorar>`.

## Cómo usamos las skills
`agent-skills:spec`→`plan` por cada nivel; `build`/`test` (TDD) en 0.4–0.6 y todo parser; `review` antes de cada hito; `ponytail` para no sobrecodificar; `graphify` sobre `docs/` + `research-c1` para consultar sin releer.

## Siguiente paso inmediato
1) Terminar la decompilación (0.3). 2) Scaffold + loader (0.4–0.6). 3) Investigación en paralelo: `RLE`/`WAD`/`ANM` (1.1, 1.2, 1.5) y ticks (2.1) en el exe.
