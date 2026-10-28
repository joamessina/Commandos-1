# Interfaz, menús, misiones, puntuación y guardado (exe `coman_mp.exe` de la raíz)

Estado: **informe parcial pero verificado** (primera entrega; se amplía abajo). Cada dato: **[hecho]** = leído en el decompilado (con dirección), **[hip]** = deducido, **NO LEÍDO** = no se tocó.
Objeto principal del juego = `ClassEngineJuego` (global `DAT_0083d658`, 0x1448 B; vtable: ctor/init `0x5bd030`, `0x5c2790` = init de recursos y arranque, `0x5c7160` = dispatcher por estado). Abreviatura: `G+off` = campo de ese objeto.

## 1. Flujo de pantallas: máquina de estados `G+0x52c` (`FUN_005c7160`) [hecho]
`5c7160` llama cada fotograma al manejador del estado actual; `G+0x528` = estado pedido (-1 = ninguno), `G+0x530` = estado "al que volver".
| Estado | Manejador | Qué es (por lo leído) |
|---|---|---|
| 0 | `5c47d0` | **partida en juego** (ciclo por fotograma, 20 ciclos/s, ver `exe-lectura.md`) |
| 1 | `5b9ce0` | menú principal (`G+0x13a8` = ClassGestorMenus; `+8 = 1` lo reactiva) |
| 2 | `5b9a40` | pausa/espera: limita con `QueryPerformanceCounter`+`Sleep` a `1000/MAXFPS` y muestra FPS si `G+0x13dc` |
| 3 | `5bc660` | arranque: si `COMANDO.CFG` no fija tamaño usa **1280x720x32** (`5ba6e0(0x500,0x2d0,0x20)`); pasa a estado 1 |
| 4..8 | `5b9e90` | pantallas modales de `ClassIntroduccion`/briefing (`F_00571080(estado)`; `G+0x13c4`) |
| 9 | `5b9fd0` | idem, al terminar vuelve a estado 1 |
| 10, 11, 12 | `5ba030` | **vídeo final** (`MSG_MODOVIDEOFINAL`, `4_V.AVI`) |
| 0x13 (19) | `5b9f50` | `ClassHelpSystem`/sistema `006b0da0` (G+0x13c0) |
| 0x15 (21) | `5b9be0` | `G+0x1390` (créditos/pantalla con `COMANDO.FNT`) |
| 0x12, 0x14, 0x16..0x1a, 0x0d..0x11 | varios | `0x12`=`521000`(G+0x13b8); `0x16/0x17/0x18/0x19` = `60e520(0)` (diálogos: 0x17→0x15, 0x18→menú, 0x19→`5bb7d0`); `0x1a`=`5962a0`; `0x0d..0x10` = editores internos (`5c86c0/5c86f0/5c8720/5c8750`), `0x11` stub |
Tras el estado, `5c7160` atiende banderas: `G+0xd38` ⇒ **guardar** (`5c0500`); `G+0xe3c` ⇒ **cargar** (`5c64b0`→`5c34a0`); `G+0xf40`/`G+0x1050`/`G+0x1264` ⇒ **cargar misión** (`5c6f80` con la dificultad `G+0x45c` o `G+0x1258`); `G+0x528` pendiente ⇒ `5bf6b0`.
Arranque (`5c2790`) **[hecho]**: carga `GLOBAL\CURSORES.WAD` y `GLOBAL\<ancho>X<alto>.WAD`; lee `COMANDO.CFG`; en locale alemán (LCID 0x407/0x1407) con `G.cfg+0x58==0` muestra un MessageBox (cadenas `EINI/NALM`); `MISIONES.DAT`; `USER.CFG`; `START.DAT`; fuentes `COMANDP`, `COMAND2`, `COMANDO` y `COMANDO.FNT`.
`START.DAT` (texto): `.INTRODUCCION [ [ VIDEO [ .MPG H_INTRO.AVI ] ] [ FADEOUT [ ] ] ]` **[hecho]** (vídeo de intro y fundido a negro).
`MISIONES.DAT` **[hecho]**: `.DATOSMISIONES [ .LISTA [ [ .FICHEROMISION MAPAnnnn.MIS .HTIT 3Nnn ] … ] ]`. Orden de campaña (8 misiones): MAPA0000, 0005, 0006, 0002, 0001, 0003, 0004, 0007; `.HTIT` = clave STR del título (`3N00`..`3N07`). Las `MAPA0008/0009/0010`, `MAPF0001` y `TUT00..06` no están en la lista (tutorial/otras).

## 2. Carga de una misión `.MIS` (`FUN_005c4ba0`, 5114 B) [hecho]
Ruta `DATOS\MISIONES\<nombre>`. Lee, **en este orden**, estos bloques de `.MISSION [ … ]`:
`.MUSICA` (nombre WAV, `G+0x23e`) · `.GRAFICOFINMISION` (BMP de fin, `G+0x33d`) · `.ILUMINADA` (0/1 → `G+0x141c`) · `.DATOSFICHEROSMISION [ .VOLUMENES .SECTORES .ESTATICODINAMICOS .BOXTOOLTIP .TEXTOSMISSION .INTROSCRIPT .WADSPRITES .WADMAP ]` (`.WADSPRITES` → `DATOS\RECURSOS\BMPS\SPRITES\<x>.WAD`) · `.AUTOEXPCASAS [ [ .MAP <token> .TILES [ rle… ] ] … ]` (`526e20`) · `.CASASFUERTES [ [ .MAP <token> ] … ]` (`526eb0`) · `.TIPOTERRENO` · `.MAP [ .SCALE f .XY [x y] .BITMAP LIBRnnnn.RLE ]` (minimapa, `6959a0`; sólo si existe el visor `G+0x1374`) · `.WATER` (`6be940/6bef80`) · `.GESTORMAPDRAW` (`588b30`) · `.CHISPAS` · `.PALFX` · `.ZONAS_ILUMINADAS_LOGICAS` · **`.INTENDENCIA n`** (ver §3; si falta ⇒ clase base `5a2140`, `G+0x13fc=-1`) · `ALAM*` (registro de alambres) · **`.ELEMENTOS`** (`609930`) · **`.INTERFACE`** (`69c1f0`, §5) · `.BRIEFING` (`520590`) · `.PATRULLAS` (`5a3320` por entrada) · luego virtuales de la Intendencia **+0x40** (init de la misión) y **+0x44** (= `.INTENDENCIAINFO`, §3) · `.SENSORES_EXP_ZONA` · `.SENSORES_SND_ZONA` · `.TRIPLINES` (`6a6f40`) · y un par de números (`G+0x1434/0x1438`).
Claves vistas en los .MIS pero **no leídas aquí**: `.XY` (a nivel misión), `.SENSORES_*` internos, `.AUTOEXPLOSIONES`, `.MENSAJESDEDESTRUCCION` (sí leída: §3).
Claves de primer nivel por archivo: ver cabecera de `docs/formats-texto-y-modelo.md` §3; hallazgos nuevos: `MAPA0003/0004/0008/0010` tienen `.GESTORMAPDRAW`; `MAPA0009` es la única con `.ILUMINADA 1` y **sin** `.PUNTUACIONES` ni `.OBJETIVOS` ni `.BRIEFING`/`.MUSICA`; `MAPA0001` y `MAPF0001` tienen `.SENSORES_EXP_ZONA`; `.INTENDENCIA`: MAPAnnnn→n (0..9), `MAPA0010`, `TUT00..06` → **8**, `MAPF0001` → **1**.

## 3. Intendencia = reglas de cada misión
### 3.1 Fábrica y clases [hecho]
`FUN_005b8810(n)` guarda `n` en `G+0x13fc` y crea `ClassIntendenciaNN` (guardada en `G+0x13a4`): 0→`5a37f0` (0x4930 B), 1→`5a4000`, 2→`5a4770`, 3→`5a6be0`, 4→`5a89e0`, 5→`5a9cb0`, 6→`5aa040`, 7→`5aa580`, 8→`5ab2c0`, 9→`5ab8e0`, otro→base `5a2140` (0x483c B). La base `ClassIntendencia` tiene **38 ranuras de vtable**; las 10 clases heredan y sobreescriben. Ranuras (nombres míos por lo leído):
| Slot (off) | Base | Qué hace |
|---|---|---|
| 1 | `59a530` | ante mensaje/alta (`59a060`) |
| 4 (+0x10) | `59e900` | **bicho muerto**(ptr): cuenta bajas por tipo `bicho+0x244`: 1→`+0x4c8`, 2→`+0x714`, 4→`+0x27c`; desactiva EXITPOINTs ligados; dispara `MATABICHOSSECTOR` (`59d490`) |
| 10 (+0x28) | `59aca0` (ret 1) | "¿confirmar código de fin?" (la 9 devuelve distinto: `5ab370`) |
| 13 | `59a550` | `0xbac += msg[1]` (acumulador del puntaje de daño, ver §3.3) |
| 14 | dtor | |
| 16 (+0x40) | vacío | **inicialización específica** (ej. M0 resuelve tokens `CASA04`, `ESCALA02`) |
| 17 (+0x44) | `5a0460` | **parser de `.INTENDENCIAINFO`** (§3.2) |
| 18/19/22/23/24 | comunes | |
| 25 (+0x64) | `59eaa0` | **tick**: `+0x960 += 1` (tiempo transcurrido en ticks), `59cdc0` (precarga exitpoints), `59acb0` (suma energía inicial en `+0xb98`), `59cf00` (evaluador de fin), `682970`; temporizador `+0x47b4` (cuenta atrás que resta `_DAT_007a1aa8`) |
| 26 | `5a2d60` | **serializar** (SavR/SavW: param=0 leer, ≠0 escribir; bloques binarios crudos) |
| 30..35 | `59dde0/59ddf0/59de00/59de10/59de20/59de30` | **condiciones de fin** (§3.4): 30=+0x78, 31=+0x7c, 32=+0x80, 33=+0x84 (base: `[0x4818]==0`), 34=+0x88, 35=+0x8c |
| 36/37 (+0x90/+0x94) | `59c330/59c3b0` | acción al código 9 / 10 (muestran STR `OEAB`/`OEAC`) |
Cada `ClassIntendenciaNN` redefine sobre todo 4, 14, 16, 17(sólo M4, M5, M9), 25, 26, 29..37. **NO LEÍDO el detalle de las 10** (condiciones de objetivos concretas); sólo se leyó M0 (ranuras 4/11/14/16/25/26): reacciona a `CASA04`/`ESCALA02` (mensajes `MSGA_ESCALA_GETINFO`, `MSGA_DESACTIVAR_ESCALA`) y reproduce el sonido `OLEA` (`0x4f4c4541`) sobre un punto, con tick propio `5a3b20`.

### 3.2 `.INTENDENCIAINFO` (`5a0460`, 5340 B) [hecho] (offsets en el objeto Intendencia)
| Clave | Destino | Notas |
|---|---|---|
| `DIVISORUNDIMIENTO` | `+0xf98` | |
| `AMBIENTE [ [ .SOUNDID ID .POS [x y z] .VOLUMEN f .DELAY n ] … ]` | `+0x2ba8…` (`682a60`) | sonidos ambientales posicionales |
| `EXITPOINTS [ [x y z] … ]` | `+0xbd4 + i*0x18`, cuenta `+0xf9c`, **máx. 40** | cada uno con flag activo `+0xbe0=1` |
| `OBJETIVOS [ [ .OBJETIVO token .VOLUMEN n ] … ]` | sub-bloque | tokens = nombres de elementos (ej. `ANTI02A`, `AVIO8`) |
| `PAJAROS` | `6ac490` | bandadas (`.ANIM .NUMPAJAROS .BASES …`) |
| `VEHICULOHUIDA` (nombre) | | vehículo de escape |
| `MENSAJESDEDESTRUCCION` | `+0x4814` | |
| `RANGOSUPERACION` | `+0x47f4` | **umbral de rango**: el fin "FINM" exige `rango(G+0x460) >= +0x47f4` (`59ade0`) |
| `PUNTOHUIDA [x y]` | `+0xbc8` (tile) | |
| `MATABICHOSSECTOR [ [ .TOKEN t .SECTORS [ [ .XYZ [x y z] .DESAPARECE b ] … ] ] … ]` | `+0x38cc`.. (≤ nº), cuenta `+0x47a8` | al morir el bicho `t`, cada sector se vacía (`59d490`); máx. 50*4 B por registro |
| `PUNTOS_PANICO_ANIMALES [ [x y z] .. ]` | `+0x14a4` (≤15) | |
| `HAY_VALLAS_AGUJEREABLES` / `HAY_ANIMALES_PELIGROSOS` / `HAY_PRESOS` | `+0x4800` / `+0x47fc` / `+0x4804` | |
| `EXITPOINTSHOME [ nombres ]` | `+0xfa4 + i*0x20`, ≤40 | puntos de salida ligados a elementos; resueltos en el tick (`59cdc0`: sólo `+0xf9c < 40`) |
| `PUNTUACIONES [ .PAR_TICKS_FACIL n .PAR_TICKS_DIFICIL n ]` | `+0x954` / `+0x958` | **por defecto 4000 / 3000**; también `+0xba8=3`, `+0x95c=3` |
`.PAR_TICKS n` (sin FACIL/DIFICIL, en M8/M10/MAPF0001/TUT) **no lo lee el parser base**: usan los defaults 4000/3000 **[hip: el valor 38000 no se usa; falta confirmar si la lee una subclase]**.
`.FACIL_VIGILANTESPRISION`/`.DIFICIL_VIGILANTESPRISION` (M4): los lee `5a8ce0` (override del parser en M4) — **NO LEÍDO el efecto**.
Tabla de datos (ticks de par): M0 16932/17290 · M1 62250/49875 · M2 87150/72884 · M3 73870/59185 · M4 57768/42826 · M5 35856/30191 · M6 62250/55860 · M7 59760/53200 · M8,M10,F1,TUT00..06 `.PAR_TICKS 38000` · M9 sin puntuaciones. (M0 es la única con FACIL < DIFICIL.)

### 3.3 Puntuación [hecho; interpretación de campos entre corchetes]
Tiempo = `Intend+0x960` (contador de ticks, +1 por tick de la Intendencia ≈ 20/s, **[hip]** 20 ticks=1 s por `MAXFPS=20`). Dificultad `G+0x45c`: 0 = fácil, 1 = difícil (`SKILL` en el .SAV).
- `63caa0(t, par)`: `r = 3 - ftol(floor(t/par - 0.5))`, recortado a **[0,3]**. Es decir **3 estrellas si t/par < 1,5**, 2 si < 2,5, 1 si < 3,5, 0 si ≥ 3,5 (≥1 por abajo no puntúa más: si t/par<0,5 el valor se limita a 3). `par` = `+0x954` (skill 0) o `+0x958` (skill 1) (`63cba0`).
- `63ca00(x, y)`: `q = clamp(x/y, 0, 1) * 4.0`; `ftol`; recortado a [0,3] (el valor se **resta de 3**). Con `x = Intend+0xbac` (acumulado por la ranura 13: suma `msg[1]`) e `y = NUMALIADOS(G+0x488) * 200` ⇒ `63cc00 = 3 - ca00(...)` **[hip: 0xbac = daño/energía perdida total de tus hombres, 200 = energía máx. por comando]**.
- Rango de misión `63cc40 = floor( (rango_tiempo + rango_energía) * 0.5 )` (valor 0..3) — se suma a la puntuación de campaña: `59ba60`: `G+0x460 += 63cc40()`.
- Rango de campaña `63cd20 = min(4, G+0x460 / 6)` (0..4); resto visible `63cd50 = min(5, G+0x460 - 6*min(4,G+0x460/6))`. `59ba60` devuelve `true` si el rango **subió** con esta misión (ascenso). Título de rango: `F_005bce30` → `623e30(idx+1, skill, score, user)` (texto de rango, **NO LEÍDO** el contenido).
- Pantalla de resultados `570510` (class `…Score`): dibuja 3 números de bajas (`+0x27c` y otros dos) + estrellas de tiempo y energía + rango global + rango de campaña; coordenadas relativas al centro de pantalla (±: −0xb1/−0x8a/−0x63 filas de números a x+0x1e; estrellas en x−0xb). **NO LEÍDO** qué ítem es cada fila ni los sprites exactos.

### 3.4 Fin de misión [hecho en estructura, parcial en detalle]
`59cf00` (en el tick) → si `[0x11f9]` activo: `[0x11fb]==0` ⇒ `code = 59b600()` y `59bab0(code)`; `==1` ⇒ cuenta atrás `[0x11fa]` y luego `59bab0([0x11fc])`.
`59b600` = **evaluador**: combina listas de aliados (`ListaComandos`: nº total, nº con flag `+0x38&4`, "todos en exitpoint" `6abd90` = nº vivos fuera de peligro) con las ranuras 30..35 de la subclase. Códigos devueltos/usados:
| Código | STR (GLOBAL.STR) | Texto | Notas |
|---|---|---|---|
| 1 | `FINM` / `FING` / `NPSE` / `3OK3` | FINM "CONGRATULATIONS, you have successfully accomplished the mission"; FING "…finished the game" (si `59ade0`: rango≥`+0x47f4` / última); NPSE = fin prematuro; 3OK3 = tutorial completado | `MSG_MODOCONGRATULATIONS`, `_ENDGAME`, `_ENDGAME_PREMATURO`, `_CONGRATULATIONSTUTORIAL`; si `NPSE`: "no puedes seguir hasta destruir/lograr" |
| 2 | `ALOL` | "ALL YOUR MEN MUST ESCAPE." | salieron algunos pero no todos |
| 3 | `NOO2` / `NOOB` | "YOU MANAGED TO ESCAPE, but you have NOT completed all the goals / didn't destroy the targets… you can't go on" | NOO2 si `[0x1205]==0` |
| 4 | `ALMU` | "ALL YOUR MEN HAVE DIED OR HAVE BEEN CAPTURED." | fin con cuenta atrás de 100 ticks (`[0x11fa]=100`,`[0x11fc]=4`) |
| 5 | (derrota diferida) | `[0x11fe]` con contador `[0x1204]=100` | |
| 6 | `NOES` | "NOW, YOU DO NOT HAVE AN ESCAPE VEHICLE." | |
| 7 | `NOVE` | "YOU HAVE FINISHED THE MISSION BUT YOU DON'T HAVE AN ESCAPE VEHICLE." | cuenta atrás 100 |
| 8 | `AMUC` | "ONE OF YOUR MEN DIED, SO YOU CANNOT ACCOMPLISH THE MISSION." | ranura 34 |
| 9 / 10 | vtable +0x90/+0x94 | `OEAB` / `OEAC` | acciones específicas |
| 0xb | `IAMU` | "ONE OR MORE OF YOUR MEN DIED… YOU NEED ALL OF YOUR MEN" | |
Las cadenas se piden con `F_00683b20("CODIGO")` (fallback `CADENA DESCONOCIDA`). Resultado ⇒ mensaje `MSG_MODOENDGAME` / `MSG_MODOGAMEOVER(REPLAY)` al engine.
**Patrón por misión [hecho en forma; contenido parcial]**: las ranuras 29..35 de cada subclase son comprobaciones de **contadores/flags de objetivos** guardados en campos propios: M1: ranura 30 = `+0x483c==1 || +0x4844==1`, ranuras 33/34 = `+0x4858==0`, ranura 29 = el comando `+0x486c` está en el vehículo `+0x4870/+0x4874` (`bicho+0x134 == vehículo`, escape); M2: ranura 32 = la lista de aliados no está vacía y el aliado `+0xbc8` sigue en su puesto, ranura 35 = tres objetivos (`+0x4844/48/4c`, `5a4bd0`) cumplidos; M3: ranura 30 = `+0x4840!=0 || +0x4844!=0`, ranura 31 = `+0x48cc==0`, ranuras 33/34 = `+0x484c==0`, ranura 29 = `+0x483c==0 && +0x4840==0` y el comando `+0x486c` en el vehículo `+0x4868`; M4: ranura 30 = `+0x4890==0`, 33/34 = siempre 1, ranura 29 = `+0x4894==9` y dos bichos con `bicho+0x38&8` apagado; (M5..M9 no revisadas). Los contadores bajan en la ranura 4 (bicho muerto) y en los mensajes de cada objetivo (`MSGA_*`). **Textos de misión**: `MAPA0001.STR` y `MAPA0007.STR` traen `GEES` (el objetivo escapó: "COLONEL VON BELOW HAS ESCAPED… / THE GENERAL HAS ESCAPED, YOU CAN NO LONGER GET THE DOCUMENTS") y `GEMU` (murió: "…YOU WERE SUPPOSED TO CAPTURE HIM ALIVE" / "THE GENERAL HAS DIED"): se disparan por muerte/huida del bicho clave **[hip, por el texto; no se leyó el disparador]** (M1: coronel a capturar vivo; M7: general). Títulos (`GLOBAL.STR` `3N00..07`): 0 DYING LIGHT · 5 THE ASPHALT JUNGLE · 6 DROPPED OUT OF THE SKY · 2 THOR'S HAMMER · 1 GUESS WHO'S COMING TONIGHT · 3 EAGLE'S NEST · 4 THE GREAT ESCAPE · 7 DANGEROUS FRIENDSHIPS (en el orden de `MISIONES.DAT`). `MBnn.STR`: `DATE`, `PLAC`, `TITL` (fecha, lugar, título del briefing) y líneas numeradas `0000..` con los objetivos mostrados.
**NO LEÍDO**: la lógica por misión (qué objetivos/`OBJETIVOS` y `EXITPOINTS` exige cada `ClassIntendenciaNN`, p. ej. `MATABICHOSSECTOR`, `CASASFUERTES`), quién llama a `+0x78/+0x7c/+0x84…` con qué efecto exacto, ni las STR `3Nnn` (títulos).

## 4. Guardado de partidas (`.SAV`) [hecho]
- **El .SAV es texto en la misma sintaxis `.CLAVE [ … ]`** que el .MIS: un solo parser (`ClassMissionScriptBlock`).
- Escritor `FUN_005c0500` (4498 B): crea bloque `MISION`, con claves **en este orden**: `DATOSFICHEROSMISION`, `ILUMINADA`, `MISIONACTUAL` (nombre .MIS, `G+0x40`), `MUSICA`, `GRAFICOFINMISION`, `BRIEFING`, `SKILL` (`G+0x45c`), `SCORE` (`G+0x460`), `USER` (`G+0x464`, perfil), `NUMALIADOS` (`G+0x488`), `MPACTIVO` (`G+0x4d4`), `ANIMPRELOAD`, `FISICA`, `SONIDOSFISICOS`, `SONIDOSLOGICOS` (si hay sonido lógico), `COLORVISTACERCA`/`COLORVISTALEJOS` (3 shorts, `G+0x47a/0x474`), `TIPOTERRENO`, `NOTICAMBIOSECTORES`, `GESTORINFOUTILPLAYER`, `ZONASSELECCION`, `ZONASILUMINADAS`, `ELEMENTOS` (todos los bichos/objetos con estado: `5bbbf0`), `DATOSINTERFACE` (HUD: `698300`), `VUELTAPARTIDA` (`G+0x468`), `INTENDENCIAID` (`G+0x13fc`), `INTENDENCIA` (Intendencia vtable +0x48 = serializar a texto), `GESTORMAPDRAW`, `CHISPAS`, `PALFX`, `WINENGINE`, `WATER`, `SENSORES_EXP_ZONA`, `SECTORESCONALEMANES`, `SENSORES_SND_ZONA`, `CAMBIATILES`. Pantalla de progreso: `LOAD0001..0003.RLE`.
- Lector `FUN_005c34a0` (3883 B): lee el mismo árbol y además `PREFERENCES` (`62d530`: opciones `GAMEINMUSIC, IGNOREPARSEHALT, VERBOSE, WARNINGS, SONAMBIENTE, MAXFPS`), `CREADORNOMBRESBICHOS` (`52c540`), `FISICA`, `CAMBIATILES`, `TRIPLINES` (`6a7a40`), `SONIDOSLOGICOS`; recarga mapa (`5b91d0`), `ELEMENTOS` (`523760`). Rutas: nombre `F_00542a70(...)`+archivo; modo apertura `0x8000`.
- Nombres: **`QLOAD.SAV`** = partida rápida (comprobada con `F_00543850(…,0x4000)`; tecla de "Quick Load" = 1ª letra de la STR `LQLD`); `REDTMP%d` (partida temporal de red, `5351a0`); cadena `.SAV` (y `SAVE`, `SAVA`) en `.rdata` para el menú de partidas (`ClassMenuPartidas`, `ClassLineaGrabaPartida`/`CargaPartida`). La carpeta base sale de `F_00542a70` (`OUTPUT\`, `0x79e0d4`). **NO LEÍDO**: la rutina que arma el nombre `xxxx.SAV` del menú, ni el contenido binario de las Intendencias (se serializan por `SavR/SavW`/`ISavRW`: `+4 leer(ptr,n)`, `+8 escribir(ptr,n)` crudo; p. ej. M0 guarda 0x18 B desde `+0x483c`).

## 5. Interfaz (HUD)
### 5.1 Pantalla y recursos [hecho]
- `FUN_005ba6e0(w,h,bpp)` cambia el modo y carga `DATOS\RECURSOS\BMPS\SYSTEM\GLOBAL\<w>X<h>.WAD`. WADs presentes: **512X384, 640X480, 800X600, 1024X768** (más `1280X720.WAD` en la raíz Steam) + `CURSORES.WAD` + `GLOBAL.WAD`. Otras carpetas: `CARAS`, `CREDITOS`, `LIBRETAS` (`LIBR0000..0008.RLE` = minimapas por misión), `MISC`, `OPCIONES`, `RED`.
- `COMANDO.CFG` `.SIZE [ .INITSIZE n ]` (`61ebc0`): 1=640x480, 2=800x600, 3=1024x768, 4=**1280x720**; sin valor (−1) arranca en 1280x720x32.
- `BOT10000/BOT10001 … BOT30000/BOT30001.RLE`, `BOTO0000..0003`, `M_DEPIE/M_AGACHA/M_INTER/M_CAMARA/M_OJOALE/M_FOTITO.RLE` (botones de postura, interruptor, cámara, ojo, fotos de ranuras `IT_FOTO0..7`), `COMANDO`/`COMAND2`/`COMANDP` y `COMANDO.FNT`.
### 5.2 Formato `.INTERFACE` de la misión [hecho en datos; código `69c1f0` parcial]
```
.INTERFACE [ .SUBINTERFACES [
  [ SUBINTERFACEMULTIPLE [ .TOKEN MULTIPLE .ELEMUSABLES [ ZODIAC5 ALBERGUE02 ESCALA01 ASCENSOR … ] ] ]
  [ SUBINTERFACEALIADO  [ .TOKEN COMANDO .CARETO CARA0001.RLE
        .ITEMS [ [ .TOKEN IT_PISTOLA ] [ .TOKEN IT_TABACO .DISPONIBLE NO ] … ] ] ]
  … ] ]
```
`ClassSubInterface{Aliado,Aleman,Multiple}` (`.TOKEN` = nombre del bicho en el .MIS, error `SUBINTERFACEALIADO: NO HAY BICHO %s. REVISAR FICHERO .MIS`). `.CARETO` = cara en `CARAS\`. `.DISPONIBLE NO` = ítem oculto hasta que se consigue. Hay también `SUBINTERFACEARRESTADO` (prisionero) y `SUBINTERFACEBASE`. El save usa `DATOSINTERFACE` (`698300`: `LIBRETA`, `SUBINTERFACEBASE/ALIADO/ARRESTADO/MULTIPLE`, `INFOCARAS`), cargado por `69ac60`.
Tokens `IT_*` por frecuencia en los 19 .MIS (**[hecho]**): `PISTOLA, MANO, PIEDRA, TABACO, CONTROLALEMAN` (casi todos), `CUCHILLO, ESPOSAS, BOTIQUIN, SEGNUELO, ACTSENUELOON/OFF, BALSA, GOLPEAR, MIRILLA, METRALLETA, ESCOPETA, CACHIPORRA, TRAJEBUZO, CEPO, CARTUCHO, ACTIVADOR, CAMUFLARSE, ARPON, JERINGUILLALETAL, INSIGNIA, GRANADA, QUITAUNIFORME, MP38, MAUSER, LUGER, ESPIAA..ESPIAA7, CLOROFORMO, ALICATE, INTERRUPTOR_ASCENSOR, BOMBATIEMPO, UNIFORME, PUTADISTRAE, PIPAPUTA, MANOCHICA, MALETIN`; en el exe además `IT_PIOLET, IT_LANZALLAMAS, IT_BALLESTA, IT_LEVANTARSE, IT_AGACHARSE, IT_CARA_ALEMAN, IT_ARRESTADO_DISTRAE`. Tokens de personajes (`.TOKEN`): `COMANDO` (Boina verde), `LANCHERO` (Marine), `FRANCOT`, `ARTIFIC` (Sapper), `ESPIA`, `CONDUC` (Driver)… (nombres internos, ver MIS).
**Tabla de ítems del HUD [hecho]**: inicializador `FUN_00786e60` rellena un array de **47 registros de 0xAC (172) B** (`+0x00` nombre `IT_*`, `+0x20` **id numérico**, `+0x24` código STR de 4 letras para el tooltip, `+0x50` clase/grupo de acción (`PISTOLA`, `ESCOPETA`, `GRANADA`…), `+0x78/+0x7c` par de frames del icono (por defecto 20,0), `+0x90` flag 1 en `MIRILLA, TRAJEBUZO, INTERRUPTOR_ASCENSOR, MALETIN`; campos `+0x2c/+0x30…` banderas 0/1 sin leer). Id : ítem (código STR): 1 PISTOLA(PIST) · 3 LUGER(LUGE) · 98 PIPAPUTA · 15 MIRILLA · 85 ARPON(ARPO) · 7 GRANADA(GRAN) · 36 ESCOPETA(ESCO) · 39 MAUSER · 32 BALLESTA(BALL) · 37 METRALLETA(METR) · 8 PIEDRA(PIED) · 9 TABACO(TABA) · 10 CUCHILLO(CUCH) · 94 QUITAUNIFORME(QUUN) · 91 CACHIPORRA(CACH) · 92 CLOROFORMO(CLOR) · 93 GOLPEAR(GOLP) · 87 ESPOSAS(ESPO) · 11 PIOLET(PIOL) · 18 MANO / 19 MANOCHICA · 4 BALSA(BALS) · 17 TRAJEBUZO(TRBU) · 86 BOMBATIEMPO(TBOM) · 5 CARTUCHO(BOMB) · 16 ACTIVADOR · 21 LANZALLAMAS(LANZ) · 44 SEGNUELO(SEGN) · 46/45 ACTSENUELOON/OFF(ASON/ASOF) · 41 ALICATE(ALIC) · 43 INSIGNIA · 34 UNIFORME(UNIF) · 40 CAMUFLARSE(CAMU) · 42 JERINGUILLALETAL(JELE) · 82 BOTIQUIN(BOTI) · 83 AGACHARSE · 84 LEVANTARSE · 89 CONTROLALEMAN(COAL) · 95 PUTADISTRAE · 96 INTERRUPTOR_ASCENSOR · 97 MALETIN(MALE) · 99..103 ESPIAA..ESPIAA5 (UNI1..UNI5). Pares de icono: PISTOLA/LUGER 28,29 · MIRILLA 24,25 · ARPON/ESCOPETA/MAUSER/BALLESTA/METRALLETA/LANZALLAMAS 30,31 · GRANADA 12,13 · PIEDRA 51,52 · TABACO 55,56 · CUCHILLO 2,1 · QUITAUNIFORME 67,66 · CACHIPORRA 61,60 · CLOROFORMO 65,64 · GOLPEAR 63,62 · ESPOSAS 53,54 · PIOLET 32,0 · MANO 23,22 · ALICATE 16,17 · INSIGNIA 39,40 · JERINGUILLALETAL 8,7 · BOTIQUIN 46,47 · CONTROLALEMAN 75,76 · PUTADISTRAE 68,69 · TRAJEBUZO 74,20. (Los ids probablemente son los del catálogo de acciones/armas: pasarlo al tema "acciones del jugador".)
Cursores: strings `CUR_*` (≈60: `CUR_PISTOLA/NPISTOLA`, `CUR_CUCHILLO`, `CUR_ESPOSAS`, `CUR_TABACO`, `CUR_GRANADA`, `CUR_PIOLET`, `CUR_ALICATE`, `CUR_JERINGA(LETAL)`, `CUR_CLOROF`, `CUR_CACHIP`, `CUR_MIRA/PTOMIRA`, `CUR_ROBAR`, `CUR_QUITAUNIF`, `CUR_PUTADISTRAE`, `CUR_CONTROLA_ALEMAN`, `CUR_ARRESTADO_*`…): prefijo `N` = versión "no aplicable" (ej. `CUR_NPISTOLA`); sprites en `GLOBAL\CURSORES.WAD`. **NO LEÍDO** la tabla cursor→acción.
### 5.3 Mensajes del HUD (`699ae0`) [hecho parcial]
Despacha por código 1..0x6a a los ítems del interfaz (`F_006f3940`); casos propios: `0x16` (posición ítem), `0x18` (nuevo ítem en lista, máx `+0x374`), `0x1a`, `0x1c/0x1d` (cambiar mundo/vista `+0x2f4/0x2f8`), `0x1e` (cambiar ícono por nombre), `0x32`, `0x3b/0x3c/0x3d` (fotos `M_FOTITO.RLE`, hasta 10 por grupo). **NO LEÍDO** el significado de cada código ni `ClassBoton*`, `ClassButtonBar`, `ClassVisorMundo` (minimapa), `ClassVisorComandos`, `ClassCamaraActiva`, `ClassPulsacionPendiente*`.

## 6. Teclado [hecho parcial]
- `FUN_00598da0` (sondeo cada fotograma, sólo si la ventana tiene el foco): pares **(tecla virtual → código de pulsación)**; al apretar llama `F_0069f680(código)`, al soltar `F_0069f6d0(código)`: ↑(0x26)→−28 · ↓(0x28)→−36 · ←(0x25)→−35 · →(0x27)→−37 · CTRL(0x11)→−34 y −30 · SHIFT(0x10)→−27 y −26 · ESPACIO(0x20)→−32 · NUM+(0x6b)→−41 · NUM−(0x6d)→−40 · NUM*(0x6a)→−39 · ALT(0x12)→−33 y −31 · HOME(0x24)→−19 · END(0x23)→−24. `F_0069f680/0069f6d0` ponen/quitan el bit `i` de una **máscara de teclas mantenidas** (`obj+0`), donde `i` = posición del código en la lista registrada (`obj+4…`, nº en `obj+0x84`): es el estado "tecla apretada" que consultan los consumidores (scroll de cámara con flechas, etc. **[hip]**). **NO LEÍDO** qué hace cada código ni quién los registra (`69f7a0`?); el resto de teclas llegan por mensajes `KYDN/KYUP/CHAR` (0x3d/0x3c/0x3e) al HUD/engine, cuya tabla de atajos no se halló.
- Teclas de confirmación localizadas: `DAT_0083d668..0x83d66f` = primera letra de las STR `LYES, LNO_, LCON, LREP, LNEX, LCAN, LRET, LQLD` (Sí, No, Continuar, Repetir, Siguiente, Cancelar, Volver, Carga rápida): en inglés `Y/N/C/R/N/C/R/Q` según GLOBAL.STR (`5c7d30`). Estado 5/6 + tecla `LQLD` ⇒ carga `QLOAD.SAV` (`56f4d0`).
- **Trucos**: `PYROFOREVER` (`6ef0b0`) **no es un código de trucos**: es el nombre que se copia (`62cb80`, strcpy) al construir el objeto de entrada `WinEngine` (`6ef0b0` es su constructor; carga el motor `"ENGINE"`). Búsqueda por cadenas (`CHEAT, TRUCO, GOD, INVUL…`): sólo `INVULNERABLE` (`0x794d64`, nombre de acción/flag de objeto, no tecla) y `DEVELOP` en cfg. **No encontré códigos de trucos por teclado**; `COMANDO.CFG .DEVELOP 1` (activo en el cfg Steam) habilita el modo desarrollo (`cfg+0x5c`), que da acceso a los editores internos (estados 0x0d..0x10, 68 diálogos `D_EDIT_*`) **[hip]**.

## 7. Configuración
`COMANDO.CFG` (`61ebc0`) [hecho]: `.OPTIMIZACIONESFPS [ .WATER .PISADAS .PARTICULAS ]` · `.PROFILE [ .USER n ]` (−1 si falta) · `.SIZE [ .INITSIZE n ]` · `.SONIDO [ .ACTIVO 0/1 .VOLMUSICA f .VOLEFECTOS f ]` (`61e110`) · `.CURSORSOFT` · `.RETARDOPISTOLA` · `.DEVELOP n` · `.NETGAMEPLAYER` · `.SERVERADDRESS` (+ la línea inicial `SAVA`, ignorada). Escritura: `61e300`. Si la STR `3PRE` vale `SPIELEINSTELLUNGEN` se marca `cfg+0x58=1` (idioma alemán). `USER.CFG` (`589ab0`): lista de usuarios (el de Legacy es `---`, el Steam `DEFAULT`).

## 8. Briefing: guion `.SCR` [hecho en parser y estructura]
- Parser `FUN_005b34a0`: lee `DATOS\MISIONES\<x>.SCR` línea a línea (continuación con `\` al inicio de la siguiente línea; líneas que empiezan por `*` son comentario); `sscanf("%ld %s %s")` ⇒ **retardo (ticks), comando, resto**; a cada comando se le pasa el texto **después del `#`** y la cola de ejecución es una lista (`afd70` agrega).
- Clase base `ClassElemIntroScript`: `[2]`=retardo; ranura vtable 1 = *tick* (`[3]--`, sigue esperando mientras `[3]>0`), 3 = *ejecutar/arrancar* (recarga `[3]=[2]`), 6 = destructor, 7 = "¿terminó?". `$n` en la línea → `[5]` (p. ej. frames de un fundido).
- Comandos [hecho: sintaxis; hip: efecto]: 
  | Comando | Argumentos (`#…`) | Efecto |
  |---|---|---|
  | `STARTWAVE[1\|2\|3\|M] #f.WAV %subtítulo` | WAV + texto tras `%` | reproduce `DATOS\BRIEF_MP\WAVE\f` (voz) o, canal **M**, `BRIEF_MP\MUSICA\f` (música; `67e120(ruta, loop=(canal==M), vol, 0)`) |
  | `STARTWAVELEVEL[..] #v` | v∈[0,1] | cambia volumen del canal gradualmente (en los datos se encadena `10 STARTWAVELEVELM #.35 … #.00` = fundido de música) |
  | `SETWAVELEVEL[..]`, `STOPWAVE[..]`, `WAITWAVE[..]`, `WAITWAVELEVEL[..]` | | fijar nivel, parar, esperar fin / fin del cambio |
  | `SETPOS #…` | `B nombre` (elemento del mapa, `64a660`), `( x y z )` (mundo), `V nombre` (vehículo/objeto `613540`), `[ sx sy ]` (pantalla→mundo) | coloca la cámara |
  | `STARTGOTO #pos @V` | `pos` igual que SETPOS; `V`=L/M/N/R velocidad | desplaza la cámara. Constantes (par por velocidad): L=(25; 1,75) · M=(10; 0,7) · N=(50; 3,5) · R=(90; 6,3) |
  | `SETZOOM #z` / `STARTZOOM #z V` | zoom float; V=L/M/N/R | zoom: L=(0,0075/0,015) M=(0,00325/0,0075) N=(0,015/0,03) R=(0,03/0,06) (pares por velocidad) |
  | `WAITGOTO`, `WAITZOOM`, `WAITFADE`, `WAITVIDEO`, `WAITZOOMBITMAP` | – | bloquea el guion hasta que termine esa acción |
  | `STARTBLENDFADE #A.BMP B.BMP $n` (+`STARTBLENDFADESTOP`) | dos BMP y `$n` frames | fundido cruzado A→B (`BR_BLACK.BMP` = negro) |
  | `STARTFADEOUT` | – | fundido a negro |
  | `STARTZOOMBITMAP #M.ZOM F.BMP x y w h nf cx0 cy0 cx1 cy1 z0 z1` | formato `%s %s` + **9 `%ld` + 3 `%f`** | zoom animado del mapa `.ZOM` en una ventana (x,y,w,h) durante `nf` frames, centro (cx0,cy0)→(cx1,cy1) y zoom z0→z1 (los datos traen sólo 2 floats) |
  | `STARTBMP[1..4]`, `STARTMM[1..4]`, `MM`, `STARTFOCO` | bitmaps por capa 1..4 / "foco" (3 floats + nombre) | **NO LEÍDOS** (usados 0 veces en los 8 `.SCR`) |
  | `VIDEO #0/#1` | 0/1 | conmuta modo de vista (0 = pantallas de texto, 1 = mapa táctico) **[hip]**; `STARTVIDEO #f.AVI` reproduce `VIDEO\f` |
  | `BREAK` | – | fin de la "página" (espera a que todas las acciones acaben/click) **[hip]** |
  Frecuencias en los 8 .SCR: STARTWAVELEVELM 96, STARTGOTO 96, WAITGOTO 91, WAITWAVE 81, STARTWAVE 74, STARTZOOM 54, WAITZOOM 51, WAITFADE 40, STARTBLENDFADE 34, VIDEO 27, STARTWAVEM 16, BREAK 11, WAITZOOMBITMAP/STARTZOOMBITMAP/SETZOOM/SETPOS 8, STARTFADEOUT 6, STARTVIDEO/WAITVIDEO 3. (Hay typos en datos: `WAIGOTO`, `STARGOTO`, que el parser ignora.)
- Canales de audio del briefing: sin sufijo, `1`, `2`, `3` y `M` (música) ⇒ 5 canales.

## 9. Menús y textos
`GLOBAL.STR` (434 líneas, `CÓDIGO texto`): todos los textos de UI/menús/red (`RE10..RE63` red, `IAMU`, `NOOB`…, `LYES/LNO_/LCON…`). `MISIONES\MBnn.STR` = textos del briefing; `MAPAnnnn.STR` = textos propios de la misión. Clases de menú (RTTI): `ClassMenu, MenuNewGame(+Confirmacion), MenuNewUserConfirmacion, MenuPartidas, MenuOpciones (líneas: Brillo, Velocidad ratón, Volumen música/efectos, Game speed, On/Off ambiente/in-game music/parse halt/verbose/warnings), MenuVideo, MenuMultiplayer, MenuJoinGame, MenuQuitGame, ClassGestorMenus, ClassLineaMenu/BotonMenu/Literales/Numeros/Password/User…`. **NO LEÍDO** el contenido ni el layout de cada menú.

## 10. Tutorial `.ROL` ("rolling demo") [hecho]
**Es texto (líneas CRLF): una grabación de la entrada del jugador** que se reproduce sobre la misión `TUTnn.MIS` (con la voz de `DATOS\rolling\wave\tut*.wav`). Lo escribe `FUN_0065d070` (grabador; diálogo `D_RECROLLING`), lo lee `65d780/65d8e0/65dfa0/65e130` (`D_PLAYROLLING`, ruta `DATOS\ROLLING\`, `*.rol`; `TUT01..06.ROL`, y `MAPA0008.ROL` en `600760`). Archivo de 7 (`tut00..06`; 131 WAV en `wave\`):
```
TUT02.MIS                 <- misión sobre la que se reproduce
1 0 0 0 1 1 1             <- 7 banderas (NO LEÍDO el significado de cada una)
16 640 480                <- [hip] bpp, ancho, alto de la grabación
STKB 0                    <- "tick"/marca de teclado (STKB n)
WAVE TUTSN01.WAV          <- arranca una voz
UNKN -1 369 276           <- evento desconocido (msg, a, b)
MMOV 381 257              <- movimiento de ratón (x y)
WAIT 10 0                 <- esperar n fotogramas (n, extra)
KYDN 50 8 / CHAR 50 0 / KYUP 50 0   <- tecla abajo/carácter/arriba (vk, flags)
BOT1 320 240 / B1RE ..    <- botón 1 abajo / B1 soltado ; BOT2/B2RE = botón 2
B1DC / B2DC               <- doble click
#### 10                   <- marca (texto/comentario "marca 10" para el editor)
FRAM ..                   <- (7 apariciones) NO LEÍDO
```
Código de mensaje de entrada → etiqueta (del grabador): `0x24 BOT1`, `0x25 BOT2`, `0x26 B1RE`, `0x27 B2RE`, `0x2a MMOV`, `0x2b B1DC`, `0x2c B2DC`, `0x3b SKUP`, `0x3c KYUP`, `0x3d KYDN`, `0x3e CHAR`, otro → `UNKN a b c`. Con teclas 0-9 y el modo de marcas el grabador añade `**** MARCA n`. Frecuencias en los 7 archivos: MMOV 13095, STKB 7663, KYDN 2610, WAIT 2446, `####` 1848, B1RE 440, BOT1 366, B2RE 215, KYUP 132, BOT2 132, WAVE 130, B2DC 83, B1DC 74, CHAR 23, UNKN 14, FRAM 7. **Para el port**: se puede reproducir como una secuencia de eventos de entrada sintéticos (mover cursor, clicks, teclas) con `WAIT n` fotogramas entre ellos; la voz se dispara con `WAVE`. Falta confirmar si la unidad de `WAIT` es un ciclo (1/20 s) y qué hace `STKB`.

## 11. Resumen de lo que falta (NO LEÍDO)
Lógica de objetivos de M0, M5..M9 (y detalle M1..M4); campos de los 47 registros de ítems salvo id/STR/iconos; sentido de las 7 banderas y de `STKB`/`FRAM`/`UNKN` del `.ROL`; **tabla de atajos de teclado** (no encontrada: las teclas entran por mensajes `KYDN` y no hay tabla `vk→comando` visible; sólo el sondeo de flechas/CTRL/SHIFT/ALT);
Reglas de cada `ClassIntendenciaNN` (objetivos reales por misión); contenido de ranuras de la pantalla de resultados; significado de códigos de pulsación y mensajes del HUD; `ClassBoton*`/`ButtonBar`/`VisorMundo`/`VisorComandos`/`CamaraActiva`; tabla cursor→acción; formato `.ROL`; menús; créditos/help/pantallazos; STR de título de misión `3Nnn` y texto de rangos; formato binario de `SavR/SavW` por clase.

## Hallazgos para otros
- **Movimiento/percepción/IA**: `bicho+0x244` (tipo: 1/2/4) clasifica las bajas; `bicho+0x208` = energía (suma inicial en `Intend+0xb98`), `bicho+0x134` = referencia de vehículo/lugar donde está el comando, `bicho+0x23c & 4` y `+0x38 & 4` = flags de "fuera de juego" usados por el evaluador de fin.
- **Sonido**: `.AMBIENTE [ .SOUNDID .POS .VOLUMEN .DELAY ]` (IDs `OLEA`, `WIND`); el id sonoro de la Intendencia M0 es el literal `0x4f4c4541` = "OLEA" (4 chars, little-endian); `MSS` se usa también para voz del briefing en `DATOS\BRIEF_MP\{MUSICA,WAVE}\`.
- **Gráficos**: la carga de misión pide `LIBRnnnn.RLE` para el minimapa (`.MAP .BITMAP`, escala `.SCALE`, `.XY`), `FASEnnnn.WAD` por `.WADMAP`, `.WADSPRITES` opcional en `BMPS\SPRITES`.
- **Armas/acciones**: `IT_*` es el catálogo de ítems/acciones de HUD (`MIRILLA`=mira del francotirador, `TRAJEBUZO`, `ARPON`, `CEPO`, `CARTUCHO`/`ACTIVADOR` = explosivos del sapper, `JERINGUILLALETAL`, `CLOROFORMO`, `PIPAPUTA`, etc.).
