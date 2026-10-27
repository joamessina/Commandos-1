# Inventario de archivos del juego (Legacy / CD)

Fuente: `...\Commandos Beyond the Call of Duty\Legacy\`. Generado con `py -I tools/inventario.py <Legacy> D:\Joaquin\research-c1`
→ extracción en `research-c1\x\`, tabla completa por archivo en `research-c1\inventario.tsv` (ruta, ext, tamaño, offset, 16 B de cabecera), resumen en `resumen_ext.txt`.
Solo lo marcado **[hecho]** está verificado; **[hip]** es hipótesis por nombre/cabecera y hay que confirmarla leyendo.

## 1. Contenedor `WAR_MP.DIR` **[hecho]**
Tabla de 55 880 B (1270 registros de 44 B) + datos contiguos sin compresión de contenedor: 1227 archivos, 64 923 011 B; `55 880 + 64 923 011 = 64 978 891` = tamaño del archivo, 0 huecos/solapes.
Registro: `nombre[32]` · `u8 flag` (+3 pad `CD`) · `u32 A` · `u32 B`. Archivo (flag 0): A = tamaño, B = offset absoluto. Directorio (flag 1): B = posición de su lista dentro de la tabla. Cada lista termina en un registro `DIRECTOR.FIN`. El registro 0 es la raíz `DATOS`. Raíz Steam: mismo formato, +2 archivos (1 BMP, 1 WAD).

## 2. Qué hay (por carpeta y tipo)
| Carpeta | Tipo (n, bytes) | Qué parece |
|---|---|---|
| `MISIONES` | MIS 19 · SEC 11 · TIL 5 · VOL 18 · TIP 3 · STR 15 · SCR 8 · MAC 96 · DAT 2 | **Datos de las fases y del comportamiento.** Es lo que más importa para IA, eventos y mapas. |
| `RECURSOS/ELEM` | ANM 166 (1,2 MB) · WAD 161 (14,9 MB) | Gráficos de objetos y personajes (animaciones + sprites). |
| `RECURSOS/SONIDO/WAVE` (+`ESA`) | WAV 150 + 250 | Efectos de sonido y voces (`ESA` = ¿sonidos de eventos/ambiente?). |
| `RECURSOS/BMPS/SYSTEM/*` | WAD 77 · RLE 88 · RLC 32 · BMP 70 | HUD/interfaz: caras, global, libretas, opciones, red, ayuda, créditos. |
| `RECURSOS/BMPS/SPRITES` | WAD 2 | Sprites (¿cursor/puntero?). |
| `BRIEF_MP` | BMP 49 · ZOM 8 | Briefings: fotos grandes y mapas de zoom (`M0..M7.ZOM`). |
| `FONTS` | FNT 1 · WAD 5 | Fuente y gráficos de fuente. |

## 3. Formatos y su cabecera (lo observado)
| Ext | Cabecera | Lectura **[hecho]** | Qué falta |
|---|---|---|---|
| WAV | `RIFF` (400/400) | Audio estándar | Mapa evento→sonido (en exe/MAC/MIS) |
| BMP | `BM` | Bitmap estándar de Windows | — |
| ANM | `BNM ` (166/166), 97 B–63 kB | Texto tras magia: nombre + lista de `*.RLE` (ej. `ALAMBRE.ANM` → `TZS60000.RLE`…`60002`) = **lista de fotogramas** | Campos binarios entre nombres (tiempos, offsets) |
| RLE | `BM…` (BMP con RLE8, 1,6–149 kB) | Parece BMP comprimido RLE | Confirmar compresión/paleta |
| WAD | `01000000`, `02000000`, `FFFFFFFF`… (236) | Varios sub-tipos de cabecera → **no es un único formato** | Todo: contenedor de sprites/hojas, ¿paleta? |
| MIS | `.MIS` (19) | — | Todo: misión (objetos, enemigos, eventos) |
| SEC | `NIBS` (11, 27–121 kB) | Binario, ¿"SBIN"? | Todo: ¿secuencias/escenario? |
| TIL | texto (`MAPDIMXY`, `NTILE x,y,w,h,…,"EST20000.RLE"`) | Lista de **tiles** del mapa con sus RLE | Semántica de los campos |
| VOL | texto (`MAPDIMXY`, `POLY "nombre",x,y,z,altura,#vért,#tiles`, `RADIO`, `EXTRAINFO`) | **Volúmenes estáticos** (colisión / ocultación / altura) | Campos y significado |
| MAC | texto con comentarios (`# VARIABLES: C-cadena P-punto G-gráfico A-acción`) | **Plantilla de objeto/"bicho"** editable: acciones, gráficos, puntos | Léxico de acciones (96 plantillas: soldados, vehículos, tanques, vigilante…) |
| SCR | texto (`0 STARTVIDEO #1_V.AVI`, `STARTBLENDFADE`, `STARTZOOMBITMAP #M0.ZOM …`, `WAITVIDEO`) | **Guion de briefing** (tiempo + comando) | Lista completa de comandos |
| STR | texto `CÓDIGO texto` (ej. `GEES …`, `GEMU …` = mensajes de fin de misión) | Cadenas por fase | Significado de los prefijos |
| TIP | texto `x y w h CODIGO` (`FARO`, `AAGU`, `ANTE`) | Posición + caja + tipo | Qué hace con ello el motor |
| DAT | texto (`.DATOSMISIONES`, `.LISTA [ [ .FICHEROMISION MAPA0000.MIS .HTIT 3N00 ] …`; `START.DAT`) | Orden de misiones y secuencia de inicio | — |
| ZOM | `C2010000` (8, ~630 kB) | — | Imagen de zoom del briefing (¿raw/paleta?) |
| FNT | `10000100` | — | Fuente |
| RLC | `rlc ` (32) | — | Variante de RLE (créditos) |

El mismo estilo de texto `.CLAVE [ … ]` aparece en `Comando.cfg` y `MISIONES.DAT`: los archivos de configuración y datos usan una **sintaxis jerárquica de clave y corchetes**; un solo parser sirve a varios formatos.

## 4. Fuera del contenedor (en disco, `Legacy\`)
- `DATOS\musica\*.wav` (creditos, fases, fases02, mcomplet, Menu, muerte) · `DATOS\brief_mp\{musica,wave}` (16 + 80 WAV: música de briefing/táctica y voces `bNNtNN`, `brNNb/h`).
- `DATOS\rolling\*.ROL` (7: `tut00..06`) + `rolling\wave` (131 WAV `tut*`) = **tutorial hablado**.
- `DATOS\recursos\bmps\map_mp\Fase0000..0008.WAD` (9, 1,5–4 MB): **mapas de fondo por fase** **[hip]** (tamaño y nombre).
- `video\*.avi` (1_v … 4_v, h_intro) · `OUTPUT\Comando.cfg`, `USER.CFG` · `MPLAYER\` · `Tutorial.exe`, `TestApp.exe`, `mpserver.exe`.
- Exe: `coman_mp.exe` (3,5 MB), DirectDraw + Miles Sound (`mss32.dll`) + WSock. Strings con `.DIRECTORIOFICHEROS FASE%04d\`, `.VELMAX 60`, nombres de BMP de UI.

## 5. Dónde buscar cada pregunta (para el exe, después del archivo)
| Quiero saber | Archivo / lugar probable | Estado |
|---|---|---|
| Animaciones | `ANM` → lista de `RLE`/`WAD`; la lógica de selección está en el exe | ANM parcialmente leído |
| Personajes, armas, objetos (modelos) | `MAC` (plantillas) + `WAD` de `ELEM` | sin leer |
| Mapa / colisión / alturas | `TIL`, `VOL`, `Fase000N.WAD`, `SEC` | TIL/VOL texto, sin semántica |
| IA y eventos (si pasa X → Y) | `MIS` + `MAC` (acciones) + exe | sin leer |
| Tiempo real / ticks | exe (bucle principal, `.VELMAX`) | sin leer |
| HUD | `RECURSOS/BMPS/SYSTEM/*`, `Comando.cfg` | sin leer |
| Sonido | `WAV`, `Comando.cfg` (`.VOLMUSICA`), Miles | sin leer |
| Red | `tcpserver/mpserver`, WSOCK | fuera de alcance por ahora |
