# Lectura del exe — `ClassAcDisparar` (disparo de los enemigos): `0x459EA0–0x45B250` (+ rutinas de bala `0x679650–0x679F00`)

**[hecho]** leído con dirección; **[hip]** interpretación marcada. Es la acción que `AcBap` activa con `MSGA_DISPARAR_ON` / `APUNTAR_AT` (ver `soldado-acbap.md`); el disparo del jugador es otro código (`au-disparar.md`).

## 1. Parámetros del MAC (`FUN_0045A050`) [hecho]
| Clave | Efecto |
|---|---|
| `TIEMPORECARGA` | `acc+0x50` = ciclos de enfriamiento entre disparos (entero, `_ftol`) |
| `TIPOARMA` | `"METRALLETA"` → `+0x30 = 1` (y precarga el sonido `DISPAROMETRALLETA`, fourcc `MET0`) · `"PISTOLA"` → `+0x30 = 2` (sonido `DISPAROPISTOLA`) · otro texto o sin clave → `+0x30 = 0` (**fusil**) |
Ctor (`FUN_0045AE70`): estado `+0x24 = 2` (activo), modo `+0x2C = 0`, `+0x34..` contadores en 0; solo si el bicho tiene ficha (`bicho+0x1A0`) pide las animaciones `DESENFUNDAR` y `DISPARAR` (`FUN_00509B60`) y guarda su duración en cuadros: `+0x3C` ← duración de `DESENFUNDAR`, `+0x40 = 2`.

## 2. Estado y mensajes (`FUN_0045A680`) [hecho]
Campos: `+0x24` estado (0 apagada, 2 activa) · `+0x2C` **modo** (0 libre, 1 apuntando, 2 disparando) · `+0x38` fase de animación (0 desenfundar, 1 listo, 2 disparando) · `+0x34` cuenta de cuadros de la fase · `+0x44` rumbo de apuntado · `+0x48/+0x4C` ángulo del barrido y paso (metralleta) · `+0x54` enfriamiento · `+0x58` hay blanco · `+0x5C` silenciado · `+0x60..0x68` punto de tiro (sin blanco) · `+0xC4` blanco.
| Mensaje | Efecto |
|---|---|
| `MSGA_APUNTAR_AT(ángulo)` | `+0x44 = ángulo`, estado 2; modo 1 si no estaba disparando |
| `MSGA_APUNTAR_OFF` | si modo 1: modo 0 y reinicia fase |
| `MSGA_DISPARAR_ON(blanco)` | `+0xC4 = blanco`, `+0x58 = 1`, `+0x5C = 0`, modo 2 |
| `MSGA_DISPARAR_SILENCIADOR_ON(blanco)` | igual con `+0x5C = 1` (disparo silenciado) |
| `MSGA_DISPARAR_SIN_OBJETIVO(punto)` | `+0xC4 = 0`, `+0x58 = 0`, punto en `+0x60..`, modo 2 |
| `MSGA_DISPARAR_OFF` | si modo 2: modo 0 y reinicia fase |
| `ARGG` / `VAS_A_SER_TRANSMIGRADO` / `TRANSMIGRATE` / `FIN_TRANSMIGRACION` | apaga (estado 0, guarda en `+0x28`) / restaura / re-registra el observador |

## 3. Tick (`FUN_0045B200`, cada ciclo con estado 2) [hecho]
1. `+0x54--` si > 0 (enfriamiento).
2. **Fases de animación** (`FUN_0045B090`): modo 0 → todo a cero. Modo ≠ 0: fase 0 anima `DESENFUNDAR` (prioridad 6) y espera `+0x3C` cuadros → fase 1; fase 1 con modo 2 anima `DISPARAR` (prioridad 6), espera 2 cuadros → fase 2; fase 2 con modo 2 y metralleta repite la animación con prioridad 4. Cada cambio de animación fija `+0x74=1`.
3. Modo 2 → **lógica de disparo** (`FUN_0045ACD0`, solo en fase 2): si `+0x54 == 0` (o es metralleta) lanza un disparo: `+0x84 |= 4`, **enfriamiento = `TIEMPORECARGA + rand % 6`** (`FUN_006453C0`), y si `bicho+0x128 == 0`: emite el sonido de disparo (§4). Fusil/pistola: un tiro por enfriamiento (`FUN_00459F20`, §4). **Metralleta**: al empezar la ráfaga `paso = 40.0 / enfriamiento` (`0x795A30`) y `ángulo = rumbo − 10°` (`0x794AA0`); durante el enfriamiento, en cada ciclo de enfriamiento **impar** lanza una bala de ráfaga (`FUN_0045A400`) y el ángulo avanza `paso`.
4. Modo 1 o 2 → `FUN_0045A2D0`: `MSGO_MOTOR_PARAR` y `MSGO_MOTOR_SETANG(+0x44)` (se queda parado mirando al rumbo).

## 4. Disparo [hecho la estructura; el daño: ver Dudas]
- **Sonido de disparo** (tipo 3 = `SONIDO_PELIGRO`, lo oyen los soldados a < 200 u y aparece en la lista de peligro de `AcBap`, `FUN_00430980`): fusil `LFUS` (`0x4655534C`), pistola `PIPA` (`0x50495041`), metralleta `MET0` (`FUN_00459EF0`). Volumen 0.75.
- **Fusil/pistola** (`FUN_00459F20`): con blanco: `FUN_00679A10(bicho, blanco)` (fusil) / `FUN_00679650(bicho, blanco, silenciado)` (pistola); sin blanco: `FUN_00679BE0(bicho, punto)` / `FUN_00679820(bicho, punto, silenciado)`. Las cuatro arman el contexto de la bala (posición de salida = pos del bicho + altura de ojo `bicho+0x58`, o la del vehículo si va montado `bicho+0x134`) y trazan el rayo del tiro (`FUN_006771A0` con `FUN_00675AB0`: se queda con el primer cuerpo con bit `0x23C & 2` del camino que no sea tirador ni blanco). Si el blanco ya figura en la lista de visibles del tirador (`FUN_00675880`, órgano `+0x214`) no hay trazado. Constantes del contexto, idénticas en las cuatro: tipo de impacto **0 = DISPARO**, valor **0x1E = 30**, sonido (arriba), efecto de bala `DISPFALL`.
- **Bala de ráfaga** (`FUN_0045A400`): distancia al blanco (o al punto `+0x60`); punto de impacto = pos del bicho + `(cos a, sen a) × distancia` con `a = +0x48` grados (`0x8113FC` = π/180) más un desvío aleatorio de ±5 en x e y; z = la del blanco/punto; `FUN_00679DC0(bicho, punto, altura)`: dispara con efecto `DISPFALL` (tiro "que cae"/falla) y sin blanco asignado; luego `a += paso`.

## 5. Datos de apoyo
- `FUN_00459EC0(max,min)` = `rand % (max−min+1) + min`.
- `FUN_005986A0(emisor, víctima, tipo, daño)` es quien envía `MSGA_IMPACTO` (ver `impactos.md`; la orden de los dos primeros parámetros es emisor, víctima según `AUAcuchillar`).

## Dudas abiertas
- `disparo-enemigo.md` distingue el impacto inmediato del efecto posterior. En fusil/pistola, la víctima inmediata se conserva si aparece en la lista de vistos. En la ráfaga `00679DC0` no hay víctima inmediata, pero el `AcPuff` creado puede aplicar **30** mediante colisión dinámica; una lectura anterior omitió esta vía. El impacto depende de que se produzca la colisión y se cumplan sus filtros. Nº de impactos de 30 que matan a cada comando: tabla en `disparo-enemigo.md` §5.
- Valor por defecto de `TIEMPORECARGA` y quién usa `TIPOARMA METRALLETA`: vienen de los datos (MAC), no del exe.
