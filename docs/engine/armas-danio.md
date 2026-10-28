# Armas, daño, impactos, muerte y energía (Commandos 1, coman_mp.exe)

Estado: **PARCIAL, escrito temprano** (se actualiza al cerrar cada punto). Marcas: [hecho] = leído en el decompilado/exe con dirección; [hip] = hipótesis; NO LEÍDO = no se miró.
Convenciones: `this+0x1c` en una acción = el bicho dueño; en el bicho `+0x208` = ENERGÍA (int). `DAT_0083d658+0x468` = contador de ciclos (20/s). Slots de vtable de acción (ClassAcXxx): 0 dtor, 1 init/parse de `.CLAVES`, 4 update por ciclo, 5 manejador de mensajes, 10 guardado. Los thunks `jmp` hay que seguirlos (script propio: nombre `thunk_FUN_xxxx` = destino).

## 1. Resumen ejecutivo
- **Todo daño es un mensaje `MSGA_IMPACTO`** con carga `{tipo, pos_origen(3 floats), cantidad, tirador}` (campos int 0..5). Lo envía `FUN_005986a0(tirador, objetivo, tipo, cantidad)` (0x5986A0) [hecho]. Hay 18 tipos con nombre (tabla `0x818DA8`, ver §2).
- Hay **dos modelos de receptor** [hecho]:
  - **Personas/animales** (acciones `AcMuerte`/`AcMuerteAnimal`): energía entera `+0x208`, **por defecto 100** (`FUN_0050f020` pone `param_1[0x82]=100`); `.ENEGIA n` del MAC/MIS la pisa (bicho `FUN_0050c490`, lee `ENEGIA` → `param_1[0x82]`). Daño = `cantidad` restada; muerte si `energía <= cantidad`.
  - **Estructuras/vehículos/barriles** (`ClassAcExplota*` + `ReceptorImpactos*`): **contadores por tipo de impacto**; cada impacto resta 1 al contador de su tipo sin importar la cantidad; al llegar a 0 explota.
- Armas del jugador: tabla estática de 8 armas en `.data 0x8143C0` (stride 0xA8). El daño de cada disparo está **cableado en código** (no en datos): pistola 40, fusil mirilla 100, escopeta 100, ballesta/arpón 100 (§3).
- Enemigos (`AcDisparar`): disparo tipo DISPARO con cantidad **30**; cadencia = `TIEMPORECARGA + rand%6` ciclos.

## 2. Tipos de impacto [hecho]
Tabla `PTR_s_DISPARO_00818da8` (19 slots, `FUN_00598560` = nombre por índice, `FUN_00598580` = índice por nombre, `lstrcmpiA`, slot 18 = NULL):

| i | nombre | i | nombre | i | nombre |
|---|---|---|---|---|---|
| 0 | DISPARO | 6 | ELECTRICO | 12 | BALLESTA |
| 1 | BOMBA | 7 | CUCHILLADA | 13 | ARPON |
| 2 | EXPLOSIONMENOR | 8 | JERINGUILLA | 14 | CEPO |
| 3 | ATROPELLO | 9 | JERINGUILLALETAL | 15 | LANZALLAMAS |
| 4 | MORDISCO | 10 | APLASTAMIENTO | 16 | EXPLOTAVEH |
| 5 | FUEGO | 11 | PEPINAZOTANQUE | 17 | EXPLOTACASA |

(Hay otra tabla de 13 nombres en `0x824C48` con GRANADA/BALLESTA, usada por el editor; el MAC de BUNKER/TORRE usa `.GRANADA $DestruyeGranada` dentro de `.IMPACTOS`: ese nombre NO está en la tabla de 19 → NO LEÍDO cómo se parsea; [hip] ignorado por `FUN_0045dec0`.)

## 3. Armas del jugador (AcUsuario `ClassAUDisparar`)
### 3.1 Tabla de armas `0x8143C0 + i*0xA8` [hecho, volcada del exe]
Registro 0 = "NULO"; i=1..8; id 9 = terminador (`FUN_004ef880` busca por nombre, `FUN_004ef910` por id de ítem).

| i | nombre | +0x24 float | +0x28 int | +0x2c cooldown (ciclos) | +0x70 lanzada | +0x74 | +0x78 balas/disparo | +0x7c id ítem UI | anim desenfundar (+0x30) | anim disparo (+0x50) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | PISTOLA | 300.0 | 80 | 1 (*) | 0 | 1 | 1 | 1 | DESENFUNDAPISTOLA | DISPARAPISTOLA |
| 2 | MIRILLA (fusil) | 1000.0 | 100 | 10 | 0 | 0 | 1 | 15 | DESENFUNDARIFLE | DISPARARIFLE |
| 3 | METRALLETA | 400.0 | 100 | 10 | 0 | 0 | **5** | 37 | DESENFUNDAMETRALLETA | DISPARAMETRALLETA |
| 4 | BALLESTA | 800.0 | 100 | 10 | 0 | 0 | 1 | 32 | DESENFUNDABALLESTA | DISPARABALLESTA |
| 5 | GRANADA | 300.0 | 200 | 1 | **1** | 0 | 1 | 7 | - | LANZAGRANADA |
| 6 | ARPON | 200.0 | 100 | 60 | 0 | 1 | 1 | 85 | DESENFUNDAARPON | DISPARAARPON |
| 7 | PIEDRA | 300.0 | 200 | 20 | **1** | 0 | 1 | 8 | - | LANZARPIEDRA |
| 8 | ESCOPETA | 600.0 | 80 | 20 | 0 | 1 | 1 | 36 | DESENFUNDARIFLE | DISPARARIFLE |

(*) `FUN_004f07e0` pisa el cooldown de PISTOLA con `*(DAT_0083d658+0x1420)+0x60` si != -1 (opción/config; cadena `RETARDOPISTOLA` @7a8764; valor NO LEÍDO).
Significado de columnas: +0x2c cooldown [hecho: `FUN_004f1a50`/`004f1680` hacen `proximoDisparo = ciclo + [+0x2c]`]; +0x70 lanzada [hecho: en `004f1a50` caso 2 decide estado 3 (esperar fin de anim) en vez de disparar al instante]; +0x78 [hecho: `munición -= [+0x78]`, y la UI muestra `munición / [+0x78]`]; +0x7c [hecho: `FUN_004ef910` mapea id de ítem→arma; coincide con `_DAT_00879a10=1` (IT_PISTOLA), `0xf` (IT_MIRILLA), `0x55` (IT_ARPON) del inicializador `FUN_00786e60`]; +0x24 float y +0x28 int, +0x74: **NO LEÍDOS sus usos** (+0x24 coincide con "alcance" de IA pero el alcance del jugador sale de código, §3.2: ojo, BALLESTA dice 800 acá y 200 en código; [hip] +0x24 = alcance de ruido/IA; +0x74 = munición inicial).
`FUN_00786e60` NO es la tabla de armas: carga registros de **ítems de UI** (`IT_*`, stride 0xAC, `0x8799F0…`: nombre, id, flags, arma asociada (`PISTOLA`, `MIRILLA`…), acción `MANEJABOMBA`…) [hecho el layout general; campos no decodificados].

### 3.2 Estado del jugador (objeto AUDisparar)
- Armas poseídas: `this+0x98+idx*4` (flag), munición: `this+0x48+idx*4`, próximo disparo permitido: `this+0xE8+idx*4` (`param_1[0x3a+idx]`), arma actual `this+0x30` (`[0xc]`), estado `this+0x28` (`[10]`) 0 guardada, 1 desenfundada, 2 apuntando/disparando, 3 esperando fin de lanzamiento, 4 recarga/post-disparo. [hecho 004f1a50, 004efa20, 004efbe0]
- Carga desde MAC/MIS (`FUN_004eff40`) [hecho]: `.ARMAS [lista]` marca armas poseídas; munición: `.MUNPISTOLA`, `.MUNMIRILLA`, `.MUNMETRA`, `.FLECHAS`(→BALLESTA), `.GRANADAS`, `.PIEDRAS`, `.MUNARPON`, `.MUNESCOPETA`. En los MAC/MIS: MUNMIRILLA 5-7, MUNMETRA 50/100, MUNFUSIL 10 (clave `.MUNFUSIL` presente en MIS; NO LEÍDO quién la usa, [hip] caja de munición), MUNESCOPETA 50, PIEDRAS 100. Armas que aparecen: PISTOLA, PIEDRA, MIRILLA, METRALLETA, ESCOPETA, GRANADA, ARPON.
- Recoger arma/munición: mensajes `MSGA_RECOGE_ARMA` (copia `param_3[0x5a]` a munición y marca poseída) y `MSGA_RECARGA_ARMA` (suma `param_3[8]` a munición) [hecho `004f11d0`]. Cajas: `CAJABALA` (`.BALASRECARGA`), `CAJAGRAN` (`.BALASINICIALES $GRANADAS`), `CAJAMETR` (`.BALASINICIALES 50`).
- Munición: se descuenta **al disparar** si `DAT_00840140 == 0` (flag de trampa/modo, [hip] "munición infinita"). Al llegar a 0 se guarda el arma. [hecho 004f1680]

### 3.3 Qué hace cada disparo (`FUN_004f1680`, kind por arma: entidad/punto) [hecho]
Arma→kind: PISTOLA 1/2, MIRILLA 3/4, METRALLETA 9/10, BALLESTA 5/6, GRANADA 0xB/0xB, ARPON 7/8, PIEDRA 0xC/0xC, ESCOPETA 0xE/0xD (`FUN_004f0c70` a entidad, `FUN_004f0e50` a punto). Cada kind llama a una función que arma una estructura de "disparo" y llama `FUN_00678dd0`, que (si hay impacto) envía `MSGA_IMPACTO`. Tipo/cantidad por función (sacados del desensamblado, campos [9] y [10] de la estructura):

| arma | función entidad/punto | tipo | cantidad | alcance (código) |
|---|---|---|---|---|
| PISTOLA | 0067a1f0 / 0067a410 | 0 DISPARO | **40** (0x28) | **300** (`_DAT_00798c0c`) |
| MIRILLA | 0067aa30 / 0067ac80 | 0 | **100** (0x64) | **1000** (`_DAT_007a1dac`) |
| ESCOPETA | 0067a610 / 0067a830 | 0 | **100** | **600** (`_DAT_00797164`) |
| BALLESTA | 0067b2a0 / 0067b4c0 | 12 BALLESTA | 100 | 200 (`_DAT_00794cf8`) |
| ARPON | 0067aeb0 / 0067b0c0 | 13 ARPON | 100 | 200 |
| METRALLETA | 00676f20 / 00676b20 (ráfaga) | NO LEÍDO | NO LEÍDO | 400 (`_DAT_0079bfd8`) |
| GRANADA | 006761b0 | crea objeto `GRANADA` (MotorObjeto `.EXPLOTA 1 .FIJO 1 .NOCAE 1` + acción `AcGranada .CARISMA 200`) | - | 300 horizontal / 200 alto (`FUN_00675f70`→`675dc0`) |
| PIEDRA | 00676460 | crea objeto `PIEDRA` + `AcPiedra .CARISMA 100`; sonido `CAEPIED`; al llegar manda `MSGA_PEDRADA` (aturde, sin daño) | - | 300 / 200 |

Chequeo de disparo (`FUN_004f05b0`→ `00677560/00677710`): distancia² al objetivo contra alcance² + línea de tiro (`FUN_006771a0`, trazado con tiles/objetos; el primer objeto chocable golpeado recibe el impacto vía callback `FUN_00675ab0`); el punto de impacto se recorta al alcance (`FUN_00675910`). Hitscan: no hay proyectil para pistola/fusil/escopeta/ballesta/arpón.
Efecto visual: tag 'PIPA' (pistola/escopeta), 'MIRI' (fusil/ballesta/arpón), 'FUSL' (metralleta enemiga). Sonido: `DISPAROPISTOLA` / `DISPAROMETRALLETA` por `FUN_00590b60` (solo si el bicho es el jugador/visible `+0x70`).
Quién oye el disparo: **NO LEÍDO** (el disparo en sí solo reproduce el WAV por el mezclador `FUN_0067f490`; el ruido para la IA debe salir por `MSGA_SONIDO_*`/`Oido01`; es del agente de percepción). Existe `MSGA_DISPARAR_SILENCIADOR_ON` (disparo silenciado de enemigo, §4).

## 4. Enemigos disparando (`ClassAcDisparar`, vt 0x795A... init 0x45A050, update 0x45B200, mensajes 0x45A680) [hecho]
- Claves MAC: `.TIEMPORECARGA` (→`this+0x50`), `.TIPOARMA` = `METRALLETA` (modo 1: ráfaga, anim `DISPARAR`) o `PISTOLA` (modo 2); otro/ausente = 0 (no dispara). Ej.: `acDisparar [ .CARISMA 500 ]` (BAP2, FUSILER), `acDisparar [.TIPOARMA PISTOLA]` (artillero del nido).
- Mensajes: `MSGA_APUNTAR_AT` (apuntar a obj), `MSGA_APUNTAR_OFF`, `MSGA_DISPARAR_ON` (obj), `MSGA_DISPARAR_SILENCIADOR_ON`, `MSGA_DISPARAR_SIN_OBJETIVO` (punto), `MSGA_DISPARAR_OFF`.
- Cadencia: cuando el contador `this+0x54` llega a 0 dispara y lo recarga con `TIEMPORECARGA + rand()%6` ciclos (`FUN_0045acd0`). Secuencia de anims `DESENFUNDAR` → `DISPARAR` (`FUN_0045b090`).
- Efecto: pistola enemiga `FUN_00679650` (entidad) / `00679820` (punto): tipo 0 DISPARO, **cantidad 30**; parámetro extra = silenciado. Ametralladora enemiga: `FUN_00679a10` (entidad), `00679be0`, `00679dc0` (a punto, con dispersión: `rand()%11-5` en x e y, `FUN_0045a400`): también tipo 0 cantidad 30. Alcance enemigo y ángulo de tolerancia (`_DAT_00795f50`=5 en AU): NO LEÍDO para enemigos (el alcance lo decide la acción de patrulla/vigilar; ver agente IA).
- Valor por defecto de `TIEMPORECARGA`: NO LEÍDO (constructor de AcDisparar).

## 5. Daño y muerte de PERSONAS (`ClassAcMuerte`, init 0x4844A0, update 0x485850, mensajes 0x485350) [hecho]
`.CARISMA 999` (BAP2) / 500-600 (artilleros): prioridad máxima de la lista de acciones.
Al recibir `MSGA_IMPACTO` (tipo = `carga[0]`, cantidad = `carga[4]`):
1. Si el bicho es del jugador (`+0x108==2` / vcall 8 == 2) y `DAT_00840140==0`: se manda el evento UI 9 (`FUN_0059a2a0(9,{bicho, cantidad})`) = "comando herido".
2. Tipos **1 BOMBA, 10 APLASTAMIENTO, 13 ARPON, 14 CEPO**: muerte instantánea (`FUN_00484600`: energía=0, estado 3), salvo flag invencible `this+0x34` (`MSG_SET_INVENCIBLE`).
3. Tipo **9 JERINGUILLALETAL**: muerte instantánea con flag `this+0x44=1` (animación propia de inyección letal).
4. Tipo **8 JERINGUILLA**: `FUN_00484540`: no mata; flag `+0x44=1`, motor/sensores apagados, `+0x48=100` ciclos (dormido ≈ 100 ciclos = 5 s) [hecho el contador; efecto exacto del dormido NO LEÍDO a fondo].
5. **Cualquier otro tipo** (DISPARO, EXPLOSIONMENOR, ATROPELLO, MORDISCO, FUEGO, ELECTRICO, CUCHILLADA, PEPINAZO, BALLESTA…) → `FUN_00484700`: si `energía <= cantidad` → energía=0, muerte (estado 3); si no `energía -= cantidad`, anim `HERIDO1` (o `HERIDO_DESNUDO`, `HERIDOESPOSAS<suf>` según flags `+0x23c` bits 0x4000/0x200000/0x400000), estado 5 (herido), para el jugador evento UI 4. Tipo 7 (CUCHILLADA) al matar suena `CUCH`.
6. `MSGA_IMPACTO_SALVAJE`: muerte instantánea (sin origen). `MSGA_PEDRADA`: `FUN_00484c20` (aturdimiento, NO LEÍDO el cuerpo).
Solo se aplica en estados 5/6 (6 = normal, 5 = herido). La posición de origen se guarda en bicho `+0x184..0x18c` (dirección del cuerpo al caer).
- Máquina de muerte `FUN_00485850` (switch `this+0x28`): estado 3 = muerte: manda `MSGA_ARGG`/`MSGO_ARGG`, apaga motor/vista/oído/etc. (vcalls +0x38..0x44), elige anim **`MUERTE1`/`MUERTE2`** (si existe `MUERTE2`: paridad de `ultimoCarácterDelToken + ciclo`), `MUERTE_DESNUDO`, variantes de espía/esposas (`MUERTEESPOSAS<suf>`); estado 2 = espera `this+0x8c` ciclos (duración de la anim); deja mancha `SANGRE` (partícula); al final "borrar físicas".
- **Daños efectivos con energía 100** [hecho por cálculo]: pistola (40): 3 disparos matan (100→60→20→muerte); fusil/escopeta/ballesta/arpón (100): 1 disparo; enemigo (30): 4 disparos matan a un comando de 100 (100→70→40→10→muerte).
- Energía inicial: 100 por defecto; MIS: `.ENEGIA` 120/150/200 en algunos bichos (MAPA0003/4/5/9, 0004: seis con 150). MAC con `.ENEGIA`: tanques 500, camiones/coches/jeeps/vehículos 300, NIDOMET 200, PRESOTRA 100, PRESOCHU/PRESOJUG 50, BARRERA/BARREAUT 40, GALLINA 10, CASA/CARCEL/CUARTELG/DEPOSEMP 1.
- Comando = misma clase, energía 100 si no se pisa. NO LEÍDO: si los comandos del jugador se definen en otro MAC (no están en `MISIONES\*.MAC`; viven en los MIS como `AuDisparar`, `AuBotiquin`… con `.CARISMA 200`).

### 5.1 Animales (`ClassAcMuerteAnimal`, init 0x486310, update 0x4870A0, mensajes 0x486DB0) [hecho]
Misma lógica: tipos 1,10,13,14 y 9 → muerte; otros restan energía (`FUN_00486550`, anim `HERIDO`); `MSGA_PEDRADA` → anim `HERIDONS` sin daño; salvaje → muerte. Solo estados 5/6.

## 6. Estructuras, vehículos, barriles: receptores de impactos
`ClassAcExplotaBase` (vt 0x795CFC) handler 0x45FCB0 `MSGA_IMPACTO` → `FUN_0045E5E0(carga)`: obtiene el receptor (virtual +0x30) y si `receptor->Recibe(carga)` devuelve true: manda `MSGA_EXPLOTA_AHORAEXPLOTO` a hasta 5 objetos vinculados, marca explotado (`+0x28=1`, `+0x2c=1`) y borra [hecho]. También `MSGA_EXPLOTA_AVISAME_AL_EXPLOTAR` (lista de 5 observadores) y `MSG_SET_INVENCIBLE` (`+0x3c`).
Receptores (vtable slot 1 = Recibe, slot 5 = serializar) [hecho]:
- **ReceptorImpactosPorNumero** (0x45DFA0): `th[19]` en `this+0x10`, inicializados a **-1** (inmune). `Recibe`: si `0 <= tipo < 19` y `th[tipo] > 0`: `th[tipo]--`, devuelve `th[tipo]==0`. **Ignora la cantidad**: cada impacto vale 1. 0 o -1 = ese tipo no hace nada.
- **ReceptorImpactosPorNumeroAcumulativo** (0x461F50, ctor 0x461980; se usa cuando hay `.ACUMULAIMPACTOS N`): buffer circular de 17 impactos (ciclo, tipo) con ventana de N ciclos (`this+0x138`); devuelve true cuando **todos** los tipos con umbral definido alcanzaron su cuenta dentro de la ventana. Ej. barril acumulable: `.ACUMULAIMPACTOS 5 .IMPACTOS [.BOMBA 1 .EXPLOSIONMENOR -1 .PEPINAZOTANQUE -1 .EXPLOTAVEH 1]`, `.TIEMPO 50` (cadena en 7a2070).
- **ReceptorImpactosDef** (0x45F400): energía del dueño `*(this+4)+0x208`; si `energía>0` y `carga.cantidad >= this+0xC` (umbral mínimo): `energía -= cantidad` (mín 0), true si llega a 0. (Para cosas con `.ENEGIA`.)
- **ReceptorImpactosPresa / Veh**: Presa/Veh reutilizan `Recibe` de PorNumero (0x45DFA0, 0x45E4E0 serializa 0x4C bytes) [hecho por thunks]; diferencias NO LEÍDAS.
- Valores por defecto al crear `AcExplotaCasa` (`FUN_004620E0`): `th[BOMBA]=1`, `th[EXPLOSIONMENOR]=1`, `th[PEPINAZOTANQUE]=1`, luego pisados por `.IMPACTOS [...]` (`FUN_0045DEC0`, busca cada nombre de la tabla §2; solo las claves presentes) [hecho].

### 6.1 MAC con impactos (resumen de los datos)
- Camiones/coches/jeeps: `.ENEGIA 300`; `.IMPACTOS [ .ATROPELLO 1 .DISPARO 20-60 .BOMBA 1 .PEPINAZOTANQUE 1 .EXPLOSIONMENOR 1 (.EXPLOTAVEH 1 en coches) ]` → **N disparos** (DISPARO 30 camiones/jeeps/horche, 20 KUBE, 60 COCHE_V/FURGO, 20 COCHEEMP, 1000 PNZ2, 500 tanqueta/SDK) hacen explotar; `-1` = inmune (PNZ3, TAN2DES, `DISPARO -1`; VAGEMPUJ `ATROPELLO -1 DISPARO -1`). `.RADIO 200 .DANO 180 .TIEMPO 100/200` = explosión del vehículo (§7). `.FUERZA 150/100/200/20000` = fuerza de empuje del piloto (`AcPilotaje`, atropello), no daño [hip]. Cisterna: `.TIPOIMPACTO BOMBA` (su explosión inflige tipo BOMBA = muerte instantánea) y `.DANO 200`.
- BUNKER/TORRE: `.IMPACTOS [ .BOMBA 1 .PEPINAZOTANQUE 1 .GRANADA $DestruyeGranada ]`; CANYON `[.BOMBA 1 .EXPLOSIONMENOR 1]`.
- Tanque PNZ2: `.ENEGIA 500`, torreta `acTorreta [.RAFAGA 10 .ALCANCE 1000 .RECARGA 5 .IMPACTO 110 .ARCO 10 .ALCANCEMINIMO 50]`; PNZ3/TAN2DES: `.ALCANCEMINIMO 300`; TANQUETA/SDK: `.ALCANCE 600 .ALCANCEMINIMO 150`. Semántica de `acTorreta` NO LEÍDA ([hip] `.IMPACTO 110` = cantidad del impacto, `.ALCANCE`/`.ALCANCEMINIMO` en las unidades del mundo, `.RAFAGA` balas por ráfaga, `.RECARGA` ciclos).
- Mina `MINA.MAC`: `AcMina [.ACTIVA 1]`; `MINASUB.MAC`: `.POTENCIAMINA 10000`; bombas: `acBomba [.RETARDO 0]` (BOMBAACT) / `.RETARDO $Retardo` (BOMBARET).

## 7. Explosiones (parcial)
- **ProductorDanoDef** (0x45FB80; claves leídas por `FUN_0045E020`) [hecho]: `.RADIO` (defecto **100**, `+8`), `.DANO` (`+0xC`, defecto 0), `.QUEMA` (`+0x14`), `.EVENTO` (`+0x18`), `.TIPOIMPACTO` (`+0x10`, defecto **0x11 = EXPLOTACASA**, seteado por `FUN_0045E010(0x11)` en `AcExplotaCasa`).
- Al explotar (`slot 2`, `FUN_0045FC40`): dispara el `EVENTO` y, si `RADIO > 0` y tipo válido, `FUN_00571FE0`→`FUN_00571E50`: crea un efecto `ONDEXP` y **a todos los objetos dentro del radio** (`FUN_0057D590` + test geométrico `0057C400`) con línea de visión (`FUN_00571A10`) les manda `MSGA_IMPACTO {tipo, DANO}` (`FUN_005986A0` / `FUN_005985C0` si no hay objeto fuente). La cantidad **no decae con la distancia** (la carga es constante) [hecho en el camino leído; el test de radio interno `0057C400` NO LEÍDO a fondo]. Además `FUN_005BC080` repite el envío para objetos en una lista de la sala (ruido/aviso, NO LEÍDO).
- `QUEMA` > 0: al tocar manda tipo **5 FUEGO** con cantidad QUEMA (`FUN_0045E290`).
- Vehículos explotan con `.RADIO 200 .DANO 180` (camión, coche, tanque…): contra personas con energía 100 es letal (180 >= 100) salvo que el tipo sea inmune.
### 7.1 Fuentes de explosión leídas [hecho]
| fuente | claves | defecto (dirección) | tipo de impacto | radio | cantidad |
|---|---|---|---|---|---|
| **AcBomba** (init 0x43FE20, update 0x440E90, explota 0x440D30) | `.RETARDO` (+0x28 ciclos), `.RADIO` (+0x34), `.POTENCIA` (+0x2C), `.FUERZA` (+0x30), `.RELOJ` (+0x38; solo si RETARDO!=0), `.MASAEXPLOSION` (+0x48 float), `.ACTIVABLE` (+0x40), `SINSOCAVON` | ctor `FUN_00440340` llamado desde `FUN_0064BA10`: RETARDO **200** ciclos (10 s), RADIO **250**, POTENCIA **10000**, FUERZA 1, RELOJ 0 (un 150 va a `+0x100`, uso NO LEÍDO) | **1 BOMBA** | RADIO | POTENCIA |
| **AcMina** (init 0x483900, msgs 0x483160, update 0x483BB0, explota 0x483540) | `.ACTIVA` (+0x34), `.RADIOACCIONMINA` (+0x30), `.POTENCIAMINA` (+0x2C), `.PESOACT` (+0x28) | ctor 0x483820: PESOACT **60**, POTENCIA **200**, RADIO **20**, ACTIVA 1; MINASUB.MAC `POTENCIAMINA 10000` | **2 EXPLOSIONMENOR** | RADIOACCIONMINA | POTENCIAMINA |
| **AcGranada** (granada del jugador; init 0x46FE80, update 0x46FEC0) | sin claves; parámetros por ctor `FUN_004700A0` | desde `FUN_006517A0`: radio (+0x30) **200**, cantidad (+0x28) **2000** | **2 EXPLOSIONMENOR** en el primer ciclo | 200 | 2000 |
| **Vehículos** `AcExplotaVeh` (init 0x464E50; receptor ReceptorImpactosVeh) | `.RADIO .DANO .TIEMPO .IMPACTOS .TIPOIMPACTO .QUITAPINTABLE .SONFIS` | receptor Veh: th[DISPARO]=**30**, th[BOMBA]=1, th[EXPLOSIONMENOR]=1, resto -1, luego `.IMPACTOS`; productor tipo **0x10 EXPLOTAVEH** | EXPLOTAVEH (o `.TIPOIMPACTO`; cisternas BOMBA) | `.RADIO` (200 en todos los MAC) | `.DANO` (180; 200 cisterna) |
| Barril/casas `AcExplotaCasa` (0x4620E0) | idem | ver §6 | EXPLOTACASA (17) por defecto | `.RADIO` (def. 100) | `.DANO` (def. 0) |

Todas terminan en `FUN_00571FE0(dueño, tipo, radio, cantidad)` (área, ver arriba). Granada: explota en el ciclo 0 de AcGranada y el objeto vive `max(+0x74,10)` ciclos (después avisa y se borra). Bomba: con `RELOJ` pinta cuenta regresiva `((RETARDO-t)*60)/RETARDO` (`FUN_005B8DD0`); BOMBAACT usa `.RETARDO 0`, BOMBARET `.RETARDO $Retardo` (del MIS).
`AcMina` armada (+0x34): se dispara por (a) `MSGA_IMPACTO` o (b) `MSGA_COLISION_DINAMICA` con un objeto de masa (`+0x238`) **> PESOACT** (y sin flag 1); ese objeto recibe de inmediato impacto tipo 2 con POTENCIAMINA; la explosión ocurre **20 ciclos después** (`+0x18=0x14`, update `>0x13`).

### 7.2 Heridas, botiquín, fuego, electricidad [hecho]
- **Botiquín** (`ClassAUBotiquin`, init 0x4E8B50, update 0x4E90E0, curar 0x4E8C30): `.USOS n` -> `this+0x1A0 = n*2`. Cura solo si `energía(+0x208) < energíaMax(+0x20C)` (máx. 100 por defecto: `FUN_0050F020` pone `[0x83]=100`). Cada curación: **+34 (0x22)** de energía con tope en energíaMax; decrementa el contador de usos; al llegar a 0 quita el ítem (id 0x52). Anim `JERINGA`; la curación ocurre al tick 10 de la anim o al terminar (una sola vez). Sirve a un aliado (clase 2 con energía < máx.) o a uno mismo. Que `n*2` signifique "n usos" es [hip] (se decrementa 1 por curación).
- **Fuego** (`AcSerIncinerado`, 0x4AC730/0x4AC760): al recibir `MSGA_TRIPLINE` de clase `FIRE` (dword 0x46495245) pasa a estado 1; cada ciclo se auto-envía impacto **5 FUEGO, cantidad 100** (letal con energía <= 100).
- **Electricidad** (`AcSerElectrocutado`, 0x4AB7C0 con `.IDTRIPLINES`; msgs 0x4AB000; 0x4AB260): `MSGA_TRIPLINE` de clase `ELEC` (0x454C4543) -> se auto-envía **6 ELECTRICO, cantidad 20 (0x14)** (5 descargas matan a 100), sonido `HSLE`, avisa al interruptor asociado. `MSGA_ARGG` (muerte) lo detiene.
- **Lanzallamas** (`AULanzallamas` init 0x4F8880/update 0x4F9090; `AcLanzallamas` 0x477F70): NO LEÍDO (existen tipo 15 LANZALLAMAS y `.QUEMA`).
- **Piedra**: `MSGA_PEDRADA` aturde sin quitar energía (§5); duración NO LEÍDA.

### 7.3 NO LEÍDO todavía
`AcExplotaEstatico` (0x462890), `AcExplotaPresa` (0x463100), `AcExplotaTilesBarrera` (0x463FA0), `AcBarrilExpl`, `MotorGranada` (trayectoria), `SimExplosion`, `ParachoquesExplosion`, `AcBomba` msgs (0x440740, activación por el jugador).

## 8. Otros NO LEÍDOS
Ruido/oído del disparo (quién oye), ráfaga de metralleta del jugador (`0x676F20/0x676B20`), `acTorreta`, alcance de disparo de enemigos, `AcRecogeArma` (0x4A6B00), `AcTransmiteImpacto`, lanzallamas, tiempo de aturdimiento por piedra, efecto detallado del sueño por JERINGUILLA.

## 9. Hallazgos para otros
- **UI**: `FUN_00786E60` = tabla de ítems de UI (`IT_*`, stride 0xAC, desde `0x8799F0`); id ítem→arma en `FUN_004EF910` (ids 0x26→0x25, 0x62→1, 3→1, 0x27→0x24).
- **IA/percepción**: mensajes de prioridad en lista de acciones por `.CARISMA`: `acMuerte` 999 (siempre gana); `AcDisparar` 500; también `MSGA_ARMA_DISPARADA` sin referencias en código leído.
- **Movimiento/vehículos**: `.FUERZA` pertenece a `AcPilotaje`; `MSGA_COLISION_DINAMICA` llega a `AcExplotaBase` (`FUN_0045D850`).
- **Tutorial/trucos**: `MSGA_SETMODE_TUTORIAL` pone `this+0x2c=1` en AcMuerte (probablemente muerte desactivada en tutorial) y `DAT_00840140` es un flag global que anula daño al jugador y consumo de munición ([hip] modo dios/PYROFOREVER).
- **Sonido**: tabla de nombres de WAV de armas en `.rdata 0x7AD5E0..` (`FRANCO.WAV` fusil silencioso, `FUSIL.WAV`, `METRMANO.WAV`, `AMETRALL.WAV`, `METRTANQ.WAV`, `METRLANC.WAV`).
