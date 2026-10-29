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
`+0x28` (80/100/200) y `+0x2C` (1/10/20/60) son enteros por arma cuyo significado exacto no está leído (**[hip]**: dispersión/ruido y recarga). `+0x70..+0x80`: banderas (arrojadiza, con retardo, etc.). `+0x38 (0x8143F8)`/`+0x2C` alimentan la munición (`FUN_004EFE90`: el contador se muestra como `munición / +0x78`).

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
