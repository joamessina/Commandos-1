# Lectura del exe — Dinámica de los `Sim*` de vehículo (`0x665030–0x66EE70`) y sus motores (`0x5EE250–0x5F3400`)

Complementa `vehiculos.md` (acción del jugador y parámetros del motor) y `parachoques.md` (colisión). **[hecho]** = leído con dirección y constantes comprobadas en el desensamblado (float vs double mirando `fld dword/qword`); **[hip]** = interpretación. 20 ciclos/s; todo en unidades de mundo por ciclo y grados (el exe pasa a radianes con `0x793910`/`0x79E810` = π/180). Recuperada la tanda `20261029-043628` (`tools/redump.py`, 255 funciones) y lo que le faltaba (`0x66C000–0x66F000`, leído con `readbatch ver`).

## 0. Marco común (el integrador de la base) [hecho]
Cada ciclo, `FUN_0057E950` hace por bicho: `vt+0x24` (sync) → `vt+0x34` (gravedad/cinta) → **`vt+0x3C` (inercia, propia de cada clase)** → `vt+0x38` (`FUN_00573E50`: pone a cero acumuladores de fuerza/impulso) → `FUN_0057E6E0` (mover, hasta 3 intentos con `vt+0x40` "limitar" + `FUN_0057E520` colisión; si los 3 fallan no se mueve y `vt+0x30` marca atascado `sim+0xA8=1`). 2.ª pasada: `vt+0x28` (fin de ciclo: guarda `v` en `sim+0x90` = *vprev*, `FUN_00574200` el terrestre añade el detector de atasco: >16 ciclos atascado invierte los impulsos y avisa al dueño).
- Layout: `sim+0x18` dueño-observador · `+0x1C` bicho · `+0x28..0x38` pos (x,y,z,ang°,sector) · `+0x3C` bloque de fuerzas (3 vectores en `+0x3C/+0x4C/+0x5C`, **impulso `n` del motor en `+0x68..0x74`**, `+0x74` = ángulo) · `+0x78` **velocidad `v` (x,y,z,ang)** · `+0x88→v`, `+0x8C→bloque` · `+0xA4` "moviéndose" · `+0x0C` **clase de masa** (la fija el ctor: Auto/Balsa 2 · Sub 3 · Lancha/Tanque 4 · Misil 2 · Seguidor/Escalador/Rail 1; `CLASE` del `.MOTOR` la pisa con `FUN_005737D0`; solo decide quién empuja a quién, `FUN_00573720`: `this.clase ≤ otro.clase`).
- **Masa** = `bicho+0x238` (la escribe `.MASA`, `FUN_0050C490`; CAMION 500, JEEP 3000, tanques 3500, ZODIAC 400). **Gravedad** (`FUN_005770D0` flag 1, desde `vt+0x34`): si el bicho está sobre el plano (`z > plano(x,y)`) o sin sector, fuerza `−masa·3,0` (`0x797928`=3.0 double) ⇒ `vz −= 3` por ciclo. Flag 2: en sector tipo 4 (cinta) suma su vector `sector+0x40/+0x44` al impulso `n`.
- **`Sim::Mover(dx,dy,dz,dang,forzado)`** (`FUN_00666060` en el Auto; `FUN_005738D0` acumula): `n += (dx,dy,dz,dang)`; si `forzado`≠0 o el anterior fue forzado, borra `v` y `n` antes.
- **Integrador base `FUN_00575F60`** (llamado por `FUN_00573600`): `m = max(masa, 0,1)`; `v += (F0+F1+F2)/m`; luego, si `|n|² > 1e-4` y `v·n < n·n`: `v += n·(1 − v·n/|n|²)` ⇒ **`v·n̂ = |n|`** (empuje mínimo = lo pedido, el resto de `v` se conserva); `v.ang = n.ang`.
- **Posición**: `pos += v` (un salto por ciclo, `v.ang` va a `pos.ang`). El motor **no** calcula posición: pide `n` y el Sim lo filtra.
- **Pilotos → motor** (`vehiculos.md` §1): `PILOTO_GOTOVEL` = `GoTo(punto)` (`FUN_005F1670`) y luego `SETVEL(v)` (`motor+0x50 = v`, `FUN_005F1240`). Si nadie manda SETVEL, `GoTo` pone `+0x50 = VELMAX` (`+0xAC`; sin `VELMAX` vale **5,0**, `0x793734`).

## 1. Motor común `MotorVehiculo` (`FUN_005F17C0`, cada ciclo) [hecho]
- `GoTo(p)` (`FUN_005F1670`): ignora si el punto es el mismo (d² < 1e-6) y ya hay orden; guarda destino (`+0x58..0x60`), `+0x50 = +0xAC`, **rumbo fijo `+0x54 = atan2(p − pos)` (se calcula UNA vez)**, y **elige adelante/atrás una sola vez**: estado `+0xB0 = 2` (adelante) o `3` (atrás) según `vt+0x7C` ("¿hace falta marcha atrás?"). Estados 0/1 parado.
- Cada ciclo en 2/3: `d² = |dest − pos|²`; si `d² ≥ v² + prec` (`prec = +0x90`: base **64**, Lancha/Sub **256**, `SETPRECISION n` ⇒ n²) llama a la maniobra `vt+0x80(dx, dy, dz, Δ, atrás)` con **`dx,dy` actuales** y `Δ = norm180(+0x54 − ang_cuerpo)`; si no, **llegó**: manda `MSGA_MOTOR_PUNTOALCANZADO`, estado 0 (no vuelve a llamar a `Mover`: el vehículo se frena solo por la inercia de su Sim). Orden con prioridad `FUN_0060F390 > 2` reinicia el destino (cancelación).
- La velocidad pedida es **constante** (VELMAX) hasta llegar: **no hay rampa de llegada** (a diferencia del peatón); el frenado lo da la inercia del Sim (§2–§6).
- `vt+0x7C` (marcha atrás, se evalúa solo en `GoTo`; `Δ` = ángulo relativo al destino, `R` = `bicho+0x54`):
  | Motor | Condición de marcha atrás |
  |---|---|
  | Auto (`FUN_005EF390`) | `|Δ| > ANGREV` (`+0xC4`, def. **150°**) **y** `d² > 0,25·R²` |
  | Ciclo (`FUN_005F0D00`) | `|Δ| > 150°` fijo **y** `0,25·R² < d² < 9·R²` |
  | Tanque (`FUN_005F2FF0`) | `|Δ| > ANGREV` (`+0xBC`, def. **150°**) |
  | Lancha (`FUN_005F20E0`) | `|Δ| > 135°` (`0x799DCC`) **y** `d² < 9·R²` |
  | Balsa (`FUN_005EFFB0`) | `|Δ| > 135°` **y** `d² < 16·R²`; y **nunca** si el sector bajo la balsa tiene corriente (`FUN_00577040`≠0) |
  | Sub (`FUN_005F27E0`) | `|Δ| > 150°` **y** `d² < 9·R²` |
  `ANGREV` no está definido por ninguna instancia de los 19 `.MIS` (`$AngMarchaAtras` queda vacío ⇒ `GetBlock` devuelve bloque vacío, `FUN_005EF110` no escribe) ⇒ **vale siempre el defecto 150°**. `GIROMAX`, `ACBASE` y `SOBREAGUA` (presentes en los `.MAC`/`.MIS`) **no existen como cadena en el exe**: nadie los lee.
- Parser: `VELMAX` (`+0xAC`), `CLASE`, `WAV` (token en `0x7938B0`), `CAPGIRO [a b c]` (Auto/Ciclo; `+0xBC=a, +0xC0=b, +0xB8=c`), `ANGREV` (Auto `+0xC4`, Tanque `+0xBC`). Defectos de ctor Auto/Ciclo (`FUN_005EF5F0`): `a = 1,0 · b = 0 · c = 10 · ANGREV 150`. Ningún `.MAC`/`.MIS` trae `CAPGIRO` ⇒ **valen los defectos**.

## 2. `SimAutoOrg` — Auto, Ciclo y balsa varada (ctor `FUN_00665ED0`, 0xF4 B, vtable `0x7ABC74`) [hecho]
(`SimAuto`, ctor `FUN_00665A70`, es un modelo "bicicleta" con volante `±0xC4`° y paso `0xC8`; **ningún código lo crea** —su thunk `0x410488` no tiene llamadores—: ignorarlo.) El motor Auto lo crea en `FUN_005EED60` y le pasa `CAPGIRO` con `FUN_00665840(a, b, c)`: `sim+0xB8 = a, +0xBC = b, +0xC0 = c`.
- Campos: `+0xB4 = R` (`bicho+0x54`: radio; para `.VOLCOLISION POLY` es la **máxima distancia de un vértice al origen**, `FUN_00528BE0`; para `CILINDRO` es `.R`) · `+0xB8 = a` (**def. 1,0**) · `+0xBC = b` (def. 0) · `+0xC0 = c` (def. **10**) · `+0xC4` ¿forzado? · `+0xC8 = 0,3·H` y `+0xCC = 0,5·H` (`H = bicho+0x58 = .H`; se pasan al `ParachoquesDuroAuto`: **sube hasta 0,3·H y baja hasta 0,5·H** de escalón) · clase de masa 2 · máscara de tests por defecto 0xFF.
- **Inercia** (`vt+0x3C`, `FUN_006661A0`), por ciclo, con `v` de la base:
  1. `v.xyz = 0; v.ang = 0` y se integra (§0) ⇒ `v = n` (+ fuerzas/m).
  2. **`v.xy = 0,3·v.xy + 0,7·vprev.xy`** (`FUN_005734A0`, factor `0x799110` = 0,3 float; solo si `sim+0xA0 == 0`, o sea sin choque este ciclo).
  3. `s = |v.xy|`; si `s < b` ⇒ `s = 0`; **giro máx. = `min(c, a·s)` grados/ciclo**; `v.ang = clamp(n.ang, ±giro máx.)` (el ángulo pedido es todo el error `Δ`, el Sim lo recorta).
  4. Nuevo rumbo `h = pos.ang + v.ang`. Se descompone `v.xy` en **componente hacia delante** `f = v·(cos h, sen h)` y **lateral** `l = v.y·cos h − v.x·sen h`; `l` se recorta a **[−1, +1]** (`0x794688` = −1,0f); `v.xy = f·(cos h, sen h) + l·(−sen h, cos h)`.
- **Resultado**: arranca en ~6 ciclos al 90 % (`1 − 0,7^k`); al llegar y dejar de mandar `Mover` desliza `v·0,7^k` (≈ **2,33·v** de distancia: ≈ 11,7 u un camión a 5). Radio de giro **constante `180/π ≈ 57,3 u`** mientras `a·s ≤ 10` (`a = 1`, o sea `v ≤ 10`, que cubre VELMAX 5 y 10); a más de 10 u/ciclo el giro se satura y el radio crece. Gira con la velocidad (a `s=5` ⇒ 5°/ciclo; parado no gira). Si el destino queda a más de 90° del rumbo, `f` es **negativa** y el coche marcha atrás aunque el estado sea 2: la reversa explícita (>150°) solo cambia además el ángulo pedido a `norm180(Δ+180)`.
- **Maniobra del motor Auto/Ciclo** (`FUN_005EEED0`/`FUN_005F09B0`): `φ = atan2(dy,dx)` (mundo), `Mover(v·cos φ, v·sen φ, 0, Δ, 0)` con `v = motor+0x50`; con marcha atrás `dang = norm180(Δ + 180)` y el mismo vector. El vector es **hacia el destino en mundo**; el Sim lo proyecta sobre el rumbo (punto 4). Simulado con `simcar.py` (agenteF): 90° de giro con VELMAX 5 en ~30 ciclos, vel. estable 4,95–5,0.
- `vt+0x40` limitar (`FUN_00666450`): si `v.ang > c` (no llega a ocurrir por el recorte) escala `xyz` por `c/v.ang`. Además, si `bicho+0x190 == 5` (vehículo) y su conductor (`+0x198→+0x24`) cumple `vt+8 == 3` y `FUN_005118C0()→vt+8 == 2`, y `FUN_00510200(bicho, desplazamiento) == 0` (consulta de zona `FUN_006BB320`), anula `xyz` — **filtro de zona para el vehículo conducido por el jugador [hip]**; `FUN_006BB320` no se leyó (ver Dudas).
- `vt+0x44` (¿puede pisar el sector?, `FUN_00666160`): sector no nulo, sin `NTrans` (bit 4 de `sector+0x50`) y **tipo ≠ 1 y ≠ 3** (no entra en agua). `vt+0x28/0x24` sincronizan `sim+0xA4` al dueño (`dueño+0x18`).

## 3. `SimTanque` (ctor `FUN_0066EAB0(bicho, masa=4)`, vtable de `0x66E…`) [hecho]
Orugas diferenciales: el motor llama **`SimTanque::avanzar(izq, der)`** (`FUN_0066E720`).
- Campos: `+0xB4 = R/4` (tope de velocidad de oruga) · `+0xC0 = R` (semi-trocha) · `+0xC4/+0xC8` oruga izq/der pedidas · `+0xB8/+0xBC` las del ciclo (las copia `vt+0x24` y borra las pedidas ⇒ **hay que llamar a `avanzar` cada ciclo**).
- `avanzar(a, b)`: si `max(|a|,|b|) > R/4` escala **las dos** por el mismo factor (se conserva la razón); `+0xA4` (moviéndose) = alguna `> 0,001`.
- **Inercia** (`FUN_0066ED70`): `v.xy *= 0,5` (**fricción**, `0x794660`=0,5 double); luego `FUN_0066E890(a,b)`: `ω = ((b − a)/(2·R))/(π/180)` en **grados/ciclo** (`n.ang`; positivo = hacia +y), desplazamiento `d = 0,5·(a+b)` en dirección `h = pos.ang + ω/2` (rumbo medio): `n.xy = d·(cos h, sen h)`. Se integra con §0 (**sin** filtro 0,3: el tanque responde a `n` de inmediato y la componente lateral decae a la mitad por ciclo).
- **Maniobra** (`FUN_005F30B0`): `Δ = norm180(atan2(dy,dx)° − ang)`, `v = motor+0x50`; con marcha atrás `v = −v` y `Δ = norm180(Δ+180)`; `e = R·Δ·π/180`; **`avanzar(v − e, v + e)`**. Por ser proporcional: gira a `ω ≈ Δ` rad/ciclo hasta que una oruga topa con `R/4`; **giro máximo = (R/4)/R = 0,25 rad = 14,3°/ciclo** (pivote casi en el sitio: con error grande `v+e` satura y la velocidad de avance cae a `v·(R/4)/(v+e)`). Con PNZ2 (R≈67,1; VELMAX 2): avanza a 2 u/ciclo (40 u/s) cuando `|Δ| ≲ 1,7°`.
- `vt+0x44`: sector sin `NTrans` (el filtro de agua lo hace el `ParachoquesDuroTanque`: bloquea tipos 1/3 y escalones `> 0,3·H` arriba / `> 0,5·H` abajo —`FUN_0066E500`—; sin freno ⇒ respuesta 2).

## 4. `SimLancha` (ctor `FUN_00668E60`, masa 4) [hecho]
Timón: **`SimLancha::girarYAvanzar(timón_deseado, empuje)`** (`FUN_00668A00`; el motor Lancha lo llama en `FUN_005F21D0`).
- Campos: `+0xB4 = R` (tope de |empuje|) · `+0xC0 = 50` (timón máx. °, `0x795C74`) · `+0xC4 = 22,5` (°/ciclo de giro del timón, `0x7AC108`) · `+0xC8 = R/4` (**eslora efectiva L**) · `+0xBC` timón actual · `+0xCC` timón pedido · `+0xD0` empuje pedido · `+0xB8` empuje del ciclo · `+0xD4` "varada" (toca sector que no es agua tipo 1/3: `FUN_00668D30`).
- `girarYAvanzar(δ, T)`: `+0xA4 = |T| > 0,001`; `timón pedido = clamp(norm180(δ), ±50)`; `empuje = clamp(T, ±R)`.
- `vt+0x24` (`FUN_00668C40`): `empuje del ciclo = empuje pedido` (y borra el pedido); el timón real avanza hacia el pedido a lo sumo **22,5°/ciclo** (`norm180`), limitado a ±`+0xC4`.
- **Inercia** (`FUN_00669070` + `FUN_00668B20(δ, T)`): `c = cos δ`; si **no** varada: **`ω_rad = c·T·sen δ / L`**, `n.ang = ω/(π/180)`; desplazamiento `K = T·c²` en dirección del rumbo medio `h = pos.ang + n.ang/2`: `n.xy = K·(cos h, sen h)`. Después de integrar: **`v.xy = 0,1·v.xy + 0,9·vprev.xy`** (`0x794A20` = 0,1) ⇒ la lancha tarda ~10 ciclos en alcanzar la velocidad (constante de tiempo 10) y **derrapa** (no hay recorte lateral, a diferencia del coche). Varada: sin giro.
- **Maniobra** (`FUN_005F21D0`): `δ = norm180(atan2(dy,dx)° − ang)`, `T = motor+0x50` (VELMAX 4); con marcha atrás `T = −T` y `δ = norm180(δ+180)`. A timón máximo (50°) con T = 4: `ω = 4·0,4924/L` rad/ciclo (para R≈102 ⇒ L≈25,5 ⇒ 4,4°/ciclo) y avance `4·cos²50° = 1,65`.
- Datos: `MotorLancha [.VELMAX 4 …]` solo en `MAPA0007.MIS` (dos lanchas inline, p. ej. `BARCOCIVIL`, polígono con `R ≈ 102`).

## 5. `SimBalsa` + sim terrestre (Zodiac, `BARMAD`, ctor `FUN_006676B0`, masa 2) [hecho]
`MotorBalsa` (`FUN_005EFB10`) crea **dos** Sim: `SimBalsa` (agua, `motor+0xD8`) y un **`SimObjeto`** terrestre (`FUN_00669D30(...,0,2)`, `motor+0xDC`, fricción `v.xy *= 0,2` con `FUN_00669A50(0x7A4D6C)`); el motor activa el que corresponda al sector que pisa (`bicho+0xE4`): tipos 1/3 ⇒ `SimBalsa`, otros ⇒ el terrestre (`FUN_005EF940/5EFA00`). Con la balsa ocupada (`bicho+0x198→+0x24`≠0) `SimBalsa+0xD4 = 1`.
- Campos `SimBalsa`: `+0xB4 = 5,0` (tope de oruga, `0x793734`) · `+0xC0 = R` (semi-trocha) · `+0xC4/+0xC8` pedidas · `+0xB8/+0xBC` del ciclo · `+0xCC` "tocó tierra" · `+0xD0` "choque duro" · `+0xDC/+0xE0` máscaras de tipos de sector tocados (bit `1<<tipo`).
- **`avanzar(a,b)`** (`FUN_006671A0`): igual que el tanque con tope **5,0** (en vez de R/4).
- **Inercia** (`FUN_00667D30`): si no hay choque duro: `v.xy *= 0,8` (`0x7A95D8`) o **`*= 0,5`** si `+0xCC` (tocó tierra); `|v.xy|² < 1e-4` ⇒ `v = 0`. Con choque duro: `v = 0`. Luego `FUN_00667320(a,b)`: `ω = ((b−a)/(2R))/(π/180)` (**×0,75** si `+0xCC`), `d = 0,5·(a+b)`, rumbo medio; se integra (§0). `+0xD0 = 0` al final.
- **Maniobra** (`FUN_005F00E0`): `Δ = norm180(atan2(dy,dx)° − ang)` solo si `dx²+dy² > 4`, si no 0; `v = motor+0xAC` (VELMAX); con atrás `v = −v`, `Δ+180`; `e = R·Δ·π/180`; **`avanzar(v − e, v + e)`**. Zodiac (R=30, H=40, VELMAX 4): gira a `ω = Δ` rad/ciclo hasta que una oruga topa con 5 (**giro máx. = 5/30 rad = 9,5°/ciclo**), avance 4 u/ciclo si el error es pequeño.
- `vt+0x4C` (contacto, `FUN_00667BE0`): marca `+0xDC |= 1<<tipo` de ambos sectores de la arista; `+0xCC = 1` si algún lado no es tipo 1/3; `+0xD0 = 1` si el vecino no existe o es `NTrans` (el `ParachoquesDuroBalsa` además ×0,5 a toda `v`).
- `vt+0x2C`/`FUN_006674B0`: **si la balsa está vacía (`+0xD4==0`)** y los sectores tocados pasan a ser solo `DEEPWATER` (máscara `8`, antes no) **rebota**: `v.x = −v.x; v.y = −v.y` y no confirma la posición; ocupada **sí puede entrar en aguas profundas**.
- `vt+0x34` (`FUN_00667860`): banderas de `FUN_005770D0`: `0xF`, o **`0x1F` en sector tipo 3 (DEEPWATER) si no hay `+0xD8`**; el bit `0x10` suma la **corriente** del sector (`sector+0x40/0x44`, flag `Corrie`) escalada `5,0/masa` a `bicho+0x13C+4..0xC` (el bloque de movimiento del bicho) cuando `masa > 1`.
- `vt+0x40` limitar (`FUN_006679D0`, comprobado en el desensamblado): si `|desp.xy|² > 0,25·R²` lo escala por `sqrt(0,25·R²/|desp|²)` ⇒ **máx. `0,5·R` por ciclo** (15 u para el Zodiac); con sector de corriente (`Corrie`) quita la componente que va contra ella.

## 6. `SimSub` (ctor `FUN_0066E110`, masa 3) [hecho; sin uso en los datos]
Mismo esquema que la Lancha. `+0xC8 = R/4`, `+0xB4 = R/8` (tope de empuje), `+0xC0 = 90°` (timón máx.), `+0xC4 = 45°/ciclo`, `+0xCC` timón pedido, `+0xD8` "sin avance". `girarYAvanzar(δ, T, sinAvance)` (`FUN_0066DCA0`): igual que la lancha pero guarda el flag `+0xD8` (si ≠ 0 el desplazamiento `K` es 0: **gira en el sitio**). Inercia `FUN_0066E400`: igual que la lancha pero con **`v.xy = 0,5·v + 0,5·vprev`**. Maniobra `FUN_005F28D0`: con marcha atrás deja un rumbo `+0x54 = ang` y, si el desvío lateral al destino² `> 0,9·prec`, reajusta el destino. Ninguna plantilla del juego usa `MotorSub` ⇒ no hace falta portarlo.

## 7. `SimRail` (tren, ascensor; ctor `FUN_0066C510`) [hecho]
`MotorRail` fija el tramo con `MSGO_MOTOR_SETRAIL` (`FUN_005EE3C0`: `p0 = (1−f)·a + f·b`… con `f = parámetro·(−2)`, `0x797C08`) o con `.RAIL [p0 p1]` ⇒ `SimRail::setRail(p0,p1)` (`FUN_0066C7B0`: `dir` unitario, `largo`).
- `SimRail::setVel(s, ang)` (`FUN_0066C740`): velocidad objetivo `= s·dir` (`+0xC0..0xC8`), `+0xCC = ang`.
- **Inercia** (`FUN_0066C990`): `v.xyz = objetivo`, `v.ang = +0xCC`; ¿integra fuerzas? solo si `+0xD8`≠0; **`v.xy = k·v + (1−k)·vprev`** con **`k = +0xD0` si `|objetivo|² > |vprev|²` (acelera) o `+0xD4` (frena)**. `INERCIAS [a b]` del `.MOTOR` ⇒ `+0xD0 = a`, `+0xD4 = b` (un solo número ⇒ ambos; **def. 0,25 / 0,25**).
- **Limitar** (`FUN_0066CA90`): proyecta el desplazamiento sobre el segmento: `t = clamp(dot(pos+d − p0, dir), 0, largo)`, `pos_nuevo = p0 + dir·t`. El tren **no puede salirse de la vía**.
- Máscara de tests `0x11` (solo cuerpos y `0x10`), `vt+0x44` siempre 1.
- **Motor** (`FUN_005EE670`, estado 2): `v_objetivo = clamp(param_destino − param_actual, ±VELMAX)` a lo largo del tramo (`FUN_0066C8F0` = proyección); llega cuando `|param_actual − param_destino| < 1,0` (`0x793090`) o se cruzó el destino ⇒ `MSGA_MOTOR_PUNTOALCANZADO`, `setVel(0)`. `STDVEL` (def. **8,0**, `0x7985FC`) es la velocidad.
- **Datos reales**: `MAPA0000.MIS` ascensor `[1113 2389 4]→[1113 1970 245]`, `.INERCIAS [ 0.25 1 ]` (acelera con 0,25, **frena en seco con 1,0**); `MAPA0002.MIS` tren `LOCOHUID` `[3097 816 0]→[3854 54 0]`, `.INERCIAS 0.01` (arranca y frena con constante de tiempo ≈ 100 ciclos = 5 s); `VAGEMPUJ`/`DEPOSEMP` por `$P0/$P1` de la instancia.

## 8. `SimAve`, `SimMisil`, `SimSeguidor`, `SimEscalador`, `SimObjeto` [hecho]
- **`SimAve`** (pájaros; `MotorPajaro`, ctor `FUN_00666B40`, clase 0): `+0xA4 = 4·R²` (tope de |desp|²), `+0xA8 = 45°` (giro máx.), `+0xAC = 0,6` (amortiguación 3D), `+0xB0/+0xB4` "en el suelo" (z ≤ plano + 1). `Mover3D` = `FUN_00666930`. Inercia (`FUN_00666A80`): `v.z=0`… `v.xyz *= 0,6`, integra. Limitar (`FUN_00666EE0`): en suelo no baja, escala si `|v|² > 4R²`, recorta `v.ang` a ±45. Motor (`FUN_005E96A0`): vector hacia el destino `· (VELMAX/|d|)` en **3D** + giro `norm180(+0x54 − ang)`; si `d² < 1,5·R²` no recalcula el rumbo. Vuela sobre todo salvo bordes (`ParachoquesAve`).
- **`SimMisil`** (misiles/cohetes; `FUN_00669510`, clase 2): `+0xA8 = 2·R` (velocidad máx.), `+0xAC` factor de filtro (**0,5** en el ctor, **0,1** tras cada `setVel`, 1,0 tras reset). `setVel(v)` (`FUN_00669350`, activa): `vec = v` recortado a `2R`. Inercia (`FUN_006696E0`): `v = vec` (si activo) ⇒ integra ⇒ `v.xy = f·v + (1−f)·vprev` con `f = +0xAC`. El motor (`FUN_005E1780`) pone el rumbo del cuerpo = `atan2` de la velocidad.
- **`SimSeguidor`** (`FUN_0066D4F0`) **no tiene llamadores** (thunk `0x406A1E` sin xrefs): código muerto en este exe. Parámetros por si acaso: bajada/subida 20/15, giro 22,5°, filtro 0,3 y 0,5.
- **`SimEscalador`** y trepar: ver `q1-escaleras.md` (`FUN_00668130`; `v = n` directo, sin filtro; sector sin `NTrans`).
- **`SimObjeto`** (cajas, barriles, balsa varada; `FUN_00669D30`): `+0xA4 = 4R²` tope de desplazamiento², `+0xA8 = 45°`, `+0xAC` fricción (def. 0,6, 0,2 para la balsa), `+0xB0` modo cinta (`FUN_00669A10`), `+0xB4` en el suelo; inercia `FUN_00669B50`: `v.z = 0`, si en el suelo `v.xy *= fricción`, integra.

## 9. Tabla de constantes y datos reales
| Vehículo (MAC) | Motor | VELMAX (u/ciclo) | `R` | `H` | Masa | Giro máx. | Notas |
|---|---|---|---|---|---|---|---|
| CAMION, CISTERNA, CAMDES*, JEEP_V | Auto | 5 | 94,9 / 70,0 / – / 55,9 | 41 | 500 (JEEP 3000) | `min(10, 1·v)` °/ciclo ⇒ 5° a plena marcha, radio 57,3 | peldaño ↑12,3 ↓20,5 (CAMION) |
| COCHE_V, COCHEEMP | Auto | **10** | 70,8 | 30 | 500 | 10°/ciclo (tope `c`) | |
| FURGO_V, KUBE*, HORCHE_V, SDK*, TANQTA_V, TANQUETA | Auto | **5 (defecto)** | 72,9 / 42,7 / 62,6 / 89,5 / – | 30–41 | 500 | ídem | sin `VELMAX` ⇒ 5,0 |
| PNZ2 / PNZ2_V | Tanque | **2** | 67,1 | 40 | 3500 | 14,3°/ciclo | `ANGREV` 150 |
| PNZ3, TAN2DES* | Tanque | 5 (defecto) | 73,1 | 40 | 3500 | `(R/4)/R` = 14,3°/ciclo | |
| ZODIAC, ZODIAC5, BARMAD | Balsa | **4** (ZODIAC17: **1,4**) | 30 (cilindro) | 40 | 400 | 9,5°/ciclo | tope de oruga 5 |
| Lancha inline (`MAPA0007`) | Lancha | **4** | ≈102 | 50 | – | 4,4°/ciclo a timón 50° | timón 22,5°/ciclo |
| Ascensor `MAPA0000`, tren `MAPA0002`, vagonetas | Rail | 8 (STDVEL def.) | – | – | – | – | INERCIAS `[0,25 1]` / `0,01` |
`R` de un `POLY` = vértice más lejano del origen (p. ej. CAMION `(−90, 30)` ⇒ 94,87). El juego **no** usa ni `GIROMAX`, ni `ACBASE`, ni `SOBREAGUA`.

## 10. Receta para el port
1. Un Sim por vehículo con `v (x,y,z,ang)`, `vprev`, `n`. Cada ciclo: `n ← motor.maniobra()`; `inercia(clase)`; `limitar`; `pos += v`; colisión (parachoques); `vprev ← v`.
2. Auto: `v = n; v.xy = 0,3·v.xy + 0,7·vprev.xy; giro = clamp(n.ang, ±min(10, 1·|v|)); proyectar sobre h = ang+giro con |lateral| ≤ 1`.
3. Tanque/Balsa: `avanzar(v − R·Δ, v + R·Δ)` con tope (R/4 o 5); `ω=(b−a)/(2R)`, avance `0,5(a+b)` al rumbo medio; fricción de `v.xy` 0,5 (tanque) / 0,8 (balsa; 0,5 varada).
4. Lancha: timón con tope 50° y 22,5°/ciclo, `ω = T·sen δ·cos δ/(R/4)`, avance `T·cos²δ`, filtro 0,1.
5. Tren: proyección sobre el segmento, filtro `INERCIAS`.

## Dudas restantes (con motivo)
- `FUN_00510200 → FUN_006BB320` (zona permitida del vehículo conducido por el jugador): no se leyó; solo se sabe que anula la velocidad xyz si falla. Motivo: pertenece a la capa de zonas de misión (fuera del rango de Sim).
- Rama de corriente de la balsa (`0x1F`, aguas profundas, `bicho+0x13C+4..0xC += corriente·5/masa`): leída pero sin contrastar con los `.SEC` reales (¿hay sectores con flag `Corrie` en agua?); quien consume `bicho+0x13C` no se siguió.
- Tipos de objeto del `bicho+0x190 == 5` con conductor `vt+8 == 3/2`: no se identificaron las clases por RTTI.
- No se midió el original en vivo; los números salen del código (reproducibles con `agenteF\simcar.py`).

## Cierre 5
La rama de corriente de la balsa (`0x1F`, aguas profundas) depende del flag de sector **Corriente (0x20)**, que **no aparece en ninguno de los 11 `.SEC`** (`q1-movimiento.md`): nunca se ejecuta con los datos instalados.
