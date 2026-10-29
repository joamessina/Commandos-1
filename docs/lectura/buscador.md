# Lectura del exe — `ClassAcBuscador` (el caminador por rutas de `AcBap`, `AcGuarda`…): `0x445850–0x447A00`

**[hecho]** leído con dirección. Es la acción que recibe `MSGA_BUSCADOR_IRA` (lo que mandan `AcBap` `FUN_004364A0`, `AcGuarda` `FUN_004712A0`, etc.) y hace caminar al bicho por el grafo de rutas (búsqueda en sí: `0x626xxx–0x629xxx`, `grid-seek.md`). Ctor `FUN_00446E40`: estado `+0x24 = 1`... (ver abajo), crea el objeto de ruta (`FUN_006285E0`, 0xD8 B) en `+0x60`.

## 1. Estado [hecho]
`acc+0x24`: 0 muerto · 1 inactivo · **2 activo**. `acc+0x28` modo de andar: **0** parado · **1** pausado · **2** siguiendo la ruta · **3** esquivando (ver §3). `+0x30..+0x38` destino, `+0x64` sector del destino, `+0x48` 1 = permitir escaleras (`IRA`/`IRA_CONESCALAS`) / 0 = prohibirlas (`IRA_SINESCALAS`), `+0x3C` ciclos de pausa, `+0x44` / `+0x40` banderas de la rutina de esquive, `+0x4C` estaba en escalera, `+0x54` valor anterior de `MOTOR_GETTREPAR`, `+0x58` radio de tolerancia, `+0x5C` contador de esquive, `+0x60` ruta, `+0x68` observador de animación, `+0x70` animación cambiada.
Animaciones (`FUN_00445EE0(nombre)`): `ANDAR` / `ANDA_DESNUDO` (si `bicho+0x23C & 0x400000`) al caminar; `ESCALAR_CICLICO(_DESNUDO)`, `ESCALAR_EMPIEZA(_DESNUDO)`, `ESCALAR_FIN(_DESNUDO)` en escalera (`FUN_00446200` compara `MSGO_MOTOR_GETTREPAR` con el último valor y manda `MSGA_ENTRAS_EN_ESCALERA` / `MSGA_SALES_DE_ESCALERA` al bicho al cambiar).

## 2. Mensajes (`FUN_00447200`) [hecho]
| Mensaje | Efecto |
|---|---|
| `MSGA_BUSCADOR_IRA(pos…)`, `…_CONESCALAS` (`+0x48=1`), `…_SINESCALAS` (`+0x48=0`) | `FUN_00446A90`: guarda destino y sector (si el sector no viene, lo busca con `FUN_005F6C60(x,y)`); pide la ruta `FUN_006283D0(x,y,z,sector,param,+0x48)`. **Sin ruta**: el resultado en `param[6]=0`, para y vuelve a inactivo (el que llamó lo trata como "no llegó"). **Con ruta**: velocidad de la ruta = `param[4]` (si es 0: **2 × `bicho+0x54`**); `param[5]` = longitud/valor de `FUN_006265C0`; tolerancia `+0x58 = param[8]`; anima `ANDAR`, modo 2 |
| `MSGA_BUSCADOR_STOP` | si activo y no parado: para, vuelve a inactivo (1), modo 0 |
| `MSGA_BUSCADOR_PAUSA(n)` | `+0x3C = n`; modo 1 (anima `ANDAR`) |
| `MSGA_BUSCADOR_ISON` | responde si está activo (`+0x24 == 2`) |
| `MSGA_BUSCADOR_ANULA_SI_ALEMANES_EN_RUTA` | responde `FUN_00627FB0(sector del bicho)` (si hay otros alemanes en la ruta) |
| `MSG_CAMBIO_SECTOR(sector)` | si va andando (modo 2 ó 3), el sector afectado está en la ruta (`FUN_00627DB0`) y ya no hay camino (`FUN_00445890` = nueva consulta falla): para y manda `MSGA_BUSCADOR_CRISIS_POR_SABOTAJE_EN_SECTOR` al bicho (así `AcBap`/`AcGuarda` ponen "no llegué") |
| `MSGA_ARGG` / `VAS_A_SER_TRANSMIGRADO` / `TRANSMIGRATE` / `FIN_TRANSMIGRACION` | apaga guardando el estado / restaura (rehace la ruta y reanuda en modo 3 si la ruta sigue válida) / re-registra observador |
| colisión (`FUN_00446CD0`, desde la capa de movimiento, tipo 0 ó 6) | modo 2 → **modo 3** (esquivar) |

## 3. Tick (`FUN_00446F90`) [hecho]
Estado ≠ 2 → nada. Modo 1 (pausa): `FUN_00446640`: `+0x3C--`; a 0 pasa a modo 2 (anima `ANDAR`); mientras tanto `MSGO_MOTOR_PARAR`. Modo ≠ 1: consulta `FUN_00412896` sobre el objeto de ruta (`+0x60`): si ≠ 0 (**llegó**) → para (estado 1, modo 0) y manda `MSGA_BUSCADOR_LLEGADA` al bicho; si es 0 mira `FUN_006273E0` (= "la ruta sigue en estado 1, siguiendo", log `TPathTool::siguiendoCamino`): si sigue → continúa; si no (**la ruta se rompió**) → para y manda `MSGA_BUSCADOR_CRISIS_POR_SABOTAJE_EN_SECTOR`. Luego `FUN_00446200` (escaleras) y, en modo 2, `FUN_00629EF0(id)` (siguiente tramo de la ruta); en **modo 3** `FUN_004467C0`: cada 20 ciclos reintenta la ruta (`FUN_006283D0`); mientras tanto da pasos laterales: toma el vector al elemento que estorba (`+0x60`+0x24/0x28) y lo gira 90° según `(+0x5C>>2)&1` (alterna cuatro direcciones) a distancia, con `MSGO_MOTOR_GOTO`; si logra ruta vuelve a modo 2.
(Detalles internos de la ruta —nodos, costes— están en `grid-seek.md` y `q1-rutas.md`.)

## Dudas abiertas
- Vacía. (El significado de `FUN_00412896` como "llegó" se deduce de que su rama manda `BUSCADOR_LLEGADA`; el cuerpo es un thunk a la rutina de `TPathTool`.)
