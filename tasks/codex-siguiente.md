# Para Codex: cómo seguir con la misión 0

Leé primero `AGENTS.md` (reglas, calidad, comandos) y `tasks/pendientes.md` (sección A). Este archivo solo dice **qué hacer ahora y en qué orden**. Estado: `main` en `1c31516`, 262 pruebas, 90,75 % de ramas, sin `push`.

## Cómo trabajar
- **No uses la carpeta principal**: `git worktree add ../commandos1-codex -b codex/<tema>` y trabajá ahí (Claude edita `main` en `D:\Joaquin\commandos1-web`). No hagas `merge` a `main` sin avisar a Joaquín.
- Un tema por rama. Antes de cada commit: `npm run check:task` entero verde (umbral de 90 % de ramas en `src/engine` y `src/formats`; cada cambio ahí lleva pruebas).
- Orden obligatorio: **leer el exe → implementar → probar en el juego real** (`npm run dev`, botón "Cargar GAME_DIR", mapa `0000`; `window.__game.game` da el estado). Fuentes del exe: decompilado en `D:\Joaquin\research-c1\ghidra\all` y `all2`, strings, el exe con pefile/capstone, datos `.MIS`/`.MAC`. El juego instalado es solo lectura.
- Un atajo se marca en el código con `shortcut: <límite>, <cuándo mejorar>` y se anota en `tasks/verificacion-exe.md`.
- Al terminar un tema: tachar la fila en `tasks/pendientes.md` y, si cambia lo leído, actualizar su doc de `docs/lectura/`.

## Qué ya está hecho (no repetir)
Energía de los alemanes (todos valen 100), armas del jugador (pistola, mirilla con retícula y disparo a un punto del suelo, cuchillo, puño, esposas, piedra, arpón, botiquín, tabaco, control alemán), escaleras, ascensor, buceo, zapador, CASA04, nidos de ametralladora, fin de misión y puntuación. Detalle en `docs/lectura/armas-restantes.md` y `tabaco-control.md`.

## Qué falta, en orden de prioridad

### 1. Casas y cuarteles con refuerzos
- Hoy: el comando entra a una casa (`src/engine/house.ts`) y en el cuartel lo matan. Falta que las casas **regeneren soldados** y manden **refuerzos con alarma**.
- Leer: `docs/lectura/obj-contenedores.md`, `mision-intendencia.md` §4, `cierre-mision-0.md` (4 CASA, 3 grupos con HOME, segunda patrulla en `CASA_REACT_02`).
- Aceptación: en MAPA0000 una alarma en un cuartel hace salir refuerzos por la regla del exe, probado en pantalla.

### 2. Alarma y voces de los soldados
- Falta: que quien ve un cadáver avise a los demás, el grito de alarma, y los métodos de reacción específicos de BAP2 y BANPE (cruzar cada token con sus `REACTIVIDADES`). La voz de atención VMUE/VESP y la escalada ALRM a 20 ciclos ya están leídas.
- Leer: `docs/lectura/soldado-acbap2.md` (Cierre adicional), `cierre-mision-0.md`, `cierre-70.md` §7. Código: `src/engine/soldier.ts`.

### 3. Eventos de misión y patrullas
- Falta integrar `EVENTO`, `ENLAZAR`, `ESPERAEVENTO` y el cambio de ruta. En M0 el sensor CAMPAMENTO dispara `REAC` y 4 de 5 grupos salen de su casa por ese evento (tabla token por token en `cierre-mision-0.md`).
- Leer: `patrulla.md`, `mision-intendencia.md`. Código: `src/engine/groups.ts`, `patrol.ts`.

### 4. Zodiac completa
- Falta: varada en tierra, hundimiento por impacto, intercambio de plazas, pinchado, y verificar en pantalla la transición de orilla. Lectura completa y sin portar.
- Leer: `sim-vehiculos.md` §5, `vehiculos.md`, `cierre-70.md` §3. Código: `src/engine/boat.ts`.

### 5. Objetos del mapa
- BOYA, BANDERA, SEÑUELO, TESTIGO, CEPO, puertas: leídos, sin integrar. Los focos NO hacen falta (M0 no los tiene).
- Leer: `obj-puertas.md`, `obj-explosivos.md`, `cierre-80.md` §4.

### 6. Sonido (Web Audio)
- No hay audio. Faltan olas, disparos, explosiones, voces; atenuación y pan. Leer `docs/lectura/sonido.md`. Los sonidos salen de los archivos del jugador, no del repo.

### 7. Explosiones y HUD
- Cráteres, partículas, temblor de cámara (`obj-explosivos.md`, `render.md` §4).
- HUD: libretas, minimapa, tooltips; reemplazar los `BAG_POS` medidos de `src/engine/hud.ts` por la tabla por personaje del exe (`cierre-70.md` §2.1, `py tools/audita-datos-exe.py --mochila`; ítems: 9 = TABACO, 82 = BOTIQUIN, 85 = ARPON, 89 = CONTROLA); verificar los cursores de ARPON, BOTIQUIN y CONTROL (hoy emparejados por nombre, atajo).

### 8. Detalles finos pendientes (baja prioridad)
- Sombras y estelas de agua (`render.md` §§2–3).
- Mano (`AuCoger`, máscara `ficha+0x7B0`) y granada del jugador (nadie la tiene en M0; ARTIFIC la usa en M2–M10).
- Disparo del francotirador a un punto: la bala no daña a quien cruce el rayo (`FUN_006771a0` sin leer).
- Retícula de mirilla: falta la deformación de lente (tabla `DAT_00853a98`) y el radio 47 es el del sprite, no el del exe.
- Hips del control alemán, pasos finos de la cajetilla (mirar al lanzador 30 ciclos, voces), JERINGA ausente en `FRANCO.ANM`.

## Cuándo parar y preguntar
Si un dato no está en el exe ni en los archivos, **no lo inventes**: dejalo como atajo declarado y avisá a Joaquín en una línea. Lo enviado a Gemini sale a servidores de Google (solo recortes de `research-c1/ghidra`; nunca claves).
