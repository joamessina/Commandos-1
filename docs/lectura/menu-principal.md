# Menú principal: investigación inicial

Lectura del ejecutable raíz y de los recursos del `WAR_MP.DIR` raíz. Esta investigación todavía no es una implementación completa.

## Recorrido observado por Joaquín

Al elegir **Nueva partida** aparece otro menú con **Nueva misión**, una opción que recuerda como introducción de código para entrar a un mapa específico y otras opciones. Al elegir Nueva misión desde cero aparece el selector **EASY / HARD**; luego se reproduce la cinemática y el briefing de la misión antes de empezar a jugar. Esta descripción es una referencia aportada por Joaquín: confirmar en el exe los nombres, el orden, las condiciones y los recursos de cada transición. La opción de código queda expresamente como recuerdo a verificar.

## Entrada y recursos

- `FUN_005C7160` despacha el estado 1 a `FUN_005B9CE0`, que actualiza `ClassGestorMenus`; la carga de recursos del arranque está en `FUN_005C2790` (`ui-misiones-guardado.md` §1).
- `FUN_006015C0` (`fn_00600000.c:1017`), constructor de las estructuras de menú, obtiene sus textos por claves de `GLOBAL.STR` con `FUN_00683B20`. El menú 0 usa título `MMEN` y crea, en orden, `NGAM`, `SGAM`, `LGAM`, `OPTI`, `CRED`, `HELP` y `QGAM` (`1240–1400`); sus acciones numéricas respectivas son 6, 4, 5, 1, 0x22, 0x3d y 0x0e. El texto real de las claves se leyó del contenedor del juego, no se debe copiar al repositorio como asset.
- `FUN_006014E0` (`978–998`) solicita `DATOS/MUSICA/MENU.WAV` con bucle y volumen 0,75. La ruta de música es archivo suelto del jugador, no parte garantizada del DIR.
- `FUN_006015C0` crea menú 6 con `ClassMenuNewGame` (`1880–1970`): primera opción `SPMP` (acción 0x18); incluye `MTIT` (0x0b) solo si `G+0x1378+0x18` está activo; incorpora otras entradas y regreso. Las acciones concretas y selección de dificultad requieren seguir el receptor antes de implementar.
- El ejecutable construye nombre `MENU%ld.BMP` (`fn_00600000.c:2848`); el DIR raíz contiene `DATOS/RECURSOS/BMPS/SYSTEM/MISC/MENU512.BMP`, `MENU640.BMP`, `MENU800.BMP` y `MENU1024.BMP`. Hay que seguir la elección por resolución y el cargador antes de asignarles un uso visual definitivo.
- La campaña se obtiene de `MISIONES.DAT`; los títulos de campaña y selección de mapas están documentados en `ui-misiones-guardado.md` §1 y `src/engine/campaign.ts`. El port actual inicia directamente un mapa al cargar el directorio (`src/app/main.ts`, `start`); todavía no presenta el menú original.
