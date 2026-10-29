# Lectura del exe — `ClassAcVigilar` (barrido de la vista) y `ClassAcVigilante` (escolta del preso): `0x4BD720–0x4C1B90`

**[hecho]** = leído con dirección; **[hip]** = interpretación. Argumentos de `FUN_00430670(orden,…)` sacados del desensamblado.

# Parte A. `ClassAcVigilar` (`0x4C0A60–0x4C1B90`): controla la mirada

Es una acción auxiliar que `AcBap`/`AcPatrulla`/etc. usan para mover la cabeza y limitar el alcance del cono de visión (el órgano de visión está en `organos.md`). Overrides: `+0x04` MAC `FUN_004C0A60` · `+0x10` tick `FUN_004C1B90` · `+0x14` mensajes `FUN_004C10D0` · `+0x28` serialización. Ctor `FUN_004C0C30`.

## A1. Parámetros del MAC [hecho]
| Clave | Campo | Defecto (ctor) | Significado |
|---|---|---|---|
| `ANGBARRIDO` | `+0x28` (y copia en `+0x2C`) | **50** | amplitud del barrido de cabeza, grados a cada lado (se manda al órgano como `ANGBARRIDO×2` de ancho) |
| `DEMORA` | `+0x30` | **100** | período del barrido en ciclos |
| `VISTAELIPTICA` | `+0x7C` | 1 | si ≠ 0 el alcance varía con la dirección de la cabeza (elipse) |
| (interno) | `+0x78` | 1.0 | factor de alcance (`LOOKSCAN_FACTOR`/100) |
| (interno) | `+0x24` estado | **2** | 0 apagado (muerto/transmigrado) · 1 `VIGILAR_OFF` · 2 `VIGILAR_ON` |
| (interno) | `+0x34` modo | 0 | 0 barrido · 1 mirar fijo a un elemento/punto (`FIJAR_VISTA`) |
| (interno) | `+0x18` fase | `(tabla[h]+0x14)*5` | **fase inicial** del barrido, distinta para cada bicho: `h` = 4 bits de la suma de los caracteres del nombre del bicho (pares/impares) `& 0x8000000F`; `tabla` = `0x812B28` = `[0,4,3,0,2,1,1,4,2,0,2,4,2,0,3,1]` |

## A2. Tick (`FUN_004C1B90`, cada ciclo si estado ≠ 1) [hecho]
- `fase++`. **Modo 0 (barrido)**: manda al órgano la orden `0x13B5` y llama `FUN_004C1A30`: si `DEMORA>0` y `ANGBARRIDO>0`: `ángulo = sen(2π·(fase mod DEMORA)/DEMORA) × ANGBARRIDO` (guarda en `+0x94`); `factor = FUN_004C0E60(ángulo)` y envía `MSGO_VISTA_SETANGCABEZA_CHANGEMOD(ángulo, ftol(factor×1000))` al órgano de vista. (`2π = 0x799678`.)
- `FUN_004C0E60`: pide al órgano `GETOBJVISTAAMPLITUDQUESITOS` (amplitud `a` del cono); eje menor `b = a/3` (`0x799668` = 0.3333); con `VISTAELIPTICA` devuelve `LOOKSCAN × a·b / √((b·cosθ)²+(a·senθ)²)` (θ = ángulo de la cabeza), si no `LOOKSCAN × a`.
- **Modo 1 (mirar fijo)**: si `+0x8C` (el objetivo fijo se está viendo): copia pos a `+0x64..0x6C`, apunta la cabeza (`FUN_004BFB30`: `SETANGCABEZA` hacia él, ángulo relativo normalizado a (−180,180], const `0x794D00=180`, `0x793398=360`), `FUN_004BF9B0` (cada 10 ciclos `MSGO_VISTA_ZOOMIN` con `distancia + 40` (`0x795A30`)), `+0x74=0`, devuelve 1. Si no se ve: `+0x74++`; al llegar a **20** ciclos (o **4** si `+0x88 != 0`) manda `MSGA_ENEMIGO_PERDIDODEVISTA(nombre,pos)` al bicho y `MSGA_VIGILAR_ON` (vuelve al barrido).

## A3. Mensajes (`FUN_004C10D0`) [hecho]
`MSGA_ARGG` / `VAS_A_SER_TRANSMIGRADO`: guarda estado y modo (`+0x84`,`+0x80`) y apaga (estado 0; con transmigración solo si ya estaba apagado o el bicho murió) · `MSGA_TRANSMIGRATE` restaura (si no está muerto) · `GETOBJVISTAAMPLITUD` responde `ANGBARRIDO×2` · `GETOBJVISTAAMPLITUDQUESITOS` · `MSGA_SET_ANGULO_BARRIDO(v)` pone `+0x28=v` · `RESTAURAR_ANGULO_BARRIDO` vuelve a `+0x2C` · `VIGILAR_ON`: si hay barrido recoloca la fase para continuar desde el ángulo actual (`fase = round(DEMORA·asin(+0x94/ANGBARRIDO)/2π)` con la función `0x70C230` [hip: `asin`; el argumento se recorta a ±1]), estado 2, modo 0 · `VIGILAR_OFF`: 2→1 · `VISTA_ELEMENTOVISIBLE` (estado 2): clasifica lo visto (§A4) · `FIJAR_VISTA(nombre,pos)` (estado ≠ 0): estado 2; si ya mira ese nombre solo actualiza la posición, si no pasa a modo 1 con ese nombre · `LOOKSCAN_FACTOR(v)`: `+0x78 = v/100`.

## A4. Qué le cuenta al bicho lo que ve (`FUN_004BFCA0`) [hecho]
Para cada elemento visto manda al bicho (`+0x1C`) mensajes `*_VISTO` (la variante `MSGA_NV_…` = "nuevo visto"; se envían al detectar) según la apariencia `elem+0x108` y `elem+0x240`:
- **objeto (0)**: bit `1` huellas → `NV_PISADA_VISTA` (+ `PISADA_VISTA` y `NV_NUEVA_PISADA_VISTA` si el dueño de la huella es válido, `FUN_00441EA0`) · bit `0x100` casa con un aliado dentro → `CASA_VISTA`/`NV_CASA_VISTA` · bit `0x80` señuelo → `SENUELO_VISTO`/`NV_SENUELO_VISTO` · bit `0x800` → `NV_TABACO_VISTO` · bit `0x4000` → `NV_ANIMALPELIGROSO_VISTO`.
- **alemán (1)**: `0x200` → `ALEMANATACANDO_VISTO`/`NV_…` · `0x2000` → `NV_ATONTADO_VISTO` · `0x8000` → `NV_DESNUDO_VISTO` · bit `8` ignora · si no: `ALEMAN_VISTO` y luego `NV_MUERTO_VISTO` (si `23C&4`), `NV_ESPOSADO_VISTO` (si `23C&0x4000`) o `NV_ALEMAN_VISTO`.
- **aliado (2)**: con bit `8` (en habitáculo) y casa con info → `VEHICENEMIGO_VISTO`/`NV_…`; si no `ENEMIGO_VISTO` y `NV_MUERTO_VISTO` (si muerto) o `NV_ENEMIGO_VISTO`.
Además, si está en modo 1 y el nombre del visto es el que vigila (`+0x38`), pone `+0x8C=+0x90=+0x88=1` y guarda su posición en `+0x58..` (el objetivo fijo está a la vista).

# Parte B. `ClassAcVigilante` (`0x4BD720–0x4BF900`): guardia que escolta a un preso

Hereda de `AcBap` (ctor `FUN_004BEC70` llama al de `AcBap`, nombre de clase `"AcVigilante"`, MAC `FUN_004BDD20` que acaba llamando al de `AcBap` `FUN_00431530`). Vtable: `+0x04` MAC · `+0x14` mensajes `FUN_004BE290` · `+0x2C` reset `FUN_004BD8B0` · `+0x30` paso de orden `FUN_004BF1F0` · `+0x34` entrada `FUN_004BF5C0` · `+0x38` salida `FUN_004BE1E0` · `+0x3C` `FUN_004BD720` · `+0x40` arranque `FUN_004BEE10` · `+0x70` sonido de atención `FUN_004BE6C0` · `+0x8C` `FUN_004BF160`. Todo lo demás es de `AcBap` (`soldado-acbap.md`).

## B1. Parámetros del MAC [hecho]
`REAC_ALARMA` (≤5 hashes, `+0x660/+0x674..`; como en `AcGuarda`) · `PRESO` (nombre del bicho a escoltar, `+0x688`) · `OTROVIGI` (nombre del otro guardia, `+0x6A8`) · `CARCEL` (nombre del objeto cárcel, `+0x6C8`) · `POSPUERTACARCEL` (x,y,z, `+0x6E8..`) · `ANGPUERTACARCEL` (`+0x6F4`) · `VELNORMAL` (`+0x6F8`, velocidad de escolta). Precarga voces `AL13` y `AL05`. Ctor (`FUN_004BEC70`): `VELNORMAL` por defecto `+0x6F8 = 1.5` (`0x793E4C`), `+0x664 = 200` (período de chequeo de la pareja), `+0x668 = 0`, enlace con la pareja `+0x66C = 2` ("sin establecer"), orden de retorno `+0x670 = 0x24`, pareja activa `+0x6FC = 1`.
Arranque (`FUN_004BEE10`): resuelve los tres nombres (`+0x708` preso, `+0x710` pareja, `+0x70C` cárcel); si falta cualquiera, lo reemplaza por sí mismo y desconecta la pareja (`FUN_004BE800`: `+0x6FC=0`; si el enlace estaba en 0 manda `COMUNICACION_PAREJA(5)`); la orden inicial es **0x24** (escolta) o **0x25** si faltó algo.

## B2. Órdenes propias [hecho]
| Orden | Significado | Entrada (`FUN_004BF5C0`) | Paso (`FUN_004BF1F0`) |
|---|---|---|---|
| **0x24** | **escoltar al preso** junto a la pareja | alerta 0; si hay pareja manda `COMUNICACION_PAREJA(3)`: si la pareja está ocupada (alerta > 3) responde que no → orden 9; si no, camina a su puesto de escolta (`FUN_004BEF60`), `+0x668=10` y le dice al preso `MSGA_CONTINUA_ANDANDO` | cada 10 ciclos recoloca (`FUN_004BF110`, `FUN_004BEF60`); cada **200** ciclos (`FUN_004BF000`) mira si la pareja está muerta/esposada/atontada (`23C&4` o `&0x604000`): si sí, alarma (`AL05`) y orden 0xE; si hay alarma (`+0x704`) y no cambió → **0x26**; si se rompió la pareja (`+0x6FC==0`) → **0x25** |
| **0x25** | **ir a la puerta de la cárcel** y quedarse ahí | `+0x670=0x25`; `BUSCADOR_IRA(POSPUERTACARCEL)` | al llegar: `acc+0x244 = ANGPUERTACARCEL`, desconecta la pareja, `SETANG`, orden 9 (mirar); si no llega, repite 0x25 |
| **0x26** | **llevar al preso a la cárcel** | `+0x670=0x26`; manda `MSGA_VETE_A_LA_CARCEL(cárcel)` al preso (si el enlace es 0) y `COMUNICACION_PAREJA`; voz `AL13` | recoloca como 0x24; reacción de alarma (`vtbl+0x58`); cuando el preso entra en un contenedor (`preso+0x134 ≠ 0`, está en la cárcel) → 0x25; sin pareja → 0x25 |
| 9 | (de `AcBap`) mirar punto | | con pareja y sin cambio: si alarma (`+0x704`) → orden `+0x670`; si `+0x700` (la pareja aceptó) y alerta 3 → `+0x670` |
| 4 | puesto normal | con pareja activa devuelve `+0x670` en vez de patrullar | |
| 0xB | ir a punto | `+0x144=1`, `VIGILAR_ON` | al llegar → 0xE |
Salida (`FUN_004BE1E0`): al salir de 0xB para; al salir de 0x24..0x26 si no estaba fuera de patrulla guarda su posición actual en `+0x2B4..` (puesto); el resto, salida de `AcBap`.
Posición de escolta (`FUN_004BE890`): punto **30** unidades (`0x793D30`) delante del preso en la dirección `FUN_004DFCE0` (ángulo del bicho); velocidad (`FUN_004BEA10`, según dist² al punto): `> 3600` (60 u) → **3.0**; `> 400` (20 u) → `VELNORMAL × 1.25` (`0x7992B8`); si no `VELNORMAL`. `BUSCADOR_IRA` con 4.º argumento 1. Si no llega, usa el punto alternativo `FUN_004BE950`.

## B3. Mensajes [hecho]
`TRIGGER_REACT` (hash en `REAC_ALARMA`) → alarma (`+0x704=1` y voz `ALRM` si no esposado/atontado y sin `+0xCC`) · `VISTA_ELEMENTOVISIBLE`: clase 1 (comando) distinta del preso y con orden ≠ 3 → alarma; clases 2-7, 0xE → alarma; 0xD con flags `0x6000000` → alarma · `SONIDO_PANICO/PELIGRO` → alarma · `MSGA_COMUNICACION_PAREJA(tipo)` (de la pareja; no pasa a `AcBap`): 0 = enlace listo (`+0x66C=1`) · 1 = la pareja ve a un comando (copia la posición a `+0x314..` y `+0x174=1`) · 2 = oyó un sonido (`+0x124=1`, `+0x354`, `+0x68=3`) · 3 = ¿puedes escoltar? (si alerta > 3 responde "no", si no `+0x700=1`) · 4 = alarma (`+0x704=1`) · 5 = enlace roto (`+0x66C=0`) · `SUSTITUYE_BICHO` actualiza la pareja. Todo lo no tratado → `AcBap` (`FUN_004370D0`).
**Sonido de atención (`FUN_004BE6C0`)**: clase `+0x68 < 3` → orden `0xA` (mirar); si no y enlace en 0 → orden `0xC` mirando al emisor 200 ciclos y `COMUNICACION_PAREJA(2)`; si hay enlace → orden `0xB` hacia el emisor a 3.0 (si no arranca, 0xC).
**`FUN_004BD720` (fin de enfoque)**: si el objetivo visto es el preso (`+0x33C == +0x708`): `APUNTAR_OFF`, `DISPARAR_OFF`, orden `0xB` y camina a `+0x260` a 3.0; si no arranca, orden `+0x670`; voz `QIEN`.

## Dudas abiertas
- Efecto del preso al recibir `VETE_A_LA_CARCEL`/`CONTINUA_ANDANDO`/`PARATE`: lo implementan `AcPresoChusma`/`AcPresoTraidor`/`AcDetenido` (se leen en sus notas).
- Ninguna abierta sobre `acc+0x6FC`: el ctor lo pone a 1 y solo `FUN_004BE800` lo apaga.
