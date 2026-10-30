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

## Cierre 2 (2026-10-30): selección, lado y mochila (capturas + lo que dijo el usuario)
- La **barra roja es la vida (HP) del comando** (lo que el exe llama "energía"); el HUD no tiene otra barra.
- **Cara**: sin selección, gris y de perfil (fotograma 1); el seleccionado "se prende" naranja y de frente (fotograma 9); calavera (10) si muere. La cara **no** sigue la vida. Transición intermedia sin leer (1 fotograma por ciclo es mío).
- **Tecla `º`/`|` (la de la izquierda del 1, `Backquote`)**: pasa la columna (espejada) y la mochila al lado izquierdo y el mundo se corre 36 px; el ojo, la cámara y las caras no se mueven.
- **Mochila** (`MOCHILA` 112×149) pegada al borde inferior, con la foto grande (`FOTOnn`, 71×91) clavada en (+42, −2); aparece con un comando seleccionado. Con el marine en la balsa solo muestra el traje de buzo (el tanque amarillo): qué ítems se ven según el contexto no se leyó.
- Escala de las capturas: ≈2,04 px por píxel de juego (paso de ranura 63).

## Cierre 3 (2026-10-30): ítems de la mochila (lo que se sabe y lo que falta)
- **Qué ítems tiene cada comando**: `.INTERFACE .SUBINTERFACES [ SUBINTERFACEALIADO [ .TOKEN … .ITEMS [ [ .TOKEN IT_X (.DISPONIBLE NO) ] … ] ] ]` del `.MIS` (`engine/hud.ts parseInterface`, con prueba). Misión 0: COMANDO 12 ítems, LANCHERO 10, FRANCOT 8, ARTIFIC 9; `.DISPONIBLE NO` = oculto.
- **Dibujo de cada ítem**: `OPCIONES/<NOMBRE>.WAD` (`FUN_00697170`: `"%s%s%s.WAD"` con `OPCIONES\`), con el dibujo y su máscara `M_*` (zona de clic). Tabla ítem→archivo (`ITEM_WAD`) emparejada por nombre; sin archivo hallado: GOLPEAR, ACTSENUELOON/OFF, LEVANTARSE, AGACHARSE, MANOCHICA, PUTADISTRAE, BOMBATIEMPO.
- **Posición de cada ítem en la mochila: NO está en el `.MIS` ni en la cabecera de los sprites (campos sin uso = basura) ni en la tabla de 47 registros (`FUN_00786E60`: nombre, id, código STR, grupo y par de frames de *cursor*)**. Las crea `FUN_0051EEF0(sprite, máscara, paleta, …)` desde `FUN_00697DD0`; las coordenadas no aparecen ahí. Plan: ubicarlas por coincidencia de plantilla de cada dibujo sobre capturas del original (comando a pie con la mochila abierta).
- **Qué ítems se ven según el contexto** (el marine en la balsa solo muestra el traje de buzo): sin leer.

## Cierre 4 (2026-10-30): posiciones de los ítems de la mochila
- **Tabla del exe**: `.data` 0x822FA0, registros de 36 B = `{nombre WAD, token IT_*, id, x, y, sprite, máscara, paleta, 0}` (82+ ítems; por ejemplo PISTOLA (59,46), MANO (50,−66), CUCHILLO/MACHETE (−7,7), PIEDRA y TABACO (−30,85), PUNO (0,48), ESPOSAS (59,−7), CONTROLA y BOTIQUIN (42,−12)). La recorre `FUN_005B8C00` (crea un `ClassInterfaceItem` con `FUN_00512A10(token, id)` y llama `FUN_00512AC0`, que guarda (x, y) en `+0xD4/+0xD8`). Ítems excluyentes comparten (x, y) (PISTOLA/LUGER, MP38/MAUSER, disfraces y BALSA).
- **Medido** (capturas 1280×720 del original, plantilla de cada dibujo de `OPCIONES/` contra la captura; diferencia media por canal 2,6–10 de 255 en aciertos, >17 en el resto), relativo a la esquina sup. izq. de la mochila (112×149, pegada a la esquina inferior): **MANO (49,−67) y PISTOLA (59,46) coinciden con el exe** (a ±1 px) en los tres comandos a pie; el resto **no coincide** con la tabla: CUCHILLO (−9,0) contra (−7,7) y PUNO/PIEDRA/ESPOSAS/CONTROLA lejos; **PIEDRA cambia de lugar según el comando** (boina (43,18), marine (81,19), zapador (55,8)). No hallé quién lee `+0xD4/+0xD8` (ni en el código de interfaz ni por búsqueda de pares de lecturas); hipótesis sin probar: otro paso de composición recoloca los ítems según el comando.
- Se dibuja con lo medido por comando (`engine/hud.ts BAG_POS`): boina verde 7 ítems (cuchillo, mano, puño, pistola, piedra, esposas, control alemán), marine 4, zapador 3, francotirador 2. Ítems de los que no hay posición medida (señuelo, interruptor, balsa, traje de buzo, arpón, mirilla y balas, cepo, cartucho, activador…) no se dibujan.
- Emparejamiento corregido: `IT_MANO`→`MANO.WAD` (mano abierta), `IT_GOLPEAR`→`PUNO.WAD` (puño).
- **Visibilidad por contexto**: el original no muestra siempre todo (señuelo e interruptor no se ven al boina verde en el zoo; el marine en la balsa o buceando solo ve el traje de buzo y el francotirador en la balsa ve mirilla y balas). Regla sin leer.
- **Mochila a la izquierda**: sin captura de un comando a pie; los ítems miden igual respecto de la esquina de la mochila (las balas del francotirador salen en x=74 en ambos lados), se dibuja sin espejar.
