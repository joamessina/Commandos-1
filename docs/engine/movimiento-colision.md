# Movimiento, motores, colisión y búsqueda de ruta (Commandos 1, `coman_mp.exe`)

Estado: **PARCIAL (v2)**. [hecho] = leído en el decompilado con dirección; [hip] = hipótesis; NO LEÍDO = no se leyó.
Convención: `FUN_xxxxxxxx` = dirección VA. Los métodos virtuales de las vtables son thunks `jmp`; las direcciones de abajo ya son las **reales**.
Ritmo del juego: 20 ciclos/s por defecto (`MAXFPS=0x14`, ver `docs/exe-lectura.md` §2.1). Toda velocidad de abajo está en **unidades de mundo por ciclo**.

## 1. Arquitectura [hecho]
- Un *Bicho* tiene un **órgano motor** (`OrganoMotor`, hijo de `ClassOrgano`) que decide *qué* movimiento pedir, y un **simulador físico** `Sim*` (`SimPeaton`, `SimEscalador`, `SimAuto`, `SimTanque`, `SimBalsa`, `SimLancha`, `SimSub`, `SimAve`, `SimMisil`, `SimObjeto`, `SimPasivo`, `SimRail`, `SimSeguidor`, `SimExplosion`) que integra el movimiento y resuelve colisiones. El motor llama `Sim::Mover(dx,dy,dz,dAngulo,flag)` = `FUN_0066b240` (para SimPeaton) con el **desplazamiento deseado por ciclo**; `FUN_005738d0` lo acumula en el vector de impulsos del Sim (`*(Sim+0x8c)+0x2c..0x38`), y marca "moviéndose" (`Sim+0xa4`) si `|dz|>0.01` o `|dx|+|dy|+|dz|>0.015` (consts `0x79ae98` f32=0.01, `0x7a1118` f64=0.015).
- Jerarquía: `SimBichoBase : ISimBicho, ISimInercias, SimComparableBase`; `SimBichoTerrestreBase` (0x574200 = integrador terrestre) → `SimPeaton/Auto/AutoOrg/Tanque/Lancha/Balsa/Sub/Seguidor`; los demás heredan directo de `SimBichoBase`. Cada Sim tiene un `Parachoques*` (colisión) del tipo correspondiente (ver §6).
- Posición del Bicho (cuerpo): `x=+8, y=+0xC, z=+0x10`, ángulo `+0x5C` (leído por `FUN_004dfce0`, **en grados**), radio del cilindro `+0x54`, sector actual `+0xE4`. El motor lo ve como `**(motor+0xC)`.
- `FUN_006102E0` (común a todos los motores, vt+0x58) = "estable en el suelo": `|Δx|+|Δy|+|Δz| (vs posición del ciclo anterior motor+0x1C..0x24) < 1.0` y `z < plano(x,y)+2.0` (`0x795e18`=f64 1.0, `0x794a70`=f64 2.0).
- **Plano del sector**: el sector `+0xE4` trae `z = a·x + b·y + c` con `a=+0x20, b=+0x24, c=+0x28`. La altura del suelo sale del sector, no de una malla.

## 2. Mensajes del motor — manejador compartido `FUN_0060F620` (vt+0x0C) [hecho]
Todos los `Motor*` heredan el mismo manejador de mensajes `MSGO_MOTOR_*` (los motores concretos añaden otros en vt+0x30). Cada comando se ignora si `motor+0x14 & 4` (muerto/ARGG) o si la prioridad `param_5 < motor+0x4C`. Mapeo:
| Mensaje | Acción (método virtual) |
|---|---|
| `MSGO_MOTOR_GOTO` | vt+0x44 `GoTo(punto)` (MotorAndante: `FUN_005dd950`) |
| `MSGO_MOTOR_BUSCADORGOTOSECTOR` | vt+0x4C (`FUN_005ddba0`: ir a un *sector*; busca el segmento en la lista de vecinos del sector `+0x14/+0x18`, pasos de 0x2C bytes) |
| `MSGO_MOTOR_BUSCADORGOTOPUNTO` | vt+0x48 |
| **`MSGO_MOTOR_SETVEL`** | vt+0x38 `SetEmpuje(v)`: MotorAndante `FUN_005dbee0` → `motor+0x50 = motor+0x84 = v` (MotorAliado `FUN_005d6910`: `+0x50 = +0xAC = v`) |
| `MSGO_MOTOR_SETDIR` / `SETANG` | vt+0x3C / vt+0x40 |
| `MSGO_MOTOR_PARAR` | vt+0x50 (MotorAndante `FUN_005dde80`... ver slot 21: para y vuelve a estado 0) |
| `MSGO_MOTOR_GETVEL` | devuelve módulo de la velocidad; `GETVELXYZ` = `pos − pos_ciclo_anterior` (`+0x1C..0x24` vs `+0x28`) |
| `MSGO_MOTOR_ON/OFF` | bit0 de `+0x14` |
| `MSGO_ARGG` | PARAR + marca bit2 (muerto) |
| `SETPRECISION n` (MotorAndante `FUN_005e0970`) | `+0x80 = n²` (**tolerancia de llegada al cuadrado**) |
| `SETTESTS m` | `Sim.setTests(m)` (`FUN_0066aa80`: máscara de tests de colisión del Sim, 0xFF = todos, 0xFB = sin el bit 2 mientras el motor está "agachado" `+0x6C`) |
| `SETTREPAR/GETTREPAR` | orden/consulta de trepar (§7) |
| `SETBUCEAR` (MotorAliado `FUN_005DB900`) | bucear (§8) |
| `SETVELVEC` (MotorObjeto `FUN_005e0d10`) | velocidad vectorial de objetos |

## 3. Velocidades [hecho salvo lo marcado]
**Valores por defecto** (constructor `FUN_005dfc00` MotorAndante; `FUN_005dab30` MotorAliado):
| Campo | Valor | Origen |
|---|---|---|
| `Empuje`/`StdVel` inicial (MotorAndante `+0x50/+0x84`; MotorAliado `+0x50/+0xAC`) | **2.5** u/ciclo | `0x793CE8` f32 |
| tolerancia de llegada² (MotorAndante `+0x80`) | **4.0** (radio 2) | `0x7941BC` f32 |
| tolerancia² MotorAliado (`+0xA8`) | `(radio_cuerpo+1)²` (`radio=cuerpo+0x54`; los comandos tienen `.R 10` → 121) | `FUN_005dab30` |
| `+0x100` / `+0x104` del motor = máx. **bajada / subida** de escalón del Sim peatón | **20 / 15** | `0x794790`, `0x798DEC`; `SimPeaton+0xCC/+0xD0` (§5, `FUN_0066BFE0`) |
- `.STDVEL x` (MAC/MIS, órgano `MotorAndante [ .STDVEL 1.5 ]`) sobreescribe `+0x84` (`FUN_005dc070`; MotorAliado `FUN_005d6d60` → `+0xAC`). Valores en los datos: `1.5` ×3 (cabinas CAMION/CISTERNA/CAMDES: el conductor), `2` ×1; los otros 22 `MotorAndante` y los 55 `MotorAliado` (comandos/aliados) usan **2.5**. Editor: diálogo `Órgano MotorAndante: Empuje, Std. Vel.`.
- **Tope de `MSGA_ANDAR_SETVEL`**: `FUN_004C4530` recorta la velocidad pedida a **≤ 4.0** (`0x7941BC` f32) y la reenvía al motor como `MSGO_MOTOR_SETVEL`.
- **Andar vs correr (animación)** — `FUN_004C3AA0` (ClassAcpAndar): vel==0 → `REPOSO`; vel ≤ **2.8** (`0x7997B8` f32; ojo, cadena `333@`) → `ANDAR`; vel > 2.8 y correr permitido → `CORRE`/`CORRER`. (Si no, `A`.) Cada 200 ciclos quieto con permiso fuma (`FUMAR`).
- **Jugador (`ClassAcUsuarioGoto` `FUN_004BC460/4BC660/4BC950`)**: elige la *animación* con el flag de correr: `ANDAR` / `CORRE` / **`ARRASTRARSE`** si el bicho tiene el bit `0x40` en `bicho+0x23C` (tumbado/agachado); en ese caso **no se puede correr** (flag forzado a 0). Emite el goto al buscador (`FUN_00628470` → `TPathTool`, §9).
- **NO LEÍDO**: de dónde sale el número de velocidad concreto del comando al *andar* (probable 2.5 = StdVel), al *correr* (≤4.0) y al *arrastrarse*: el emisor que arma la estructura `MSGA_ANDAR_IRA` (+0x14 = float velocidad) para el jugador no se localizó; la velocidad de patrulla viene del campo "Velocidad" de la ruta (`AcpAndar+0xCC`, `FUN_004C5180/4C5510`).
- **ANM** (`SEQUENCE nombre,pasos,a,b` = `FUN_004E3CF0` → `FUN_004E39C0`; `NLSEQUENCE` = no cíclica): registro de 0x80 B, `+0x78 = a`, `+0x74 = b`. Valores reales: `COMANDO.ANM` ANDAR `[8,35,0]`, **CORRE `[8,71,0]`**, **ARRASTRARSE `[8,30,0]`**; `SOLDADO.ANM` ANDAR `[8,33,0]`, CORRER `[8,55,0]`; `PERRO.ANM` ANDAR `[8,21,0]`, CORRER `[8,0,9]`. [hip] `a` = ciclo de zancada que sincroniza la animación con la velocidad; **el consumidor de `+0x78` no se leyó** (copiado a descriptores de 16 B por `FUN_004E1380/4E2010`).

## 4. Paso de caminata por ciclo (MotorAndante `FUN_005DCF70`, estado 3/sub 1) [hecho]
1. Destino `(+0x58,+0x5C)`, `d² = |dest−pos|²`. Si `d² ≥ tolerancia` (parámetro; `+0x80` en sub 1, 4.0 en sub 2):
2. Rumbo al destino = `atan2` en **grados** (`FUN_00428710`). Se actualiza el ángulo objetivo `+0x54` sólo si `d² > 1.5·r²` (r = radio cuerpo; `0x793830` f64 1.5), para no oscilar cerca.
3. Giro = `normalizar(+0x54 − ángulo_actual)` a [−180,180) con `FUN_005DBCA0` (`0x793398`=360, `0x793E68`=180).
4. Velocidad `v = motor+0x50`. **Frenado de llegada**: si `d² < 16·v²` y `v>0.001`: `v' = d / N` con `N = entero(d/v)` (`FUN_005049C0` + `FUN_0070A910`) → llega justo en un número entero de ciclos [hip: redondeo exacto de `N` sin confirmar; ver §Pendiente].
5. Si el sector del bicho (`+0xE4`) es de **tipo 1 o 3**: `v ×= 0.5` y giro `×= 0.5` (`0x794660` f64 0.5). MotorAliado lo hace salvo si `+0x90 != 0`.
6. Sale `Mover(cos(Δ)·v, sin(Δ)·v, 0, Δ, 0)` con `Δ` = giro pendiente (paso 3, ya x0.5 en agua) [hecho: el argumento del seno/coseno es `Δ` y hay un `fmul 0.0174533` (grados->rad) en el desassembly; `FUN_0070B650`=cos y `FUN_0070B780`=sin por la forma de uso, wrappers CRT]. Es decir **el desplazamiento se pide en el marco local del bicho** (adelante = `v·cos Δ`, lateral = `v·sin Δ`), no hacia el destino en mundo; el Sim lo rota con su ángulo [hip: la rotación no se leyó]. Efecto: si el cuerpo no mira al destino avanza menos hacia delante mientras gira (<=45°/ciclo, §5). `FUN_005049C0` del paso 4 es un envoltorio CRT de redondeo (`FUN_0070C6D0`, máscara de bits del double): **no confirmado si es floor o ceil**.
7. Si ya llegó (`d² < tolerancia`): envía `MSGA_MOTOR_PUNTOALCANZADO`; si `+0xB8==0` gira a la orientación final pedida (`+0xBC`: 0=mantiene, 1=hacia el destino, 2=opuesto) y pasa a estado 2 (giro en sitio) si el error angular ≥ 4°.
- **Estado 2** (giro en sitio, `FUN_005DFFE0` case 2): `Mover(0,0,0,Δ,0)` con `Δ = normalizar(+0x54 − ang)`, termina con `|Δ| < 0.001` (`0x793228`). El giro **no está limitado por una velocidad angular fija**: el `dAngulo` completo se pasa al Sim y éste lo limita (ver §5 [NO LEÍDO el límite]).
- Estados MotorAndante (`+0x64`, subestado `+0x68`; `FUN_005DC750` = set): 0 parado · 1 recuperación (`FUN_005DCA90`: 12 intentos de reanudar, luego `FUN_005DC1C0`) · 2 giro en sitio · 3 mover (sub1/2 punto, sub3 sector `FUN_005DCCA0`, sub4/5 tramo recto/rampa `FUN_005DD480`) · 4 trepar (usa el Sim `+0x7C` = `SimEscalador`, subs 6..12). Flags derivados: `+0x6C`=agachado/arrastre(sub 2/3), `+0x70`=andando, `+0x74`=sub 4/5. Bit1 de `+0x14` = "en marcha".
- Tramo recto/rampa (`FUN_005DD480`, sub 4/5): avanza `v` (×0.5 en sectores tipo 1/3) por el segmento `(+0xE4,+0xE8)` con dirección `(+0xEC,+0xF0)`, longitud `+0xF4` (rampas y escaleras entre sectores). Sub 5 variante curva (arco de radio `+0xEC`, `v/radio·57.2958` grados por ciclo).

## 5. Sim / inercias / integración [hecho en estructura; parcial en números]
**Bucle del mundo** (`FUN_0057E950`, por ciclo, para cada bicho con Sim; el motor ya corrió antes y dejó `Mover(dx,dy,dz,dAng)` acumulado en los impulsos):
1. vt+0x24 (`FUN_0066AC80` sincroniza Sim<-cuerpo), vt+0x34 (`FUN_0066AC00`), **vt+0x3C (`FUN_0066BB20`, inercia/amortiguación)**, vt+0x38 (`FUN_00573E50` pone a cero acumuladores), y `FUN_0057E6E0(sim)` (paso de movimiento); luego `FUN_0057CDD0(bicho)` (reubica en la grilla espacial: bichos con radio `+0x54 <= 128` se indexan con `FUN_00574AB0`).
2. Segunda pasada: `FUN_0057E520` (colisión) por bicho y vt+0x28 (`FUN_0066BE70`: fin de ciclo; llama al detector de atasco `FUN_00574200`).

**Paso de movimiento `FUN_0057E6E0`** [hecho]: toma la velocidad deseada `v=(x,y,z,ang)` (`Sim+0x3C`) e intenta hasta **3 veces**: vt+0x40 (`FUN_0066BCD0` = *limitar*) -> posición candidata = pos + desplazamiento -> `FUN_0057E520(destino)`; si pasa, confirma posición/sector/ángulo (vt+0x2C). Si las 3 fallan prueba con desplazamiento 0 y llama vt+0x30 (deslizar) en bucle. No hay sub-pasos: **un solo salto por ciclo**.

**Limitar `FUN_0066BCD0` (SimPeaton)** [hecho]: si `r² = Sim+0xC0 > 0` y `|dxy|² > r²` el desplazamiento XY se reduce a longitud r (r = radio del cilindro del bicho: 10 en los comandos, o sea **máx. 10 u/ciclo por paso**); `dz=0` si flag `+0xE0`; **giro máximo por ciclo = ±`Sim+0xC4` = ±45°** (`0x79747C` f32). Esa es la única "velocidad de giro" que se leyó: el motor pide el giro entero (<=180°, x0.5 en agua) y el Sim lo recorta a 45°/ciclo.

**Amortiguación `FUN_0066BB20` (SimPeaton)** [hecho]: `v.xy *= Sim+0xC8` (= **0.3**, `0x799110`); si `|v.xy|² < 0.01` -> 0; `vz>0 -> 0`; si el Sim no está forzado (`+0xD4==0`): mezcla `v = 0.8·v + 0.2·v_anterior` (`FUN_005734A0`, `0x7A95D8`=0.8; `v_anterior` = copia en `Sim+0x90..0x9C` tomada en `FUN_00573590/574200`) = **inercia**; si `|vx|+|vy|+|vz| < 0.001` -> 0; `|vang| < 0.001` -> 0.
[NO LEÍDO] el orden exacto entre "sumar impulsos del motor (`+0x8C+0x2C..`) a la velocidad (`+0x88`)" y estas dos operaciones; por eso **no puedo afirmar si la velocidad efectiva de caminata es exactamente `StdVel` o `StdVel` filtrada por 0.3/0.8**. Leer `FUN_00573600`/`FUN_00575F60` y quién copia `+0x8C+0x2C` a `+0x88`. Hasta confirmarlo, el port debe tratar `Mover` como desplazamiento por ciclo.

**Cruce de sectores `FUN_0066BFE0`** [hecho]: el vecino se acepta si `dz = z_plano_destino - z_actual` cumple `dz <= Sim+0xD0 (=15, subida)` y `dz >= -Sim+0xCC (=-20, bajada)`; si no, bloqueado. Si el sector vecino está tras otra arista, empuja el cuerpo hacia el punto medio de la arista con intensidad `2/|.|`.

**Detector de atasco `FUN_00574200`** [hecho]: cuenta ciclos con movimiento pedido pero `|v.xy|² < 0.0001` y `|vang|<0.01`; al superar **16** avisa al dueño (vt+0x64) e **invierte** los impulsos acumulados (rebote); el contador se reinicia a los 5 ciclos sin atasco.

**Tests de colisión `FUN_0057E520`**: máscara de bits `Sim+0xB4` (`MSGO_MOTOR_SETTESTS`; por defecto 0xFF; el motor pone 0xFB mientras `+0x6C`): `0x1` bicho<->bicho (`FUN_00577290`), `0x2` (`FUN_005775B0`), `0x4` sectores/volúmenes (`FUN_0057B660`), `0x8` (`FUN_0057CEA0`), `0x10` (`FUN_0057E2A0`). Qué es cada uno: [hip], sin leer.
- Repulsión entre cuerpos (`FUN_00573EC0`): suma al impulso un vector separador acotado a `(radio_otro + 10.0)`.
- `SimPeaton` (ctor `FUN_0066B080`, 0xF4 B, vtable `0x7AC3C4`): `+0xC0` r², `+0xC4` 45.0, `+0xC8` 0.3, `+0xCC/+0xD0` bajada/subida 20/15, `+0xB4/+0xB8/+0xBC` máscaras de test, `+0xE0` sin-z.
- `ISimInercias`: interfaz pura; `INERCIAS` en MAC solo aparece en `MotorRail` (`.INERCIAS 0.01`, `.INERCIAS [ 0.25 1 ]`), consumidor NO LEÍDO. Amortiguaciones de Auto/Tanque/Lancha/Balsa/Sub/Ave/Misil: NO LEÍDAS.

## 6. Parachoques (colisión) [parcial: lista, no semántica por clase]
Clases (cada una con su vtable de 7 métodos; el 3.º = "¿colisiona con?" / resolución): `ParachoquesNulo` (0x574A40, todo no-op), `Peaton` (0x66A8C0/66A8E0), `Ave` (0x666800), `Escalador` (0x667F50), `DuroAuto` (0x665960, 210 B), `DuroBalsa` (0x667600), `DuroLancha` (0x668DF0), `DuroSub` (0x66E0A0), `DuroTanque` (0x66EA00, 129 B), `DuroMisil` (0x669210), `Objeto` (0x669C20, 213 B), `Pasivo` (0x66A3B0), `Rail` (0x66C350), `Explosion` (0x668300), `BlandoSeguidor/DuroSeguidor` (0x66CE10/66CD40), base `SimParachoquesBase` (0x573C20: guarda dueño y su vtable `+0x1C`).
- **Regla de choque del peatón** (`FUN_0066AD30` + `FUN_0066ADF0`) [parcial/hip]: un sector/obstáculo bloquea según su tipo (`!=3` o `==1/3`, depende del modo agachado) y flags (`+0x50` bit2 `NTrans`, `0x400`); se compara la altura del obstáculo contra `Parachoques+0x10/+0x14` con tolerancia 1.0; detalle sin cerrar.
- **NO LEÍDO**: qué hace cada Parachoques concreto (daño, empuje, atropello); `ClassVolumen/ClassVolDinamic/ClassVolMapa`.

## 7. Trepar / escalar [parcial]
- Estado 4 de MotorAndante usa **`SimEscalador`** (0xA4 B, ctor `FUN_00668130`, parachoques `ParachoquesEscalador`); lo conduce `FUN_005DF1A0` (2086 B, **NO LEÍDO a fondo**). `GETTREPAR` devuelve dirección: sub 6→1, 7→2, 8→3, 9→4, 10→−1, 11→−2, 12→−3 (arriba/abajo, empieza/ciclo/fin).
- Animaciones: `ESCALAR_EMPIEZA / ESCALAR_CICLICO / ESCALAR_FIN` (+ `_DESNUDO`). Mensajes `MSGA_ENTRAS_EN_ESCALERA/SALES_DE_ESCALERA`. `TPathTool::mandaGotoEscalando`, `TPathTool::EnEscalera`.
- Datos: `.VOLCOLISIONSUBIDA`, `ClassAcEscala` (Punto alto/bajo), `ClassAUEscalar`: NO LEÍDOS.

## 8. Agua / bucear / balsas / vehículos [parcial]
- MAC reales (todos los parámetros que traen los `.MOTOR`): `MotorAuto [ .VELMAX 5|10 .ACBASE 1 .WAV CAMN .ANGREV $AngMarchaAtras ]`, `MotorTanque [ .VELMAX 2 .ANGREV .. .WAV TANQ ]`, `MotorBalsa [ .VELMAX 4|1.4 .ACBASE 1 .GIROMAX 3 .SOBREAGUA 1 .WAV REMA ]`, `MotorLancha [ .VELMAX 4 .ACBASE 1 .GIROMAX 3 .SOBREAGUA 1 .WAV LANC ]`, `MotorRail [ .RAIL [P0 P1] .INERCIAS .. .WAV TREN ]`, `MotorObjeto [ .FIJO .NOCAE .EXPLOTA ]`. Unidades de `.VELMAX` = u/ciclo [hip: consistente con el tope 4.0 de andar].
- Motores de vehículo: `MotorVehiculo` + `Auto/Balsa/Ciclo/Lancha/Sub/Tanque` (clase base común `FUN_005F1E30`); lógica de aceleración (`ACBASE`), giro (`GIROMAX`, `ANGREV`) **NO LEÍDA**; Sims: `SimAuto/Tanque/Balsa/Lancha/Sub` (integrador `FUN_00574200`).
- Bucear: `MSGO_MOTOR_SETBUCEAR`, `ClassAuBucear`, animación `BUCEAR`: NO LEÍDO.
- Pilotaje (`AcPilotaje`, diálogo): "Velocidad normal / rápida", entradas Tierra/Agua/Aire/Balsa: NO LEÍDO.

## 9. Búsqueda de ruta [parcial pero con estructura clara]
- **No es A\* sobre grilla de celdas: es un grafo de *sectores* poligonales** cargado de `MAPAnnnn.SEC` (magia `NIBS`) más un "buscador" de bajo nivel (`BuscadorPuntoAPunto`, `GridSeek*`, `SeekToPoint`, `SeekBackToPath`, `SeekToNextSec`: NO LEÍDOS).
- **`TPathTool`** (0x6262E0–0x62A700, con cadenas de log `TPathTool::…` que documentan su máquina de estados): `buscaCamino` `FUN_00627490` (llama al calculador de caminos `FUN_00624B90` del objeto `DAT_0083FEA0+0x150`, devuelve nº de puntos, estado `setEstado(de→a)` `FUN_00626FC0`), `mandaGoto` `FUN_00629EF0`, `mandaGotoBuscador/Escalando/BuscadorAuxiliar` (`FUN_00628720/627990/627CD0`), `msgSectorAlcanzado/PuntoAlcanzado/DestinoInalcanzable/Crisis/Colision` (`FUN_00628B60/628C40/62A2E0/62A370/62A400`), `anulaRutaSiPasaPorSector[DeTipo|ConFlags]` (`FUN_00627DB0/627EB0/628080`), `abandona` `FUN_006281A0`. Rechazo de destino: "destino no transitable a pSec==0". Ya-en-destino: `d² < 4.0`.
- Mensajes de coordinación AI↔motor: `MSGA_MOTOR_PUNTOALCANZADO`, `DESTINOINALCANZABLE`, `BUSCADORSECTORALCANZADO`, `CRISIS`; los consume `ClassAcpAndar` (`FUN_004C63B0`).
- Interno del algoritmo (`FUN_00624B90`, `FUN_006251D0`): NO LEÍDO.

## 10. Sectores / formato `.SEC` [hecho en lo estructural; verificar con archivo real]
Cargador: `FUN_005FCBD0(archivo)` → si el primer u32 = `0x5342494E` ('NIBS') → `FUN_005FBEA0` (binario); si no → `FUN_005FC4C0` (texto, `.SECTORS [ ]`). Binario:
1. `u32 N`; `N × (f32 x, f32 y)` vértices (en memoria 16 B: x,y,z=altura máx calculada, flag). Bbox global: `+0x24..0x30`.
2. Array de sectores A: `u32 n` ; luego por sector un registro de **0x24 B**: `nverts, planoA(f32), planoB(f32), planoC(f32), tipo, ?, ?, flags, longNombre`; `nombre[longNombre]` ; si `flags&0x20`: 2 floats (vector de dirección/escalera, flag 0x20 si |a|+|b|>0); luego `nverts × u32` índices de vértice. Se leen **dos arrays** (A en `+4` con `+0x14` elementos, B en `+8` con `+0x18`).
3. En memoria cada sector ocupa **0x78 B**: `+0` tipo, `+4` índice, `+8/+0xC` centroide x,y, `+0x14` nverts, `+0x18` puntero a lista de aristas (0x2C B c/u: p0,p1 punteros a vértice, vecino en `+0x18`), `+0x20/+0x24/+0x28` plano a,b,c (z = a·x+b·y+c), `+0x2C` z del centroide, `+0x50` flags (bit2 = ¿transitable/sólido?, bit `0x10000` = marcado por bloque `TW3`, bit 1 en array B), `+0x54..+0x68` bbox (minx,maxx,miny,maxy,minz,maxz).
4. Tras los arrays: bloque `TW1` (vecinos del array A, índice u32, `0xFFFFFFFF`=nulo, enlace por arista 0x2C B), `TW2` (enlaces A↔B: `[sectorA, arista, sectorB, arista]` hasta −1), `TW3` (lista de índices que reciben flag `0x10000`).
- **Tipo de sector** (`+0`; volcado de depuración `FUN_0053E2E0`, tabla de salto `0x53ED38`) [hecho]: **0 LAND, 1 WATER, 2 SNOW, 3 DEEPWATER, 4 CONVEYOR, 5 RAPIDS, 6 LASTTYPE**. Efecto leído: **WATER(1) y DEEPWATER(3): velocidad y giro x0.5** (§4). Efecto de nieve/cinta/rápidos y el id extra de tipo 2 (`FUN_005D1420`): NO LEÍDO.
- **Flags `sector+0x50`** (mismas fuentes; nombres de 6 letras truncados en el exe) [hecho los nombres, hip la interpretación]: `0x1 Inclin` (plano inclinado a,b distintos de 0; lo pone el cargador), `0x2 Superp` (superpuesto; los del array B), `0x4 NTrans` (no transitable), `0x8 NCamin` (no caminable), `0x10 Ocluso`, `0x20 Corrie[nte]` (hay vector de corriente `+0x40/+0x44`: 2 floats extra en el archivo), `0x40 PEscal`, `0x80 PExplo`, `0x100 NVista`, `0x200 NCorri` (no correr), `0x400 SoloAg` (solo agachado), `0x800 NTirar`, `0x1000 NTirAt`, `0x10000 Cubier[to]`. Al cargar se enmascara con `0x3FDC` (o `0x3EDC` si no es `NTrans`): **`NVista` solo se conserva en sectores no transitables**. Mensajes que cambian flags en juego: `SECTORESHARANTRANSITABLES/INTRANSITABLES/SOLOAGACHADO/NOSOLOAGACHADO`, `HACERNOTRANSITABLE`.
- **Verificado contra los 11 `.SEC` reales**: el parser de arriba consume los 2 arrays sin fallar en `MAPA0000..0009` y `TUT`. Sectores (array A + array B) y tipos: `MAPA0000` 700 vért., 481 {LAND 366, WATER 3, SNOW 7, DEEPWATER 105}; `0001` 929 {LAND}; `0002` 1232 {LAND}; `0003` 1114+14 {LAND 1015, SNOW 99}; `0004` 1196+2 {0:1125, 2:25, 3:43, 1:3}; `0005` 808; `0006` 806 {0:744, 1:30, 3:28, 2:4}; `0007` 924+8; `0008` 313; `0009` 1195+2; `TUT` 312. Tras los arrays quedan 6-38 kB (bloques `TW1/TW2/TW3` + lo que leen `FUN_005FA5F0`/`FUN_005F4A40`, NO LEÍDO). Nombres de sector vacíos; el campo 6.º del registro (`u1`) vale 0/255/310 en `MAPA0000` (NO LEÍDO).
- Ejemplo real: `MAPA0000.SEC` empieza `4E494253 BC020000 …` → N=700 vértices, x=157.0 y=2677.0 (f32). Archivo de 45 265 B.

## 11. Proyección isométrica / coordenadas [NO LEÍDO]
No se leyó (`MAPDIMXY`, relación mundo→píxel). Las coordenadas de mundo están en f32 (x,y suelo, z altura); sectores trabajan en (x,y) con plano z. Ver agente de gráficos/mapa.

## Pendiente (siguiente pasada)
Suma de impulsos->velocidad (`FUN_00573600/575F60`); trig exacta de `FUN_0070B650/0070B780` y redondeo de `FUN_005049C0`; semántica de Parachoques; tipos de sector; emisor de velocidades del jugador; vehículos; proyección.

## Hallazgos para otros
- **IA/mensajes**: `ClassAcpAndar` (`FUN_004C63B0`) maneja `MSGA_ANDAR_{PAUSE,UNPAUSE,STOP,SETVEL,SETRADIO,IRA,FOLLOW,GETINFO}`, `MSGA_BUSCADOR_{LLEGADA,STOP,CRISIS_POR_SABOTAJE_EN_SECTOR}`, `MSGA_MOTOR_{PUNTOALCANZADO,CRISIS}`, `MSGA_TRANSMIGRATE`, `MSGA_PUEDES_FUMAR`; tras 200 ciclos quieto emite `MSGO_VISTA_SETFACTORALCANCE` (cambia el alcance de visión mientras fuma, valor `0x793730`=0.5) y `MSGA_LOOKSCAN_FACTOR`.
- **Jugador**: `ClassAcUsuarioGoto` usa el bit `0x40` de `bicho+0x23C` para tumbado (ARRASTRARSE, sin correr) y `bicho+0x23C>>6&1` en la selección de sector transitable (`FUN_0053A250`).
- **UI**: `ClassLineaNumerosBarraGameSpeed` (opción velocidad de juego), campo del bucle `param_1[0x13e]`.
- **Gráficos**: handlers del flujo ANM = cadenas `NUM_SEQUENCES %l / SEQUENCE %s,%l,%l,%l / NLSEQUENCE / CHAINSEQUENCE %s,%l,%l,%l,%s,%s / FRAME %l / SPRITE %s,%l,%l,%l / SIZESPRITE / NHOTSPOTS / HOTSPOT / ANCLAJES / ANCLAJE / ANCLAJESEC` (`FUN_004E4100`); `SEQUENCE`=cíclica (`0x4E3CF0`), `NLSEQUENCE`=no cíclica (`0x4E3D30`).


## Correcciones tras la investigación Q1 (2026-10-28; ver `docs/research/q1-movimiento.md`)
- §4 estaba mal: el motor llama `Mover(v·cosφ, v·sinφ, 0, Δ, 0)` con φ = rumbo al destino en mundo (`atan2`, grados 0..360) y Δ solo el giro; no es `cos Δ`/`sin Δ` en marco local.
- La amortiguación ×0.3 y la mezcla 0.8/0.2 solo dan rampa de arranque (0.8, 0.96, 0.992…) y deriva al soltar: **la velocidad en régimen es exactamente la pedida**. Andar del jugador 2,5 u/ciclo (`0x793CE8`, verificado = 2.5 f); correr 6,0 (COMANDO, CONDUC) o 5,0 (resto; tabla `0x815198`, verificada); agachado/arrastrarse = 2,5; agua tipo 1 y 3 ×0,5; soldado patrullando = `.VELOCIDADTRAMO` o `.VEL` de la ruta o 1,5.
