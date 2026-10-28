# Q1 — Movimiento: velocidad real (R1) y semántica de `.SEC`/suelo (R4)

Estado: **R1 cerrada por código (no medida en vivo)**; **R4 cerrada en estructura y consultas; consumidores de PEscal/PExplo/NCorri/NTirAt y CHOQ*.VOL NO LEÍDOS**. Marcas: **[hecho]** = leído en el exe con dirección; **[hip]** = hipótesis; **NO LEÍDO**.
Todas las velocidades son **unidades de mapa por ciclo de lógica**; el juego corre a 20 ciclos/s (`MAXFPS=0x14`, verificado antes), así que u/s = u/ciclo × 20.
Script de apoyo: `tools/q1a_sim_walk.py` (simula motor + Sim peatón; `py -I tools/q1a_sim_walk.py`). Constantes verificadas con pefile (`0x793CE8`=2.5f, `0x7941BC`=4.0f, `0x7997B8`=2.8f, `0x799110`=0.3f, `0x7A95D8`=0.8f, `0x79747C`=45.0f, `0x796368`=0.1 f64, `0x79E1B8`=16.0 f64, `0x794660`=0.5 f64).

## R1 — Resumen

**La velocidad efectiva en régimen es exactamente la que pide el motor (`Mover` = `motor+0x50`), NO se filtra a la baja.** La amortiguación ×0.3 y la mezcla 0.8/0.2 solo producen una *rampa de arranque* (0.8, 0.96, 0.992… de la velocidad pedida) y una *deriva al soltar* (≈0.74 × velocidad pedida de distancia extra). Lo que decide cuánto camina un personaje es el número que le **mandan por `MSGO_MOTOR_SETVEL`**, y ese número es:

| Situación | Pedido (u/ciclo) | u/s | De dónde sale |
|---|---|---|---|
| Jugador, **andar** (cualquier aliado) | **2.5** | 50 | `FUN_004BB080` (tick de `ClassAcUsuarioGoto`): `local_4 = _DAT_00793CE8` (2.5f); lo manda con `vt+0x38` (SetEmpuje) al motor `bicho+0x220` |
| Jugador, **correr** COMANDO (Boina Verde) y CONDUC (Conductor) | **6.0** | 120 | misma función: si `AU+0x3C` (flag correr) ≠ 0 → `bicho+0x7D0`; ese campo lo carga la tabla por personaje (abajo) |
| Jugador, **correr** FRANCOT, LANCHERO, ARTIFIC, ESPIA, CHICA, FUSILADO, PILOTO, PRESO | **5.0** | 100 | ídem |
| Correr **cargando la balsa** (`bicho+0x23C & 0x2000`) | −1.0 al valor de correr (5.0 / 4.0) | 100 / 80 | `FUN_004BB080`: `local_4 -= 1.0` (`0x795E18`); el bit 0x2000 lo pone `FUN_004F97A0` al recoger `IT_BALSA` (item 4) y lo quita `FUN_004F9730` |
| **Arrastrarse / agachado** (bit `0x40` de `bicho+0x23C`) | **2.5** (= andar) | 50 | `FUN_004BC460/4BC660/4BC950`: si el bicho está agachado el flag correr se fuerza a 0, y solo cambia la *animación* (`ARRASTRARSE`). El motor no aplica ningún factor de postura (en `FUN_005D7D90` solo hay el ×0.5 del agua) |
| **Agua** (sector tipo 1 WATER o 3 DEEPWATER) | ×0.5 sobre lo anterior (y el giro ×0.5) | 1.25 andando | `FUN_005D7D90`/`FUN_005D7AB0` (MotorAliado) y `FUN_005DCF70` (MotorAndante): `if tipo==1\|\|3 { v*=0.5; giro*=0.5 }`. MotorAliado lo omite si `motor+0x90 != 0` (**buceando**; `FUN_005D69B0` = SETBUCEAR lo escribe) |
| **Soldado patrullando** | `.VELOCIDADTRAMO` del punto de la ruta, si no existe `.VEL` de la ruta, si no existe **1.5** (`0x793E4C`) | 30–60 típico | `FUN_0048B830` (parser de rutas: `VEL` por defecto 1.5; `VELOCIDADTRAMO` por tramo en `tramo+0x3C`), `FUN_0048DC90` envía `MSGO_MOTOR_SETVEL(this+0x78)` en cada tramo. Datos MAPA0000: `.VEL` ∈ {1.5, 1.7, 1.8, 2}; otras MIS usan 1, 1.6, 2.5, 3, 6 |
| Soldado sin ningún SETVEL (caso residual) | `StdVel` del `MotorAndante` = 2.5, o `.STDVEL` 1.5 / 2 (conductores de CAMION/CISTERNA/CAMDES) | 50 / 30 / 40 | ctor `FUN_005DFC00`, `FUN_005DC070` |
| Soldado en estado `0xA` de `FUN_0048EDB0` | 5.0 (`0x793734`) | 100 | contexto del estado: **[hip]** alerta/carrera; no leí qué estado es |
| Tope de `MSGA_ANDAR_SETVEL` (AcpAndar) | ≤ 4.0 | 80 | `FUN_004C4530` (ya conocido). Animación `CORRE` si pedido > 2.8 (`FUN_004C3AA0`): soldados con `.VEL` 3 o 6 *corren* |
| Rampa de arranque (cualquier v pedida) | ciclo 1: 0.8·v; 2: 0.96·v; 3: 0.992·v; 4: 0.9984·v | — | simulación (abajo) |
| Deriva al soltar (andando a 2.5) | 1.10, 0.48, 0.21, 0.04, 0.01… = **+1.85 u** de más | — | simulación |

Tabla por personaje [hecho] — `FUN_00513D60` (init del bicho aliado) compara la cadena `bicho+0x14` (TOKEN) con la tabla de 16 B/entrada en `0x815198` {nombre, energía, velocidad de correr, ptr}; si coincide carga `energía → +0x208/+0x20C` y `velocidad → bicho+0x7D0`; sin coincidencia queda el default 5.0 (`FUN_00514970`, `0x793734`):

| índice | token | energía | vel. correr |
|---|---|---|---|
| 0 | COMANDO | 200 | **6.0** |
| 1 | FRANCOT | 100 | 5.0 |
| 2 | LANCHERO | 160 | 5.0 |
| 3 | ARTIFIC | 130 | 5.0 |
| 4 | CONDUC | 130 | **6.0** |
| 5 | ESPIA | 160 | 5.0 |
| 6 | PILOTO | 100 | 5.0 |
| 7 | PRESO | 100 | 5.0 |
| 8 | CHICA | 100 | 5.0 |
| 9 | FUSILADO | 75 | 5.0 |

(El setter `bicho+0x7D0 = x` `FUN_00512CF0` y el getter `FUN_004BB040` no tienen ningún llamador en el exe: el valor viene solo de esta tabla.)

## R1 — Flujo exacto clic → posición [hecho]

1. Clic → `ClassAcUsuarioGoto` (`FUN_004BC460/4BC660/4BC950`, slots 25/24/26): guarda flag correr (`this+0x3C = param`, 0 si agachado), pone la animación por *nombre* (`FUN_004BC100`: `ANDAR`/`CORRE`/`ARRASTRARSE` → `bicho+0x8A8`) y pide ruta con `FUN_004BB2F0` → `FUN_00628470` → `TPathTool::buscaCamino` (`FUN_00627490`). La animación **no** determina la velocidad.
2. Cada tick de la acción (`FUN_004BBDD0`, estado 1) llama `FUN_004BB080`: manda `mandaGoto` (`FUN_00629EF0`, o `vt+0x44` del motor) y **luego** SetEmpuje(2.5 / vel. correr[−1]) con prioridad = CARISMA (200 en las AU). `SetEmpuje` = `FUN_005D6910`: `motor+0x50 = motor+0xAC = v` (sin tope). Cada `GoTo` (`FUN_005D8770`) vuelve a copiar `+0x50 = +0xAC`.
3. Motor aliado, estado 3 (`FUN_005DAFE0`): sub 1 → `FUN_005D7D90(tol²=motor+0xA8)`; sub 2 (BUSCADORGOTOPUNTO) → `FUN_005D7D90(1.0)`; sub 3 (sector) → `FUN_005D7AB0`. `motor+0xA8` = `(radio_cuerpo+1)²` = 121 para R=10 (ctor `FUN_005DAB30`); si el comando ya está a menos de 11 u del punto, `GoTo` responde `PUNTOALCANZADO` sin moverse.
4. Paso por ciclo (`FUN_005D7D90` ≡ `FUN_005DCF70` de MotorAndante) — **corrección al informe previo**:
   - `φ = atan2(dy, dx)` en **grados, mundo, normalizado a [0,360)** (`FUN_00428710`; `dx = destino.x − pos.x`, `dy = destino.y − pos.y`). `Δ = norm180(ang_objetivo − ang_cuerpo)` (`FUN_005D6680`). `ang_objetivo` (`motor+0x54`) solo se actualiza si `d² > 1.5·R²`.
   - Frenado: si `d² < 16·v²` y `v > 0.001`: `v' = d / N`, `N = ceil(d/v)` (`FUN_005049C0` → CRT `0x70C6D0` = **ceil**, comprobado en el SSE: suma 1.0 si `x > trunc(x)`; luego `+0.1` y `ftol`). Llega justo en N ciclos (`v' ≤ v`; si `d < v` → `v' = d`, 1 ciclo).
   - Agua tipo 1/3: `v' *= 0.5`, `Δ *= 0.5`.
   - Llamada: **`Mover(v'·cos φ, v'·sin φ, 0, Δ, 0)`** — `cos`=`FUN_0070B650` (tiene `fcos` en `0x70B6BD`), `sin`=`FUN_0070B780` (`fsin` en `0x70B7ED`). **El desplazamiento se pide en coordenadas de MUNDO hacia el destino, con el ángulo φ y NO con Δ** (el informe previo decía `cos Δ`/`sin Δ` en marco local: era un error de lectura de la pila x87). Δ solo va al 4.º argumento (giro).
   - Llegada: `d² < tol²` → `PUNTOALCANZADO`, estado 0 (que llama `Mover(0,0,0,0,0)`); si hay orientación final pedida y el error angular ≥ 4° (`0x7941BC`) pasa a estado 2 (giro en sitio).
5. `Sim::Mover` = `FUN_0066B240`: `Sim+0xB8 = Sim+0xB4`; si `Sim+0xD4` (forzado) ≠ 0 o `param_6 ≠ 0` → borra velocidad e impulsos; acumula `(dx,dy,dz,dang)` en `Sim+0x3C+0x2C..0x38` (= `*(Sim+0x8C)+0x2C..`; `Sim+0x8C` apunta a `Sim+0x3C`, `Sim+0x88` a `Sim+0x78`, el vector velocidad; verificado en el ctor `FUN_005745B0`) con `FUN_005738D0`; fija `Sim+0xA4` (moviéndose) si `|dz|>0.01` o `Σ|d|>0.015`. El flag de `Mover` ≠ 0 pasa a modo forzado (sin filtro).
6. Por ciclo y por bicho (`FUN_0057E950`): vt+0x24 (sync) → vt+0x34 → **vt+0x3C `FUN_0066BB20`** → vt+0x38 (`FUN_00573E50` = pone a cero impulsos) → `FUN_0057E6E0` (mover) → `FUN_0057CDD0` (grilla). Después, 2.ª pasada con vt+0x28 (`FUN_0066BE70` → `FUN_00574200`: `Sim+0x90 = v` (vprev), `+0xA0=0`).
   `FUN_0066BB20` (SimPeaton, velocidad `v = Sim+0x78`, `n` = impulso de `Mover`): (a) `v.xy *= 0.3`; si `|v.xy|² < 0.01` → 0; `vz>0 → 0`. (b) si no forzado: `FUN_00573600` → `FUN_00575F60`: suma fuerzas externas (`Sim+0x3C..` vectores 0,4,8, normalmente 0) / masa; luego, **si `v·n < n·n` y `|n|²>1e-4`: `v += n·(1 − v·n/|n|²)` ⇒ `v·n̂ = |n|`** (empuje mínimo = lo pedido); `v.ang = n.ang`. (c) `FUN_005734A0(0.8)`: `v.xy = 0.8·v.xy + 0.2·vprev.xy` (solo si `Sim+0xA0 == 0`). (d) `Σ|v| < 0.001 → 0`; `|v.ang| < 0.001 → 0`.
   `FUN_0057E6E0`: copia `v`, limita (vt+0x40 `FUN_0066BCD0`: `|v.xy| ≤ R=10`; `|v.ang| ≤ 45°`), `pos += v` (un solo salto por ciclo), prueba colisión `FUN_0057E520` hasta 3 veces; si pasa, escribe `v` limitado de vuelta.

**Régimen estacionario**: con `n` constante y `vprev = n`: (a) 0.3n → (b) sube a n → (c) 0.8n+0.2n = **n**. Es decir, **px/ciclo = v pedida** (error numérico < 1e-6). Comprobado con `tools/q1a_sim_walk.py`: arranque 2.0, 2.4, 2.48, 2.496, 2.499, 2.5 (v=2.5); correr 6.0: 4.8, 5.76, 5.952…; agua 1.25; deriva tras soltar 1.85 u.

## R1 — Contraste con ANM (sin conflicto, pero la anim NO sirve para deducir la velocidad)
`a` de ANM = distancia por ciclo de animación (`graficos-mapa.md` §1). Ciclos de lógica por ciclo de animación = `a / v`:

| ANM | ANDAR a | v | ciclos | CORRE a | v | ciclos | ARRASTR. a | v | ciclos |
|---|---|---|---|---|---|---|---|---|---|
| COMANDO | 35 | 2.5 | 14.0 | 71 | 6.0 | 11.8 | 30 | 2.5 | 12.0 |
| FRANCO/LANCHIST/ARTIFIC/ESPIA | 33 | 2.5 | 13.2 | 54 | 5.0 | 10.8 | 35 | 2.5 | 14.0 |
| MECANIC (CONDUC) | 33 | 2.5 | 13.2 | 54 | 6.0 | 9.0 | 30 | 2.5 | 12.0 |
| SOLDADO (v=1.7 típ.) | 33 | 1.7 | 19.4 | 55 | 3+ | ≤18 | — | — | — |

Los cocientes `a_corre/a_andar` (2.03 COMANDO, 1.64 resto) no coinciden con `v_corre/v_andar` (2.4, 2.0): la anim no está calculada a partir de la velocidad; hay que usar los números de la tabla de arriba. El soldado a 1.7 u/ciclo recorre 33 u en 19.4 ciclos (≈1 s): la zancada es un poco lenta en pantalla pero es lo que dicen los datos. [Datos ANM leídos con `tools/bnm_dump.py -v`.]

## R1 — NO LEÍDO / pendiente
- **Medida en vivo** (R6): no hecha. Todo sale del código; la simulación asume pos única en línea recta sin colisión ni rampas. Falta contrastar con `sample_game.py`.
- `AU+0x3C` correr: quién decide correr (¿doble clic?) no lo leí (`FUN_004BC460` recibe `param_4`); basta saber que el valor es booleano.
- Efecto de **rampas/escaleras** (sub 4/5 de `FUN_005DD480`, `FUN_005D8280`): avanzan `v` por el segmento (×0.5 en agua). En escalera/trepar `SimEscalador` NO LEÍDO (velocidades de trepar).
- `CONVEYOR`(4), `SNOW`(2), `RAPIDS`(5): no leí ningún efecto sobre velocidad (ver R4).
- Estado `0xA` de `FUN_0048EDB0` (SETVEL 5.0), estados de `AcpAndar`/`Patrullero` y qué velocidad pone `AcBuscador`/persecución: NO LEÍDO.
- `.STDVEL` solo afecta si nadie manda SETVEL (conductores de camión); los soldados patrullan con `.VEL` de la ruta.
- Resolución de colisiones (`FUN_0057E520`) puede recortar el paso; no incluida en las cifras.

## R4 — Semántica de `.SEC` y suelo

### Estructura en memoria (`FUN_005FBEA0` → `FUN_005F9EC0`, `FUN_005FA5F0`, `FUN_005F4A40`) [hecho]
Objeto "mapa de sectores" (`[0x83FEA0]+0x150`, el mismo que usa `TPathTool`): `+4` array **A** (stride 0x78, `n` en `+0x14`), `+8` array **B** (`n` en `+0x18`), `+0xC` vértices (16 B: x, y, z máx. calculado), `+0x20` contador de visitas (anti-bucle), `+0x24..0x30` bbox XY global, `+0x34/+0x38` zmin/zmax, `+0x3C` acelerador espacial (si ≠ 0 las consultas van por `FUN_005F4EE0/4FF0`; construido por `FUN_005FBB40`, NO LEÍDO).
Sector (0x78 B): `+0x00 tipo` · `+0x04 índice` · `+0x08/+0x0C` centroide x,y (media de vértices) · `+0x10` z del plano en el centroide · `+0x14 nverts` · `+0x18` ptr a aristas · `+0x1C` = 1.0f · **`+0x20 A`, `+0x24 B`, `+0x28 C`** (z = A·x+B·y+C) · `+0x40/+0x44` vector de corriente (los 2 floats si `flags&0x20`) · `+0x4C` id extra solo para tipo 2 (`FUN_005D1420(cx,cy)`, NO LEÍDO) · **`+0x50 flags`** · `+0x54..0x68` bbox (minx, maxx, miny, maxy, zmin, zmax) · `+0x74` sello de visita.
Arista (0x2C B): `+0` ptr a vértice p0, `+4` p1, `+8,+0xC,+0x10` ecuación (a,b,c; dentro si `a·x+b·y+c ≥ 0`, `FUN_005F6F70`), `+0x18` **ptr al sector vecino** (0 = sin vecino / borde).
`u1`, `u2` del registro de archivo (6.º y 7.º u32; valores 0, 255, 310, −105, 15, 22…) **se leen y se descartan** (no los guarda `FUN_005F9EC0`). El nombre del sector va a `FUN_005F4E70` (los 11 archivos lo traen vacío). `z` de cada vértice = máximo de los planos de los sectores que lo comparten.
Enlazado: **TW1** rellena `arista.vecino = A + idx·0x78` (idx absoluto sobre A; −1 → 0). En MAPA0003/4/7/9 hay 4–10 vecinos con `idx ≥ nA` (apuntarían a B). **TW2** `{sA, aristaA, sB(+nA), aristaB}` hasta −1: `A[sA].arista[aristaA].vecino = B[sB−nA]` y, si la arista de B no tiene vecino, el recíproco; **todo sector B recibe flag `0x2` (Superp)**. Sin TW2 se llama `FUN_005F8680` (NO LEÍDO). **TW3**: `A[i].flags |= 0x10000` (Cubierto). Los **grupos** (`ZONA_*`, `CAMPAMENTO`) son listas `(lista, sector)` con nombre y **se solapan** (MAPA0001: 188+761+191+330 = 1470 refs para 929 sectores); consumidor real NO LEÍDO ([hip] `.SENSORES_SND_ZONA [ .ZONA x .MENSAJE REXT ]` y `.ZONAPERMITIDA` de AcBap los nombran). `pares` (`FUN_005F4A40`): 0 en los 11 archivos.
Datos (`tools/q1a_sec_stats.py`, 14 631 sectores): flags crudos `0x1` 137, `0x2` 26, `0x4` 3975, `0x8` 1, `0x10` 1019, `0x40` 60, `0x80` 6009, `0x100` 8303, `0x400` 126, `0x800` 233, `0x1000` 6, `0x2000` 1; **`0x20` y `0x200` no aparecen nunca**. Al cargar: `flags &= 0x3FDC` si el sector es NTrans, `0x3EDC` si no (**NVista se descarta en sectores transitables**; el cargador pone Inclin si A≠0 o B≠0 y Corriente solo si hay vector con `|vx|+|vy|` sobre el umbral `0x792FA8`). Tipos: LAND 4833 + 3962 NTrans · WATER 55 · SNOW 179 · DEEPWATER 294 + 13 NTrans · **CONVEYOR y RAPIDS no aparecen**. Los sectores B (MAPA0003/4/7/9, 2–14 por mapa) son todos llanos (A=B=0), tipo 0.

### Consultas (con evidencia) [hecho]
| Consulta | Función | Regla |
|---|---|---|
| **Sector en (x,y)** | `FUN_005F6C60` (134 llamadores) | Con acelerador: `FUN_005F4EE0`. Si no: **primero el array B, luego el A**; primer sector cuyo bbox contiene el punto (`minx < x ≤ maxx`, `miny < y ≤ maxy`) y cuyo polígono lo contiene (`FUN_005F4630`: prueba de cuadrantes por cruce de aristas = punto-en-polígono). Devuelve ptr o 0. |
| **Sector en (x,y,z)** (pisos) | `FUN_005F6DB0` (56 llamadores) | Igual, pero un B solo vale si `plano_B(x,y) < z + 1.0` (el punto está sobre el suelo de B); A no pide altura. Orden B→A: B = "superpuestos" (puentes/pisos altos) que ganan si estás encima. |
| **Sector actual → nuevo** | `FUN_005F9E60(sector,x,y)` (60 llamadores) | Camina por vecinos desde `sector` con las ecuaciones de arista (`FUN_005F6F70`, sello `+0x74` contra bucles); si falla, `FUN_005F6C60`. |
| **Altura del suelo** | z = `A·x+B·y+C` del sector; `bicho+0xE4` = sector actual; el Sim lo inicializa con `FUN_005F6C60` si no tiene (`FUN_0057E6E0`) | `FUN_006102E0` "en el suelo": `z < plano+2.0` |
| **¿Se puede ir de P a Q en recta?** | `FUN_005F62F0(x,y,z,sector, x2,y2,z2, −20, +15, &t, cb)` (el jugador pasa `0x7991C4`=−20 y `0x798DEC`=+15) | Avanza arista a arista (`FUN_005F5B80` da arista y `t∈[0,1]`). Bloquea si no hay vecino, si el vecino tiene **NTrans (0x4)**, o si `z_vecino − z_actual` en el cruce `< −20` o `> +15`. Devuelve 1 y `t=1` si llega; si no, `t` = fracción alcanzada. |
| **¿Sector transitable (orden/destino)?** | `FUN_0053A250(sector, modoAgua, agachado)` | 0 si `flags & 0xC` (**NTrans o NCamin**). `modoAgua`: solo tipos 1 y 3. Si no: tipo ≠ 3 (**DEEPWATER no se camina**) y, si no está agachado, además `~SoloAg`. |
| **¿El Sim lo deja pisar?** | `FUN_0066AD30` (Parachoques peatón) | Bloquea si sector nulo, **NTrans**, tipo 3 a pie o (`modoAgua`) tipo ∉ {1,3}; con SoloAg solo pasa agachado. **No mira NCamin** (NCamin solo afecta a buscador/órdenes). `FUN_0066ADF0` compara además alturas (tolerancia 1.0). |
| **Cruce de sector por el Sim** | `FUN_0066BFE0` | `dz` destino−actual en [−20, +15] (`Sim+0xCC/0xD0`) |
| **Línea de vista** | `FUN_005F9820(x,y,z,sector, x2,y2,z2, &t, cb)` (desde la oclusión de la Vista `0x61B580`; luego `0x63E200` volúmenes) | Camina aristas; **bloquea si no hay vecino** (salvo sector con Superp, que busca con `FUN_005F6C60`), **si el vecino tiene Ocluso (0x10)**, o si la pendiente del suelo en el cruce (`max(z_actual,z_vecino) − z_ojo` sobre distancia horizontal) supera la pendiente del rayo. NTrans **no** corta la vista; Ocluso sí. Si parte de sector Cubierto/Superp prueba además los B con `FUN_005F51A0`. |
| **Aterrizaje de lanzamiento** | `FUN_00675DC0` | Sector válido solo si tipo ∈ {0,1,2}, `~NTirar (0x800)` y `flags & 0xC14 == 0` (NTrans, Ocluso, SoloAg, NTirar) |

### Tipos de sector
| tipo | Nombre | Efecto leído |
|---|---|---|
| 0 | LAND | normal |
| 1 | WATER | a pie: velocidad y giro ×0.5 (`FUN_005D7D90`, `FUN_005DCF70`, `FUN_005D7AB0`, `FUN_005DD480`); transitable; `FUN_004BB370` (tick del jugador) detecta "pisando tipo 1" y conmuta un sonido (`FUN_00680D50`) |
| 2 | SNOW | sin efecto de movimiento leído; trae id extra `+0x4C` (`FUN_005D1420`) [hip: huellas, ver `AcPisar`/`AcDejarRastro`] |
| 3 | DEEPWATER | ×0.5 igual que WATER, pero **no se camina a pie** (`FUN_0053A250`, `FUN_0066AD30`); solo con modo agua/buceo |
| 4 | CONVEYOR | NO LEÍDO (no aparece en los 11 `.SEC`) |
| 5 | RAPIDS | NO LEÍDO (ídem) |
La "corriente" no es un tipo: es el flag Corriente (0x20) con el vector `+0x40/+0x44`; lo leen `FUN_00577040` (devuelve el vector del sector) y `FUN_006679D0` (Parachoques de balsa/lancha: suma la corriente). No aparece en ningún `.SEC` real.

### Flags `+0x50` (nombres del exe, volcado `FUN_0053E2E0`)
| Bit | Nombre | Crudo | Efecto leído |
|---|---|---|---|
| 0x1 | Inclin | lo calcula el cargador | plano no horizontal; lo usa el render de sectores (`FUN_006B8860/6B9580`) |
| 0x2 | Superp | lo pone el cargador a todo B | sector superpuesto (consultas de arriba) |
| 0x4 | **NTrans** | 3975 | bloquea al Sim, al buscador y al rayo de caminata; se conmuta en juego (`FUN_004A4330`, `FUN_00454100`, mensajes `SECTORESHARAN(IN)TRANSITABLES`, `HACERNOTRANSITABLE` `FUN_00454A20`) |
| 0x8 | NCamin | 1 | bloquea buscador y `FUN_0053A250`, **no** al Sim; se conmuta con `FUN_0043D6F0` |
| 0x10 | **Ocluso** | 1019 | corta la línea de vista (`FUN_005F9820`) y excluye destinos de lanzamiento |
| 0x20 | Corriente | nunca | corriente del agua (arriba) |
| 0x40 | PEscal | 60 | consumidor NO LEÍDO; está en MAPA0003/0006/0008 [hip: permite escalar] |
| 0x80 | PExplo | 6009 | consumidor NO LEÍDO [hip: permite efectos de explosión] |
| 0x100 | NVista | 8303 (crudo) | solo se conserva en sectores NTrans; lo lee el render de sectores (`FUN_006B8860` descarta con 0x100; `0x6BA390`/`0x52B7A0` con 0x104). **No es la oclusión de la Vista** (esa es Ocluso). Puerta cerrada = NTrans+NVista (`FUN_00454100`) |
| 0x200 | NCorri | nunca | ningún lector encontrado (el flag de correr no se consulta en `AcUsuarioGoto`) |
| 0x400 | **SoloAg** | 126 | solo pasa agachado (`FUN_0053A250`, `FUN_0066AD30`); `AUDisparar` (`FUN_004EF7E0`) no dispara en SoloAg (voz 3) salvo disfrazado; excluye destinos de lanzamiento |
| 0x800 | NTirar | 233 | `FUN_00675DC0`: no se puede aterrizar/lanzar ahí |
| 0x1000 | NTirAt | 6 | ningún lector encontrado |
| 0x2000 | (sin nombre) | 1 | pasa la máscara de carga; sin lector |
| 0x10000 | Cubierto | vía TW3 | lo pone TW3; lo mira `FUN_005F9820` (parte de sector Cubierto/Superp) |
Mensajes de MIS que cambian flags en juego (`FUN_005A6EF0`): `SECTORESHARANTRANSITABLES/INTRANSITABLES` (±NTrans), `SECTORESHARANSOLOAGACHADO/NOSOLOAGACHADO` (±SoloAg).

### Qué debe construir un port
1. Parsear `.SEC` (cerrado): `vertices[]`, `A[]`, `B[]` (B con Superp), aristas con `vecino` (TW1/TW2) y ecuación, planos, bbox, centroide, flags enmascarados (0x3FDC/0x3EDC).
2. `sectorAt(x,y,z?)`: B primero (con la condición de altura si hay z), luego A; bbox → punto-en-polígono. Para un bicho, seguir por vecinos desde su sector.
3. `groundZ(sector,x,y) = A·x+B·y+C`.
4. `walkable(sector, aPie|agua, agachado)` = `FUN_0053A250`; `simBlocked` = `FUN_0066AD30`.
5. `canWalk(P→Q)` = `FUN_005F62F0` con escalón [−20,+15]; `hasLOS(P→Q)` = `FUN_005F9820`.
6. Factor de velocidad por sector: tipos 1 y 3 ×0.5 (salvo buceando).

### NO LEÍDO (R4)
`CHOQ*.VOL` y su relación con los sectores (`VOLCOLISIONSUBIDA`, `FUN_0057B660` test 0x4 sectores/volúmenes, `FUN_0057E520`); `FUN_005F5B80` (cruce de arista) y las variantes aceleradas (`FUN_005F4EE0/4FF0`, `FUN_005FBB40`), `FUN_005F8680` (sin TW2); consumidores de los grupos con nombre; `FUN_005D1420` (id de nieve); CONVEYOR/RAPIDS; PEscal/PExplo/NCorri/NTirAt; `u1/u2` (descartados); cómo `TPathTool` (`FUN_00624B90`) usa NCamin/SoloAg (R3).

## Hallazgos para otros
- **Render/z-order (otro agente)**: `FUN_006B8860/6B9580/6BA390/52B7A0` recorren sectores y filtran por `flags & 0x100 / 0x101 / 0x104` (NVista, Inclin, NTrans).
- **IA/percepción**: la oclusión de la Vista consume `FUN_005F9820`: Ocluso corta la vista, NTrans no.
- **Acciones/jugador**: `AUDisparar` no dispara en SoloAg (`FUN_004EF7E0`); cargar la balsa resta 1.0 al correr; tabla por personaje en `0x815198` (energía: COMANDO 200, FRANCOT 100, LANCHERO 160, ARTIFIC 130, CONDUC 130, ESPIA 160, PILOTO 100, PRESO 100, CHICA 100, FUSILADO 75; `prioridades.md` decía "energía 100").
- **Corrección a `movimiento-colision.md` §4/§5**: el desplazamiento se pide en mundo con el rumbo φ (no `cos Δ` local); el "NO LEÍDO" de §5 queda cerrado (el impulso fija una velocidad mínima a lo largo de n; régimen estacionario = v pedida).
- **Patrulla**: velocidad por tramo `.VELOCIDADTRAMO`, si no `.VEL` de la ruta, si no 1.5; soldados con velocidad > 2.8 usan la animación CORRE.
