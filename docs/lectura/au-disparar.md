# Lectura del exe — AUDisparar (disparo del jugador) `0x4EFE00–0x4F2C00` (tanda 20261029-002949)

**[hecho]** leído con dirección. Tabla de armas del jugador volcada con `/tmp/weapons.py` (guardada abajo).

## Tabla de armas `0x8143C0` (9 entradas de 0xA8 B; `FUN_004EF880(nombre)` y `FUN_004EF910(id)` la consultan) [hecho]
| id | nombre (+4) | animación (+0x50) | alcance (+0x24, float) | +0x28 | +0x2C | +0x7C | notas |
|---|---|---|---|---|---|---|---|
| 1 | PISTOLA | DISPARAPISTOLA | **300** | 80 | 1 | 1 | sonido `DISPAROPISTOLA`; flag +0x74 |
| 2 | MIRILLA (rifle del francotirador) | DISPARARIFLE | **1000** | 100 | 10 | 15 | |
| 3 | METRALLETA | DISPARAMETRALLETA | **400** | 100 | 10 | 37 | sonido `DISPAROMETRALLETA` |
| 4 | BALLESTA | DISPARABALLESTA | **800** | 100 | 10 | 32 | (el “200” del informe viejo es el ARPÓN, no la ballesta: **discrepancia R9 resuelta**) |
| 5 | GRANADA | LANZAGRANADA | **300** | 200 | 1 | 7 | arma arrojadiza (flag +0x70) |
| 6 | ARPON | DISPARAARPON | **200** | 100 | 60 | 85 | submarinista |
| 7 | PIEDRA | LANZARPIEDRA | **300** | 200 | 20 | 8 | arrojadiza |
| 8 | ESCOPETA | DISPARARIFLE | **600** | 80 | 20 | 36 | |
| 9 | (terminador) | | | | | | |
**Columnas cerradas (2026-10-29, buscando todos los accesos al rango `0x8143C0…0x814470` con paso 0xA8 en las 37 026 funciones):** las únicas columnas que el código lee son `+4` nombre · **`+0x2C` = enfriamiento en ciclos tras disparar** (`reloj + valor`: 1 pistola/granada, 10 rifle/metralleta/ballesta, 20 escopeta/piedra, 60 arpón; la interfaz puede reescribirlo, `FUN_004F07E0`) · `+0x30` animación de desenfundar (`DESENFUNDAPISTOLA/RIFLE/METRALLETA/BALLESTA/ARPON`; granada y piedra no tienen) · `+0x50` animación de disparo · **`+0x70` = arrojadiza con retardo de animación** (granada, piedra: pasan al estado 3 y tiran al llegar el cuadro; el resto dispara de inmediato) · **`+0x78` = munición que gasta cada disparo** (1; **metralleta 5**) · `+0x7C` = id de ítem del interfaz (1, 15, 37, 32, 7, 85, 8, 36; `FUN_004EF910` traduce el ítem a arma, con alias 3→1, 0x62→1, 0x26→0x25, 0x27→0x24). **`+0x24` (alcance) y `+0x28` (80/100/200) no los lee ningún código**: el alcance real está **fijo dentro de la rutina de cada arma** (pistola `300` = `0x798C0C`, metralleta `0x79BFD8`, ballesta/arpón `0x794CF8`, escopeta `0x797164`, rifle `0x7A1DAC` menos un ajuste por zoom `0x7AD060 − zoom`), que coincide con la columna `+0x24`; `+0x28` es un dato sin consumidor (editor o resto de desarrollo): no afecta al juego. Disparo: raycast de `FUN_006771A0` (línea de visión por sectores `FUN_005F9820` + obstáculos `FUN_0063E820`, y búsqueda del primer cuerpo impactado `FUN_00677010`→`FUN_00574C60`/`FUN_006BB660` con el callback `FUN_00675AB0` que elige el cuerpo vivo más cercano a lo largo del rayo).

## Munición y arranque (`FUN_004EFF40`, desde el MAC) [hecho]
Claves del MAC de la acción: `ARMAS [ … ]` (qué armas lleva, marca `+0x98 + id·4 = 1`), `MUNPISTOLA`, `MUNMIRILLA`, `MUNMETRA`, `FLECHAS` (ballesta), `GRANADAS` (al leerlas registra el ítem `GRAN`), `PIEDRAS` (si hay piedras registra el sonido `CAEPIED`), `MUNARPON`, `MUNESCOPETA`. La munición actual de cada arma está en `acción + 0x48 + id·4`.

## Máquina de estados (`FUN_004F1A50`, uno por ciclo; estado en `+0x28`, arma en `+0x30`, blanco `+0x1F4/…`) [hecho]
- **Enfriamiento** `+0x150`: si > 0 resta 1 y no hace nada más.
- **Estado 1 (listo)**: si el arma elegida tiene munición 0 → termina la acción.
- **Estado 2 (apuntar)**: gira hacia el blanco; sale cuando el rumbo está a menos de `±DAT_00795F50` (≈ el ancho de tolerancia) o se agota un contador de intentos `+0x13C`; exige `acción[+0xEC + id·4] ≤ reloj` (**enfriamiento por arma**: `ahora + tabla[+0x2C…]` = `0x8143EC`) y que el despachador de disparo (`FUN_004F05B0`) acepte; si pasa: sonido de arma (`DISPAROPISTOLA` o `DISPAROMETRALLETA` para 1 y 3), anima el disparo (`tabla+0x50`, velocidad 1.0, modo 6) y toma el retardo del motor (`bicho+0x8CC`); si el arma no tiene retardo de animación dispara ya (`FUN_004F1680`) y termina; si lo tiene pasa al estado 3. Si el blanco se pierde (estado 2 sin condiciones) termina.
- **Estado 3 (animación de disparo)**: cuenta `+0x13C` hasta 0, entonces dispara (`FUN_004F1680(blanco)`), vuelve a la pose normal y termina.
- **Estado 4 (recarga/lanzar)**: espera a que la animación llegue al cuadro de disparo (`FUN_00675A30`), pone `bicho+0x8A4 = 4`, y descuenta una unidad de munición; al llegar a 0 quita el ítem (`FUN_00513210`).
- **Efecto del disparo** (`FUN_004F1680(estado)`): según el arma elegida llama a `FUN_00677FE0/678110/6782C0/678240/675F70/6781C0/675FE0/678060…` (una rutina de proyectil/impacto por arma; no leídas), descuenta munición **`tabla[+0x78]`** por disparo (salvo trampa `DAT_00840140`), y arma el enfriamiento `reloj + tabla[+0x2C]`. Casos 9 y 10: arrojadizas (granada/piedra): `FUN_00676F20(objeto, 0x794790 = 20.0, tabla[+0x78])` o `FUN_00676B20`, y quitan 1 de munición.
- **Despachador** `FUN_004F05B0(id, blanco, x, y, z)`: arma debe estar en `+0x98` y con munición > 0; la rutina por arma recibe el blanco (elemento) o el punto del suelo (`param_3 == 0` → punto en la pila).
- **Mensajes** (`FUN_004F11D0`): `ACTUASOBREELEMENTO`/`…PUNTO` (y DBLCLK) → apuntar al elemento o al punto (`FUN_004F0C70/0E50`, que elige la animación de apuntado según el arma: casos 1→1/2, 2→3/4, 3→9/10, 4→5/6, 5→0xB, 6→7/8, 7→0xC, 8→0xE/0xD); `MSGA_RECARGA_ARMA` (suma las balas del cargador recogido al arma `+0x48` y vacía el cargador), `MSGA_RECOGE_ARMA` (si no tenía el arma la agrega con la munición del arma recogida y la marca recogida), `MSG_INTERCAMBIO_ITEM` y `MSG_SUSTITUYE_BICHO`.

## AUEmpujar (`FUN_004F2480`) [hecho]
Estados `+0x188`: 2 camina al **punto de empuje** del objeto (`AcPuntoEmpuje`, tipo 8: `blanco+0x190 == 8`) con tolerancia `DAT_00795658 (15)`; 3 gira (`MSGO_MOTOR_SETANG`) hasta quedar a < `DAT_0079AE98` del ángulo; 4 camina el último tramo; 5 anima `EMPUJAR` y cada ciclo manda `MSGA_ERES_EMPUJADO` al objeto mientras el objeto no esté muerto y se haya desplazado ≤ `radio² + DAT_00796388`; máximo **26 reintentos** (`+0x1A8`). Marca `bicho+0x24C |= 0x2000` al crearse.

## Cierre: `RETARDOPISTOLA` (2026-10-29)
`FUN_004F07E0` pisa el enfriamiento de la pistola (`tabla+0x2C`) con `cfg+0x60` **solo si ≠ −1**. `cfg+0x60` lo escribe únicamente el lector de `COMANDO.CFG` (`FUN_0061EBC0`, clave `.RETARDOPISTOLA`) y el `Comando.cfg` real instalado (`OUTPUT\Comando.cfg`: `.SONIDO`, `.SIZE`, `.PROFILE`, `.DEVELOP`, …) **no la trae**; el test `!= -1` implica que el valor inicial del ctor de la configuración es −1 (el ctor no se localizó por desensamblado). Efecto: **la pistola usa el enfriamiento de la tabla (10 ciclos)**; solo un `Comando.cfg` editado a mano lo cambiaría.

## Cierre: `FUN_00676F20 / 00676B20` (2026-10-29)
No son la lógica de la ráfaga de la metralleta: son el **efecto visual del fogonazo** (objeto `ClassEfectoFogonazo`-like): colocan el efecto en la posición del bicho que dispara (`bicho+0x58` = altura del arma, offset del cuerpo `motor+0x1C..0x24`), le fijan el ángulo (`sin/cos` del rumbo) y lo encienden (`FUN_006819A0`, `FUN_00680D50(1)`). La cadencia y el consumo de la metralleta del jugador están en `AUDisparar` (tabla de armas: enfriamiento 1 ciclo, 5 de munición por disparo) y el daño en `impactos.md`.

## Cierre: la granada (2026-10-29)
- **No hay vuelo ni mecha**: `FUN_006761B0` crea el objeto `GRANADA` directamente **en el punto de destino** (`MotorObjeto` `.EXPLOTA 1 .FIJO 1 .NOCAE 1` + acción `AcGranada .CARISMA 200`), lo registra en su sector y silencia su física (`MSGO_MOTOR_BORRAFISICA`). El único retardo es el de la animación de lanzamiento del soldado (columna `+0x70` de la tabla de armas).
- **`AcGranada`** (`FUN_0046FEC0`, update; ctor `FUN_004700A0`; la fábrica de acciones (zona `0x64xxxx`) lo construye con `(150, 200, 2000)`: `+0x48 = 150`, `+0x30 = 200`, `+0x28 = 2000`): en su **primer ciclo** fija el sector, emite el sonido `'GRAN'` (cat. 3, 0,75) y aplica `FUN_00571FE0(origen, tipo 2 = EXPLOSIONMENOR, radio 200, potencia 2000)`: a todos los objetos en el radio con línea de vista les llega `MSGA_IMPACTO {tipo 2, 2000}` **sin decaer con la distancia** (`armas-danio.md` §7). Después cuenta ciclos y a `max(10, acc+0x74)` se destruye (`mensaje 5` al dueño). Efecto visual `EXPLOS1`/`EXPLOSION1`, cilindro de choque del objeto con radio = 200 (`FUN_00507E80(200, 10)`).
- Por tanto una granada mata (2000 ≫ 100) a todo lo que esté a ≤ 200 u con línea de vista, y destruye lo que declare `.EXPLOSIONMENOR` (cañón, vehículos con ese contador).
- La piedra (`AcPiedra`) es análoga: objeto en el destino, `MSGA_PEDRADA` al llegar (aturde sin daño, `muerte.md`).
`MotorObjeto` (objetos con física: barril rodando, cuerpos): `SimObjeto` (`FUN_00669D30`, 0xC4 B) con paso máximo² `1000²`, giro máximo 45°, **fricción 0,6** por ciclo en el suelo (`+0xAC`; `FUN_00669B50` multiplica x,y y anula z cuando `+0xB4` = apoyado, apoyado ⇔ `z ≤ z_plano + 1`), velocidad inicial por `MSGO_MOTOR_SETVELVEC(vx,vy,vz)` y cuenta atrás `MSGO_MOTOR_EXPLOTAR(n, k)`.
