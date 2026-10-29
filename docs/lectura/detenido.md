# Lectura del exe — `ClassAcDetenido` (el detenido que camina escoltado a la cárcel): `0x458920–0x459970`

**[hecho]** leído con dirección. Pareja de `AcVigilante` (`vigilar-vigilante.md`): el vigilante manda `MSGA_VETE_A_LA_CARCEL`, `CONTINUA_ANDANDO` y `PARATE` al preso; este es el receptor.

## 1. Composición [hecho]
Ctor `FUN_004589C0`: hereda de `ClassAccion`, y contiene dos sub-acciones construidas dentro: un **caminador** (`AcpAndar`, ctor `FUN_004C3010`, en `acc+0x5C`) y un **buscador de caminos** (`AcBuscador`, ctor `FUN_00446E40`, en `acc+0x180`). Todo mensaje que no maneja la acción se reenvía a los dos (`vtable+0x14`) al final de `FUN_00459970`. Tick (`FUN_00459560`): si activa, `FUN_00459310` y, salvo en estados 1 y 6, tica al caminador y al buscador (`vtable+0x10`); en estado 6 (dentro de la cárcel) y sin contenedor (`bicho+0x134 == 0`) vuelve al estado 1; `acc+0x18` cuenta ciclos.

## 2. Estados (`acc+0x28`, inicial 1) [hecho]
| Estado | Significado | Qué hace al entrar (`FUN_00458FB0(estado)`) |
|---|---|---|
| 0 | muerto / apagado (`MSGA_ARGG`) | |
| 1 | **libre**, parado | `MSGA_ANDAR_STOP` al caminador |
| 2 | **detenido**, esperando órdenes (tras `HAS_SIDO_DETENIDO`) | `MSGA_ANDAR_UNPAUSE` |
| 3 | **siguiendo** al vigilante | `MSGA_ANDAR_FOLLOW(elemento a seguir +0x30, nombre de anim "ANDAR")` |
| 4 | **yendo a la puerta de la cárcel** | pide `MSGA_POS_SUBIDA` a la cárcel (`+0x23C`) y `MSGA_ANDAR_IRA(punto)` al caminador, velocidad `0x795740 = 2.0`, anim `ANDAR`; si la cárcel no da punto → "preso escapado" |
| 5 | **entrando** a la cárcel | `MSGA_ANDAR_PAUSE`, `acc+0x18=0`, manda `MSGA_ENTRAR_HABITACULO(cárcel)` al bicho |
| 6 | **en la cárcel** | (ver `FUN_00459800`) |
`FUN_00458FB0` solo actúa si el estado cambia o si se fuerza.

## 3. Mensajes (`FUN_00459970`) [hecho]
Si el estado es 0 ignora todo (devuelve 0).
| Mensaje | Efecto |
|---|---|
| `MSGA_ARGG` | estado 0 (muerto); sigue al reenvío |
| `MSGA_HAS_SIDO_DETENIDO(guardia)` | `FUN_004595E0`: `+0x240 = guardia`, `+0x2C = 0`, `ANDAR_UNPAUSE`, estado 2 |
| `MSGA_SIGUES_DETENIDO` | `+0x2C = 0` (reinicia el contador de `FUN_00459310`) |
| `MSGA_ORDEN_MUEVETE(vigilante)` (solo en estado 2) | `FUN_004596B0`: si el emisor es de apariencia 2 toma su posición/sector (`emisor+0x38/+0x3C/+0x40`), velocidad **2.5** (`0x793CE8`) y estado 3 + `ANDAR_FOLLOW` |
| `MSGA_ORDEN_ENTRA_EN_CARCEL(cárcel)` (si no está libre) | `+0x23C = cárcel`, estado 4 |
| `MSGA_COLISION_DINAMICA` | en estado 4, si choca con la cárcel (`+0x23C`): estado 5 |
| `MSGA_ANDAR_IRA_ALCANZADO` | en estado 4: estado 5 |
| `MSGA_ENTRADA_HABITACULO` | si está libre (1) o sin guardia: `FUN_00459940` (si el contenedor es de tipo `0x100`, que es la cárcel, → `FUN_00459800`); si no `FUN_00459800` |
| `MSGA_ME_ESCAPO` | `FUN_00458E30`: avisa `MSGA_PRESO_ESCAPADO` al guardia y termina (`FUN_00458C30`) |
| `MSGA_ANDAR_BADFOLLOW` (no pudo seguir) | si no está libre: igual que escapar (`FUN_00458EF0`) |
Terminar (`FUN_00458C30`): manda `MSGA_REPORT_ENDDETENIDO` al guardia, para al caminador (`ANDAR_PAUSE`) y al buscador (`BUSCADOR_STOP`), `MSGO_MOTOR_PARAR`, fija custodia (`FUN_005086A0`) y pasa a estado 1.
En cárcel (`FUN_00459800`): `MSGA_REPORT_PRESO` al guardia y `MSGA_AUTOREPORT_PRESO` a sí mismo, custodia (`FUN_005086A0`), estado 6.
**Custodia** (`FUN_00459310`): según `bicho+0x194`: `2` (detenido): cuenta `+0x2C` hasta 10 y luego `FUN_005086A0` (re-fija `bicho+0x194`: `= 2` si el bicho no es aliado; si es aliado `= (vtable+8 != 2)`) y reinicia; `1` y sin `bicho+0x23C & 0x800000`: `FUN_00508660` (misma lógica). `bicho+0x194`: 0 normal · 1 libre · 2 detenido; lo leen las puertas de casa/cárcel (`obj-contenedores.md`: un detenido no abre la puerta).

## Dudas abiertas
- Ninguna sobre el receptor. El emisor de `MSGA_HAS_SIDO_DETENIDO` son las acciones de los policías/sargentos `AcpPatrullero` (`FUN_004CF6D0`) y `AcpSargento` (`FUN_004D9F20`), que **no se leyeron** en este informe (≈73 KB, rangos `0x4C3170–0x4DD700`); queda pendiente de una tanda aparte.
