# Los 19 `.MIS`: qué traen y qué falta usar (2026-10-30)

Lectura completa de los 19 archivos `DATOS/MISIONES/*.MIS` del juego (`WAR_MP.DIR` de la raíz) con el lector del proyecto (`formats/clave.ts`). Todos parsean con corchetes balanceados.
Catálogo reproducible: `node --experimental-transform-types tools/mis-catalogo.ts <carpeta>` (genera `mis-claves.tsv` y `mis-resumen.json`; solo lectura del juego).
Catálogo ya generado: **`docs/lectura/mis-claves.tsv`** (392 claves: archivos donde aparece, apariciones, tipo de valor, claves padre, ejemplo, si el código la nombra, si algún doc la menciona).

## Qué es cada archivo

| Grupo | Archivos | Notas |
|---|---|---|
| Misiones 1–11 | `MAPA0000` … `MAPA0010` | `MAPA0000` (53 KB) es la que se juega hoy. Las más pesadas: `MAPA0002` (107 KB), `MAPA0005` (89 KB). `MAPA0008` (19 KB) y `MAPA0010` (20 KB) son las más chicas: sin patrullas ni refuerzos |
| Mapa extra | `MAPF0001` (71 KB) | 117 elementos, 12 patrullas, 4 `SENSORES_SND_ZONA` y `SENSORES_EXP_ZONA` (único que lo trae). **Su función no está identificada** (¿misión suelta o de otra edición?): leer `MISIONES.DAT`/`START.DAT` y el menú |
| Tutoriales | `TUT00` … `TUT06` (5–16 KB) | 13–31 elementos, un solo aliado salvo `TUT00` (5) y `TUT05` (2) (cuenta de `.BANDO ALIADO`); sin patrullas salvo 1 en `TUT00` y `TUT04` |

## Estructura de un `.MIS` (bloque `.MISSION`)

Claves de primer nivel, en este orden en `MAPA0000`: `.MUSICA` · `.GRAFICOFINMISION` · `.DATOSFICHEROSMISION [ .VOLUMENES .SECTORES .BOXTOOLTIP .WADMAP .INTROSCRIPT … ]` · `.BRIEFING` ·
`.SENSORES_SND_ZONA` · `.MAP [ .SCALE .XY .BITMAP ]` · `.WATER` · `.AUTOEXPCASAS` · `.CASASFUERTES` · `.INTENDENCIA n` · `.INTENDENCIAINFO [ .PUNTUACIONES .EXITPOINTS .OBJETIVOS .VEHICULOHUIDA .PUNTOHUIDA .MATABICHOSSECTOR .AMBIENTE .EXITPOINTSHOME .PAJAROS … ]` ·
`.PATRULLAS` · `.ELEMENTOS` · `.INTERFACE [ .SUBINTERFACES .INFOCARAS ]` · `.TRIPLINES` (vacío en las 17 que lo traen). `MAPA0008` trae además `.GESTORMAPDRAW`. Los elementos instancian macros (`.CLASS MACRO .MACRO X`, ver `world.ts`), así que muchas claves por elemento son variables de un `.MAC` (96 `.MAC` en el juego: **siguiente lectura pendiente**).

## Tamaño de cada misión (cuenta de claves reales, no de texto)

| Archivo | Bytes | `.TOKEN` | `.AcPatrulla` | puntos de ruta con clave `.CASA` | `.ESPERAEVENTO` | `.REGENERATE` |
|---|---|---|---|---|---|---|
| MAPA0000 | 53 671 | 149 | 11 | 7 | 11 | 5 |
| MAPA0001 | 82 344 | 196 | 34 | 23 | 34 | 12 |
| MAPA0002 | 106 829 | 205 | 35 | 55 | 36 | 15 |
| MAPA0003 | 77 503 | 158 | 27 | 70 | 28 | 7 |
| MAPA0004 | 82 444 | 151 | 34 | 91 | 36 | 4 |
| MAPA0005 | 89 079 | 128 | 22 | 177 | 22 | 8 |
| MAPA0006 | 50 199 | 111 | 22 | 51 | 22 | 6 |
| MAPA0007 | 81 086 | 163 | 29 | 82 | 31 | 6 |
| MAPA0008 | 18 588 | 72 | 4 | 8 | 4 | 0 |
| MAPA0009 | 77 079 | 148 | 31 | 85 | 33 | 4 |
| MAPA0010 | 20 235 | 86 | 4 | 8 | 4 | 0 |
| MAPF0001 | 71 068 | 174 | 32 | 24 | 32 | 12 |
| TUT00–06 | 4,9–16 KB | 24–90 | 0–1 | 0 | 0–1 | 0 |

(Cuentas de apariciones de la clave en el texto, no de puntos con valor 1: los valores reales de `.CASA`/`.ENLAZAR` están abajo.)

## Valores reales de las claves sin usar más repetidas (todas las misiones)

- **Rutas de patrulla**: `.TIPORUTA` LOOP×246, PINGPONG×186, STOPPED×33, EXIT×3, JUMP×1. `.ENLAZAR` 0×600 y 1×86; `.CASA` 0×660 y 1×15; `.EVENTO` (evento al llegar al punto, 4 letras): BUC1…BUC8, BUNO, HUGE, ABPU, GEPE, YATA, NORM. `.ESPERAEVENTO` 0×277 y 1×18.
- **Grupos de soldados (`.PATRULLAS`, 79 en 10 misiones)**: `.NSOLDIERS`, `.NCOLUMNS`, `.RUTADEF`, `.ANIMCABO CABO`, `.ANIMSOLDADO` (ALEGABAR×36, GRANADER×30), `.DISPARARCABO` (PISTOLA×79, FUSIL×2), `.DISPARARSOLDADO` (METRALLETA×79), `.REGENERATE`/`.REGENERATEPATROL`, `.STARTATHOME` (1×51), `.NONSTOP` (1×61), `.SIGUEHUELLAS`, `.HOME` (CUARTEL_*, CASA_REACT_*, ALBERGUE*), `.EXITHOME_EVENTS` y `.REACT_EVENTS` (códigos de 4 letras).
- **Reactividad**: `.REACTIVIDADES` (CHES CHHU×18, REXT×8, DEMO×4 …), `.SENSORES_SND_ZONA [ .ZONA X .MENSAJE Y ]` (ZONA_INICIO, ZONA_INTERIOR, CAMPAMENTO … con mensajes REAC, ZOIN, REXT, RETA…).
- **Elementos** (por `.ELEMENTOS`): `.GRAFICO` (589), `.TENGOTABACO` (1×382 / 0×134), `.SEHUNDE` (1×55 / 0×33), `.CONTENEDOR`, `.DETECTAEXPLOSION` (0×54 / 1×31), `.NOSOLIDO`, `.NOAGACHA`, `.MASA`, `.LISTAS` (EJEC CHOC VISI SELE), `.TOKENARTILLERO` (nidos), `.VEHICULO` (FURGO_HUIDA, CAMION_HUIDA, DEPEMP, COCHE_GENERAL…), `.DIRECCIONEMPUJE` (DELANTE/DETRAS×15 cada uno, **sin doc ni código**).
- **Ambiente**: `.AMBIENTE [ .SOUNDID .POS .VOLUMEN .DELAY .BUCLADO ]` (sonidos RIO1×18, VIEN×11, MBIR×8, BIRD×6, OLEA×5, WIND×4, BIR1/BIR2, AGUA, MOL2/MOL3).
- **Pájaros** (`.PAJAROS [ .NUMPAJAROS .ANIM .BASES [ [ .ESAEREA .XYZ .CONEXION [..] ] … ] ]`): grafos de puntos aéreos entre los que vuelan las gaviotas (`.ESAEREA` 1×163 / 0×22, `.CONEXION` = índices vecinos, `.ALTURA`).
- **Intendencia** (`.INTENDENCIAINFO`): `.OBJETIVOS [ [ .OBJETIVO ANTI02A ] … [ .OBJETIVO CASA04 .VOLUMEN 0 ] ]`, `.VEHICULOHUIDA`, `.PUNTOHUIDA`, `.EXITPOINTS`, `.MATABICHOSSECTOR`, `.MENSAJESDEDESTRUCCION`.
- **Casas que explotan**: `AcExplotaCasa` (`.TIEMPO`, `.VOLESTATICO`, `.VOLTOKENLLAMAS`), `.IMPACTOS [ .DISPARO .BOMBA .PEPINAZOTANQUE .EXPLOSIONMENOR ]` (qué daña cada cosa).
- **Interfaz**: `.CARETO CARAnnnn.RLE`, `.INFOCARAS [ CARA [ .TOKEN X .ACCESIBLE 1 ] ]`, `.ITEMS [ [ .TOKEN IT_X .DISPONIBLE .IDGRUPO .HAYQUECOGERLODEMOCHILA … ] ]` (35 `HAYQUECOGERLODEMOCHILA` en 3 misiones: ítems que hay que recoger).

## Claves que no están ni en el código ni en los docs (36 de 392)

Son las realmente desconocidas; casi todas de **una sola misión**: `.DIRECCIONEMPUJE` (9 archivos), `.DESPXMAX/.DESPXMIN/.DESPYMAX/.DESPYMIN/.ANCHOMAX/.OFFMAX/.SPRITEMAX/.OFFALTURASEL/.ANCHOPORC` (3 archivos, 13 veces: parámetros de un efecto gráfico, ¿humo o fuego?),
`.VOLUMENESDESAPARECERAN/.SECTORESHARANINTRANSITABLES/.SECTORESHARANNOSOLOAGACHADO` (1 archivo: **cambios de terreno por eventos**), `.FORCEMOD/.FORCEANG`, `.POSCOMEDERO2..5/.POSMAQUINA2..5` (animales comiendo y máquinas), `.MANGUERAS`, `.FIXEDANGLES`, `.NAMEVOL`, `.ARRANCADA/.VELMIN/.PUNTODESTINO/.PUNTOPASADA/.PUNTOANIMACION` (un vehículo animado, ¿tren o avión?), `.ALIADOMUERTO/.ALEMANMUERTO`, `.SECTORDER/.SECTORDEB/.PVECTORIZQ1..2/.PVECTORDER1..2` (¿puertas o barreras?), `.CP1/.CP2`, `.TESTDISPONIBLE`.

## Lo que sí está en los docs pero **no implementado** (por área, con su doc)

| Área | Claves | Doc que ya la describe | Efecto en el juego |
|---|---|---|---|
| Cambio de ruta y espera de evento | `.ENLAZAR`, `.ESPERAEVENTO`, `.EVENTO`, `ACPATRULLA` completo | `patrulla.md` (tick `FUN_0048E530`, `FUN_0048D2D0`), `ia-mensajes.md` §5 | Los soldados de 14 misiones deberían esperar un evento (`TRIGGER_REACT`) y cambiar de ruta |
| Grupos y refuerzos | `.PATRULLAS` completo (`NSOLDIERS`, `REGENERATE`, `HOME`, `EXITHOME_EVENTS`) | `ia-mensajes.md` §5.3, `mision-intendencia.md` (`FUN_005A2760/5A2AD0/5A3500`) | Cuarteles que sacan soldados nuevos cuando matan a otros |
| Casas | `.CASA`, `AcCasaLogica` (`.TOKENCASA`), `AUTOEXPCASAS`, `CASASFUERTES` | `obj-contenedores.md` | Soldados que entran/salen de casas siguiendo la ruta |
| Reacciones | `.REACTIVIDADES`, `.REACT_EVENTS`, `SENSORES_SND_ZONA/EXP_ZONA` | `ia-mensajes.md` §5.2 | Alarma por zonas y voces |
| Sonido ambiente | `.AMBIENTE` | `sonido.md` | Ríos, viento, pájaros (falta todo Web Audio) |
| Pájaros | `.PAJAROS` | `animales.md` | Gaviotas |
| Elementos | `.SEHUNDE`, `.CONTENEDOR`, `.DETECTAEXPLOSION`, `.LISTAS`, `.MASA`, `.NOSOLIDO`, `.NOAGACHA`, `.TENGOTABACO` | `flags-bicho.md`, `obj-*.md` | Qué se hunde, qué contiene, qué reacciona a explosiones, tabaco para fumar |
| Intendencia | `.OBJETIVOS` (parcial), `.MENSAJESDEDESTRUCCION`, `.VEHICULOHUIDA`, `.EXITPOINTSHOME` | `mision-intendencia.md` | Victoria de misiones 1–10 |

## Qué hacer con esto (orden propuesto)

1. **Terminar misión 0** con lo ya leído: `.ESPERAEVENTO` (11 patrullas), `.TENGOTABACO`, `.REACTIVIDADES` y `SENSORES_SND_ZONA` (la IA de reacción), `.AMBIENTE` y `.PAJAROS` (sonido y gaviotas).
2. **Leer los 96 `.MAC`**: ahí están las variables que los elementos instancian (acciones por tipo de soldado, nidos, vehículos).
3. **Misiones 1–10**: cada una necesita su Intendencia (`Intend01..10`, ya leídas en `mision-intendencia.md`) y las 36 claves desconocidas aparecen en 1–3 de ellas.
4. Identificar `MAPF0001`.

Limitación del catálogo: "en código" se mide por coincidencia de texto de la clave en `src/`; una clave leída de forma genérica no se detecta.
