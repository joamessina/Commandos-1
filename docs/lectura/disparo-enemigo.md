# Lectura del exe — Daño y puntería del disparo enemigo (cierra la duda de `ac-disparar.md`)

Rutinas leídas y desensambladas (frames reconstruidos a mano del `.text`): `FUN_00678DD0` (aplica el contexto de la bala), `FUN_00679650` (pistola con blanco), `FUN_00679820` (pistola sin blanco), `FUN_00679A10` (fusil con blanco), `FUN_00679BE0` (fusil sin blanco), `FUN_00679DC0` (bala de ráfaga), `FUN_00675880`, `FUN_006771A0`, `FUN_00675AB0`, `FUN_006758D0`, `FUN_006760C0`, `FUN_005986A0`, receptor `AcMuerte` (`muerte.md` §3). **[hecho]** = verificado en el desensamblado; **[hip]** = interpretación marcada.

## 1. Convención de llamada de `FUN_00678DD0` [hecho]
Recibe el **contexto de la bala en `EBX`** (sin parámetros de pila). Campos (índice de dword = `EBX[i]`, offset = `i·4`), tal como los lee la rutina:

| Campo | Significado |
|---|---|
| `[0]` | tirador (bicho) |
| `[1..3]` | punto de impacto / de salida (x,y,z); es la posición del sonido y del efecto |
| `[4]` | **víctima** (bicho) o 0 |
| `[5..7]` | punto de mira (pos del blanco + altura de ojo, o el punto pedido); lo usa el efecto visual |
| `[8]` | valor 2 (parámetro de `FUN_00678740`, el nombre de animación del efecto) |
| `[9]` | **tipo de impacto** (0 = `DISPARO`) |
| `[10]` | **daño** (el 4.º parámetro de `FUN_005986A0`) |
| `[0xB]` | parámetro de intensidad de la partícula `AcPuff` (no es daño) |
| `[0xC]` | si ≠ 0 y no hay víctima: "ricochete en suelo" (`FUN_00676D60`, sonido `PING`) |
| `[0xD]` | 1 = hacer sonar el disparo (`FUN_00681660(tipo [0xF], fourcc [0x10], pos [1..3], pos del tirador, tirador)`) |
| `[0xE]` | 1 = además `FUN_0067F9C0(fourcc, pos, 0.75)` |
| `[0x11]` | 1 = dibujar el impacto (`FUN_006788C0`, partícula `ClassAcPuff` con la animación `[0x13]`=`DISPFALL`) — lo fijan en "no hay víctima" |

Lo que hace: **si `[4] ≠ 0` y `[10] ≠ 0` → `FUN_005986A0(tirador, víctima, tipo [9], daño [10])`** (envía `MSGA_IMPACTO` a la víctima); si no, y `[0xC] ≠ 0`, el ricochete; después el efecto visual y el sonido. (Comprobado: `mov ecx,[ebx+0x10]; mov eax,[ebx+0x28]; ... push eax(daño); push [ebx+0x24](tipo); push ecx(víctima); push [ebx](tirador); call` en `0x678DDA`.)

**`FUN_005986A0(emisor, víctima, tipo, daño)`**: el orden correcto es *emisor primero* (`impactos.md` lo tenía al revés). Arma el mensaje `{+0x00 tipo, +0x04..+0x0C pos del emisor, +0x10 daño, +0x14 emisor}` y lo manda a la víctima. Por eso `ReceptorImpactosDef` y `AcMuerte` leen el daño en `impacto+0x10` y la dirección del golpe en `impacto+4..+0xC`.

## 2. Qué arma cada rutina [hecho]
| Rutina | Quién la llama (`FUN_00459F20`) | `[9]` tipo | `[10]` daño | `[4]` víctima | sonido (`[0x10]`) | `[0xD]` |
|---|---|---|---|---|---|---|
| `FUN_00679650` pistola con blanco | `TIPOARMA PISTOLA`, `+0x58≠0` | **0** | **30 (0x1E)** | blanco, **solo si pasa el filtro de §3** | `PIPA` (0x50495041) | 1 si no silenciado |
| `FUN_00679820` pistola a punto | `PISTOLA`, sin blanco | 0 | 30 | **0 siempre** | `PIPA` | idem |
| `FUN_00679A10` fusil con blanco | `TIPOARMA` ausente u otro (fusil) | 0 | 30 | blanco, filtro de §3 | `LFUS` (0x4655534C) | 1 |
| `FUN_00679BE0` fusil a punto | fusil sin blanco | 0 | 30 | 0 siempre | `LFUS` | 1 |
| `FUN_00679DC0` **bala de ráfaga** | `TIPOARMA METRALLETA` (`FUN_0045A400`) | 0 | **0** (el `0x1E` cae en `[0xB]`, la partícula) | **0 siempre** | ninguno (`[0xD]=0`) | **0** |

Detalle de la ráfaga: en `FUN_00679DC0` las escrituras previas a `call 678DD0` son `[esp+0x38]=0, [esp+0x3C]=0, [esp+0x40]=0x1E` con `EBX = esp+0x14`, o sea `[9]=0`, `[10]=0`, `[0xB]=0x1E`; y `[4]=0` desde el principio. Resultado: **las balas de la metralleta enemiga (`TIPOARMA METRALLETA`) no hieren a nadie por este camino**: solo dejan la partícula `DISPFALL` en el punto y el ruido `MET0` que `AcDisparar` emite una vez al empezar la ráfaga (`ac-disparar.md` §4). Ojo: `docs/engine/armas-danio.md` §4 llamaba "ametralladora" a `FUN_00679A10` y le daba daño 30; es el **fusil**; la ráfaga real (`679DC0`) no tiene daño.

## 3. Puntería: no hay tirada, hay un filtro de visibilidad [hecho]
- **Ninguna de las rutinas de bala llama a `rand`** (comprobado buscando `call 0x40EA0C`, el `_rand` del CRT, en `678DD0`, `679650`, `679820`, `679A10`, `679BE0`, `679DC0`, `6771A0`, `675880`, `675AB0`, `6760C0`, `677010`, `6758D0`, `676D60`, `5986A0`: 0 apariciones). Los únicos `rand` del disparo enemigo son (a) la cadencia: `enfriamiento = TIEMPORECARGA + rand % 6` (`FUN_0045ACD0`) y (b) la dispersión de la ráfaga `rand % 11 − 5` en x e y (`FUN_0045A400`), que como se vio no hiere.
- El filtro (idéntico en `679650` y `679A10`): `FUN_00675880(tirador, blanco)` recorre la lista de elementos vistos del órgano de vista del tirador (`bicho+0x214`: `+0x48` = cantidad, hasta 16 entradas desde `+0x08`, la lista del último escaneo de `Vista01`, `organos.md`).
  - **Blanco en la lista → la víctima se mantiene (`EBX[4]=blanco`) y recibe `IMPACTO` tipo 0 daño 30, siempre.** No se traza rayo ni hay probabilidad de fallo.
  - **Blanco fuera de la lista → se traza el rayo `FUN_006771A0` (solo para fijar dónde cae el impacto visual: recorta el punto con `FUN_006758D0` si algo lo bloquea) y luego se hace `xor esi,esi; mov [esp+0x1C],esi`: `EBX[4]=0` (sin víctima).** El disparo queda en puro efecto (partícula `DISPFALL` en el punto, sonido). El rayo no devuelve el cuerpo que toca (`param_6 = NULL` en las cuatro rutinas), así que **no hay "bala perdida" que dañe a un tercero**.
  - (Por eso `FUN_00675AB0`, que elige "el primer cuerpo con `23C & 2` del camino", aquí solo sirve para acortar el punto del impacto visual.)
- Las rutinas "a punto" (`679820`, `679BE0`): víctima 0 desde el inicio, nunca hieren (disparo a un punto cuando no hay blanco: p. ej. fuego de supresión).
- Además `AcDisparar` solo dispara si `bicho+0x128 == 0` (no ocupado/herido; `FUN_0045ACD0`).
- Alcance: no hay prueba de distancia en estas rutinas; el límite lo da el cono de visión del tirador (la lista de vistos). [hecho: ausencia de comparación de distancia en el rango leído]

## 4. Recepción del daño [hecho, `muerte.md` §3 + `impactos.md`]
`MSGA_IMPACTO` tipo 0 (`DISPARO`) cae en el caso genérico `FUN_00484700` de `AcMuerte` (solo en estados 6/5, no invencible, no tutorial): `si energía ≤ daño → energía = 0 y muere; si no energía −= daño` (+ animación de herido, estado 5, voz de dolor del comando `FUN_00513C70(4)`). Es decir **muere el disparo en que `energía ≤ 30`**, no el que la deja en 0 exacto. No hay armadura en las personas (`BLINDAJE` es de `ReceptorImpactosDef`, objetos con `ENEGIA`). No hay curación en el rango leído.

## 5. Cuántos disparos mata a cada comando [hecho por cálculo]
Energía inicial: tabla `0x815198` (16 B/entrada `{nombre, energía int, vel. correr float, ptr}`, la volqué del exe y coincide con `q1-movimiento.md`). `FUN_00513D60` la copia a `bicho+0x208/+0x20C` **después** de que el cargador común del bicho (`FUN_0050C490`) haya leído el `.ENEGIA` del MAC/MIS, así que la tabla manda para los comandos. Con daño 30 y la regla `energía ≤ daño → muere`:

| Token | Energía | Disparos que lo matan | Cadena de energía |
|---|---|---|---|
| COMANDO | 200 | **7** | 200→170→140→110→80→50→20→muerto |
| FRANCOT | 100 | **4** | 100→70→40→10→muerto |
| LANCHERO | 160 | **6** | 160→130→100→70→40→10→muerto |
| ARTIFIC | 130 | **5** | 130→100→70→40→10→muerto |
| CONDUC | 130 | **5** | idem |
| ESPIA | 160 | **6** | idem LANCHERO |
| PILOTO | 100 | **4** | |
| PRESO | 100 | **4** | |
| CHICA | 100 | **4** | |
| FUSILADO | 75 | **3** | 75→45→15→muerto |

(Para el port: un tiro enemigo = −30 de energía, determinista, siempre que el blanco esté en la lista de vistos del tirador en el ciclo del disparo; cadencia = `TIEMPORECARGA + rand%6` ciclos entre tiros de fusil/pistola; el fusil/pistola nunca falla por azar. Un comando agachado reduce el alcance de la vista del enemigo (`organos.md`: la mitad), pero no cambia el daño.)

## Dudas abiertas
- Valor por defecto de `TIEMPORECARGA` y qué MAC/MIS usan `TIPOARMA METRALLETA` (ráfaga sin daño): no está en el exe (viene de los datos); verificar con los `.MAC` extraídos cuando se porte `AcDisparar`.
- Si algún MIS pisa la energía de un comando después de `FUN_00513D60` (`.ENEGIA` de un `AuX`): el orden en el exe es tabla-después-de-MAC, pero un parámetro de misión aplicado más tarde no se ha leído.
