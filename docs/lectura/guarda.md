# Lectura del exe — `ClassAcGuarda` (guarda que da la alarma): `0x4703D0–0x472FD0` (+ `0x4702D0`, `0x470360`)

**[hecho]** = leído con dirección; **[hip]** = interpretación marcada. Argumentos de `FUN_004720B0(orden, …)` verificados con desensamblado.

## 0. Qué es [hecho]
Acción simple y **distinta de `AcBap`** (`vtable` propia, orden inicial 3): el guarda **no dispara**. Ve a un comando, **corre** hacia el bicho `CONTACTO` (o al punto de alarma más cercano), emite un grito de peligro y se va a la alarma. Overrides sobre `ClassAccion` (`FUN_004C2A00`, ctor base): `+0x04` MAC `FUN_004703D0` · `+0x10` tick `FUN_00472FD0` · `+0x14` mensajes `FUN_004722E0` (los no tratados van a `FUN_004C2A60`, que solo maneja `MSGA_VAS_A_SER_TRANSMIGRADO`/`MSGA_TRANSMIGRATE`) · `+0x28` serialización. Cambio de orden `FUN_004720B0(orden)`: salida del viejo (`FUN_00471450`) → entrada del nuevo (`FUN_00471AD0`) hasta que se estabiliza; luego `+0x70=1` (orden cambiada en este ciclo).

## 1. Parámetros del MAC (`FUN_004703D0`) [hecho]
| Clave | Efecto |
|---|---|
| `REAC_ALARMA` | lista de hasta **5** nombres (`+0x38` = cantidad, tope 5; `+0x40..` = hash `FUN_0057F1C0` de cada uno). Cuando llega `MSGA_TRIGGER_REACT` con ese hash, el guarda se pone en alarma (ver mensajes) |
| `CONTACTO` | nombre de un bicho (hasta 0x20 chars, `+0x88`): a quien corre a avisar. Se resuelve en el orden 3 (`FUN_0064A660(nombre,1)` → `+0xE4`; si no existe, `+0xE4` = él mismo) |
Además: carga efectos `BRILLOS` y `CHIRIVITAS` (las "estrellitas" del atontado), `MSGO_VISTA_SETVIS = 0xB03C` (máscara de visión), precarga sonidos `QIEN`, `ZO02`, `ZO01`, `AL10`, y pone **`bicho+0x23C |= 0x20000000`** (marca "guarda").

## 2. Órdenes (`acc+0x24`) [hecho]
| Orden | Significado | Entrada (`FUN_00471AD0`) | Tick (`FUN_00472FD0`) | Salida (`FUN_00471450`) |
|---|---|---|---|---|
| 3 | arranque | | `bicho+0x24C ^= 0x400`; resuelve `CONTACTO`; → **4** | |
| **4** | puesto/patrulla | `MSGA_PATRULLA_UNPAUSE` | si `+0x6C` (crisis del motor): `MSGA_PATRULLA_INVERT_ROUTE` (da la vuelta a la ruta); si `+0x74` (alarma) y no cambió la orden → **0xB**; si `+0x7C` (vio algo) → **0xA** | `MSGA_PATRULLA_PAUSE` |
| 6 | **esposado** | ver §4 | si `+0x60` (lo tocó un alemán vivo): → **0xB**, o **8** si ya estaba desnudo (`23C&0x400000`) | ver §4 |
| 7 | **atontado** | ver §4 | `+0x34--`; al llegar a 0 (o, si `+0x60`, pasados **15** ciclos de los 600): se levanta → **0xB** (o **8** si desnudo); si `+0x58` (le pusieron esposas) → 6 | ver §4 |
| **8** | **ir a la alarma** | `+0x34 = 0x19` (25); `FUN_00471A80`: busca el punto de alarma (§3) y `BUSCADOR_IRA` (corriendo) | `+0x34--`; al `<1` y `+0x80==0`: emite el grito (`FUN_004702D0`, §5) y `+0x80=1`; si el punto de alarma `idx=+0x30` ya no está activo → re-entra al 8 (elige otro); si llegó (`+0x64`): sin camino (`+0x68`) → 9 si el punto de destino queda a dist² ≤ **50** (`0x793EB0`) si no 8; con camino → **9** | |
| 9 | **llegó a la alarma** | oculta al bicho: si `bicho+0x38` tiene bit `0x10`/`0x02`/`0x08` llama `FUN_006157B0`/`FUN_00615750`/`FUN_006156B0`, luego `FUN_00615670`; `FUN_005086E0(0)`, `FUN_00508410(0)`, `FUN_00508430(0)` (son las mismas llamadas de visibilidad de `Camuflarse` en `au-jugador.md`) | sin tick | |
| **0xA** | **mirar lo que vio** | para; voz `QIEN`; `+0x34 = 0x32` (50); `MI_VISTA_ES_INTERESANTE(1)` | si `+0x74` → 0xB; si hay objeto visto `+0xE8`: manda `MSGA_FIJAR_VISTA` y `SETANG` hacia él; `+0x34--`; al `<1`: la alarma pasa a ser la posición del objeto (`+0xC4..→+0xB8..`), `+0x74=1`, → **0xB** | `MI_VISTA…(0)` |
| **0xB** | **correr al contacto** (`+0xE4`) | si el contacto está esposado/atontado (`23C & 0x204000`) o muerto (`23C & 4`): grito (§5) y **vuelve 8**; si no, `BUSCADOR_IRA` a su posición y `MI_VISTA_ES_INTERESANTE(1)` | si dist² al contacto `< 1600` (`0x795780`, = **40** u) → **0xC**; si llegó (`+0x64`) → 0xC (o 0xB otra vez si hubo camino fallido `+0x68`); si el contacto se movió > **√50** de donde estaba (`+0x154` del contacto) → 0xB (vuelve a calcular) | `MI_VISTA…(0)` |
| **0xC** | **dar el aviso al contacto** | grito (§5), para, `+0x34 = 0x7D` (**125** ciclos), `MI_VISTA…(0)` | gira hacia el contacto; `+0x34--`; a 0 → **8** | |
| 0xD | muerto (`ARGG`) | `MI_VISTA…(0)` | | |
| 0xE | recompuesto tras arresto | anima 0 (ANDAR) y `FUN_00509E50` (pone animación base por el ficha) | | |
Al final de cada tick se limpian `+0x58,+0x5C,+0x60,+0x6C,+0x7C` (flags de evento de un solo ciclo).
`+0x78` nunca se escribe en el rango (solo ctor=0): siempre 0 (variante no usada).

## 3. Punto de alarma (`FUN_0059D8B0`, lo llama `FUN_00471A80`) [hecho]
Tabla del mundo (`mundo+0xBD4 + i·0x18`, hasta **0x28 = 40**, contador `mundo+0xF9C`): `x,y,z` · `+0xBE0` activo · `+0xBE4` tipo · `+0xBE8` id del dueño (al destruirse el elemento dueño se pone `activo=0`). Para cada punto activo de **tipo 2** (si no hay: **tipo 1**; si no: otro criterio `FUN_0059CB60`) hace una consulta `MSGA_BUSCADOR_IRA` al bicho (sin mover) y se queda con el de **menor distancia de camino**; guarda su índice en `acc+0x30` y la posición como destino. `FUN_00471A80`: sin punto, `+0x64=+0x68=1` (no llegó / no hay).

## 4. Esposado / atontado [hecho]
- **Entrada 6 (esposado)**: `+0x74=1`, alarma = su posición; `bicho+0x240 |= 0x1000`, `+0x23C |= 0x4000`, `+0x24C |= 0x20`; si no está desnudo `+0x24C |= 0x4000|0x10000`; `+0x250 |= 0x800`; `+0x24C &= ~0x80000`; altura de ojo `bicho+0x58 = 5.0` (`0x793734`); animación `ESPOSAS1` / `ESPOSAS_DESNUDO`; manda `MSGA_ME_HAS_ESPOSADO` al que lo esposó (`+0xDC`).
- **Entrada 7 (atontado)**: `+0x240 |= 0x2000`, `&= ~2`; si no desnudo `+0x24C |= 0x10000`; `+0x23C |= 0x200000`; `+0x24C |= 0x20`; `+0x250 |= 0x1000`; altura 5.0; animación `ATONTADO` / `ATONTADO_DESNUDO`; **`+0x34 = 600`** (30 s); efecto `CHIRIVITAS` (`FUN_006A18D0(1)`); `+0x24C |= 0x400`.
- **Salida de 6/7** (si el siguiente no es el muerto 0xD): `+0x240 &= ~0x1000` (6) / `~0x2000` (7); `+0x23C &= ~0x4000` / `~0x200000`; `+0x24C &= ~0x4000, ~0x10000` (en 7 solo si el siguiente no es 6); `+0x250 &= ~0x800` / `~0x1000`; si `+0x250==0` → `+0x24C &= ~0x20`; restaura altura y velocidades del mover (`+0xAC`, `+0xB0/+0xB4` guardados al crear); la salida 6 pone `+0x24C |= 0x80000`; la 7 alterna `+0x24C ^= 0x400`. Si el siguiente es el 0xD (muerte): queda `+0x240 |= 0x10` y `+0x23C |= 0x4000`.
- `FUN_004710C0`/`FUN_00470FE0`: elige `ATONTADO_ESTATICO` / `ATONTADO_DESNUDO_ESTATICO` si ya está atontado (`23C & 0x200000`) al recibir impacto/pedrada. Animación al andar (`FUN_00471160`): con la velocidad pedida **4.0** (`0x7941BC`, la que usa siempre `BUSCADOR_IRA` aquí) **corre**: `CORRE` / `CORRER_DESNUDO`; al llegar `ANDAR` / `ANDA_DESNUDO`. Es decir, el guarda siempre **corre** cuando va a avisar.

## 5. Gritos (`FUN_004702D0`, selector `acc+0x3C`) [hecho]
`FUN_00681B90(3, fourcc, bicho, 0.75)`: tipo **3 = `SONIDO_PELIGRO`** (ver `organos.md`: se entrega a < 200 u): `+0x3C==0` → `ZO02`, `==1` → `ZO01` (**vio a un comando**), `==2` → `AL10`. `FUN_00470360`: `FUN_00681B90(2, 'QIEN')` = `SONIDO_ATENCION` ("¿quién va?", al entrar en 0xA). Los tres fourcc de grito están en la lista de voces que `AcBap` reconoce como peligro (`FUN_00430980`), así que **los soldados `AcBap` a < 200 u reaccionan** al grito del guarda.
`+0x3C` lo fija el clasificador de lo visto: 1 si ve clase `1` o `6` (comando / comando oculto), 2 si ve clase `0xD` con bits `0x7000000` en sus flags.

## 6. Mensajes (`FUN_004722E0`) [hecho]
| Mensaje | Efecto |
|---|---|
| `MOTOR_CRISIS` / `DESTINOINALCANZABLE` | `+0x6C=1` |
| `BUSCADOR_CRISIS_POR_SABOTAJE_EN_SECTOR` | `+0x64=+0x68=1` (no llega) |
| `MSGA_TRIGGER_REACT` (hash) | si `+0x74==0` y el hash está en `REAC_ALARMA`: alarma en su posición |
| `COLISION_DINAMICA` | si choca con un no-persona aliado-bando-1 vivo y no inmovilizado: `+0x60=1` |
| `VISTA_ELEMENTOVISIBLE` | clase 1 ó 6 → recuerda el objeto (`FUN_00470D60`: pos, id; `+0x7C=1`) y `+0x3C=1`; clases 2,3,4,5,7,0xE → solo recuerda; 0xD con `0x7000000` → `+0x3C=2` (y recuerda) |
| `HAS_SIDO_ESPOSADO` / `CACHIPORRAZO` | `+0x58=1` / `+0x5C=1` (guarda quién) |
| `ESTAS_DESNUDO` | `23C \|= 0x400000`, `240 \|= 0x8000`, `24C &= ~0x10000`; si esposado/atontado cambia a la animación `*_DESNUDO` |
| `BUSCADOR_LLEGADA` | `+0x64=1`, `+0x68=0`; animación de parado |
| `SONIDO_PANICO`/`SONIDO_PELIGRO` | `+0x74=1`, alarma = posición del sonido |
| `DONDE_ESTA_TU_OBJETIVO` | si `+0x74`, responde la posición de alarma |
| `IMPACTO` | `+0x74=1`, alarma = posición del agresor (o la propia) |
| `IMPACTO_SALVAJE`, `PEDRADA` | `FUN_004710C0` |
| `INICIO_ARRESTO` / `FIN_ARRESTO` | guarda y restaura `bicho+0x24C` (se pone a 0 durante el arresto); al terminar, según el parámetro: 0 → orden 0xB; 1 → orden 0xE + `IMPACTO_SALVAJE`; 2 → `24C \|= 0x4000` y orden 6; 3 → orden 7 |
| `SUSTITUYE_BICHO` | cambia `+0xE4` y copia el nombre |
| `ARGG` | orden 0xD (muerto) |
(`SONIDO_ATENCION` **no** lo trata: el guarda solo se alarma por peligro, impacto, vista o `TRIGGER_REACT`.)

## Dudas abiertas
- Qué desactiva/consume el punto de alarma al llegar el guarda (orden 9): el tick del 9 no existe y el código que apaga puntos (`mundo+0xBE0`, rutina `0x59E900`-zona) pertenece a "Misión/intendencia", fuera de este encargo (otro agente). Queda: el guarda llega, se oculta (`FUN_00615670…`) y la alarma la gestiona el mundo.
- `FUN_00509E50` (animación base): solo se vio que depende de `bicho+0x1A0`.
