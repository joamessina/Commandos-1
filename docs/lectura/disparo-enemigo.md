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
| `[8]` | filtro de bando que recibe el efecto `AcPuff` cuando se activa su colisión |
| `[9]` | **tipo de impacto** (0 = `DISPARO`) |
| `[10]` | **daño** (el 4.º parámetro de `FUN_005986A0`) |
| `[0xB]` | daño del efecto `AcPuff` por colisión dinámica, cuando se crea con este valor positivo |
| `[0xC]` | si ≠ 0 y no hay víctima: "ricochete en suelo" (`FUN_00676D60`, sonido `PING`) |
| `[0xD]` | 1 = hacer sonar el disparo (`FUN_00681660(tipo [0xF], fourcc [0x10], pos [1..3], pos del tirador, tirador)`) |
| `[0xE]` | 1 = además `FUN_0067F9C0(fourcc, pos, 0.75)` |
| `[0x11]` | 1 = dibujar el impacto (`FUN_006788C0`, partícula `ClassAcPuff` con la animación `[0x13]`=`DISPFALL`) — lo fijan en "no hay víctima" |

Lo que hace: **si `[4] ≠ 0` y `[10] ≠ 0` → `FUN_005986A0(tirador, víctima, tipo [9], daño [10])`** (envía `MSGA_IMPACTO` a la víctima); si no, y `[0xC] ≠ 0`, el ricochete; después crea el efecto y reproduce el sonido según sus banderas. El efecto puede causar un impacto posterior por colisión, como se precisa en §2. (Impacto inmediato comprobado en `0x678DDA`.)

**`FUN_005986A0(emisor, víctima, tipo, daño)`**: el orden correcto es *emisor primero* (`impactos.md` lo tenía al revés). Arma el mensaje `{+0x00 tipo, +0x04..+0x0C pos del emisor, +0x10 daño, +0x14 emisor}` y lo manda a la víctima. Por eso `ReceptorImpactosDef` y `AcMuerte` leen el daño en `impacto+0x10` y la dirección del golpe en `impacto+4..+0xC`.

## 2. Qué arma cada rutina [hecho]
| Rutina | Quién la llama (`FUN_00459F20`) | `[9]` tipo | `[10]` daño | `[4]` víctima | sonido (`[0x10]`) | `[0xD]` |
|---|---|---|---|---|---|---|
| `FUN_00679650` pistola con blanco | `TIPOARMA PISTOLA`, `+0x58≠0` | **0** | **30 (0x1E)** | blanco, **solo si pasa el filtro de §3** | `PIPA` (0x50495041) | 1 si no silenciado |
| `FUN_00679820` pistola a punto | `PISTOLA`, sin blanco | 0 | 30 | **0 siempre** | `PIPA` | idem |
| `FUN_00679A10` fusil con blanco | `TIPOARMA` ausente u otro (fusil) | 0 | 30 | blanco, filtro de §3 | `LFUS` (0x4655534C) | 1 |
| `FUN_00679BE0` fusil a punto | fusil sin blanco | 0 | 30 | 0 siempre | `LFUS` | 1 |
| `FUN_00679DC0` **bala de ráfaga** | `TIPOARMA METRALLETA` (`FUN_0045A400`) y nido enemigo | 0 | **0 inmediato**, 30 en el efecto de colisión | **0 inmediato** | ninguno (`[0xD]=0`) | **0** |

**Corrección: el efecto también puede herir.** En `00679DC0`, `[9]=0`, `[10]=0`, `[0xB]=30` y `[4]=0`; no hay víctima para el impacto inmediato de `00678DD0`. Pero `[0x11]` y `[0x13]` activan la creación de `DISPFALL`: `00678DD0` pasa `[0xB]` a `006788C0` (asm `0x678E59–0x678E7C`). Si es positivo, esta rutina crea `ClassAcPuff`, guarda 30 en `acción+0x2C`, tipo 0 en `+0x30`, filtro 2 en `+0x34`, activa el flag del objeto `+0x23C & 1` y lo registra (`0x678A1C–0x678A61`). Al recibir `MSGA_COLISION_DINAMICA`, `00676DE0` envía `005986A0` con esa cantidad si el otro objeto tiene `+0x108 == 2`, o el filtro es −1, o el objeto tiene `+0x240 & 0x4000`; con `acción+0x28 != 0` pone el daño a cero después del primer impacto (`0x676E01–0x676EA4`). Para esta ráfaga la llamada fija ese campo en 1 y el filtro en 2. **La lectura anterior que concluía que la ráfaga no podía herir era incorrecta.** La entrega depende de que ocurra la colisión dinámica; no está probado que cada tiro alcance a alguien. El ruido de `AcDisparar` es `MET0`; el del nido es `NIDO`.

El registro de `006788C0` llama a `00616020`, que marca `bicho+0x38 & 2` y lo añade a la lista de choque; `005B8B50` entrega esa lista a `0057E950` (`fn_00600000.c:14786–14804`, `fn_00580000.c:37275–37285`). El mensaje de choque llega a las acciones como `MSGA_COLISION_DINAMICA` mediante `0050B160` (`obj-explosivos.md`, despacho del contacto). Registrar el efecto no garantiza por sí solo que el motor encuentre una superposición en una partida: faltan el contraste de sus dimensiones efectivas y de cuándo se procesa respecto del movimiento de la víctima.

La ráfaga suministra los dos parámetros de tamaño **5 y 5** (`00679DC0`, `fn_00640000.c:38200–38209`); `00675D10` los convierte a float y configura `bicho+0x50 = 2`, `+0x54 = 5`, `+0x58 = 5` (asm `0x675D10–0x675D58`). En `0057C400` la forma 2 es circular, `+4` es el radio y `+8` la altura (`q1-colision.md`): para el efecto es un cilindro de **radio 5 y altura 5**. Un comando ordinario de M0 tiene en sus datos radio 10 y altura 40 (`tools/audita-acciones-m0.ts`); si ambas formas mantienen esos valores, su intersección exige distancia XY **menor que 15** y solapamiento vertical, antes de las demás pruebas de entrega. No implica que todo par de cuerpos superpuesto reciba el mensaje. El tick de `AcPuff` es `00675B30`: decrementa `acción+0x3C` y, cuando queda por debajo de cero, pide apagar chispas y destruir el bicho (`36169–36217`). La animación carga inicialmente ese contador desde el componente gráfico (`00678740`, `37553–37608`); no se deduce una duración fija sin comprobar el recurso y la inicialización efectiva.

**Impactos visibles de cada bala del nido (2026-11-05):** `00488670` genera diez puntos consecutivos, uno por ciclo, con un abanico inicial de 30° (`00487C70` inicializa `acción+0x3C=30`); para la orientación actual los desplazamientos son −15°, −12°, …, +12°. Cada punto pasa por `00679DC0`, que traza sectores, volúmenes y cuerpos mediante `006771A0` y, si el trayecto resulta recortado, ajusta el punto antes de crear el efecto. No se fuerza siempre a z del suelo: la altura depende del punto y el trazado. Por eso puede producir una sucesión de impactos en terreno u obstáculos, pero no se puede afirmar que siempre deje una línea sobre el suelo.

El recurso original `DISPFALL.ANM`, secuencia **`ANDAR`**, tiene cuatro pasos (`DISP0005.RLE` a `DISP0008.RLE`), no cíclicos, con período **8 ciclos**. `00678740` configura velocidad 1 y consulta la duración mediante `00509B60`; con el gráfico cargado, ese período produce un contador inicial 8 para `00675B30`, que pide destruir el efecto al decrementarlo por debajo de cero. El mismo creador `006788C0` incorpora una acción de partículas/chispas además del sprite; su distribución visual completa no se ha contrastado en ejecución. `node --experimental-transform-types tools/audita-flags-efectos.ts` confirma que los cuatro sprites tienen bandera cruda 2, asociada al flag de suma aditiva (`render.md`); el parser actual la confunde con espejo. El port aún no dibuja estos diez impactos: su nido emite sonido y daño simplificados una vez por ráfaga.

## 3. Puntería: no hay tirada, hay un filtro de visibilidad [hecho]
- En las rutinas de bala enumeradas no se encontró llamada directa al `rand` del CRT; eso no cubre todas las funciones descendientes. `006788C0` sí usa `rand` para parámetros del efecto. La recarga de patrullas usa el generador del juego y la ráfaga agrega dispersión en XY (`refuerzos-m0.md`, `ac-disparar.md`).
- El filtro (idéntico en `679650` y `679A10`): `FUN_00675880(tirador, blanco)` recorre la lista de elementos vistos del órgano de vista del tirador (`bicho+0x214`: `+0x48` = cantidad, hasta 16 entradas desde `+0x08`, la lista del último escaneo de `Vista01`, `organos.md`).
  - **Blanco en la lista → la víctima se mantiene (`EBX[4]=blanco`) y recibe `IMPACTO` tipo 0 daño 30, siempre.** No se traza rayo ni hay probabilidad de fallo.
  - **Blanco fuera de la lista → se traza el rayo `FUN_006771A0` y se pone `EBX[4]=0` (sin víctima inmediata).** El rayo no devuelve el cuerpo que toca (`param_6 = NULL` en las cuatro rutinas). Además estas cuatro ponen `[0xB]=0`, por lo que el `AcPuff` no activa esa vía de daño por colisión (asm `0x679752`, `0x679937`, `0x679B09`, `0x679CF1`).
  - (Por eso `FUN_00675AB0`, que elige "el primer cuerpo con `23C & 2` del camino", aquí solo sirve para acortar el punto del impacto visual.)
- Las rutinas "a punto" (`679820`, `679BE0`) parten con víctima inmediata 0 y crean el `AcPuff` con daño de colisión 0. Esto no descarta otros efectos o acciones del soldado fuera de esas llamadas.
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
- **Actualización M0:** `refuerzos-m0.md` cruza las cinco patrullas reales: sus soldados declaran `METRALLETA`, sus cabos leen `PISTOLA` y la recarga base de todas es 15. Las claves repetidas y las condiciones de la ráfaga están detalladas allí. La duda histórica siguiente sigue aplicando a otras misiones y macros, no a esas cinco patrullas.
- Qué otras instancias de MAC/MIS usan `TIPOARMA METRALLETA` y qué valores de `TIEMPORECARGA` aplican: contrastar datos de cada misión cuando se porte `AcDisparar`.
- Si algún MIS pisa la energía de un comando después de `FUN_00513D60` (`.ENEGIA` de un `AuX`): el orden en el exe es tabla-después-de-MAC, pero un parámetro de misión aplicado más tarde no se ha leído.
