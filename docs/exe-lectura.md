# Lectura del exe: qué se cubrió, qué se leyó y qué no

Exe analizado: `coman_mp.exe` de la **raíz** (PE normal; el de `Legacy\` está cifrado, ver `formats-texto-y-modelo.md` §0). 5 secciones: `.text` 3 737 088 B · `.rdata` · `.data` · `.idata` · `.rsrc`.
Tres niveles, para no confundirse: **Cubierto** = existe en el índice y tiene dueño; **Atribuido** = un script lo asignó a un subsistema; **Leído** = lo leí y lo entendí (con dirección). **Cubrir y atribuir no es leer.**

## 1. Cobertura medida (reproducible)
| Qué | Resultado | Cómo |
|---|---|---|
| Funciones decompiladas | **37 026** (1 096 871 líneas de C); 2 fallidas | Ghidra 12.1.4 + `tools/ghidra_*.cmd` |
| `.text` | 2 787 187 B en funciones (74,6 %) · 873 727 B relleno `CC/90` · 5 682 B tablas de `switch` · 20 550 B datos incrustados · **50 764 B (1,4 %) parecen código sin función propia** (fragmentos desalineados de la CRT `printf` y ~700 saltos de importación, no lógica del juego) | `tools/exe_index.py` + capstone sobre los huecos |
| Funciones que Ghidra no había descubierto | **7 721 creadas** (≈217 KB: funclets de excepción `Unwind@…` y bloques de limpieza) + 1 función gigante rehecha | `tools/ghidra/CreateGapFuncs.java`, `FixBigFunc.java` |
| **`FUN_00786e60`** | 37 808 B, **solo 13 KB estaban decompilados**; ahora entera. Es el **inicializador de ~1 700 globales con sus valores por defecto** (`_DAT_0087bc00 = 0x14`…) y tablas de nombres (`COGETABACO`, `ESCALA`, `COGEBARRIL`…) | idem |
| Clases (RTTI) | **838 clases**, 1 108 vtables, 11 367 métodos distintos (`docs/exe-clases.md`) | `tools/rtti_c1.py` (jerarquía incluida) |
| Atribución por subsistema | **72,1 % del código** con dueño; **27,9 % (10 093 funciones, 777 kB) sin atribuir** (`docs/exe-cobertura.md`) | `tools/exe_classify.py` |
| Cadenas | 6 270 ASCII en `.rdata/.data`; **419 de las 463** palabras `.CLAVE` usadas por los archivos del juego están en el exe (sin el punto; las 44 ausentes son valores como `ANM`, `BMP`, `XYZ`, `WAV`) | `research-c1\strings.tsv` |
| Imports | `DDRAW` (solo `DirectDrawCreate`), `WINMM` (`timeGetDevCaps`, `timeBeginPeriod`), `mss32` (40 funciones AIL: muestras, streams, **redbook CD-audio**), `WSOCK32` (18), `steam_api` (3), KERNEL32/USER32/GDI32… Sin Direct3D ni DirectSound directos | `pefile` |
| Recursos `.rsrc` | 32 cursores, 3 iconos, 1 menú, **68 diálogos del editor interno** (`research-c1\dialogs.txt`) | `pefile` |

## 2. Lo que SÍ se leyó (con direcciones)
1. **Ritmo del juego = 20 ciclos/s por defecto.** `FUN_005c47d0` (779 B) es el ciclo por fotograma: ejecuta las actualizaciones (virtuales +0x0C, +0x18, +0x1C y subsistemas), cada 10 ciclos (`% 10`) llama a `FUN_00675620` y luego **limita**: `1000.0 / MAXFPS` ms (constante en `0x793F78`), `Sleep(resto)` con `QueryPerformanceCounter`. `MAXFPS` es el campo `[5]` del objeto de opciones (24 B, `FUN_0062d050`): `GAMEINMUSIC=1, IGNOREPARSEHALT=1, VERBOSE=1, WARNINGS=1, SONAMBIENTE=1, **MAXFPS=0x14 (20)**`; se lee del bloque `PREFERENCES` de la partida/usuario (`FUN_0062d530`). Coherente con los datos: `PAR_TICKS_FACIL 16932` ÷ 20 = 846 s ≈ 14 min de tiempo de referencia en la misión 0. **[hecho]** · Falta: confirmar si la lógica avanza 1 paso por ciclo (parece que sí: el limitador está dentro del mismo ciclo) y qué escala `param_1[0x13e]` (parece el multiplicador de velocidad de juego; opción "Velocidad").
2. **Bomba de mensajes de Windows**: `FUN_006bffe0` (`PeekMessageA`, sale con `WM_QUIT`=0x12). Ventana: `ClassDxWin`/`ClassWin32`.
3. **Cargador de `WAD`** `FUN_005d02b0` y deserializadores `FUN_00647580/00645fb0/00648360/00648000` → `docs/formats-graficos.md`. **Blitter RLE** `FUN_00659c80` (además aplica un **mapa de luz por píxel**: 256 tablas RGB565). **Flujo `BNM`** `FUN_00622bc0/00622cf0/006225a0`.
4. **Editor interno del juego (restos en el exe)**: los diálogos nombran los parámetros de cada pieza: `Vista01` = *Altura, Módulo, Ángulo, Cabeza, Paso, Aliado muerto*; `Oido01` = *Umbral*; `MotorAndante` = *Empuje, Std. Vel.*; `AcVigilar` = *Ángulo de barrido, Visión (el)ptica*; `AcBomba` = *Retardo, Radio, Potencia, Reloj, Masa Expl.*; `AcMina` = *Potencia, Radio, Masa act.*; `AcPatrulla` = *Route, Wait event, Edit Points*; editor de patrulla: *Token, Soldados, Anim Cabo, Anim Soldado, Flags, Alarma*; `AcEscala` = *Punto alto, Punto bajo*; `AcInterruptor` = *DesplX, DesplY, Ancho, Alto*; `Bap2/Banpe2` = *Persigue sonidos, Persigue pisadas, Nerviosismo, Compañero*; `Casa` = *Pos. Entrada, Radio*; `Pilotaje/UsaHab` = *Tierra, Agua, Aire, Balsa*; `SerEspia` = *Preload, Empieza disfrazado, Paleta, Disfraz*; `Explota` = *Tiempo, Evento, Lista de tiles*; hay **gestor de mensajes** (`Cascada de mensajes`, `Message manager`, `Msg Tracer`): el juego se comunica por **mensajes** entre acciones, no por llamadas directas.
5. **Arquitectura por clases** (RTTI): `ClassAc*` (120 acciones de objetos y enemigos), `ClassAU*` (35 acciones del jugador: `Acuchillar, Agacharse, Alicate, Botiquin, Bucear, Cachiporra, Camuflarse, CogeBarril, CogeMisil, Coger, CogeTabacoDeMuerto, Disfraz, Disparar, Empujar, Escalar, Esposas, Garfio, Insignia, Jeringuilla, Lanzallamas, ManejaBomba/Cepo/Item/Segnuelo, PutaDistrae, Quietorrr, Robar, Tabaco, TomarControlAleman, Usar, UsarVehiculo…`), 17 motores (`MotorAndante, MotorGranada, MotorMisil, MotorObjeto, MotorPablo, MotorPajaro, MotorPasivo, MotorPerro, MotorRail, MotorVehiculo{Auto,Balsa,Ciclo,Lancha,Sub,Tanque}, MotorAliado`), órganos `ClassVista01/02`, `ClassOido01`, `ClassMemoria01`, simulación `Sim*` y colisión `Parachoques*` (uno por tipo: Peatón, Escalador, Auto, Tanque, Balsa, Lancha, Sub, Misil, Rail, Explosión…), `ClassIntendencia` + `00..09` (11 clases), buscadores de ruta (`BuscadorPuntoAPunto, GridSeek, GridSeekAroundObstacles, SeekToPoint, SeekToNextSec, SeekBackToPath`), partículas (`ClassBlood, ClassFireBolt, ClassSmoke…`), red (`CRed_*`, `LLRedCSKT`), sonido `MSS_SoundLib`.
6. **Un código de trucos**: `PYROFOREVER` en `FUN_006ef0b0` (3 526 B). Sin leer qué activa.

## 3. Lo que NO se leyó (con ancla para retomarlo)
| Tema que pediste | Estado | Dónde seguir |
|---|---|---|
| **Armas** (tabla de armas, daño, alcance, munición, ruido) | **No leído.** Hay `ClassAUDisparar`, `ClassAcDisparar`, `ClassAULanzallamas`, `ReceptorImpactosDef` (`0x45F2F0`, 73 B), `ProductorDanoDef`, campos `.MUNFUSIL`, `.BALAS`, `.IMPACTOS`, `.FUERZA`, `.ENEGIA` en las `MAC` | los valores seguramente están en el inicializador `FUN_00786e60` y en las `MAC`; leer esos campos |
| **IA: elección de acción por `CARISMA`** | **No leído.** Solo se sabe que `.CARISMA` está en 126 `MAC` y que cada acción tiene su clase | `ClassBicho` (`0x507A00`, 190 B), la lista `EJEC`/`LISTAS`, el gestor de mensajes |
| **Visión** (cono, alcance, altura) y **oído** (umbral) | **Parámetros nombrados, código no leído.** `ClassVista01/02` tienen métodos de 5 B (stubs `jmp`); `ClassOido01` `0x61A360` (38 B); `ClassVisionVista` | seguir los saltos de cada vtable hasta el cuerpo real |
| **Alarma / ruido / reacciones** | **No leído** (`ClassAcSensorSonido` `0x4AAEF0` 97 B, `REAC_ALARMA`, `SENSORES_SND_ZONA`, `TRIPLINES`) | idem |
| **Movimiento** (velocidades, giro, aceleración) | **No leído.** `MotorAndante` y los demás comparten `0x6102E0` (153 B); `SimBichoTerrestreBase` `0x574200` (327 B); `.VELMAX 60` en una cadena; parámetros `Empuje`, `Std. Vel.` | leer `0x574200`, `0x6102E0` y las constantes del inicializador |
| **Daño, muerte, energía** | **No leído** | `ClassAcMuerte`, `ReceptorImpactos*`, `.ENEGIA` |
| **Animaciones: semántica de los campos del `ANM`** | Estructura cerrada; **significado de las ranuras 2 y 3 de los tipos 1–3 y tipos 9–11, no** | manejadores `BNM` registrados (clase por identificar) |
| **HUD** | **Sin leer.** Las libretas/subinterfaces están en `0x69AC60` (2 603 B, sin atribuir), `ClassSubInterface*`, `ClassBoton*`, `ClassButtonBar` | leer esas funciones |
| **Sonido** | Solo imports y clases (`MSS_SoundLib`, `ISoundLib`); **sin leer** el mapeo evento→WAV ni la mezcla/pan/volumen | `0x6A…`/`MSS_*` |
| **Guardado de partidas** | Se vio el lector de bloques (`SKILL, SCORE, NUMALIADOS, PREFERENCES, CREADORNOMBRESBICHOS, ANIMPRELOAD, ZONASILUMINADAS…` en `FUN_005C34A0`, 3 883 B) pero **no el formato** | `SavR/SavW/InMemorySavRW` |
| **Pathfinding** | Clases nombradas; **algoritmo sin leer** | `BuscadorPuntoAPunto`, `GridSeek*` |
| **Vehículos, explosiones, puntuación (`ClassIntendencia00..09`)** | **Sin leer** | |
| **Multijugador/red** | Imports y clases; fuera de alcance por ahora | `CRed_*` |
| **Menús y secuencia de pantallas** | **Sin leer** | `ClassMenu*`, `ClassElemIntroScript*` |
| **`.rdata` y `.data` como datos** (tablas numéricas, vtables, constantes) | **Solo cadenas.** Las tablas de números no se barrieron | `tools/from-c2/exed.py` como base |
| **10 093 funciones sin atribuir (27,9 %)** | **Sin dueño** | mejorar `exe_classify.py` con cadenas y fórmulas; 4 989 son thunks |

## 4. Cómo reproducir
`tools/ghidra_import.cmd` → `ghidra_decompall.cmd` → `ghidra_gaps.cmd` (crea funciones en huecos y re-decompila a `all2`) → `ghidra_fixinit.cmd` → `py tools/exe_index.py` → `py tools/rtti_c1.py` → `py tools/exe_classify.py` → `tools/showfn.py <all2> <dir hex>` para leer una función. Salidas en `D:\Joaquin\research-c1\` (fuera de git).
