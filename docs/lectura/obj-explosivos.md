# Objetos-trampa y explosivos: Mina, Bomba, Barril, Cepo, Señuelo, depósitos de munición (exe `coman_mp.exe`)

**[hecho]** = leído con dirección; **[hip]** = interpretación. 20 ciclos/s. Complementa `docs/engine/armas-danio.md` §6/§7 (receptores y área) y `docs/lectura/au-jugador.md` §9 (cómo el jugador pone/recoge bombas, cepos y señuelos). Los tipos de impacto (índice de la tabla `0x818DA8`): 0 DISPARO, 1 BOMBA, 2 EXPLOSIONMENOR, 3 ATROPELLO, 4 MORDISCO, 5 FUEGO, 6 ELECTRICO, 7 CUCHILLADA, 8 JERINGUILLA, 9 JERINGUILLALETAL, 10 APLASTAMIENTO, 11 PEPINAZOTANQUE, 12 BALLESTA, 13 ARPON, 14 CEPO, 15 LANZALLAMAS, 16 EXPLOTAVEH, 17 EXPLOTACASA.

## 0. Piezas comunes
- **Ids de sonido y radio de oído** (tabla de **48** entradas `{fourcc, radio}` en `0x821DE0`, contador en `0x821F60`) [hecho, volcada]. Registrar un sonido como fuente (`FUN_00680D50(obj,1)` → `FUN_006807E0`, máx. 32 fuentes) guarda `radio²`; esos radios son hasta dónde "oye" la IA. Valores: `ALTO 80` · `VMUE 150` · `VESP 150` · `DETE 80` · `ALRM 300` · `ATAK 80` · `ESPI 300` · `QIEN 150` · `SOLD 300` · `ESPG 150` · `APOE 150` · `AL01 150` · `AL04 150` · `AL10 150` · `AL12 300` · `ZO01 300` · `ZO02 300` · `GE01 80` · `GE02 80` · `KI03 150` · `LADR 300` · `RUGV 150` · `RUGA 300` · `AVVE 150` · `AVAT 300` · **`SIRN 800`** · **`TELF 800`** · `CLXN 300` · **`DCOY 300`** (señuelo) · **`TKTK 300`** (tic de bomba) · `CLBA 300` · `FTRN 300` · `PING 125` · **`PIPA 600`** (pistola) · `FUSL 400` · `MET0 400` · `MET1 500` · **`NIDO 500`** · `METL 500` · `METT 500` · **`XGRA 1200`** · **`GRAN 1200`** · **`EBAR 1200`** (barril) · `TNKS 1200` · **`XPLO 1200`** (explosión) · `MXPL 0` · `PEDL 125` · `PEDW 125` (piedra). Fuera de la tabla (no hacen ruido para la IA): `CEPO` y los sonidos de objeto de la UI.
- `FUN_00681B90(categoría, fourcc, bicho, vol)` = ruido **para la IA** (`FUN_00681660`) + reproducción (`FUN_0067F9C0`). Categorías vistas: 2 (atención) y 3 (peligro). Los explosivos usan siempre **3** con volumen `0.75`.
- La tabla de radios define el alcance **si la fuente se registra**; no registra automáticamente cada reproducción audible. La ruta del tic de bomba `TKTK` usa el reproductor de sonido y no registra fuente de oído (§2).
- `FUN_00507E80(r, h)`: fija el cilindro de choque del bicho (mina `FUN_00507E80(radio, 10)`; barril `(20,10)` tras explotar; bomba `(−1,40)` con cráter) — [hip: radio y altura]. `FUN_00615DE0/615F60/616020/616140/6156B0/615750/615670/6157B0/6156E0` = encender/apagar bits de visibilidad/actividad del bicho (`bicho+0x38`: 2,4,8,0x10,0x80).
- **Cráter**: `BOQUETET` (sprite de agujero) con animación `GRANDE`; si el sector bajo el objeto es nulo o de tipo **1 o 3** (agua) no hay cráter (`NADA`, salpicadura `FUN_00679120`). El efecto central `EXPLOS1`/`EXPLOSION1` es una secuencia de sprites (`render.md` §2.2); la cámara tiembla en la bomba (`FUN_0063F760(10, 1.0)`).
- Contador de minas por sector: el sector (`bicho+0xE4`) tiene un contador en `+0x48` que la mina suma al crearse (`FUN_00483140`) y resta al explotar [hecho; el consumidor —búsqueda de rutas del enemigo— no se leyó].

## 1. `ClassAcMina` (`0x483110…0x483C50`) [hecho]
Parámetros MAC (`FUN_00483900`): **`ACTIVA`** (+0x34, por defecto **1**), **`RADIOACCIONMINA`** (+0x30, por defecto **20**), **`POTENCIAMINA`** (+0x2C, por defecto **200**), **`PESOACT`** (+0x28, por defecto **60**). (Corrige `armas-danio.md`, que tenía RADIO/POTENCIA al revés; los defectos del ctor `FUN_00483820`: `0x3C`, `0x14`, `200`.) `MINA.MAC`: `AcMina [.ACTIVA 1]`, cilindro `R10 H5`, `MotorObjeto [.EXPLOTA 1 .FIJO 1]`, `MASA 0`; `MINASUB.MAC` (mina submarina): `POTENCIAMINA 10000`, cilindro `R17 H95`, `TIP MISU`.
Estados: `+0x34` armada, `+0x38` disparada, `+0x3C` ya explotó, `+0x40` fase del efecto (0 espera, 1 efecto, 2 fin), `+0x18` contador de ciclos.
- `MSG_ACTUASOBRE` → `MSG_SOY_UNA_BOMBA` (el Zapador la reconoce y la manipula).
- `MSG_MANIPULA_BOMBA` (poner/levantar con `AUManejaBomba`): si no está disparada: `+0x18=0` y **alterna** `+0x34` (desarmada ↔ armada).
- `MSGA_ENTRADAENCONTENEDOR` / `SALIDADECONTENEDOR` (la mochila): `+0x34 = 0` (queda desarmada).
- `MSGA_IMPACTO` (cualquier impacto) con la mina armada y no disparada: `+0x38=1`, `+0x18 = 0x14`.
- `MSGA_COLISION_DINAMICA`: si armada y no disparada y el cuerpo que choca (`FUN_005FE1A0`) no tiene `+0x23C & 1` y su **masa `+0x238` es estrictamente mayor que PESOACT** → `+0x38=1`, `+0x18=0x14` y **el que pisó recibe de inmediato impacto tipo 2 (EXPLOSIONMENOR) con POTENCIA (200)**.
- Tick `FUN_00483BB0`: fase 0: `+0x18++`; si disparada y no explotada y `+0x18 > 0x13` (o sea **20 ciclos = 1 s después**) → `FUN_00483540` (explota). Fase 1: avanza la animación del efecto; al terminar (`FUN_004E18B0`) → fase 2 y apaga el bicho.
- **Explosión** (`FUN_00483540`): cráter/agua (§0), `FUN_00571FE0(bicho, tipo 2, RADIO=20, POTENCIA=200)` (área: ver `armas-danio.md` §6), sonido `'XPLO'` (cat. 3, 0.75), animación `GRANDE`, `bicho+0x23C |= 1`, `+0x3C=1`. Con `POTENCIAMINA 10000` (minas submarinas) mata a cualquier cosa.
- Ruido de la IA: `XPLO` = radio **1200**.

## 2. `ClassAcBomba` (`0x43FE20…0x440FB0`) [hecho]
Parámetros (`FUN_0043FE20`): `RETARDO` (+0x28, **ciclos**; si es 0 se fuerza `RELOJ=0`), `RADIO` (+0x34), `POTENCIA` (+0x2C), `FUERZA` (+0x30), `RELOJ` (+0x38; `==1` muestra cuenta atrás), `MASAEXPLOSION` (+0x48, float; por defecto **100000**, `0x7948F8`), `ACTIVABLE` (+0x40, `==1` ⇒ el jugador puede cogerla), clave de macro `SINSOCAVON` (si **no** está ⇒ `+0x44=1` y se precarga el cráter). MAC: `BOMBAACT` `RETARDO 0`; `BOMBARET` `RETARDO $Retardo` (por defecto `200` = **10 s**). El ctor prepara el sonido audible `TKTK`; el radio 300 de su entrada de tabla no implica que esta ruta lo registre para la IA (ver abajo).
Estado `acc+0x24`: 0/1 inactiva-desarmada, **2 contando**; `+0x18` contador; `+0x3C` explotó.
- `MSG_ACTUASOBRE`: solo si `ACTIVABLE` → `MSG_SOY_UNA_BOMBA`.
- `MSGA_IMPACTO` (no explotada): si el tipo ∈ {0 DISPARO, 1, 2, 3, 5 FUEGO, 10, 11, 16, 17} (`FUN_00428040` ∪ `FUN_0043FD30`) ⇒ **estado 2 con `+0x18 = RETARDO`** (detona al ciclo siguiente: explosión en cadena).
- `MSG_MANIPULA_BOMBA` (el Zapador la pone/levanta) y `MSG_ACTIVA_BOMBA` (activarla): si no explotó: enciende la marca de actividad; si es `ACTIVA` o estado<2 o ya cumplió el retardo → arranca el tic (`FUN_0067E530/67FA80(1)` si `RETARDO≠0`) y **estado 2**; si no (estaba contando y aún falta) → **estado 1** (desarmada/pausa). `+0x18 = 0`; si `RELOJ`: pinta `60 × (RETARDO−t)/RETARDO` (`FUN_005B8DD0`).
- `ENTRADAENCONTENEDOR`/`SALIDADECONTENEDOR`: `+0x18=0`, tic apagado, estado 1.
- Tick `FUN_00440E90`: con estado>1: `+0x18++`; sin explotar: si `+0x18 ≥ RETARDO` → apaga el tic y `FUN_00440D30`; con `RELOJ` actualiza el reloj. Explotada: avanza la animación del efecto y al terminar vuelve al estado 1 y apaga el bicho.
- **Explosión** (`FUN_00440D30`): sacudida de cámara `(10, 1.0)`, cráter `GRANDE` (si hay `+0x44` y el sector no es agua; entonces `FUN_00507E80(−1, 40)`) o `NADA`, `'XPLO'` (cat. 3), `bicho+0x23C |= 5`, **`FUN_00571FE0(bicho, tipo 1 BOMBA, RADIO, POTENCIA)`**.
- **Corrección del tic:** el asm del constructor `00440340`, `0x4403E0–0x440414`, prepara `TKTK` mediante `00680080` en `acción+0x140`; al activar una bomba temporizada, `00440740`, `0x44099D–0x4409BB`, usa ese mismo objeto con `0067E530` y `0067FA80`. Este último solo inicia reproducción (`FUN_0067F5A0`, `fn_00640000.c:48405–48438`, `48631–48653`); esa ruta no registra una fuente de oído. `XPLO` sí se emite como peligro con radio 1200 al explotar. Las cuatro bombas declaradas en M0 usan `BOMBAACT` con retardo 0, por lo que esa activación no arranca el tic.

## 3. `ClassAcBarrilExpl` (`0x43EFF0…0x43FB50`) [hecho]
MAC `BARRIL`: `MASA 200`, cilindro `R10 H20`, `MotorObjeto [.EXPLOTA 1]`, `TIP 0BAR`. Sin parámetros propios.
Estado `acc+0x2C`: 0 reposo · **1 explotar** · **2 comprobar si cae sobre algo** · 3 efecto.
- `MSG_ACTUASOBRE` / `MSGA_IDENTIFICATE` → `MSG_SOY_UN_BARRIL` (el AU `CogeBarril` lo carga).
- `MSGA_IMPACTO` (si aún no estalló): si el tipo ∈ {0, 1, 2, 3, 5, 6 ELECTRICO, 10, 11, 15 LANZALLAMAS, 16, 17} ⇒ `+0x2C=1`, `+0x30=1`; `MSGA_IMPACTO_SALVAJE` siempre.
- `MSGA_SALIDADECONTENEDOR` (el comando lo suelta): si no estalló ⇒ estado **2**: `FUN_0043F020` recorre todos los bichos y, si alguno con `+0x240 & 0x30` solapa el círculo del barril (`FUN_0057C400`), lo **guarda debajo** (`acc+0x3C`), le apaga la visibilidad/actividad (`FUN_006157B0`, `FUN_006156B0`, `FUN_005086E0(0)`) y marca `+0x38=1` [hip: es el cuerpo inmovilizado que se oculta bajo el barril]. `MSGA_QUITASOCAVON` borra el cráter.
- **Explosión** (`FUN_0043F9B0`): cráter `GRANDE` (o `NADA` en agua), `EXPLOS1/EXPLOSION1`, `'EBAR'` (cat. 3, radio de oído **1200**), **`FUN_00571FE0(bicho, tipo 2, radio 100, cantidad 20000)`**, `bicho+0x23C |= 4`.

## 4. `ClassAcCepo` (`0x450C00…0x451040`) [hecho]
MAC `CEPO`: cilindro `R10 H5`, `MASA 200`, `OCLU 0`, anim `CEPO`. Cadena de animación `PILLAR`.
- Estado `acc+0x24`: **3 armado** (al soltarlo: `MSGA_SALIDADECONTENEDOR` ⇒ estado 3, `bicho+0x23C |= 1`, `+0x40=4`, `+0x74=0`) · **4 cerrado**.
- `MSGA_COLISION_DINAMICA` en estado 3: si el que choca es un bicho de **clase ≠2 y ≠3** (o sea ni comando ni arrestado) y **con apariencia ≠0** (alemán/animal): le envía **impacto tipo 14 (CEPO) cantidad 1** (muerte instantánea, `armas-danio.md` §4), `+0x74 = 1.0`, estado **4**, sonido `'CEPO'` (vol. 0.75, sin ruido de IA).
- `MSG_ACTUASOBRE` → `MSG_SOY_UN_CEPO`. `MSGA_ENTRADAENCONTENEDOR` (recogido): `+0x23C &= ~1`.
- Un comando **nunca** activa el cepo (clase 2). No se volvió a leer ninguna regla de rearme: queda cerrado y recogible (la animación `PILLAR` se detiene en el último cuadro).

## 5. `ClassAcSegnuelo` (`0x4A8D70…0x4A93B0`) [hecho]
MAC `SEGNUELO`: `INTERVALOSND` (por defecto **30**), cilindro `R10 H5`, `NOSOLIDO 1`, `MASA 200`, anim `SEGNUELO`. `bicho+0x190 = 3`, `bicho+0x198 = acc+0x28`, `bicho+0x240 = 0x80` (la IA —`AcSeguir`, vista, oído— lee ese bloque: `+0x28` encendido, `+0x2C` cuenta, `+0x30` espera, `+0x34` roto, `+0x38` intervalo).
- `MSG_SEGNUELO_ONOFF` (clic derecho/orden del AU `ManejaSegnuelo`): si no está roto alterna encendido/apagado; al encender: `+0x2C=1`, `FUN_006819A0` (posiciona la fuente: posición/sector del bicho) y `FUN_00680D50(1)` (registra el sonido como fuente de ruido; id `DCOY`, **radio de oído 300**); al apagar `FUN_00680D50(0)`.
- Tick (`FUN_004A8D70`): si encendido, reactualiza la fuente cada ciclo; cuenta `+0x30` (espera inicial) y luego `+0x2C` que se recarga con `INTERVALOSND` (**30 ciclos = 1,5 s**) — el temporizador lo consulta el sonido/IA a través de `bicho+0x198`.
- `MSGA_IMPACTO` (si no estaba roto): `+0x34=1`, anim `ROTO`, sonido apagado, `+0x240 &= ~0x80` (deja de ser señuelo).
- `MSGA_SALIDADECONTENEDOR` (soltado): si está muerto (`+0x38&4`) apaga; anim `SEGNUELO`. `MSGA_ENTRADAENCONTENEDOR` (recogido): sonido apagado, `+0x34=0`, `+0x240 |= 0x80`.
- `MSG_ACTUASOBRE` → `MSG_SOY_UN_SEGNUELO`.

## 6. Depósitos de munición / armas
- **`ClassAcRecogeArma`** (`0x4A6B00`, cajas `CAJA*.MAC`): parámetros `NUMARMAS` (`+0x19C`→usos `+0x28`), `FLAGSRECOGER` (`FL_GRANADAS`→flags `+0x250|=8`, `+0x254|=0x100`; `FL_METRALLETA`→`0x10`/`0x200`; `FL_BALASFRANCOT`→`0x20`/`0x400`), `TOKENARMA` (+0x170, p.ej. `GRANADA` ⇒ registra el sonido `XPLO`), `BALASINICIALES` (+0x190), `TOLTIP_LLENO`/`TOLTIP_VACIO` (tooltip lleno/vacío, `FUN_00507600`). `MSG_ACTUASOBRE` ⇒ `FUN_004A6FB0`: manda `MSGA_RECOGE_ARMA` al actor; si lo acepta (`+0x194≠0`): `usos−1`, sonido `'CAJA'`; al llegar a **0** quita los flags de recogible y pone el tooltip "vacío". El actor queda con la animación `ANDAR` (prio 6).
- **`ClassAcRecarga`** (`0x4A6380`): igual pero **un solo uso**: `MSGA_RECARGA_ARMA` con `BALASRECARGA` (`+0x48`) al actor; quita los flags; tooltip vacío; sonido `'CAJA'`.
- **`ClassAcCogeBombas`** (`0x453920`, depósito de bombas, `+0x250=0x100`, `+0x254=0x2000`): `TOKENBOMBAS` (nombre), tooltips; `MSG_ACTUASOBRE` ⇒ `MSGA_RECOGE_BOMBAS` al actor (le da las bombas) y apaga los flags (queda vacío).

## 7. Otros restos leídos
- `ClassAcLapa` (`0x478710…`): `FUERZA` (+0x5C), `PROPIETARIO` (nombre, +0x28): sigue a su propietario a un desplazamiento fijo (`FUN_00478890`) y, al chocar contra otro bicho (≠ propietario) con velocidad > **3,0** (`0x793F74`), le envía **impacto tipo 3 (ATROPELLO) = FUERZA** — es un parachoques/espolón atado a un vehículo [hip, por nombre y datos].
- `ClassAcTransmiteImpacto` (`0x4B6870…`): `CEREBRO` (nombre de otro bicho); reenvía `MSGA_IMPACTO`/`IMPACTO_SALVAJE` recibidos al receptor `CEREBRO` (error en consola si no existe). Sirve para que un elemento "tonto" (volumen, puerta) pase el daño a su dueño.
- `ClassAcUniforme` (`0x4B6CE0…`): parámetro `UNIFORME` (por defecto una cadena de 6 bytes de `0x798390`); `MSG_ACTUASOBRE` ⇒ `MSGA_DISFRAZATE` al actor (con el nombre del uniforme); ver `au-jugador.md` §8 (Disfraz/QuitaUniforme).

## Dudas abiertas
- Ninguna sobre las clases de esta nota. No leídos por quedar fuera del tema: parámetros con que el AU `ManejaBomba` construye la bomba (`FUN_00440340`, ya anotado en `armas-danio.md`), y el consumidor del contador de minas por sector (búsqueda de rutas del enemigo, tema P2/pathfinding).
