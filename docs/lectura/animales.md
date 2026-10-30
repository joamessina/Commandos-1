# Lectura del exe — Animales: `AcFelino`, `AcAvestruz`, `AcGallina`, `AcGaviota`

**Actualización (2026-10-30):** [cierre-70.md §6](cierre-70.md#6-animales-huecos-de-avestruz-gaviota-y-perro) lee íntegros `FUN_0042B2C0/0042C910/0046E760` y los selectores de vecinos del vuelo. La gaviota avanza8 unidades/ciclo y cae10, no vuelo libre; falta validar el grafo con datos/pantalla. `FUN_005F4430` busca nombres y los validadores de recinto actualizan un bit: no prueban por sí solos confinamiento físico. Corrección de §1: el **perro también hiere** (mordisco25); felino/avestruz no son los únicos.

Clases leídas: `ClassAcFelino` (`0x465310–0x468976`), `ClassAcAvestruz` (`0x428E10–0x42CE91`), `ClassAcGallina` (`0x46C200–0x46DE90`), `ClassAcGaviota` (`0x46E090–0x46F100`). **[hecho]** = leído con dirección y constantes con tipo comprobado en el desensamblado; **[hip]** = interpretación. Felino y avestruz son el **mismo diseño** (máquina de 10 estados, mismo cableado de mensajes; solo cambian números y animaciones): son los **animales peligrosos** que `AcBap`/`AcGuarda`/`AcVigilar` reconocen como clase `0xD` ("animal suelto", voz `AL10`, `flags-bicho.md`: `240 & 0x4000`). Son los únicos animales que **hieren**: usan `FUN_005986A0(emisor, víctima, tipo 4 = MORDISCO, daño)` y la víctima la procesa `AcMuerte` (`muerte.md` §3; daño ≥ energía → muere).

## 1. Daño de los animales [hecho]
| Animal | Tipo | Daño | Cuándo se aplica | Alcance de la mordida |
|---|---|---|---|---|
| Felino (`AcFelino`) | 4 `MORDISCO` | **50** (`0x32`) | estado 7, a mitad de la animación `ZARPAZO` (`acc+0x2F0 == acc+0x2A4/2`, donde `+0x2A4` = duración de `ZARPAZO` en cuadros) | `dist² < 3600` (`0x796280`, double → **60 u**); la abandona si `> 8100` (`0x796270` → **90 u**) |
| Avestruz (`AcAvestruz`) | 4 `MORDISCO` | **25** (`0x19`) | estado 7, cuando el contador `+0x29C` vale **5** (cuenta atrás) | `dist² < 4900` (`0x7936F0`, float → **70 u**) |
No hay tirada de acierto ni de daño: si la víctima sigue en el radio en ese ciclo, la herida es segura. Con energía 100 el felino mata en 2 mordidas (50+50) y el avestruz en 4. Con la tabla de energía de `disparo-enemigo.md` §5: COMANDO (200) 4 felino / 8 avestruz; FRANCOT 2 / 4; FUSILADO (75) 2 / 3.

## 2. `AcFelino` / `AcAvestruz`: configuración [hecho]
- **MAC**: `ZONARECINTO` (nombre de una zona; `FUN_005F4430(nombre)` → número; se guarda como máscara de 160 bits `{n, n>>5, 1<<(n&31)}` en `+0x48`; el animal **solo ataca dentro de su recinto** y la bandera `+0x294 = 1` la activa). El avestruz además lee `POSCOMEDERO0, POSCOMEDERO1 …` (puntos de comedero, hasta que falte uno) para las animaciones de comer (`PICA`). El felino fija `MSGO_VISTA_SETVIS` con `0x108E`, precarga los rugidos (`RUGV`, `RUGA`), pone **`bicho+0x240 |= 0x4000`** (animal peligroso) y quita el bit `2` ("de pie/activo" para el clasificador); el avestruz hace lo mismo con su propia máscara de vista [hip: las escrituras a `+0x240` son las mismas, no verificadas bit a bit]. Animaciones: felino `ZARPAZO`, `CORRER`; avestruz `ATACA`, `PICA`, `MIRA`, `ANDAR`, `CORRE`.
- Se mueven por una ruta de patrulla (`PATRULLA_UNPAUSE/GETNEXTPOINT/INVERT_ROUTE`) y barren la vista (`MSGA_SET_ANGULO_BARRIDO`).

## 3. Máquina de estados (`acc+0x24`; setter `FUN_004674C0`→`FUN_00466DD0` (felino) / `FUN_0042B9E0`→`FUN_0042B2C0` (avestruz)) [hecho el flujo; nombres hip]
| Est. | Qué es | Detalle |
|---|---|---|
| 3 | arranque | guarda su posición de origen (`+0x25C`) y pasa a **4** |
| 4 | **ronda** (patrulla) | `PATRULLA_UNPAUSE`; si hay "crisis" de ruta (`+0x2D8`) invierte la ruta y pasa a 5 |
| 5 | siguiente tramo de ruta | `PATRULLA_GETNEXTPOINT`; vuelve a 4 al llegar |
| 6 | **perseguir** a la víctima (`+0x28`) | `BUSCADOR_IRA_SINESCALAS` cada **10** ciclos con velocidad pedida **8.5** (`0x7934A0`, float; el parámetro de velocidad de `FUN_004665C0`, por defecto 1.5 `0x793E4C` si es 0); si la víctima está en `dist² < 4900` (felino, `0x7936F0`) / `< 16900` (avestruz, `0x79347C`, **130 u**) y hay línea de tiro (`FUN_004657A0`/`FUN_00429460`) → 7; si no hay camino → 9 con 100 ciclos de espera |
| 7 | **atacar** (mordida, §1) | anim `ZARPAZO`/`ATACA`; cuando acaba el contador (o la víctima sale de 90 u): si la ve este ciclo → 7 de nuevo (otra mordida) o 6 (si está a más de 70 u o sin línea); si no la ve → 8 (gira 10 ciclos) o 9 si ha muerto (`23C & 4`) |
| 8 | **girar hacia la víctima** 10 ciclos (`SETANG`) | luego → 6 |
| 9 | espera (100 ciclos o el valor pedido) | → 5 |
| 10 | **ir a investigar un ruido** (felino) | `SET_ANGULO_BARRIDO(1)`; va al punto con espera 100/400 |
| 0xB | muerto (`ARGG`, felino) | |
**Qué lo activa** (`FUN_00467520`/`FUN_0042BA50`): `IMPACTO` (cualquier agresor: lo adopta como víctima, `+0x298 = 1` "provocado", `+0x2E8 = 1`); `VISTA_ELEMENTOVISIBLE` con clase `1` (comando vivo: anota posición y bicho `+0x44`, `+0x234 = 1`), `3`, `0xE`, `0xF` (los registra como candidatos), `0xA` (señuelo, solo si ya iba a un punto); `SONIDO_PANICO/PELIGRO` (va al punto del sonido si no está ocupado: `+0x220 < 1`), `SONIDO_ATENCION`; `PEDRADA` (`+0x2A8++`, `+0x2E4`); `BUSCADOR_LLEGADA`/`MOTOR_CRISIS` (llegó/no llega); `SUSTITUYE_BICHO` (cambia referencias); `DONDE_ESTA_TU_OBJETIVO` (responde la posición de la víctima).
**Víctima válida** (`FUN_00465690`): el objetivo no está dentro de un contenedor (`+0x134 == 0`); si lleva `23C & 0x20000000` (alemán con uniforme/espía disfrazado) solo vale si de verdad es un comando controlable **y** el animal está provocado (`+0x298`); y debe tener custodia `0` o `1` (`+0x194`: un detenido no se ataca) o ser alemán (`+0x108 == 1`). Los candidatos van en una lista ordenada por distancia (hasta 9; `FUN_00465A10`) y se ataca al más cercano al que haya camino (`FUN_00465BA0`).
Cada tick (`FUN_00468370`/`FUN_0042C910`) baja los contadores (`+0x228`, `+0x220`) y limpia los avisos de un solo ciclo.

## 4. `AcGallina` [hecho]
Sin armas. MAC `FUN_0046C230`: `POSGALLINERO [x y z]` (`+0x94..0x9C`, el gallinero), pone `bicho+0x23C |= 1`, precarga `GAL1`, `GAL2` y registra el efecto `SANGRPEQ`. Estados (`FUN_0046D090`, tick `FUN_0046D7A0`): 0 **picoteando** (`PICOTADAS`); 1 **paseando** (`ANDAR`, `BUSCADOR_IRA` a puntos al azar, `rand`); 2 **corre al gallinero** (anim `ALBOROTADA`) cuando hay alboroto; 3 **espera en el gallinero 300 ciclos** (`+0xC0 = 300`) y vuelve a 1. Alboroto: `SONIDO_PELIGRO/PANICO/ATENCION` de cualquiera que no sea un aliado de la clase 3 (`+0x190 ≠ 3`) → `+0x80 = 1`; `PEDRADA` → `+0x90 = 1`; llega al gallinero cuando `dist² < 144` (`0x7965B0`, 12 u). `IMPACTO` (tipo 9 `JERINGUILLALETAL` → `+0x7C = 1`) → `FUN_0046D330`: muerte (`ARGG`/`MSGO_ARGG`, `MSG_DESORGANIZAR`, `MSG_DESACTUAR`, crea `SANGRE`/`CHARCOSANGRE` y la partícula pequeña `SANGRPEQ`). Su energía en el MAC es 10 (`armas-danio.md`): cualquier tiro la mata.

## 5. `AcGaviota` [hecho el flujo]
Ave de adorno. Estados de vuelo `acc+0x7C`: 0 **volar** (`VOLAR` + sombra `VOLARSOMBRA`), 1 **previo al planeo** (`PREVIO_PLANEO`), 2 **planear** (`PLANEO` + `PLANEOSOMBRA`), 3 **herida/cae** (tras `IMPACTO`). `SONIDO_PELIGRO` → `+0x48 = 1`, anota la posición del sonido (`+0x70..0x78`) y huye. Tick `FUN_0046E760`: trayectoria de vuelo (usa la constante `55` de `0x796614` y las de `0x796170`/`0x796650`), sin efecto de juego conocido: no hiere y en el rango leído no emite mensajes a otras acciones salvo el `IMPACTO` propio. [hip: es decorado]

## Dudas abiertas
- `AcAvestruz` y `AcGaviota`: no leí a fondo los cuerpos de `FUN_0042B2C0` / `FUN_0046E760` (setters y tick de vuelo); lo anotado sale de la estructura (idéntica a la del felino, de la que sí leí el setter y el tick) y de los números extraídos. El `ZONARECINTO` del avestruz y del felino define una máscara de zona, pero qué comprueba `FUN_005F4430`/`FUN_004655B0` al confinar (el animal no sale del recinto) queda como hipótesis.
- La energía de felino/avestruz y de qué manera mueren (quien los hiera) no está en este rango; `AcMuerteAnimal` (`armas-danio.md` §5.1) trata el daño.
