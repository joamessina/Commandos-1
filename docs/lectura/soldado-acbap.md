# Lectura del exe — Cerebro del soldado `ClassAcBap` (+ `AcBap1/2`, `AcBanpe1/2`): `0x42F4A0–0x438A40`, 138 funciones (33 KB)

**[hecho]** = leído con dirección (tandas 20261029-004711 y -004752). **[hip]** = inferido por mensajes/flags. `bicho` = el soldado; `acc` = esta acción. `AcBap1`, `AcBap2` y `AcBanpe1/2` heredan la misma tabla virtual (`AcBap2` reemplaza 17 virtuales: `0x43A0E0…0x43C7F0`, **NO LEÍDOS aún**: es el soldado que dispara/persigue con más lógica). Las funciones de serialización (guardar/cargar partida: `FUN_0042F530…0042FE20`) no tienen lógica de juego.

## Parámetros del MAC (`FUN_00431530`) [hecho]
`GESTAPO` (`+0x178`: es de la Gestapo; reacciona a la insignia/uniforme `0x80000000` del aliado, `FUN_004347E0`) · `DELANTEMURO` (`+0xB8`) · **`NERVIOSISMO`** (`+0x44`, mínimo 1; ver abajo) · `VOLVERORIGEN` (`+0x164 = 1` → vuelve a su puesto) · `COMPANERO`/`PAREJA` (nombres de otros bichos, `+0x1E0/+0x200`; charlan) · `TIEMPOMIRANDOCOMPA` (`+0x80`) · `TIEMPOENTREMIRADAS` (`+0x84`) · `ZONAPERMITIDA` (`+0x18C`, nombre de sector/zona; `+0xA8 = 1`; máscara de 160 bits en `+0x550`) · `TENGOTABACO` (pone `bicho+0x23C |= 0x10000`: fumador) · `EV_EXITPOINT` (`+0x30`, punto de salida de una alarma) · `VELVOLVERPATRULLA` (`+0x240`). Fija la máscara de vista `MSGO_VISTA_SETVIS` con `0x240 | 0x1F9BD`, precarga 11 voces (fourcc `ALOT`, `ALRM`, `QIEN`, `VMUE`, `VESP`, `CAFU`, `AL01`, `AL02`, `AL07`, `AL08`, `AL12`, y `GPSE`, `APOE` si es Gestapo) y activa `bicho+0x23C |= 0x200` (“ve”).

## Nervios y velocidad [hecho]
`bicho+0x118` = contador de **alerta** (en ciclos). Al recibir un impacto o una pedrada se pone a **`NERVIOSISMO × 20`**; mientras es ≥ `NERVIOSISMO` el soldado se considera “nervioso”. Cada cambio manda `MSGA_PATRULLA_SETVEL` (`FUN_004323C0`): al calmarse vuelve a `MSGA_PATRULLA_VELNORMAL` (`FUN_004305B0`) y al ponerse nervioso fija `DAT_00793CE8` (= 2.5, andar). Cada ciclo `FUN_00434160` descuenta 1 de los temporizadores de reacción (`+0x38`, `+0x3C`, `+0x40` de la acción).

## Máquina de estados (`acc+0x24`) y nivel de alerta (`acc+0x54`, 0…0xF) [hecho]
`FUN_00430670(orden, tiempo, datos)` cambia de orden: llama a la salida del orden viejo (`vtable+0x38` = `FUN_00436770`) y a la entrada del nuevo (`vtable+0x34` = `FUN_00438A40`) hasta que el orden se estabiliza. El tick es `FUN_00435060` (vtable `+0x30`), llamado desde `FUN_00434160` (que antes corre la cadena de reacciones). `acc+0x90` es el temporizador del orden.

| Orden | Significado [hip por mensajes y animaciones] | Entrada (`FUN_00438A40`) | Tick (`FUN_00435060`) |
|---|---|---|---|
| 3 | arranque | | llama `vtable+0x40` (`FUN_00434250`: resuelve COMPANERO/PAREJA por nombre, guarda posición/rumbo de puesto, cuenta soldados, reproduce voces `AL10/AL04/AL03`) y pasa al **4** |
| **4** | **patrulla / puesto normal** | alerta=0, `VIGILAR_ON`, `VISTA_ZOOMOUT`, `REACTIVAR_ACCION_SECUNDARIA`, `PATRULLA_UNPAUSE` | charla con compañero (`FUN_00432310`), **fumar**: si es fumador y vence `+0x78` → orden 5 |
| 5 | **fumar** | anim `FUMAR`, `+0x78 = 500`, `LOOKSCAN_FACTOR 50` | cuenta `+0x78`; al llegar a 0 vuelve |
| 6 | **mirar/investigar un punto** | `+0x88 = TIEMPOMIRANDO…`, `VIGILAR_OFF`, gira hacia el punto, `VISTA_ZOOMIN` | cada 10 ciclos traza línea de vista y re-apunta |
| 7 | **volver a mirar tras una alerta** | `FUN_004346F0`, `+0x90 = 5` | cuenta 5 y re-apunta |
| **8** | **sospecha / apuntar al objetivo visto** | `VISTA_CLEARVIS`, `APUNTAR_AT`, `+0x90 = 0x28`; si `bicho+0x118 < NERVIOSISMO` suena `CAFU` | cada 0x28 repite voz/aviso (`HAS_SIDO_DESCUBIERTO`, `MSGA_ALTO` a los vistos) |
| 9 / 0xA | **ir a un punto** (`BUSCADOR_IRA`, `FUN_004364A0`) | `+0x90 = tiempo (o +0x48 = 100)`, `VIGILAR_ON` | `vtable+0x48` (reacciones); al llegar y vencer el tiempo pasa al siguiente |
| 0xC | ir a un punto **mirando a otro** | `FIJAR_VISTA`, `SETANGCABEZA` | igual que 9 |
| 0xD | **charla con el compañero** | mira a `+0x370`, 10 ciclos (100 si Gestapo) | termina a los 10 o si deja de verse; manda `NO_AGUANTO_CHARLA` |
| 0xE | **mirar alrededor** | `+0x64 = 0`, `+0x90 = 0x1E` | gira `SETANG` hasta 4 veces (cada 0x1E ciclos) y vuelve |
| 0x11 | **perseguir / disparar al objetivo** | `DISPARAR_ON(blanco)` y apunta | cada `+0x94` actualiza el apuntado |
| 0x12 | **disparar a una posición** (`DISPARAR_SIN_OBJETIVO`) | apunta a `+0x98`, `+0x90 = 10` | al acabar vuelve al 4 y emite `QIEN` |
| 0x13 | **volverse hacia el objetivo** | gira hacia él | espera `+0x90`; luego repite `APUNTAR_AT` |
| 0x14 | **volver al puesto** (`VELVOLVERPATRULLA`) | alerta=0; si está lejos de su origen va con `BUSCADOR_IRA` | llegó → 4; si no llega → 0x1A |
| 0x15 | **muerto** (`MSGA_ARGG`) | visión apagada (`0x23C &= ~0x200`) | |
| 0x16 | impacto salvaje (reinicia la animación) | | |
| 0x17 | **esposado/detenido** | `0x240\|=0x1000`, `0x23C\|=0x4000`, anim `ESPOSAS1-3` (o `_DESNUDO`), avisa `ME_HAS_ESPOSADO` | espera `FIN_ARRESTO` |
| 0x19 | inactivo | | no se actualiza |
| **0x1A** | **huir corriendo al punto de alarma** (corrección 2026-10-29: antes figuraba como "desnudo esperando") | alerta=0; limpia `bicho+0x24C` bits `0x100` y `0x20000`; si está desnudo (`23C&0x400000`) quita selección y `+0x90=200`; `FUN_004389E0`: si hay punto de alarma (`vtable+0xA8` = `FUN_00431340` → `FUN_0059D8B0`, ver `guarda.md` §3) `BUSCADOR_IRA` a esa posición (`+0x2E4`) a velocidad **4.0** (corre); si no hay, `+0x138=+0x13C=1` | si está desnudo cada 200 ciclos grita `ALRM` (`FUN_00430C40`); si el punto de alarma se desactivó (`vtable+0xAC` = `FUN_00431370`: `mundo[+0xBE0+idx·0x18]`) o llegó → orden 0xE (mirar alrededor). `FUN_00431390` dispara el evento de misión `EV_EXITPOINT` (`acc+0x30`, parámetro del MAC) |
| **0x1B** | **atontado** (cachiporra / `CACHIPORRAZO`) | `0x23C\|=0x200000`, anim `ATONTADO(_DESNUDO)`, **`+0x90 = 600` ciclos (30 s)** | se levanta al terminar (o antes si recibe otro estímulo pasados 15 ciclos) |
| 0x1C | fin: limpia órganos | | |

Animaciones (`FUN_00436140` ↔ `acc+0x58`): 0 `ANDAR` · 1 `CORRE` · 2 `FUMAR` · 3 `ESPOSAS1-3` · 4 `RECOGER` · 5 `ATONTADO` · 6 `ATONTADO_ESTATICO` · 7 `ATONTADO_DESNUDO` · 8 `ATONTADO_DESNUDO_ESTATICO` · 9 `ESPOSAS_DESNUDO` · 0xA `CORRER_DESNUDO` · 0xB `ANDA_DESNUDO`. `FUN_00436380` elige andar/correr según la velocidad pedida (`> 0x793F74` → `CORRE`).

## Cadena de reacciones (`FUN_004345F0`, el primero que responde 1 gana; es `vtable+0x48`) [hecho la estructura]
Orden de evaluación: `+0x58` (`FUN_00433090`: investiga una **alarma**, alerta=0xF, orden 7, voz `AL10`) → `+0x60` (`FUN_00430F70`) → `FUN_00433190` (pregunta al objetivo `DONDE_ESTA_TU_OBJETIVO` y lo sigue, alerta 0xD) → `FUN_00433430` (**sonido de peligro/pánico**, alerta 0xC) → `+0x54` (`FUN_00433B80`: alerta 0xB) → `+0x4C` (`FUN_00433910`: alerta 10, orden 9, `SET_ANGULO_BARRIDO`) → `FUN_00430F80` (alerta 9) → `+0x50` (`FUN_00433A40`: alerta 8) → `+0x78` → `FUN_00433660` (sonido de atención, alerta 6) → `+0x64` (`FUN_00431210`: alerta 5, orden 0x13) → `+0x6C` (`FUN_00431280`: alerta 4, orden 0xD) → `FUN_00430FD0` (alerta 3) → `+0x74`. A mayor alerta, más prioridad.

## Qué ve el soldado: clasificación `FUN_006AFC10(elemento)` → código 0…0xF [hecho]
Por la **apariencia** del visto (`+0x108`: 0 objeto, 1 alemán, 2 aliado) y sus banderas (`+0x23C`, `+0x240`):
- **aliado** (2): vivo → **1**; muerto (`0x23C & 4`) → **2**; oculto (`0x240 & 8`) dentro de habitáculo → **6**.
- **alemán** (1): con `0x240 & 8` no cuenta; `0x240 & 0x200` → **0xE**; muerto → **2**; esposado/inmovilizado (`0x23C & 0x4000`) → **3**; `0x240 & 0x2000` → **5**; si no, **0xF** (soldado normal) o **4** si lleva `0x240 & 0x8000` (desnudo).
- **objeto** (0): `0x240 & 1` → **8** (o **9** si `FUN_00441EA0`); habitáculo (`0x100`) con algún aliado dentro → **7**; `0x80` → **0xA**; `0x800` → **0xB**; `0x4000` → **0xD**; `0x10000` → **0xC**.

Reacción en `FUN_004370D0` (`VISTA_ELEMENTOVISIBLE`): **1** → `FUN_00432C20(elem,0,0)` (ve un comando: anota su posición, sube `bicho+0x118`, lo agrega a la lista de objetivos `+0x350`) · **2** (primera vez) → `FUN_004326B0` (ve un cuerpo: lo anota, `VISTA_ZOOMIN` hacia él) · **3** → `FUN_004329C0` (compañero inmovilizado) · **4/5** → `FUN_004326B0` · **6** → `FUN_00432C20(elem,1,0)` · **7** → anota la casa (`+0x44`) · **9** → `FUN_004308C0` · **0xA** → `FUN_00432B70` · **0xB** → `FUN_00434460` (`MSGA_PUEDO_IR_A_COGERTE`) · **0xC** → `FUN_00432830` · **0xD** → `FUN_00432F60` · **0xE** → anota objetivo si `+0x40 < 1` · **0xF** → `FUN_00432C20(elem,0,1)` si es compañero que alerta (o Gestapo ve insignia).

## Mensajes que maneja (`FUN_004370D0`) [hecho]
`MOTOR_CRISIS`/`DESTINOINALCANZABLE` (marca que no llegó) · `BUSCADOR_CRISIS_POR_SABOTAJE_EN_SECTOR` · `COLISION_DINAMICA` (choca con un vivo no alemán) · `VISTA_ELEMENTOVISIBLE` · `HAS_SIDO_ESPOSADO` · `ENTRAS/SALES_DE_ESCALERA` · `INICIO_ARRESTO`/`FIN_ARRESTO` (guarda y restaura `bicho+0x24C`) · `ARRESTADO_MUERTO` · `SALIDA_HABITACULO` · `ACCION_SECUNDARIA_ACTIVA/INACTIVA` · **`SONIDO_PANICO`/`SONIDO_PELIGRO`** (si no está ocupado y el sonido está más cerca que el anterior: guarda posición y emisor; si el emisor está entre las voces/armas clasificadas por `FUN_00430980` —fourcc `PIPA, LFUS, MET0, MET1, METL, METT, ALRM, QUIE, VMUE, ALOT, KATA, LDAL, VESP, URGV, URGA, AVVE, AVAT, AL02, AL10, ZO01, ZO02, AL12`— fija quién debe responder) · **`SONIDO_ATENCION`** · `ECHAR_CHARLA` / `PUTA_ECHAR_CHARLA` · `DONDE_ESTA_TU_OBJETIVO` (responde la posición del blanco según el orden) · **`IMPACTO`** (`bicho+0x118 = NERVIOSISMO × 20`) · `IMPACTO_SALVAJE` · **`PEDRADA`** · **`CACHIPORRAZO`** (→ orden 0x1B) · `ESTAS_DESNUDO` (flags `0x23C |= 0x400000`, animaciones `_DESNUDO`) · `BUSCADOR_LLEGADA` · `SUSTITUYE_BICHO` · `CHIVATO_VIO_PELIGRO` · `MIRA_HACIA` · **`ARGG`** (muerte → orden 0x15).

## Salida de cada orden (`FUN_00436770`) [hecho]
4: `DESACTIVAR_ACCION_SECUNDARIA` y `PATRULLA_PAUSE`. 5: `LOOKSCAN_FACTOR 100`. 6/0xC: `VIGILAR_ON`. 8/0x12: `DISPARAR_OFF` y `APUNTAR_OFF` (salvo si pasa al 0x11). 9: `RESTAURAR_ANGULO_BARRIDO`. 0xD: `VIGILAR_ON` y `NO_AGUANTO_CHARLA` al compañero. 0x11→0x1B: `DISPARAR_OFF`+`APUNTAR_OFF`. **0x17 (esposado) y 0x1B (atontado)**: si se llega desde la muerte (0x15) quedan inmóviles con `0x240 |= 0x10`; si no, **se levantan** (`0x240 |= 2`, limpian `0x4000/0x200000`, restauran altura y animación).

## No leído
`AcBap2` (`0x43A0E0…0x43C7F0`: sus reacciones propias), `AcBap1` (`0x439FA0`), `AcBanpe2` (`FUN_0042FCA0`, solo ctor), y el significado exacto de cada flag de `bicho+0x23C/0x240/0x24C/0x250` (hay que armar una tabla aparte). Los números de alerta de cada rutina de la cadena son los que escribe `acc+0x54` en la propia rutina; su efecto en el comportamiento visible está en la entrada del orden correspondiente.
