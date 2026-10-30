# HUD: inventario de recursos y lo leído hasta ahora (2026-10-30)

Estado: **inventario hecho, composición (posiciones) NO leída**. Sin la posición de cada pieza no se puede dibujar el HUD sin inventar.

## Recursos (todos dentro de `WAR_MP.DIR`, `DATOS/RECURSOS/BMPS/SYSTEM/`)
- `GLOBAL/<ancho>X<alto>.WAD` (512X384, 640X480, 800X600, 1024X768; el exe arma el nombre con `sprintf("%s%ldX%ld.WAD")` en `FUN_005BA6E0`): 4 sprites cada uno: `BARRA01.BMP` y `BARRA02.BMP` (tiras de lona horizontales, 45 de alto) y `BARS0000.RLE`/`BARS0001.RLE` (tiras verticales, 36 de ancho). En 1024X768: 337+633 de ancho de barras horizontales; 337+386 de alto de verticales (+45 = 768); en 800X600: 389+359 y 280+275 (+45 = 600). Falta 16-18 px de ancho en ambos: ¿ventana del minimapa o esquina?
- `GLOBAL/GLOBAL.WAD` (47 sprites, independiente de la resolución): `AGACHAR/DEPIE/DOBLEZ` (postura), `M_*` = máscara verde de cada icono (zona de clic), `CAMARA`/`CAMAESQU`/`M_OJOALE`/`P_OJOAL0/1` (ojo de alerta), `BOLSOPUTA`/`M_BOLSO`, `MOCHILA`/`MOCHILAA`, `CANT0000`, `CHAT0000`, `CIRC0000..0006` (7 estados, ¿carga o energía?), `ESTRELLA1/2`, `MARC0000`/`MARCA000`, `OFF`/`ON` (interruptor), `REDLENTA`, `SANGRE`, `INPUTCHA`, `ALMR0000..0003`, `INTERROG`, `CUR20000`, `CURS0000`, `BARS0000` (36x442).
- `CARAS/<PERSONAJE>.WAD` (COMANDO, FRANCOT, LANCHERO, ARTIFIC, CONDUC, ESPIA, ALEMAN, CHICA, FUSILADO, INGERIE, PILOTO, PRESO): `COM0001..COM0009` = cara por nivel de energía (9 grados), `COM0010` = calavera (muerto), `FOTITO02` (foto chica), `FOTO02`, `RFOT0002` (foto de preso); `COMUN.WAD`: `M_FOTITO`, `M_FOTO`, `M_RFOTO` (máscaras).
- `OPCIONES/<ITEM>.WAD` (PISTOLA, MIRILLA, GRANADA, …, 47 ítems): `<ITEM>.RLE` = dibujo del ítem y `M_<ITEM>.RLE` = máscara verde.
- `LIBRETAS/LIBR0000..0008.RLE`: minimapa/libreta por misión.
- Los `BARS000x` que carga `FUN_00608460` (`ClassLineaNumerosBarra`) y `FUN_006F6270`/`FUN_006F6590` (`ClassVentanaMenuDerecha`) son de **ventanas de menú**, no necesariamente del HUD de misión.

## Datos de la misión ya conocidos
`.INTERFACE [ .SUBINTERFACES [ [ SUBINTERFACEALIADO [ .TOKEN COMANDO .CARETO CARA0001.RLE .ITEMS [ [ .TOKEN IT_PISTOLA ] … ] ] ] … ] ]` (docs/engine/ui-misiones-guardado.md §5.2) y la tabla de 47 ítems (id, código STR del tooltip, par de frames).

## Falta leer (en este orden)
1. Quién arma el HUD de misión y dónde pone cada pieza (`ClassVisorMundo`, `ClassVisorComandos`, `ClassButtonBar`, `ClassBoton*`, `FUN_006EEEB0`/`FUN_0069D600` que `FUN_005BA6E0` llama tras cargar el WAD).
2. Qué muestran `CIRC0000..6`, `MARC0000`, `MARCA000`, `REDLENTA`.
3. Mensajes del HUD (`699AE0`) y la tabla cursor→acción.

## Cierre 1 (2026-10-30): tira, columna, ranuras de comandos
Con la captura del original (1280×720, `imagenesReferncia/HUD.PNG`, no versionada) y los sprites:
- **Tira superior** = `BARRA01` (337) + `BARRA02` (889 a 1280) de alto 45; el **ojo** `P_OJOAL0` (52×45) va pegado al borde derecho, `INTERROG` a 156 px del borde y `CAMARA` (55×69, cuelga bajo la tira) a 121 px. **Columna** de 36 a la derecha bajo la tira: `BARS0000` (337) y `BARS0001` debajo. El mundo ocupa el resto (`viewRect`). Con 1280×720: 1226 + 52 = 1278 de ancho de tira; la columna (1244..1280) arranca bajo la tira.
- **Ranura de comando** = marco `MARC0000` (62×44: hueco de cara 38×38 en +6,+2 y pozo de la barra de sangre en +47,+4); paso 63. El seleccionado usa `MARCA000` (86×44, con una ventana más). La barra es `SANGRE` (9×37).
- **Caras**: cada WAD de `CARAS/` trae 10 BMP en orden (COM, FRA, LAN, BOM, MEC, ESP + 0001..0010): 1 sano … 9 muy herido, 10 calavera.
- Sin leer: regla exacta cara↔energía, contenido de la ventana extra del seleccionado, libreta/minimapa de la columna (`LIBRnnnn.RLE`, archivo suelto con otro formato), significado de `CIRC0000..6`, botones de postura (`AGACHAR`/`DEPIE`/`DOBLEZ`), mochila/bolso (ítems), `ALMR`, interruptores `ON`/`OFF`.
- Código: `engine/hud.ts` (medidas y reglas, con pruebas), `render/hud.ts` (dibujo), integrado en `app/main.ts` (zona del mundo, clic en caras).
