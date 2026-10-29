# Lectura del exe — Presos, testigo, seguidor, escoltado y ojo distante

Clases leídas completas: `ClassAcPresoChusma` (`0x497F70–0x49AA10`), `ClassAcPresoTraidor` (`0x49AA80–0x49D5AF`+`0x49D520`), `ClassAcTestigo` (`0x4B3540–0x4B3830`), `ClassAcSeguir` (`0x4A9E90–0x4AAAC0`) con `ClassAcSensorSonido` y `ClassAcSerElectrocutado` (vecinas), `ClassAcEscoltado` (`0x45BDB0–0x45C9D0`), `ClassAcOjoDistante` (`0x4893D0–0x4896F0`). **[hecho]** = leído con dirección; **[hip]** = interpretación (los nombres de estado no están en el código). Los sonidos (`PRR1…`, `ZO03`, etc.) y los eventos `CHxx` son fourcc leídos del código; los nombres de `.WAV` salen de `sound_table.tsv` cuando figuran allí.

## 1. `AcPresoChusma` — los presos que juegan en el patio y huyen [hecho el flujo; nombres hip]
Ctor `FUN_00498080` (estado `acc+0x24 = 0`; `thunk_FUN_00645380("PRESO")` fija el token del bicho); MAC `FUN_00499150`:
| Clave | Efecto |
|---|---|
| `POSICIONJUGAR [x y z]` | `+0x90..0x98` punto donde "juega" (y `+0x78 = 1`, "puede jugar") |
| `ANGULOJUGAR` | `+0xB4` rumbo al jugar (por defecto 0) |
| `TIEMPOENTREJUEGOS` | `+0x44` ciclos entre juegos (por defecto **1200**, `0x4B0`) |
| `TIEMPOJUGANDO` | `+0x48` ciclos jugando (por defecto **500**) |
Además: `MSGO_VISTA_SETVIS` con la máscara `0x10042`, `bicho+0x240 = 4`, precarga las voces `PRR1–PRR5`, `PRM1–PRM4`, `PRA1–PRA3` (fourcc `0x5052Rn`/`Mn`/`An`) y registra el observador de animación. Eventos de misión que dispara (`FUN_0059A2A0(0, hash, bicho)`), guardados en el ctor: `+0x28 'CHDB'`, `+0x2C 'CHDH'`, `+0x30 'CHSH'`, `+0x34 'CHSE'`, `+0x38 'CHSC'`, `+0x3C 'CHNH'`.
**Estados** (`FUN_00498400(estado)`, tick `FUN_00499660`; entran con `PATRULLA_PAUSE`/`UNPAUSE` según corresponda):
| Est. | Qué hace | Salida del tick |
|---|---|---|
| 0 | arranque: pide a la misión el punto `'CHDH'` (API de misión `vtable+0x3C`, guarda `+0xA8`) y pasa a 1 | |
| 1 | **ronda** (`PATRULLA_UNPAUSE`, andar por su ruta). Cuenta `+0x50` (tiempo entre juegos) | al llegar a 0 → 3 |
| 2 | **vuelve a su sitio** (`+0x9C`) a vel. **2.0**, anim `ANDAR` | |
| 3 | **ir al punto de juego** (`+0x90`) a vel. 2.0; carga `+0x4C = TIEMPOJUGANDO` | al llegar (`+0x74`) → 4 |
| 4 | **llega y se orienta** (`SETANG(ANGULOJUGAR)`, `SETANGCABEZA`), anim `REPOSO` | cuando el rumbo está a < 1° del pedido → 5 |
| 5 | **jugando** (`JUGAR`; con azar `FUN_00468B70(1,0)` suena una de `PRA1–PRA3`) | cuenta `+0x4C` hasta 0 → 2; si se aleja de `POSICIONJUGAR` más de **5 u** (`dist² > 25`, `0x793CA0`) → 3 |
| 6 | **huye a la casa** (tras un impacto o `TRIGGER_REACT`): evento `CHSE`, `bicho+0x108 = 0` (deja de parecer aliado), anim `CORRE`, a vel. **4.0** al punto de huida; mientras corre `+0x58++` | sin camino: <3 reintentos → 9; ≥ 3 → 1 |
| 7 | pausa de 10 ciclos | |
| 8 | esperando salir del habitáculo | `MSGA_SALIR_HABITACULO` |
| 9 | **correr a su refugio** (`+0xB8`): evento `CHSH`, `bicho+0x108 = 2`, `CORRE` a vel. 4.0 | llegado → 0xB; si el camino falla → `FUN_00498EB0` (reintenta con `POS_SUBIDA`) |
| 0xB | **entrar al refugio** (casa de la misión por `'CHDB'`, `MSGA_POS_SUBIDA`) | `MSGA_ENTRAR_HABITACULO` |
| 0xC | **muerto** (`MSGA_ARGG`): evento `CHNH`, `bicho+0x240 |= 0x20`, `+0x108 = 2`, voz `PRM1–PRM4` | |
| 0xD | **oculto/fuera** (en refugio): evento `CHSC`, `FUN_005086E0(0)` y quita las marcas de selección (`FUN_00615670/615750/6157B0/6156B0`) | |
| 0xE | parado (`REPOSO`) | |
Mensajes (`FUN_0049A4F0`): `BUSCADOR_LLEGADA`/`MOTOR_PUNTOALCANZADO` → `+0x6C=1` (llegó); `MOTOR_CRISIS`/`DESTINOINALCANZABLE`/`CRISIS_POR_SABOTAJE` → `+0x74=1`; `IMPACTO` (si vivo) → voz `PRR0`→ azar `PRR1–PRR5` y estado 5 reutilizado como "asustado"; **`TRIGGER_REACT("CHES")`** (excepto en 6, 0xC, 0xD) → `+0x7C=1` (a huir, estados 6/9); **`TRIGGER_REACT("CHHU")`** → `+0x80=1`; `ARGG` → 0xC; `COLISION_DINAMICA` con la casa que busca (estados 6/0xB) → `+0x70=1`. [hecho el flujo; hip el sentido de cada evento `CHxx`: la misión los usa para contar presos liberados/muertos].

## 2. `AcPresoTraidor` — el chivato (token `GONZOL@`) [hecho el flujo; nombres hip]
Ctor `FUN_0049B720` (`FUN_00645380("GONZOL@")`, efectos `BRILLOS` y `CHIRIVITAS` = las estrellitas del atontado, `+0x34` = 0x5DC); MAC `FUN_0049C8B0`: `CONTACTOS [nombre …]` (hasta **4**, `+0x40` cuenta, nombres de 0x20 B en `+0x8C`), vista `MSGO_VISTA_SETVIS 0x10836`, `bicho+0x240 = 4`, voces `PRR1–PRR5`, `PRM1–PRM4`, `ZO03` ("cuchicheos"). Sus contactos son bichos (alemanes) a los que va a **charlar** y contarles lo que ve.
Estados (`FUN_0049BB70`, tick `FUN_0049CBC0`; arranque 0 → busca los contactos por nombre y pasa a 2):
| Est. | Qué hace | Tick |
|---|---|---|
| 0 | parado (`PATRULLA_PAUSE`) | resuelve los contactos y → 2 |
| 1 | **ir hacia un punto** (`+0x154`, `ANDAR`) | |
| 2 | **ronda** (`PATRULLA_UNPAUSE`, cabeza barriendo ±`FUN_0070B780`·50°) | `+0x34--` (1500 ciclos); a 0, si hay contacto → 5; si ve a un comando y puede (`+0x7C`) y `MSGA_PUEDO_IR_A_COGERTE`→10 |
| 3 | **ir a la casa** (`MSGA_POS_SUBIDA`, vel. 4.0, `CORRE`) | al llegar `ENTRAR_HABITACULO`; dentro → 4 |
| 4 | dentro de la casa (oculto: quita marcas de selección) | |
| 5 | **ir a un contacto** (anim `ANDAR`) | a `dist² < 600` (`0x797164`, float; ≈ 24 u) → 6 |
| 6 | **charla** con el contacto: `ZO03` + `MSGA_ECHAR_CHARLA` cada ciclo, **50** ciclos (`+0x38`) | → 1 |
| 7 | mira al origen del ruido, 50 ciclos | |
| 8 | **ir al contacto con el aviso** (hasta 3 vistos) | a `dist² < 600` → 9 |
| 9 | **le cuenta**: `ECHAR_CHARLA` 30 ciclos (`+0x38 = 0x1E`) | → **0xE** |
| 0xA | **perseguir a un comando** (`MSGA_ESTOY_YENDO_A_COGERTE`, vel. 2.0) | a `dist < …` → 0xB |
| 0xB | **mirar al comando** (`SETANG`) | cuando el rumbo está a < 1° → 0xC |
| 0xC | **"RECOGER"** durante **10** ciclos; luego manda **`MSG_DESTRUIR`** al comando/objeto (`+0x19C`) | → 1 |
| 0xD | **fumar** (`FUMAR`) 100 ciclos; cooldown `+0x4C = 1000` | |
| 0xE | **avisar** (`MSGA_CHIVATO_VIO_PELIGRO` al contacto `+0x184`), anda hacia él | si el contacto se aleja a `dist² > 2000` (`0x797A38`, double; ≈ 45 u) vuelve a ir a él (`FUN_0049C790`) |
| 0xF | **atontado** (cachiporra): bits `240|=0x2000`, `23C|=0x200000`, `24C|=0x20|0x400`, `250|=0x1000`, altura 5.0, anim `ATONTADO`, **600 ciclos** (`+0x48`), estrellitas | cuenta y vuelve a 8 |
| 0x10 | **esposado** (`HAS_SIDO_ESPOSADO`): bits `240|=0x1000`, `23C|=0x4000`, `250|=0x800`, anim `ESPOSAS1`, manda `ME_HAS_ESPOSADO` | espera la orden |
| 0x11 | **muerto** (`ARGG`) | |
Mensajes (`FUN_0049D520`): `IMPACTO` (voz `PRR0` y `PRR1–5`), `BUSCADOR_LLEGADA`/`PUNTOALCANZADO` → `+0x68=1`, `SUSTITUYE_BICHO` (cambia las referencias a contactos), `CACHIPORRAZO` → `+0x84=1` (estado 0xF), `PEDRADA` → 7 con el origen; `VISTA_ELEMENTOVISIBLE` (clase del visto): en 8/9/0xE aviso; en otros, un comando visible → 8 (va a avisar); un objeto con `240 & 0x800` (cajetilla) → 10 (va a cogerla); `TRIGGER_REACT("CHES")` → 3/4 (se esconde); `HAS_SIDO_ESPOSADO` → `+0x88=1`; `ARGG` → 0x11; `COLISION_DINAMICA` con un alemán ordinario no esposado ni atontado → `+0x5C=1`.

## 3. `AcTestigo` — el testigo de misión [hecho]
Ctor `FUN_004B3540` (estado `acc+0x28 = 3`). `MSGA_ACTIVAR_TESTIGO` → estado 0 (se pone **visible a la vista**: `FUN_00616140` + `FUN_005086E0(1)`, `+0x2C=1`); `MSGA_DESACTIVAR_TESTIGO` → estado 1 (se vuelve invisible a la vista: `+0x2C=0`); `MSGA_GET_ESTADO_TESTIGO` devuelve `+0x2C`. MAC `FUN_004B38E0`: `bicho+0x240 |= 0x400` (no cuenta para la IA normal pero la vista sí lo reporta con `MSGA_HE_VISTO_EL_TESTIGO`, `organos.md`) y empieza oculto. `MSGA_HE_VISTO_EL_TESTIGO(quién)` con el testigo activo y en reposo (estado 3) → guarda al observador (`+0x30`) y pasa a 2; el tick (`FUN_004B3940`) en estado 2 manda al mundo **`MSG_VISIONDINAMICA`** con el id del observador (lo consume la misión: "ser visto por" / "el testigo ha visto") y se desactiva (`FUN_004B38A0`). Estado 0 → asegura visible, 1 → asegura oculto; tras cada tick vuelve a 3.
**`ClassAcTiroAlBlanco`** (`0x4B3AD0…4B3E00`, mismo rango): soldado de entrenamiento del tutorial; claves `POSBLANCO [x y z]` (`+0x34`) y `POSMIRARIMPACTOS [x y z]` (`+0x40`); el valor `+0x58` = (suma de los caracteres del token) mod 10.

## 4. `AcSeguir` — seguir a otro bicho [hecho]
MAC `FUN_004AA300`: `TARGET` (nombre, 0x20 B, `+0x48`; resuelto por nombre `FUN_0064A660`, `+0x84`). Ctor `FUN_004AA940` (estado 0; `+0x2C = +0x30 = 20`; `+0x3C = 100.0` (`0x794CE8`, float) [hip: distancia de formación por defecto]). Estados `acc+0x28`: 0 parado, 1 **ir** (tick `FUN_004AA450`: `MOTOR_GOTO` al punto de formación detrás del líder y `MOTOR_SETVEL`; si la distancia al punto `> 2.6` (`0x79824C`) corre a esa distancia como velocidad con anim `CORRE`, si `> 2.4` (`0x798248`) anda a **2.5** (`0x793CE8`) con `ANDAR`; si no llega a 2.4, no pide velocidad), 2 (tras entrar en un habitáculo no `0x80`), 3 (parado cerca: `FUN_004AA710`, si la distancia ≤ 0 cambia a `REPOSO`), 5 (dentro del contenedor del líder). Mensajes (`FUN_004A9E90`): `LIDER_REPOS(desplazamiento)` del líder → guarda el vector `(+0x68..0x70)`, su ángulo `+0x40` (`atan2(x,y)`) y su módulo `+0x44`, estado 1; `MOTOR_PUNTOALCANZADO` (estado 1 y punto exacto) → 3; `ENTRADA_HABITACULO` → 2; `ARGG` → avisa al líder `LIDER_FOLLOWERDEAD`; `SUSTITUYE_BICHO` cambia la referencia. El punto de formación (`FUN_004AA3F0`) es `líder + dist·(sen, cos)(rumbo líder + 180° + ángulo)` (`0x793E68` = 180.0).
**`ClassAcSensorSonido`** (`0x4AABB0…4AAEF0`): MAC `EVENT` (5 caracteres → hash `FUN_0057F1C0`, `+0x28`); estado `+0x24` (ctor 2 = activo, `FUN_004AAFD0` lo cambia): si estando activo recibe `MSGA_SONIDO_PELIGRO` o `MSGA_SONIDO_PANICO` dispara el **evento de misión** `FUN_0059A2A0(0, hash, 0)`; `ARGG` lo apaga. **`ClassAcSerElectrocutado`** (`0x4AAFA0…`): sólo ctor/dtor y un setter (`+0x24`), sin lógica en el rango.

## 5. `AcEscoltado` — el preso que se deja llevar (pareja de `AcVigilante`) [hecho]
Es un `AcBuscador` (`FUN_00446E40` en el ctor) con estado propio (`acc+0x24`, ctor 0) y por debajo del `AcPatrulla` del mismo bicho. Mensajes (`FUN_0045BDB0`): **`PARATE(rumbo)`** (`+0x3C` rumbo, `+0x44 = 1`), **`CONTINUA_ANDANDO`** (`+0x44 = 2`), **`VETE_A_LA_CARCEL(cárcel)`** (`+0x44 = 3`, `+0x48` = cárcel), `COLISION_DINAMICA` con la cárcel (`+0x48`) → `+0x38 = 1` (entra). Estados (`FUN_0045C2C0(e)`; la orden `+0x44` se traduce en `FUN_0045C750`): 0 **sigue su ruta** (`PATRULLA_UNPAUSE`); 1 **parado mirando** (`MOTOR_PARAR` + `SETANG(rumbo)`); 2 **va a la cárcel** (`BUSCADOR_IRA` a la cárcel a vel. **2.0** `0x795740`; si no hay camino pasa a 5 al instante); 3 parado mirando (viniendo de 2); 4 **apresado**: `bicho+0x108 = 2` (parece aliado), `bicho+0x8E8 = 1`, se **quita `AcPatrulla` y `AcEscoltado`** (`MSG_QUITA_ACCION`); 5 **entrar** (`MSGA_ENTRAR_HABITACULO` en la cárcel, espera `+0x40` = 10); 6 **dentro** (`+0x108 = 2`, quita acciones). `PARATE` solo desde 0; `CONTINUA_ANDANDO` desde 1 → 0 y 3 → 2; `VETE_A_LA_CARCEL` desde cualquiera → 2. Si el bicho "no puede ser visto" (`FUN_00513530`: agachado/tumbado) pasa a 4. Tick `FUN_0045C9D0`: ejecuta el `AcBuscador`/`AcPatrulla` internos (`vtable+0x10`).

## 6. `AcOjoDistante` — vista remota [hecho]
MAC `FUN_004893D0`: `CONTROL` (nombre de un bicho, 0x20 B en `+0x2C`). Su único mensaje es `MSGA_VISTA_ELEMENTOVISIBLE`: lo **reenvía** al bicho `CONTROL` (resuelto por nombre y cacheado en `+0x28`; `FUN_005FE050(origen=id propio, destino=control, mensaje, datos…)`). O sea: un órgano de vista colocado en un sitio (cámara, torre, ventana) cuyo "lo vi" lo recibe otro bicho (típicamente un `AcBap`/`AcBunker` lejano). No lleva más lógica.

## Dudas abiertas
- Significado exacto de los eventos de misión `CHDB/CHDH/CHSH/CHSE/CHSC/CHNH` (`PresoChusma`): el código solo los dispara en transiciones (entrar al refugio, huir, morir, ocultarse); lo que hace cada uno lo decide `Misión/Intendencia` (fuera de este encargo).
- `AcSeguir`: el significado de `+0x3C` (100.0 en el ctor) es hipótesis; en el rango leído nadie lo lee.


## Cierre 2 (2026-10-29): eventos `CHxx` de `AcPresoChusma`
Resuelto leyendo `Intend04` (`0x5A89E0…0x5A9A00`) e `Intend09` (`0x5AB8E0…0x5AC530`). **No todas las claves son eventos [hecho]:**
- **Consultas** a la Intendencia (`mundo+0x13A4`, `vt+0x3C`, argumentos `(bicho, clave)`; la base devuelve 0): **`'CHDH'`** (`0x43484448`) devuelve un **punto fijo de la misión** (x,y,z) que el preso guarda en `+0xA8..0xB0` (estado 0) y usa como destino de huida (estado 6, o 9 tras 3 reintentos fallidos): `Intend04` da **(2733, −241, 0)** (`FUN_005A8FD0` escribe `+0x4840..48`), `Intend09` da **(965, −90, 0)** (`+0x4844..4C`). **`'CHDB'`** (`0x43484442`) devuelve, dado el preso, la **casa refugio más cercana** de `CASA_07..13` (lista `+0x48B4`, hasta 10); `Intend09` exige `bicho+0x23C & 4 == 0` (no destruida), `Intend04` filtra por `bicho+0x38 & 4` (sentido sin cerrar). El preso corre a su `MSGA_POS_SUBIDA` y entra (estado 0xB). `'CHBH'` está previsto en `Intend04` y devuelve 0.
- **Eventos** (`FUN_0059A2A0(0, hash, preso)` va al slot 1 de la Intendencia y de ahí `FUN_0059A530` los reparte a patrullas y escuchas): **`'CHSE'`** (`+0x34`, entrada al estado 6: el preso **escapa** tras `TRIGGER_REACT('CHES')`, `bicho+0x108 = 0`): `Intend04` suena `PRE1..4` (`0x50524531 + rand&3`, una vez cada 30 ciclos por `+0x4888`). **`'CHSH'`** (`+0x30`, entrada al estado 9: **corre al refugio**, `bicho+0x108 = 2`): `PRH1..3` (`rand%3`), mismo temporizador. **`'CHSC'`** (`+0x38`, estado 0xD: **ya oculto en el refugio**): `+0x4894++` (presos a salvo); **la victoria de M4 (slot 29, `FUN_005A9A00`) exige 9 y `MOCHILA_CONDUCTOR`/`MOCHILA_COMANDO` con `bicho+0x38 & 8 == 0`**; M9 también cuenta hasta 9. **`'CHNH'`** (`+0x3C`, estado 0xC: **muerto**): M4 pone `+0x4858 = 1` y `+0x4880 = 1` (fracaso, texto `CHPB`), M9 `+0x4850 = 1`. `'CHHI'` no lo emite el preso (M9 `+0x4840 = 1`, texto `CHHI`): otro fracaso.
- Sentido de las siglas (**[hip]**): CH = chusma/preso; `SE` = se escapa; `SH` = sale huyendo al refugio; `SC` = salvado/cobijado; `NH` = muerto (cuenta de bajas); `DB` = destino-base (casa); `DH` = destino-huida (punto).
- Quién dispara la huida: cada 5 ciclos la Intendencia revisa si algún guardia de `*_VIGILANTESPRISION` está en alarma (`FUN_005A96F0/97A0`, cuerpos sin leer) y emite una vez `TRIGGER_REACT('CHHU')` (huida, `+0x80`) o `'CHES'` (escapada, `+0x7C`). Cierra la primera "duda abierta".

## Cierre 3
- Filtro `bicho+0x38 & 4` de `CHDB` (Intend04): el refugio candidato debe estar **activo en la lista de choque (CHOC)**; ver `mision-intendencia.md` Cierre 3. Las clases de conductor con `bicho+0x190 == 5` quedan sin identificar (no afectan a las reglas leídas).
