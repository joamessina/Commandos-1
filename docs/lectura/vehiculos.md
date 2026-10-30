# Vehículos: acción del jugador y motores (exe)

**Actualización (2026-10-30):** [cierre-70.md §3](cierre-70.md#3-vehículos-pilotaje-daños-y-conductores) agrega Pilotaje (parser/tick/mensajes y reparto de impactos), CLancha/CTanque (objetivo y disparo), y TiroAlBlanco (entrenamiento, no pilotaje). Varada: `FUN_005EF940/005EFA00` seleccionan Sim por sector. Se consultó `FUN_006BB320`, todavía parcial. Quedan transiciones/selectores de conductores y contraste en juego: no están cerrados todos los vehículos.

Fuente: `0x502430–0x504300` (`ClassAUUsarVehiculo`), `0x5EE250–0x5F3400` (motores de vehículo), `0x5D6600–0x5DA440` (base `MotorAndante/Aliado`, ya en `q1-movimiento.md`). Leído con dirección; lo que no se leyó figura al final.

## 1. Acción `AUUsarVehiculo` (`FUN_00503160`, ctor; `acc+0x188` = estado)
- Estado inicial `0x12` (18) y `acc+0x18C = 0x1E` (30); `acc+0x1B0 = -1` (ítem activo), `+0x1B4` flag, `+0x1B8/0x1BC/0x1C0` destino pendiente, `+0x1DC` = vehículo (`bicho+0x134`, el contenedor en el que va).
- Script `VEHICULOS [ … ]` (`FUN_00502640`): lista qué clases de vehículo sabe conducir el bicho. Cada entrada fija un bit en `acc+0x19C`, un ítem de interfaz y un estado inicial: **`TIERRA`** bit 1 → ítem 2, estado `0x29` · **`AGUA`** bit 2 → ítem 4, estado `0x2A` · **`AIRE`** bit 4 → estado `0x2B` · **`BALSA`** bit 8 → ítem 4 · **`ARMA_ESTATICA`** bit `0x40` → ítem `0x10`.
- Tipo del vehículo conducido: `vehículo+0x248 & 3` (bit 1 tierra, bit 2 agua); la plantilla del vehículo (`vehículo+0x198`) trae `+0x14 & 2` (tiene cañón: el conductor anima **`CANONERO`**, vel 1, prio 6), `+0x14 & 1`, `+0x14 & 4`, `+0x10` (código de clase: `0x20` = ascensor/montacargas, `0x100`, …), `+0x18/+0x1C` (ítems de cursor para clic de punto / de elemento).
- **Mensajes de piloto** (la acción los envía al vehículo, `vehículo.vtable+0x50`): `MSGA_PILOTO_GOTOVEL` (velocidad objetivo, reenviada **cada ciclo** mientras haya orden; solo si el temporizador `FUN_0070B230 ≥ 0x79BABC`, si no cancela la orden), `MSGA_PILOTO_PARAR`, `MSGA_PILOTO_DISPARAPUNTO(punto)`; el vehículo avisa `MSGA_ENTRADA_HABITACULO`/`MSGA_SALIDA_HABITACULO`; `MSGO_ENTRAOSALE_DE_HABITACULO` refresca la Sim de la balsa.
- **Clic en el suelo** (`MSGA_ACTUASOBREPUNTO[DBLCLK]`, `FUN_005034A0`): si el bicho está dentro de un vehículo con plantilla, `acc+0x1D8` guarda el ítem de cursor (`plantilla+0x18` para un clic simple, `+0x1C` para doble); si el vehículo tiene cañón (`+0x14 & 2`) y el cursor está en modo disparo (`punto+0x30 == 1`) envía `PILOTO_DISPARAPUNTO`; si no, `acc+0x1D0..1D8 = punto` y `acc+0x1B8 = 1` ("ir allí": el siguiente ciclo envía `PILOTO_GOTOVEL`).
- **Clic derecho** (`MSG_BOTON2VIRTUAL`): `PILOTO_PARAR` y limpia órdenes.
- **Items activados** (`MSG_ITEM_ACTIVADO`, `FUN_00503f10`/`00502cb0`): `0xF` (activar equipo del vehículo; consume el ítem `0xF` si está en la mochila y `FUN_00514510(0x2A)` lo permite; con él se "baja" al conductor del vehículo al agua, `FUN_00678110/6780A0`), `0x11` (salir al agua / buzo: envía `MSGA_PILOTO_PARAR`, `MSGO_MOTOR_SETBUCEAR(0x81)` y `MSG_PON_A_BUCEAR`), `0x60` (ascensor: `MSGA_ACTIVA_ASCENSOR`), `-1` (nada).
- **Bajarse** (`FUN_00503340`): solo si la velocidad del vehículo (`MSGO_MOTOR_GETVEL`) es **< 0,01**; y para el buzo exige que no haya sector de agua bajo el vehículo (`FUN_00503030`: tipos 1 o 3).
- Cada ciclo (`FUN_00503F10`): si el bicho dejó de estar en el vehículo (`bicho+0x134 == 0`) la acción termina.

## 2. Parámetros de los motores de vehículo (script `ORGANOS … .MOTOR`)
Clase base `MotorVehiculo` (`FUN_005F1490` ctor; `FUN_005F1B30` lee los parámetros):
| Parámetro | Campo | Valores |
|---|---|---|
| `VELMAX` | `motor+0xAC` | velocidad máxima (unidades por ciclo) |
| (token en `0x7938B0`, tipo de sonido de motor) | `FUN_0067E4F0` | fourcc del sonido de motor |
| `CLASE` | `motor+0x8C` (y `+0x88 = 1`) | `ETEREO` 0 · `ANIMAL` 1 · `LIGERO` 2 · `MEDIANO` 3 · `PESADO` 4 · `CONSTRUCCION` 5 (clase de masa; `FUN_005737D0` se la pasa a la Sim) |
| `STDVEL` | `+0xAC` (en `MotorAndante`) | velocidad estándar si nadie manda `SETVEL` |
| `CAPGIRO [a b c]` | `Auto`/`Ciclo`: `+0xBC, +0xC0, +0xB8` | topes de giro de la dirección (3 números) |
| `ANGREV` | `Auto: +0xC4`, `Tanque: +0xBC` | ángulo a partir del cual el vehículo da marcha atrás en vez de girar |
| `MSGO_MOTOR_SETPRECISION n` | `+0x90 = n²` | radio² de llegada al destino |
Valores por defecto de los ctor: `Auto`: `+0xB8 = 10`, `+0xBC = 1.0`, `+0xC4 = 150°`; `Ciclo`: `+0xB8 = 10`, `+0xBC = 1.0`; `Lancha`/`Sub`: `+0x90 = 256` (`0x7A5870`); `Tanque`: `+0xBC = 150°`; base: `+0x90 = 64` (`0x7A52CC`) y `+0xAC = 5.0`.
Cada motor crea su **Sim** con la clase de masa: `Auto` `SimAuto` (`FUN_00665ED0`, 0xF4 B) · `Ciclo` idem · `Balsa` `SimBalsa` (`FUN_006676B0`) **y** un segundo Sim terrestre (`FUN_00669D30`, para cuando la balsa varó) · `Lancha` `SimLancha` (`FUN_00668E60`) · `Sub` `SimSub` (`FUN_0066E110`) · `Tanque` `SimTanque` (`FUN_0066EAB0`, clase 4). Y un parachoques duro por clase (`ParachoquesDuro*`, ver `parachoques.md`).
Comportamiento común (`FUN_005F17C0`, por ciclo): si hay orden (`+0x98`), llega cuando `dist² < VELMAX_actual² + tolerancia`, calcula el giro objetivo (`atan2` en grados, normalizado a (−180, 180]) y llama a la maniobra propia (vtable `+0x80`: `FUN_005EEED0` Auto, `FUN_005F00E0` Balsa, `FUN_005F09B0` Ciclo, `FUN_005F21D0` Lancha, `FUN_005F30B0` Tanque, `FUN_005F28D0` Sub); si no se acerca avisa `MSGA_MOTOR_DESTINOINALCANZABLE`.
Maniobras: **Auto/Ciclo**: pasa el giro `φ` (con marcha atrás: `φ+180°`) y velocidad `±v` al Sim (`FUN_00666060`) con `cos/sin` de `φ`; hay que girar si `|Δ| > ANGREV (Auto)` y el destino está a más de `0.25·r²`. **Tanque**: `Sim.avanzar(v−k, v+k)` con `k = r·f(φ)·0.5` = giro diferencial de orugas (`FUN_0066E720`). **Lancha**: igual con timón (`FUN_00668A00`). **Sub**: avanza/gira (`FUN_0066DCA0`) y gira antes de avanzar si `|Δ| > 0.5`.
`MotorRail` (`FUN_005EEA80`): carril; `MSGO_MOTOR_SETRAIL` fija un segmento `p0→p1` y una fracción (`0x797C08`); avanza por proyección sobre el segmento y avisa `MSGA_MOTOR_PUNTOALCANZADO` al llegar (±1.0).

## 3. Sin leer (con motivo)
La dinámica de los `Sim*` de vehículo (`SimAuto`, `SimTanque`, `SimLancha`, `SimBalsa`, `SimSub`, `SimAve`, `SimMisil`), en `0x660000–0x66C000` (35 KB; volcado a mano en la sesión pero no analizado). **Ningún vehículo es jugable en el port todavía**; se leerá cuando se porte el primero (la maniobra de cada motor de §2 ya dice qué datos le entrega a su Sim: velocidad firmada, giro y, en el tanque, orugas diferenciales).


## Cierre 2 (2026-10-29): la dinámica de los `Sim*` ya está leída
Ver **`docs/lectura/sim-vehiculos.md`** (integrador, `SimAutoOrg`, `SimTanque`, `SimLancha`, `SimBalsa`, `SimSub`, `SimRail`, `SimAve`, `SimMisil`, constantes y datos reales). Lo que se cerró:
- El motor pide cada ciclo un impulso `n` (velocidad constante `VELMAX` hacia el destino en mundo + ángulo de error `Δ`); el Sim lo filtra. Auto: `v = 0,3·n + 0,7·vprev`, giro `min(c=10, a=1,0·|v|)` °/ciclo y deslizamiento lateral ≤ 1 (radio de giro 57,3 u). Tanque/Balsa: `avanzar(v−R·Δ, v+R·Δ)` con `ω = (b−a)/(2R)` y fricción 0,5/0,8. Lancha: timón (±50°, 22,5°/ciclo) y filtro 0,1. Rail: proyección sobre el segmento con `INERCIAS`.
- **Corrección a §2**: la marcha atrás se decide **una sola vez** en `GoTo` (`vt+0x7C`), no cada ciclo, y `ANGREV` vale siempre **150°** (ninguna instancia define `$AngMarchaAtras`). `CAPGIRO [a b c]`: `a` = factor giro/velocidad (def. 1,0), `b` = velocidad mínima para girar (def. 0), `c` = giro máximo °/ciclo (def. 10); ningún dato lo trae. `GIROMAX`, `ACBASE` y `SOBREAGUA` de los `.MAC` **no existen en el exe**.
- **Corrección a §2 (Sim por motor)**: `SimAuto` (`FUN_00665A70`) es código muerto; Auto/Ciclo usan **`SimAutoOrg`** (`FUN_00665ED0`). `SimSeguidor` también está muerto. La Balsa lleva un `SimObjeto` terrestre para cuando varó. `MotorSub` y `MotorCiclo` no aparecen en ningún dato.
- §3 ("Sin leer") queda reemplazado por `sim-vehiculos.md`. Solo queda pendiente `FUN_006BB320` (zona permitida del vehículo del jugador).
