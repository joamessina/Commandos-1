# Formatos de texto y modelo de objetos (lectura del 2026-10-27)

Todo **[hecho]** salvo lo marcado. Fuente: archivos de `Legacy\WAR_MP.DIR` extraídos a `research-c1\x\DATOS\`.

## 0. Qué exe leer
- `Legacy\coman_mp.exe` (2009, empaquetado con el wrapper DRM de Steam): `.text` con entropía 8,0 y entry point en `.bind` → **código cifrado, no se puede leer estáticamente**. No se intenta quitar el DRM.
- `coman_mp.exe` de la raíz: PE normal (sin `.bind`, `steam_api` solo como import) → **es el exe que se decompila**.
- Los datos de ambas versiones son los mismos: de 1227 archivos comunes, 1226 son idénticos byte a byte; solo difiere `GLOBAL.STR`. La raíz agrega `1280X720.WAD` y `MENU1280.BMP` (UI 720p). Conclusión: el motor lee los mismos formatos; la lógica se estudia en el exe de la raíz y los datos son los de Legacy. **[hip]** hasta cotejar comportamiento concreto (el exe de la raíz es una compilación más nueva).

## 1. Sintaxis `.CLAVE [ … ]`
Mismo lenguaje en `MIS`, `MAC`, `DAT`, `Comando.cfg`: claves que empiezan con `.`, listas entre `[ ]`, números, cadenas sin comillas, `$Nombre` = variable de la plantilla, `;` y `#` comentarios. Un solo parser sirve.

## 2. `MAC` = plantilla de objeto (96 archivos, `.CLASS BICHO` en todas las que tienen clase)
Campos vistos: `.VARIABLES` (tipo por la primera letra: `C` cadena, `P` punto, `G` gráfico/ANM, `A` acción, `E` entero, `N`, `V`), `.BANDO` (`ALEMAN` 17 / `NEUTRAL` 44), `.ANGULO`, `.VOLCOLISION [ CILINDRO [ .R 10 .H 29 ] ]`, `.LISTAS [ EJEC CHOC SELE VISI ]` (en qué listas del motor participa), `.MASA`, `.TIP`, `.REACTIVIDADES`, `.ENEGIA`, `.FUERZA`, `.IMPACTOS`, `.SONFIS`, `.PINTABLE`, `.OCLU`, `.CONTENEDOR`, `.TIPOVEH`, `.VEHICLE`, `.GRAPH [ .ANIM <ANM> .RENDERVOL … ]`.

### IA = acciones concurrentes que compiten por los órganos con prioridad (CARISMA)
> **Corregido (2026-10-27, `docs/engine/ia-mensajes.md`):** no hay una acción activa ni una pila. Todas las acciones del bicho reciben `Update` y todos los mensajes en cada ciclo (`FUN_0050BF30`, `FUN_0050BEA0`); la lista se ordena por CARISMA descendente al cargar la MAC (`FUN_0054FE50`). **CARISMA es la prioridad de cada orden que una acción da a un órgano** (se guarda en `Accion+0x20`): el órgano acepta la orden solo si `prioridad_actual <= carisma`, que se reinicia a -1 en cada Update del órgano (`0x60F620`, `0x610060`, `0x61C8C0`). Gana la de mayor carisma por ciclo (empate: la última). Las acciones se coordinan por mensajes (`PATRULLA_PAUSE`, `VIGILAR_OFF`, `BUSCADOR_STOP`, `DISPARAR_ON`…), sin árbitro central.

```
.ACCIONES [
  [ acMuerte     [ .CARISMA 999 ] ]
  [ acFusilador  [ .CARISMA 600 .REAC_ALARMA $ReacAlarma .PRESO … .SOYJEFE … ] ]
  [ acDisparar   [ .CARISMA 500 ] ]
  [ acVigilar    [ .CARISMA 400 .ANGBARRIDO $AngBarrido ] ]
  [ AcPisar      [ .CARISMA 100 ] ]  [ AcUsahab [ .CARISMA 250 ] ]  [ AcBuscador [ .CARISMA 300 ] ]
]
.ORGANOS [ .VISTA [ Vista01 [ ] ]  .MOTOR [ MotorAndante [ ] ]  .OIDO [ Oido01 [ ] ] ]
```
`CARISMA` = prioridad de las órdenes a los órganos (confirmado en el exe, ver nota arriba); `Muerte` = 999 siempre gana.
- Acciones distintas en las 96 plantillas (≈45): `Patrulla, UsaHab, Muerte, Vigilar, Pisar, Buscador, Disparar, Empujable, VehDescubierto, CTanque, AccionSecundaria, Zodiac, MuerteAnimal, Foco, CasaLogica, PresoChusma, NidoMetralleta, Mina, Bunker, Bomba, Bap1/Bap2, Banpe1/2, Vigilante, Uniforme, TransmiteImpacto, Testigo, Segnuelo, PuntoEmpuje, PresoTraidor, Perro, Metrallero, InterruptorFoco, Guarda, General, Gallina, Fusilador, FocoDestruible, Felino, Canonero, Canon, BichoExpl, BarrilExpl, BarcaMadera, Aleman`.
- Órganos: `.VISTA [Vista01]` (21), `.OIDO [Oido01]` (23), `.MOTOR [MotorAndante | MotorTanque | MotorAuto | MotorObjeto]`. Los parámetros de cada órgano **no** están en la plantilla → están en el exe o en una tabla aparte (por buscar).
- Reacción a alarma: `ReacAlarma`/`REAC_ALARMA`, `SENSORES_SND_ZONA` (en `MIS`).
- Tipos de objeto (`.TIP`): `GUAR, VIGI, GEN(1GEN), ZOD, FUR, MOR, SD2, SDK2, LEON, AVES, GALL, DEPO, MAQU, VAEM…`.

## 3. `MIS` = misión (`.MISSION [ … ]`)
`MAPA0000.MIS` (106 kB). Claves de primer nivel: `.MUSICA`, `.GRAFICOFINMISION`, `.DATOSFICHEROSMISION` (apunta a `.VOL`, `.SEC`, `.TIP`, `.WADMAP` = `FASEnnnn.WAD`, `.INTROSCRIPT` = `BRIEnnnn.SCR`), `.BRIEFING [ .TEXTOS MB00.STR ]`, `.SENSORES_SND_ZONA`, `.MAP` (minimapa `LIBRnnnn.RLE`, escala), `.WATER` (animación de agua), `.AUTOEXPCASAS`, `.CASASFUERTES`, `.INTENDENCIA` / `.INTENDENCIAINFO` (puntuación: `.PAR_TICKS_FACIL 16932`, `.PAR_TICKS_DIFICIL 17290`; `.EXITPOINTS`; `.OBJETIVOS`), **`.ELEMENTOS`** (instancias de objetos y enemigos), **`.PATRULLAS`**, **`.TRIPLINES`**, `.INTERFACE`.
- `PAR_TICKS_*` ⇒ el tiempo de juego se mide en **ticks**; falta saber el ritmo (ticks/seg) → exe.

## 4. `SCR` = guion de briefing (`<t> COMANDO args`, `*` = comentario)
Comandos vistos: `STARTWAVE, STARTWAVELEVELM, STARTWAVEM, WAITWAVE, STARTGOTO, WAITGOTO, STARTZOOM, WAITZOOM, STARTZOOMBITMAP, WAITZOOMBITMAP, SETZOOM, SETPOS, STARTBLENDFADE, WAITFADE, STARTFADEOUT, VIDEO, STARTVIDEO, WAITVIDEO, BREAK`. Los `Fase*.WAD` referencian `M0.ZOM` (mapa de zoom).

## 5. `TIL`, `VOL`, `TIP`, `STR`, `DAT`
> **Corrección:** el juego **no lee los `.TIL`** (ni `NTILE` existe en el exe ni la `.MIS` los referencia): el mapa se dibuja desde `.VOL`. Ver `docs/engine/graficos-mapa.md`.
- `TIL` (no usado por el juego): `MAPDIMXY w,h` + `NTILE x,y,w,h,?,?,?,?,"NOMBRE.RLE","   "` por tile del mapa.
- `VOL`: `MAPDIMXY` + `POLY "nombre",cx,cy,cz,altura,#vért,#tiles` + `RADIO`, `EXTRAINFO`, `TILE …`.
- `TIP`: `x y w h CÓDIGO` (cajas para tooltips: `FARO`, `AAGU`, `ANTE`).
- `STR`: `CÓDIGO texto` (`\n` literal). `DAT`: `.DATOSMISIONES .LISTA [ [ .FICHEROMISION … .HTIT … ] ]`, `START.DAT` = secuencia de arranque (video, fadeout).

## 6. `ANM` = `BNM ` (166 archivos)
Cabecera 40 B aprox. (`BNM ` + campos u32), luego **secuencias con nombre** (`ANDAR` en `SOLDADO.ANM`, 59 secuencias, 63 kB) y por cada fotograma un registro con **nombre del `.RLE`** (`SAND0000.RLE`) y **hot-spot con signo** (ej. `-12, -39`), más banderas. Estructura exacta: **por cerrar** (necesita el cálculo de tamaño del registro y verificación en los 166).

## 7. `WAD` (236) — por cerrar
Cabeceras distintas según carpeta: 
- `ELEM\*.WAD`: u32 grande + `0x3C` + `0x83/0x8C`… seguidos de datos de 16 bits tipo RGB565 (`0842`, `3186`, `528A` = grises) → **[hip]** sprite 16 bpp con encabezado.
- `SYSTEM\CARAS`, `FONTS`, `SPRITES`: rellenos de `FFFF…` desde el byte 0 (¿mapa de colores clave / máscara?). 
- `Fase000N.WAD` (en disco, fuera del DIR): `u32 + 0x3C + 0x8C` y ceros.
Tarea dedicada.

## 8. Lo no leído (a propósito)
`SEC` (binario `NIBS`), `ZOM`, `RLE` (¿BMP RLE8 estándar?), `FNT`, `RLC`, `ROL`, parámetros de los órganos, bucle de ticks, tabla de armas, sonido (Miles), red.
