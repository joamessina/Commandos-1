# Lectura del exe — `AcFusilador`, `AcGeneral`, `AcLider` (+ restos de `CAcMaquina`): `0x46AA70–0x46C200`, `0x46EE30–0x470000`, `0x478E60–0x479800`

**[hecho]** leído con dirección; **[hip]** marcado. `AcFusilador` y `AcGeneral` heredan de `AcBap` (ctor `FUN_00434840`; nombres `"AcFusilador"`, `"AcGENERAL"`); `AcLider` hereda de `ClassAccion`.

# A. `ClassAcFusilador` (pelotón de fusilamiento)

## A1. Parámetros del MAC (`FUN_0046AB10`) [hecho]
`REAC_ALARMA` (≤5 hashes, `+0x660`/`+0x664..`; llegada de `MSGA_TRIGGER_REACT` con ese hash) · `PRESO` (nombre del preso a fusilar → `+0x6D4`) · `MIJEFE` (nombre del jefe del pelotón → `+0x6D8`) · `SOYJEFE` (entero → `+0x6C4`; ≠0 = este soldado es el jefe). Precarga voces `KI01`, `KI02`, `KI03`. Ctor `FUN_0046B4A0`: `+0x6BC = 1` (pelotón activo; `FUN_0046C0F0` solo ejecuta su lógica propia si está en 1; si no usa el tick de `AcBap`).

## A2. Órdenes propias (tick `FUN_0046B5F0`, entrada `FUN_0046B9E0`, salida de `AcBap` salvo 0x20 `FUN_0046AF10`) [hecho]
`+0x6D0` = "dispara" (se pone con cualquier alarma) y `+0x6CC` = "el jefe dio la orden" (solo si `SOYJEFE`≠0). Al principio de cada tick, si el preso está a la vista y (`FUN_0050A5C0` > `0x7930D0` o la alerta > 2) → `+0x6D0 = 1`.
| Orden | Significado | Qué hace |
|---|---|---|
| 3 | arranque | resuelve `PRESO` y `MIJEFE`; sin preso, o sin jefe y sin ser jefe → pelotón desactivado (`+0x6BC=0`, `+0x6C0=0`, orden 0xE); si activo: orden **0x20** y manda `MSGA_SIGUES_DETENIDO` al preso |
| **0x20** | **guardia ante el preso** (esperando la orden) | apunta al preso (`FUN_0046B100`: `SETANG` + `FIJAR_VISTA` + `APUNTAR_AT`); cada ciclo `SIGUES_DETENIDO` al preso; si pierde de vista al preso (`+0x6C0==0`): voz `ALRM`, orden 0x22; si `+0x6D0` → **0x21**; si `+0x6CC` y sin cambio → **0x23** |
| **0x21** | **fusilar** | entrada: `FUN_005816F0`, apunta y manda `MSGA_DISPARAR_ON(preso)`, `bicho+...` custodia, `+0xC4=1`; si es jefe y aún no gritó, `KI03`; tick: si ve al preso vivo repite el apuntado, si no (muerto) → desactiva y orden 0xE |
| 0x22 | girarse hacia el preso | `+0x90 = 0xF`, `SETANG`; si recupera la vista → 0x21; al agotarse `+0x90` → desactiva y orden 0x1A |
| **0x23** | **ritual del jefe** | cada vez que `+0x90` llega a 0 llama `FUN_0046B3B0`: contador `+0x678`: 1 → voz `KI01`; 2 → `KI02` (pausa `+0x90=0x28`=40 ciclos); 3 → grito de peligro `KI03` (`FUN_00681B90(3,…)`, lo oyen los demás) y `+0x6C8=1` (pausa 5 ciclos); >3 → **0x21** (todos disparan). Entrada: `+0x90 = 0x32` (50). Cualquier `+0x6D0` pasa a 0x21 |
| 0x17 / 0x1B | esposado / atontado | si recupera: desnudo → orden 0x1A (huye a la alarma, ver `soldado-acbap.md`), si no → 0x22 |
Mensajes (`FUN_0046BC60`): `TRIGGER_REACT` (hash en `REAC_ALARMA`: sin ser jefe `+0x6D0 = 1`; jefe `+0x6CC = 1`); `FIN_ARRESTO` (`FUN_0046ADD0`: tipo 0 → orden 0x22; 1 → orden 0xE + `IMPACTO_SALVAJE`; 2 y 3 → `bicho+0x24C |= 0x4000`); `VISTA_ELEMENTOVISIBLE`: comando (clase 1) = el preso → `+0x6C0 = 1` (a la vista), otro comando con orden ≠ 3 → `+0x6D0`; clases 2-7, 0xE → `+0x6D0`; `PEDRADA`, `SONIDO_PANICO/PELIGRO`, `IMPACTO` → `+0x6D0 = 1`; `SUSTITUYE_BICHO`. Todo lo demás: `AcBap`. Mientras el pelotón está activo ignora los mensajes de `AcBap` hasta que el orden lo permita.

# B. `ClassAcGeneral` (oficial que huye) 

## B1. Parámetros del MAC (`FUN_0046F360`) [hecho]
`EVENTOS_DESACTIVADORES` (≤3 hashes → `+0x664/+0x668..`) · `EVENTOS_ACTIVADORES` (≤3 → `+0x660/+0x674..`) · `EV_HUIDA` (hash → `+0x680`) · `HUIRPOREXITPOINT` (entero → `+0x698`) · `EXITPOINTPREFIJADO` (x,y,z → `+0x684..0x68C`, `+0x69C=1`: punto de huida fijo en vez del punto de alarma más cercano). Después, MAC de `AcBap`. Ctor `FUN_0046FC80`.

## B2. Comportamiento [hecho]
- `TRIGGER_REACT(hash)` (`FUN_0046F8D0`): en `EVENTOS_DESACTIVADORES` → `+0x690=1` (el general se "apaga": orden **0x1F** salvo si está esposado 0x17 o en 0x10); en `EVENTOS_ACTIVADORES` → `+0x694=1` (en 0x1F vuelve a orden 4); hash `EV_HUIDA` → `bicho+0x24C &= ~0x100 & ~0x20000` y **`+0x6A0 = 1` ("alarmado/huyendo")**.
- Orden **0x1F** (entrada `FUN_0046F060`): `PATRULLA_UNPAUSE`, `MI_VISTA…(0)`, `DISPARAR_OFF`, `APUNTAR_OFF`, `VIGILAR_OFF`: no reacciona a nada.
- Tick (`FUN_0046F840`): orden 4 con `+0x6A0` y `HUIRPOREXITPOINT≠0` → orden **0x1A** (huir corriendo al punto de alarma/`EXITPOINT`).
- Estando alarmado (`+0x6A0`): solo evalúa la reacción de alarma (`vtable+0x58`) y la de sonido de pánico (`FUN_00433430`) en la cadena (`FUN_0046F2F0`); los sonidos de atención se tragan; `SONIDO_PANICO/PELIGRO` encienden `+0x6A0`. Al salir de la orden 0x14 se dispara el evento `EV_HUIDA` (`FUN_0046EFF0`). Con `EXITPOINTPREFIJADO` el punto de huida es el fijo (`FUN_0046F280/F2D0` reemplazan a `FUN_00431340/431370`).
- Ante peligro estando alarmado (`FUN_0046FB80`): si no hay línea de vista al sonido (`FUN_005F9820`) no reacciona; si la hay, orden 9 hacia el punto (25 ciclos) con alerta propia.
- `+0x6A0` también silencia las reacciones normales de `AcBap` (reacción `vtable+0x60/+0x68/+0x6C/+0x90/+0x94` reemplazadas por no-ops: `FUN_0046EE70/F260`).

# C. `ClassAcLider` (jefe de formación) (`0x478E60–0x479700`) [hecho]
- MAC: `FORMACION` = lista de N posiciones `XYZ` (stride 0x10 B: x,y,z + puntero al seguidor en `+0xC`).
- `MSGA_LIDER_GETPOSFOLLOW(seguidor)`: asigna al seguidor el primer hueco libre de la formación y le devuelve su posición (`FUN_00479210`).
- `MSGA_LIDER_FOLLOWERDEAD(seguidor)`: libera su hueco; si hay seguidores detrás, el siguiente avanza (`FUN_004791A0`: los huecos se compactan).
- `MSG_SUSTITUYE_BICHO` actualiza los punteros. El resto de la lógica de seguir está en el lado del seguidor (`AcSeguir`, no leído).

# D. `CAcMaquina` / `0x479700`
`FUN_00479700`: manda `MSGA_MAQUINA_NECESITA_SER_ATENDIDA` (con el id de la máquina) a su operador asignado (`acc+0x84`); lo recibe `AcBap2` (`soldado-acbap2.md`). Destructor `FUN_004797F0`.

## Dudas abiertas
- Efecto detallado de `FUN_005816F0` y de `FUN_0050A5C0` (usadas por `AcFusilador`): están en el motor de visión/simulación, fuera del rango asignado; no cambian las reglas descritas.
- `AcSeguir` (seguidor del `AcLider`) y `AcpAndar/AcpPatrullero/AcpSargento`: no leídos (ver índice en `flags-bicho.md`).
