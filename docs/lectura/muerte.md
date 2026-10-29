# Lectura del exe — `ClassAcMuerte` (heridas y muerte de personas): `0x484310–0x485A70`

**[hecho]** leído con dirección. Es la acción de salud de todos los bichos con `vtable+8` de persona (comandos y alemanes); también los animales usan `AcMuerteAnimal` (no leída). Receptor de `MSGA_IMPACTO` (formato del impacto: `impactos.md`; tipos: 0 DISPARO, 1 BOMBA, 7 CUCHILLADA, 8 JERINGUILLA, 9 JERINGUILLALETAL, 10 APLASTAMIENTO, 13 ARPON, 14 CEPO…). Ctor `FUN_00485010`: estado `+0x28 = 6` (vivo), `+0x2C` modo tutorial 0, `+0x34` invencible 0, `+0x38 = 1` sangre permitida (los demás campos a 0; `MSGA_NO_DEJES_MANCHA_SANGRE` pone `+0x38=0`).

## 1. Estados (`acc+0x28`) [hecho]
| Estado | Significado |
|---|---|
| **6** | vivo, sano o herido (estado normal) |
| **5** | herido: reproduciendo la animación de herida durante `+0x8C` cuadros; al acabar (`+0x30 ≥ +0x8C`) → 6, `MSGO_MOTOR_ON`, `bicho+0x128 = 0` |
| 3 | **muriendo** (se entra con energía 0) |
| 2 | animación de muerte en curso; al cumplir `+0x8C` cuadros → anima código 8 y vuelve a 0 |
| 0 | muerte consumada: avisa a la misión y pasa a 1 |
| 1 | cuerpo en el suelo: limpieza (ver §4) |

## 2. Mensajes (`FUN_00485350`) [hecho]
| Mensaje | Efecto |
|---|---|
| `MSG_SET_INVENCIBLE(v)` | `+0x34 = v` (≠0: ignora los impactos letales de abajo) |
| `MSGA_SETMODE_TUTORIAL` | `+0x2C = 1` (tutorial: no baja la energía ni muere), `bicho+0x124 = 1`, `+0x10 = 0` del bloque `+0x13C` |
| `MSGA_NO_DEJES_MANCHA_SANGRE` | `+0x38 = 0` |
| **`MSGA_IMPACTO`** | solo si no es (aliado y `DAT_00840140`=modo trampa): si el bicho es aliado (`vtable+8 == 2`) avisa a la misión (`FUN_0059A2A0(9, bicho, daño)`: puntuación/eventos de "comando herido"). Por `impacto.tipo`: **1, 10, 13, 14** (BOMBA, APLASTAMIENTO, ARPON, CEPO): muerte inmediata si no es invencible (`FUN_00484600`: energía 0 → estado 3); **9** (JERINGUILLALETAL): `+0x44 = 1` ("sin sangre") y muerte inmediata (igual); **8** (JERINGUILLA): `FUN_00484540` (solo en estados 6/5, no invencible, no tutorial): `+0x44 = 1`, apaga las capas de acción `vtable+0x3C/+0x38`, `+0x48 = 100` → a los **100 ciclos** (estado 6, `+0x44≠0`, cuenta atrás de `+0x48`) energía 0 y estado 3 (muere); **cualquier otro tipo** (DISPARO, CUCHILLADA, ATROPELLO, MORDISCO, FUEGO…): `FUN_00484700`, ver §3 |
| `MSGA_PEDRADA` | `FUN_00484C20`: herida sin daño (animación `NSHERIDO…`, sin sangre) |
| `MSGA_IMPACTO_SALVAJE` | `FUN_00484600` (muerte inmediata) |
| `MSGA_MOTOR_YASOYQUITABLE` | `+0x40 &= ~1` |
| `MSGA_FIN_TRANSMIGRACION` | re-registra el observador |
Resto → `FUN_004C2A60`.

## 3. Herida por impacto genérico (`FUN_00484700`) [hecho]
Solo si no es invencible (`+0x34`) y el estado es 6 ó 5. Con `+0x2C == 0` (juego normal):
- **Daño**: si `bicho+0x208` (energía) ≤ `impacto.daño` (`impacto+0x10`): energía = 0, estado **3** (muere), guarda la dirección del golpe (`impacto+4..+0xC`) en `bicho+0x184..+0x18C` (para orientar la caída), `bicho+0x128=1`; si es aliado `FUN_00513C70(5)`; con impacto tipo 7 suena `'CUCH'` (`0x43554348`). Si no: `energía −= daño`.
- **Animación de herida** (si no va en contenedor `bicho+0x134`, ni agachado `23C&0x80`): según bandas de `bicho+0x23C`: sin banderas `HERIDO1` · desnudo (`&0x400000`) `HERIDO_DESNUDO` · atontado (`&0x200000`) `ATONTADO_HERIDO` · atontado y desnudo `ATONTADO_DESNUDO_HERIDO` · esposado (`&0x4000`) `HERIDOESPOSAS` + parte según el tipo de ficha y, si está desnudo, `_DESNUDO1/2/3` elegido por el ángulo del bicho más cercano a **20°, 80° o 337°** (`FUN_00484310`); con `impacto.daño == 0` el prefijo `NS` (sin sangre). Prioridad 6.
- Efectos: aliado → `FUN_00513C70(4)` (voz de dolor del comando), con `23C & 0x1040` (agachado o buceando) detiene el motor (`+0x30=1` del bloque `+0x13C`); alemán → sonido `'HERI'` (`0x48455249`). `+0x30=0`, estado **5**, `bicho+0x128=1`.
Con `+0x2C == 1` (tutorial) no hay daño: solo la animación de herida.

## 4. Muerte (`FUN_00485850`, un paso por ciclo) [hecho]
- **Estado 3 (empieza a morir)**: `bicho+0x128=1`; si estaba en un contenedor y es aliado manda `MSGA_SALIR_HABITACULO`. **`bicho+0x23C |= 4` (muerto)**. `bicho+0x240`: bit `2`→ se cambia por `0x10`; bit `4` → se cambia por `0x20`. Manda `MSGA_ARGG` a sí mismo y `MSGO_ARGG` (grito), apaga las cuatro capas `vtable+0x38/3C/40/44`, anim de muerte: sin banderas `MUERTE1` ó `MUERTE2` (si la ficha tiene `MUERTE2`, se elige por la paridad de `último carácter del nombre + reloj de juego`), `MUERTE_DESNUDO`, `ATONTADO_MUERTE`, `ATONTADO_DESNUDO_MUERTE`, esposado `MUERTEESPOSAS`+sufijo; limpia `23C & ~0x4000 & ~0x200000`; si el bicho tenía `23C&0x1000` (buceando) `FUN_005086E0(0)`; prioridad 6 (10 si estaba agachado) → estado 2.
- **Estado 2**: espera la duración de la animación (`+0x8C`), pone la animación final código 8 y pasa a 0.
- **Estado 0**: una sola vez (`+0x30==0`) avisa a la misión: aliado `FUN_0059A2A0(1,…)` (muere un comando), alemán `FUN_0059A2A0(3,…,0x800)` (cuenta una baja enemiga); sigue a 1 cuando `+0x40 == 0`.
- **Estado 1 (cuerpo)**: si el jugador está activo anima `TUMBA` (`DAT_007970C0`); apaga las marcas de selección (`FUN_00615750/615670`), manda `MSG_DESORGANIZAR` y `MSG_DESACTUAR` a sí mismo, altura de ojo `bicho+0x58 = 0`, `23C &= ~0x20`. **Mancha de sangre**: si no es tutorial, no es muerte con jeringuilla (`+0x44==0`), no es muerte en contenedor (`+0x3C==0`), la sangre está permitida (`+0x38≠0`) y el tipo de ficha no es 1 ni 3: crea el objeto `SANGRE` (`CHARCOSANGRE`, prioridad 999, escala 1.0) bajo el cuerpo (`FUN_00485170`). **Marcas de cuerpo recogible**: `bicho+0x250 = 0`; si es aliado: `24C |= 0x40` y, si el bicho no se llama `PERRO`, `24C = 0x28` y `250 |= 0x400`; si es alemán y no es perro: `24C = 0x28`, si fuma (`23C&0x10000`) `24C |= 0x8000`, y `250 |= 0x400`.

## Dudas abiertas
- `FUN_00513C70(4/5)` (voz del comando al herirse/morir) y `FUN_0059A2A0(9,…)`: no leídas (fuera de rango; mision/puntuación).
- Semántica exacta de los bits `0x24C` (`0x28`, `0x40`, `0x8000`, `0x4000`, `0x10000`, `0x20`, `0x80000`, `0x400`): ver la tabla de flags (`flags-bicho.md`).
