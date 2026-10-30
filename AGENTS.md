# AGENTS.md — commandos1-web

Port al navegador de **Commandos: Beyond the Call of Duty** (Commandos 1, 1998–99, Pyro Studios/Eidos) por ingeniería inversa. El jugador carga SUS archivos; **el repo nunca contiene assets ni bytes del juego**. Este archivo es para agentes de código (Codex u otros). Hay otro agente (Claude) que también trabaja en este repo: ver "Trabajo en paralelo".

Usuario: **Joaquín**, español rioplatense, directo y con poca paciencia para vueltas. Respondé en **español**, corto, sin disculpas ni rodeos; si algo es una decisión del usuario, decilo en una línea y seguí con lo razonable.

## Reglas (no negociables)
1. **Nada inventado.** Todo comportamiento, regla, IA, animación y velocidad sale de los archivos del juego o del exe. Si falta el dato: **leer primero el exe/datos y recién después implementar**. Un atajo se marca en el código con `shortcut: <el límite>, <cuándo mejorar>` y se anota en `tasks/verificacion-exe.md`.
2. **Primero investigar, después implementar.** Antes de tocar una regla, leé su definición en el exe (ver "Cómo se lee el exe"). Los docs de `docs/lectura/` marcan `[hecho]` (leído con dirección) y `[hip]` (deducido): no uses un `[hip]` como si fuera un hecho.
3. **Verificá contra los archivos reales**, no solo con tests sintéticos (un parser puede dar totales correctos con estructura mala).
4. El juego instalado (`D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty`) es **solo lectura**: nunca escribas ahí. El `WAR_MP.DIR` de la **raíz** es la referencia (el de `Legacy\` no trae algunos recursos; el exe de Legacy está cifrado, no se usa).
5. **Solo commits locales. NO hagas `git push`** (ni ramas remotas) hasta que Joaquín diga que hay algo estable. Mensajes de commit en español, cortos; cerrá con una línea `Co-Authored-By:` con **tu propio nombre** (no uses el de otro agente).
6. Acciones destructivas (borrar, reescribir historia, `reset --hard`, tocar archivos fuera del repo): **avisá antes**. Lecturas y diagnóstico: libres.
7. No toques archivos personales de la máquina (`D:\Joaquin\Videos`, Descargas, etc.) ni explores carpetas fuera del proyecto y de `D:\Joaquin\research-c1`.

## Calidad (se verifica con `npm run check:task`)
- `npm run check:task` = typecheck + lint (`--max-warnings 0`) + tests con cobertura. **Tiene que pasar entero antes de cada commit.**
- TypeScript estricto. ESLint sin `eslint-disable`, sin aserción no nula (`!`), sin `void` en flechas cortas. No debilites `eslint.config.js`, `tsconfig.json`, `vitest.config.ts` ni `CONSTRAINTS.from-c2.md`.
- **Umbral de cobertura 90 % de ramas en `src/formats` y `src/engine`** (hoy ≈ 90,2 %: el margen es mínimo). **Cada cambio en `engine`/`formats` lleva sus pruebas** (casos felices y bordes); si bajás de 90 %, agregá tests, no bajes el umbral.
- Comentarios solo para el *porqué* que el código no muestra, en una línea; estilo del código vecino (nombres en español de dominio, comentarios con la dirección del exe o el doc de donde sale la regla).
- Sin dependencias nuevas salvo necesidad real.

## Comandos
- `npm run dev` — Vite en `http://localhost:5176/` (a veces sirve módulos viejos: `touch` de los archivos tocados y recargar). Botón "Cargar GAME_DIR (solo desarrollo)": lee `GAME_DIR` de `.env.local` (ignorado por git). En desarrollo los comandos arrancan **invencibles**; atajos de prueba del original: **Ctrl+X** teletransporta al cursor, **Alt+I** invencibilidad, **Ctrl+Alt+N** termina la misión.
- `npm run check:fast` (typecheck + lint), `npm test`, `npm run build`.
- Scripts de Node que leen el juego: `node --experimental-transform-types ruta.ts` (importan módulos `.ts` del repo). Ejemplos: `tools/mis-catalogo.ts`, `tools/mac-catalogo.ts`.
- Python con **`py`** (no existe `python` en Git Bash). `capstone` y `pefile` están en el site de usuario: ejecutá los scripts del exe **sin `-I`**.

## Plataforma (Windows, Git Bash)
- Los heredocs con comillas o `\` a veces se rompen: para archivos de más de unas líneas usá el editor de archivos o un script en vez de `cat <<EOF`. `cat > archivo` sin heredoc se cuelga.
- Salida LF→CRLF en `git add` es solo un aviso.
- Rutas con tilde (`C:\Users\Joaquín\...`): citá siempre.

## Estructura
- `src/formats/` — lectores de archivos del juego (`container` = `WAR_MP.DIR`, `wad`, `anm`, `sec`, `clave` = lenguaje `.CLAVE [ ]` de `.MIS`/`.MAC`…).
- `src/engine/` — reglas del juego sin gráficos (movimiento, soldados, ataques, bote, demolición, HUD, puntuación, trampas, grupos). Cada módulo cita en su cabecera el doc/dirección del exe de donde sale.
- `src/render/` — dibujo en canvas (sprites, HUD, cursores). `src/app/main.ts` — la app (bucle a 20 ciclos/s, entrada, carga de misión).
- `tools/` — scripts de investigación (catálogos de `.MIS`/`.MAC`, utilidades del exe). `scripts/` — verificación contra los archivos reales (`npm run verify:real`).
- `docs/lectura/` — **lecturas del exe, una por tema** (guarda, soldado-acbap, hud, sonido, mis-todos, mac-todos, …): leelas antes de tocar el tema. `docs/engine/`, `docs/research/` — notas anteriores. `docs/traspaso-desde-commandos2.md` — método heredado del proyecto hermano.
- `tasks/pendientes.md` (**estado vigente**, qué falta y % investigado), `tasks/verificacion-exe.md` (qué es leído y qué es atajo), `tasks/prioridades.md`, `tasks/gemini.md`. `tasks/estado.md` es de las primeras sesiones y **está desactualizado**.

## Cómo se lee el exe
Fuentes, de más a menos usada (detalle: `docs/exe-lectura.md`):
1. **Decompilado de Ghidra ya exportado** en `D:\Joaquin\research-c1\ghidra\all\fn_00XX0000.c` (≈1 MB cada uno; cada función empieza con `//// 0059a2a0 FUN_0059a2a0 size 251`; el cuerpo está en el archivo cuyo rango contiene la dirección; `thunk_FUN_xxx` saltan a `FUN_xxx`). Trampas: Ghidra esconde argumentos de punto flotante y los saltos por tabla; `param_1` es `this`; anotá siempre los offsets.
2. **Cadenas y clases**: `D:\Joaquin\research-c1\strings.tsv`, `class_methods.tsv`, `rtti.json`, `inventario.tsv` (archivos del juego).
3. **Exe crudo** con `pefile` + `capstone` (desensamblar, buscar referencias, volcar tablas de `.data`): `D:\SteamLibrary\...\coman_mp.exe` (solo lectura).
4. **Memoria del juego en marcha** (solo lectura, `ReadProcessMemory`, plantilla `tools/from-c2/sample_game.py`): sirve cuando el código no alcanza (así se leyeron las posiciones de la mochila).
5. **Datos del juego**: `.MIS` (misiones), `.MAC` (plantillas de elementos), `.SEC`, WAD… con los parsers del repo. Una regla de un comando o una acción casi siempre está **también** en el `.MIS`/`.MAC`: mirá ambos (ejemplo: solo el marino tiene `.HABILIDAD BALSA`, por eso solo él maneja la balsa).
- Antes de afirmar que algo "no está en el exe", buscá en las **cuatro** fuentes; varios errores salieron de mirar solo una.

## Cómo trabajar una tarea
1. Leé `tasks/pendientes.md` y el doc de `docs/lectura/` del tema.
2. Leé la regla en el exe/datos (con direcciones). Si es lectura masiva, anotá lo hallado en `docs/lectura/<tema>.md` **antes** de implementar.
3. Implementá lo mínimo que cumple la regla leída; marcá cada atajo con `shortcut:`.
4. Pruebas + `npm run check:task` en verde.
5. Si se puede, verificalo jugando en `npm run dev` (misión 0; el usuario también prueba el juego).
6. Actualizá `tasks/pendientes.md`/`tasks/verificacion-exe.md` y commiteá en local.
7. Cerrá tu respuesta con 1–2 líneas: **qué omitiste o no pudiste verificar** y el riesgo.

## Trabajo en paralelo con otro agente
- Claude también edita este repo. **No trabajes en la misma rama a la vez**: usá `git worktree add ../commandos1-codex -b codex/<tema>` (o una rama propia) y no hagas `merge` a `main` sin avisar a Joaquín.
- Antes de empezar, `git status` y `git log -5`: si hay cambios sin commitear que no son tuyos, no los toques.
- Si dos agentes tocan el mismo archivo, resolvé el conflicto leyendo ambos cambios; no sobrescribas.

## Lo que NO hay que hacer
- Subir assets, capturas del juego o bytes de `WAR_MP.DIR`/`.WAD`/`.EXE` al repo (la carpeta `imagenesReferncia/` está ignorada por git: no la agregues).
- Inventar valores "razonables" cuando el exe no se leyó; aproximar sin marcar `shortcut:`.
- Cambiar umbrales, reglas de lint o configuración para que pase el check.
- Pegar claves de API o credenciales en archivos o en el chat.
