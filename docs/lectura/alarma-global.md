# Alarma global: sirena y linterna del HUD

Lectura del ejecutable raíz y contraste de recursos del `WAR_MP.DIR` raíz. Es distinta del grito `ALRM` de un soldado.

## Activación y duración

- En M0 el MIS declara `.SENSORES_SND_ZONA [ [ .ZONA CAMPAMENTO .MENSAJE REAC ] ]`; `REAC` además figura en `EXITHOME_EVENTS` de las patrullas de refuerzo (`refuerzos-m0.md`). El sensor de sonido entrega eventos de peligro según sector y máscaras; no basta afirmar que cualquier ruido audible activa la alarma (`cierre-70.md` §4).
- `FUN_0059CEA0` (`fn_00580000.c:23054`) es uno de los receptores: primero llama a `FUN_0059A410`, después incorpora máscaras de zona y transmite el evento mediante `FUN_0059A060`. Este último despacha también órdenes de salida y reacción a grupos (`20791–20861`). `FUN_0059CE40` y `FUN_0059A4B0` también llaman a la activación.
- La intendencia construye un reproductor para el tag **`SIRN`** en `FUN_005A2140` (`26449`), y pone el permiso inicial `+0x47B0=1` (`26460`). La tabla `0x820F28` asigna `SIRN` a **`DATOS/RECURSOS/SONIDO/WAVE/SIRENA01.WAV`**; contrastado en el DIR raíz (WAV de unos 4,11 s). Es una muestra distinta de `ALRM → VOZALARM.WAV`.
- `FUN_0059A410` (`20909–20923`, asm `0x59A410–0x59A46B`) solo actúa si `+0x47B0 != 0`: fija `+0x47B4=0,75`, `+0x47AC=1`, muestra la linterna, asigna el volumen al reproductor de la sirena y pide iniciarlo; luego fija `+0x47B0=0`. Mientras el flag siga en cero, las siguientes llamadas no reinician la alarma. El constructor lo inicia en uno; no se identificó otra escritura ordinaria que lo reactive, aunque debe contemplarse carga de partida (`FUN_005A*` serializa estado).
- `FUN_0059EAA0` (`24463–24485`, asm `0x59EAC8–0x59EB49`) resta en cada actualización el double **0,001500000013…** de `0x7A1AA8` al volumen float. Desde 0,75 llega a cero en **500 actualizaciones**, unos **25 s** si corren a 20/s; entonces para el sonido, oculta la linterna y limpia `+0x47AC`. `FUN_0067F0D0` (`fn_00640000.c:48210–48253`) actualiza el volumen de fuentes activas, por lo que el descenso afecta al sonido. `FUN_0067F5A0` inicia la muestra y configura el reproductor; falta confirmar con el backend Miles si se repite durante todo el descenso y cómo se comporta al faltar el WAV.

## Imagen de alarma

- `FUN_0069D7C0` (`fn_00680000.c:21605–21625`) crea `ClassLinterna` y la oculta inicialmente. `FUN_006FA220` (`fn_006c0000.c:40960–41043`) llama a `FUN_0069F140` con **0x14**, que busca una entrada de geometría del HUD: no está demostrado que 0x14 sea un período de animación.
- `FUN_006F76A0` (`38975–39042`) carga **`ALMR0000.RLE`**, fondo de **29×52**, y `ALMR0001.RLE`, cuadro de **103×103**. También existen `ALMR0002.RLE` y `ALMR0003.RLE` de 103×103. Los cuatro se verificaron en `DATOS/RECURSOS/BMPS/SYSTEM/GLOBAL/GLOBAL.WAD` del DIR raíz; hay copias en `DATOS/RECURSOS/ELEM/LINTENNA.WAD`.
- `FUN_006F7830` (`39043–39175`) centra fondo y cuadro, los dibuja y recorre `ALMR0001 → ALMR0002 → ALMR0001 → ALMR0003`. Al tercer índice usa el bit de espejo `0x10`; luego vuelve a empezar. La frecuencia real depende de cuándo se llama al dibujante: falta medir el despachador y confirmar la posición por resolución antes de fijar valores.
- El encendido y apagado llegan desde intendencia por `FUN_005BAEC0 → 0041291D → 006F3460 → virtual +0x2C` (`hud-consumidores.md` §2).

## Estado del port

El `raise` de `src/app/main.ts` ya entrega `REAC` a rutas y patrullas, y `Battle.onDanger` consulta las zonas; no conserva el estado de la alarma global. `GameSound` conoce la tabla `SIRN`, pero todavía no reproduce la sirena por la alarma, y `Hud` no dibuja la linterna. Las explosiones de `Demolition` tienen su propio aviso a soldados: falta verificar su enlace al sensor antes de prometer que toda explosión encienda la alarma. No se implementó nada en esta investigación.

Para portar: estado separado de la propagación de eventos, reproducción de `SIRENA01.WAV` con caída y parada, y linterna del banco `GLOBAL.WAD`; probar activación, segundo evento, apagado y ausencia de recursos. Quedan pendientes frecuencia y ubicación exactas del HUD, repetición del WAV y contraste con el juego original.
