# Lectura del exe — `ClassAcpAndar` (caminador de la gente: policías, detenidos, seguidores): `0x4C3170–0x4C7000`

Rango leído completo: 41 funciones (`4C3170 … 4C7280`). **[hecho]** = leído con dirección y constantes verificadas en `.rdata` (tipo float/double comprobado en el desensamblado); **[hip]** = interpretación. No es una acción que se declare en un MAC: es un **componente** que otras acciones construyen dentro (`AcpPatrullero` y `AcpSargento` lo traen embebido; `AcDetenido` también, ver `detenido.md` §1) y al que mandan `MSGA_ANDAR_*`. Hereda de `ClassAccion`; ctor `FUN_004C3010` (vtable `0x79975C`), reset `FUN_004C2F30`, tick **`FUN_004C6ED0`** (slot 4), mensajes **`FUN_004C63B0`** (slot 5), "init de animación" `FUN_004C3760` (slot 1).

## 0. Campos [hecho]
`+0x1C` bicho · `+0x20` id · `+0x24` **estado de la acción** (0 apagada/muerta, 1 pausada, 2 activa; ctor 2) · `+0x28` estado guardado al morir · `+0x18` cuenta atrás de reintento · `+0x2C` **velocidad pedida** (init **2.5** `0x793CE8`) · `+0x30/+0x34` contadores de transición de animación (andar/correr) · `+0x3C` "puede fumar" · `+0x40`/`+0x44`/`+0x48` contadores (el `+0x48` cuenta ciclos; cada 64 recalcula el punto de seguimiento) · **`+0x4C` modo de marcha** · `+0x50` modo anterior · `+0x54..0x5C` **destino** (x,y,z) · **`+0x6C` radio de tolerancia** (init `2 × bicho+0x54`; `ANDAR_SETRADIO` lo cambia) · `+0x74` nombre de la animación pedida (init `REPOSO`) · `+0x88` "crisis" (no llegó) · `+0x8C` "ya pidió camino" · `+0x90` bloqueo · `+0x94` el motor está andando · `+0x98` el buscador está andando · `+0xA0` modo previo guardado (para 5) · `+0xA4` **objeto seguido** (0 = ir a un punto) · `+0xA8` distancia de formación (int) · `+0xAC` desvío lateral (int) · `+0xB0` ángulo de formación (float, estado) · `+0xB4` "mantener formación" · `+0xB8` nombre de animación de marcha (0x14 B) · `+0xCC` velocidad de marcha · `+0xD0` observador de animación · `+0xE4` modo de animación · `+0xEC` nombre de la animación actual (char[]) · `+0xDC` "animación caminando".

## 1. Modos de marcha (`acc+0x4C`) [hecho el comportamiento; los nombres son hip]
Cambiar de modo (`FUN_004C3D60(m)`): limpia `+0x8C,+0x88,+0x18`, guarda el anterior en `+0x50`, y al entrar:
| Modo | Qué es | Al entrar | Tick (`FUN_004C6ED0`: solo con estado de acción 2) |
|---|---|---|---|
| 0 | parado | `MSGO_MOTOR_PARAR` si el motor andaba, `BUSCADOR_STOP` si el buscador andaba, anim `REPOSO` | `FUN_004C4150`: si el motor ya no está en "trepar" (`FUN_00508800`), para y anima `REPOSO` |
| 1 | **ir a punto, en línea recta** (motor `MOTOR_GOTO`) | `+0x88=1`; para el buscador si andaba | `FUN_004C60C0` cada ciclo (ver §3) |
| 2 | **seguir a un objeto, en línea recta** | idem | `FUN_004C4730` (ver §4) |
| 3 | **ir a punto con buscador de caminos** (`BUSCADOR_IRA`) | para el motor | sin tick (lo mueve el buscador; avisa por `BUSCADOR_LLEGADA`) |
| 4 | **seguir con buscador** | para el motor | `FUN_004C42A0` |
| 5 | **sin camino: reintenta** | guarda en `+0xA0` el modo que falló | `FUN_004C59C0` cada ciclo |
| 6 | sigue por línea recta tras reintento | `+0x88=1` | lo trata `FUN_004C6ED0`→default (`FUN_004C4150`) |
La elección recta/buscador sale de **`FUN_004C2E90(p)`** = "¿hay línea libre del bicho a `p`?" (`FUN_005F6DB0` + `FUN_00611780`, rayo contra sectores/obstáculos): libre → motor directo (`MSGO_MOTOR_GOTO` + `MSGO_MOTOR_SETVEL(velocidad)`); no libre → `FUN_004C43D0` = consulta `MSGA_BUSCADOR_IRA` al bicho (sin mover aún; si responde que hay camino, `+0x98=1`, y la animación a `+0xB8`).

## 2. Mensajes que acepta (`FUN_004C63B0`) [hecho]
Todos requieren `acc+0x24 ≠ 0` salvo los de transmigración. Lo no tratado va a `FUN_004C2A60`.
| Mensaje | Efecto |
|---|---|
| `VAS_A_SER_TRANSMIGRADO` | si el bicho está muerto (`23C & 4`): guarda estado y pasa a 0 (`FUN_004C2E60`) |
| `ARGG` | `+0x28 = +0x24`, `+0x24 = 0` (apagada) |
| `TRANSMIGRATE` | si estaba apagada y el bicho no muere: restaura el estado |
| `FIN_TRANSMIGRACION` | re-registra el observador de animación (`+0xD0`) |
| **`ANDAR_PAUSE`** | si activa: modo 0 (para todo), `FUN_00429AD0(0)`, estado de acción **1** (pausada) |
| **`ANDAR_UNPAUSE`** | si activa: estado de acción **2**, `+0x94 = 1`, `FUN_00429AD0(1)` |
| **`ANDAR_STOP`** | modo 0 |
| **`ANDAR_SETVEL(v)`** | `FUN_004C4530`: **tope 4.0** (`0x7941BC`); si cambia: con el buscador parado → `MSGO_MOTOR_SETVEL(v)` directo + animación (`FUN_004C3AA0`); con el buscador andando, vuelve a pedir camino (`FUN_004C43D0`) y si falla pasa a modo 5 |
| **`ANDAR_SETRADIO(r)`** | `+0x6C = r` (tolerancia de llegada) |
| **`ANDAR_IRA(punto, flags, {anim[0x14], vel})`** | `FUN_004C5180`: copia animación y velocidad (`+0xB8`,`+0xCC`) y el destino; si el punto ya es el mismo y la velocidad/animación coinciden y modo 3: no hace nada. Línea libre → modo 1 (+ `GOTO`+`SETVEL`); no libre y con camino → modo 3; sin camino → modo 5 y manda al bicho **`MSGA_ANDAR_BADFOLLOW`** y **`MSGA_ANDAR_CRISIS`**. Devuelve en `flags+5` si hubo camino |
| **`ANDAR_FOLLOW(descriptor, {anim, vel})`** | `FUN_004C5510`: guarda el descriptor `{objeto, distancia, desvío, ángulo, mantener}` en `+0xA4..+0xB4`; objeto 0 → modo 0; si no, calcula el punto de formación (`FUN_004C31C0`, §4) y entra en modo 2 (línea libre) o 4/5 |
| `ANDAR_GETINFO` | devuelve `+0xA4..+0xB4` (el objeto a 0 si no está en modo 2) |
| `BUSCADOR_LLEGADA` | si activa: `FUN_004C5F20` (§5) |
| `MOTOR_PUNTOALCANZADO` | si el punto alcanzado = el destino (`FUN_00426EA0`, igualdad exacta de x,y,z): `FUN_004C5F20` |
| `MOTOR_CRISIS` | modo 1 sin crisis previa: se queda quieto; con `+0x88`: `FUN_004C4EA0` intenta recalcular (recta ↔ buscador ↔ modo 5) |
| `BUSCADOR_CRISIS_POR_SABOTAJE_EN_SECTOR` | modo 5 (reintentar) |
| `PUEDES_FUMAR` / `NO_PUEDES_FUMAR` | `+0x3C = 1/0` |

## 3. Llegada y tolerancias [hecho]
- Modo 1 (`FUN_004C60C0`): si `dx²+dy²` al destino `< 100` (`0x793538`, **double 100.0**, o sea **10 u**) no hace nada (espera el `PUNTOALCANZADO` del motor); si no, reevalúa recta/buscador.
- Llegada (`FUN_004C5F20`), según el modo: 1 y 3 → manda al bicho **`MSGA_ANDAR_IRA_ALCANZADO(destino)`**; 4 (seguir con buscador) → `FUN_004C5510` (reajusta la formación); 5 → si el modo previo era 4 igual que 4, si 3 → `ANDAR_IRA_ALCANZADO`, si no → modo 6.
- Seguimiento (§4): se considera "alcanzado" a **5 u** (`0x793734`, float 5.0) del punto de formación.

## 4. Seguir a un objeto (formación) [hecho el cálculo; el uso lo definen las clases que lo llaman]
- **Punto de formación** (`FUN_004C31C0`): ángulo de la formación `+0xB0` gira hacia el rumbo del objeto seguido (`FUN_004DFCE0`) **como máximo 2° por llamada** (`0x794A70` = double 2.0; si la diferencia (normalizada a ±180) es < 2° lo iguala). Punto = pos del objeto + `dist·(cos(a+90°), sen(a+90°))` + `(−desvío)·(cos a, sen a)` (`dist = +0xA8`, `desvío = +0xAC`); se recorta con un rayo `FUN_00611780` desde el objeto: si el punto cae detrás de una pared se lo acerca al objeto ([hip] sobre el recorte).
- Cada ciclo en modo 2 (`FUN_004C4730`): distancia al punto de formación; sin "mantener" (`+0xB4==0`): si **> 5** va al punto (recta si hay línea, si no `BUSCADOR_IRA`/modo 4 con velocidad `+0xCC`, `+0x30=0`); si ≤ 5, a los **6 ciclos** (`+0x30 > 5`) para el motor, gira hacia el rumbo del objeto en pasos de **5°** (`SETANG`; igual si la diferencia < 5°) y anima `REPOSO`. Con "mantener": retrasa/avanza para conservar la formación (si el ángulo relativo sale de `[-90°, 90°]` o está más lejos que `+0xAC` recalcula y rearma un temporizador de **5** ciclos).
- Cada **64 ciclos** (`+0x48 & 0x3F == 0`) en modo 4: recalcula el punto; si hay línea libre vuelve a modo 2 (`FUN_004C42A0`).

## 5. Animación y velocidad [hecho]
`FUN_004C3AA0(v, umbral, puedeCorrer)`: con motor libre (`+0x90==0`): `v == 0` → `REPOSO` tras algunos ciclos; `v ≤ umbral` o no se permite correr → **`ANDAR`**; si no **`CORRE`**. El umbral es el float `2.8` (bytes `"333@"` en `0x7997B8`): **a velocidad pedida > 2.8 corre, si no anda** (`q1-movimiento.md`). Cambiar de `ANDAR`↔`CORRE` exige cruzar una cuenta de `+5/−5` ciclos (`+0x34`) para no oscilar. Tras **200 ciclos** (`+0x34 > 200`) parado y con `+0x3C` (puede fumar) el bicho pasa a `FUMAR` y manda `MSGO_VISTA_SETFACTORALCANCE(0.5)` (`0x793730`): fumando mira con la mitad de alcance. Al salir de fumar, `MSGA_LOOKSCAN_FACTOR 100`. Con el bicho trepando (`FUN_00508800`) se suspende la animación de marcha.

## 6. Otras rutinas del rango [hecho]
`FUN_004C7020(v)`: pone/quita `bicho+0x23C |= 0x200` ("ve"). `FUN_004C7060`: manda `ANDAR_STOP` y limpia contadores. `FUN_004C7170/7140/7240/7280/7330/7540/7690/7920/7A70/7B30` y el resto (>`0x4C7000`) pertenecen a `AcpPatrullero` (ver `policia.md`). `FUN_004C7540(v)`: v=0 → `VISTA_SETVIS 0x200`, v≠0 → `VISTA_CLEARVIS 0x200` (activa/desactiva el bit 0x200 de la máscara de vista: "ve solo a lo marcado").

## Dudas abiertas
- Nombres de los modos 4–6 son interpretación por comportamiento; el código no los nombra.
- `FUN_00611780` (rayo de línea libre) y `FUN_005F6DB0` (sector del punto) están fuera de este encargo (colisión/sectores); aquí se usan como caja negra "¿hay línea libre?".
