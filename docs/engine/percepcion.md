# Percepción: vista, oído, memoria, ruido, luz (Commandos 1, `coman_mp.exe`)

Estado: **informe parcial pero con lo central cerrado**. Marcas: **[hecho]** = leído en el decompilado/exe con dirección; **[hip]** = hipótesis; **NO LEÍDO** = no se pudo leer. Direcciones = VA del exe (base 0x400000). Muchas entradas de vtable son thunks `jmp`; acá van las direcciones de la función REAL. Ticks: el juego corre a 20 ciclos/s por defecto (`exe-lectura.md`).

## 1. Resumen ejecutivo
1. **Cada tick** `ClassBicho::update` (`0x50bf30`, vtable slot 8) llama al slot 4 de sus órganos: Vista `bicho+0x214` (solo si `+0x224!=0`), Motor `+0x210` (si `+0x228`), **Oído `+0x218`**, **Memoria `+0x21c`**, `+0x220` (si `+0x22c`); después las acciones (lista en `+0x17c`) **[hecho]**.
2. **Vista01 escanea TODOS los ticks** (slot 4 = `0x61c890`): gira la cabeza hacia el ángulo objetivo (máx. `PASO` grados/tick), recalcula el cono y busca entidades. **No hay "contador de detección" en la vista**: si una entidad pasa los filtros, en ese mismo tick le llega al bicho el mensaje `MSGA_VISTA_ELEMENTOVISIBLE` **[hecho]**. Cualquier retardo de alerta está en las acciones (`AcBanpe2`, `AcPatrulla`…), no en el órgano. Del retardo de alerta de esas acciones: **NO LEÍDO**.
3. **Alcance**: radio `MOD*2` (default **800** si el MAC no pone `.MOD`) y apertura `ANG` (default **70°**). Con luz ambiente 1.0 (día) el alcance es completo; de noche el alcance "libre" se reduce por el factor de luz y más allá solo se ve lo **iluminado por un foco/zona** **[hecho]**.
4. **Agacharse/buceo/pisadas** acortan la vista a la mitad (ver §3.4) **[hecho]**.
5. **Oído**: no usa el `Umbral` del editor (el slot de parseo de `Oido01` es un `ret`). Tiene dos vías: (a) **registro global de ruidos** con radio por id de sonido (tabla de 48 ids, §5) y (b) mensaje directo `MSGO_OIDO_SONIDO` con radio fijo **200.0** **[hecho]**.
6. **Memoria01** = lista enlazada de ítems con vida que baja **5 por tick** **[hecho]**.

## 2. Mapa de funciones
| Función | Dirección real | Notas |
|---|---|---|
| Vista01 ctor | `0x61b6e0` | defaults (§3.1) |
| Vista01 parse MAC (vt slot 1) | `0x61b050` | lee `ALT`, `MOD`, `ANG`, `CABEZA`, `PASO` |
| Vista01 mensajes (slot 3) | `0x61c8c0` | SETVIS/CLEARVIS/SETANGCABEZA/ZOOM…(§3.6) |
| Vista01 tick (slot 4) | `0x61c890` | `+0x78=-1`; `0x61ac30` (cabeza); si hay dueño `0x61c5b0` (escaneo) |
| Vista01 ¿ve el punto P? (slot 10) | `0x61b990` | test de puntos (§3.3) |
| Vista01 polígono del cono (slot 9) | `0x61bd30` | para dibujo/volumen; sale de `0x61b7c0` |
| Recalcular cono | `0x61b7c0` | radios y semiplanos (§3.2) |
| Caja envolvente del cono | `0x61ae90` | `+0x88..0x9c` |
| Giro de cabeza | `0x61ac30` | |
| Escaneo + envío de mensajes | `0x61c5b0` | usa `0x6bb660` (consulta espacial) con callback `0x61c4d0` |
| Filtros de candidato | `0x61b380` (rango), `0x61b490` (ángulo), `0x61b580` (oclusión) | |
| Oclusión rayo/sectores | `0x5f9820` y `0x63e200` | |
| Luz en un punto | `0x701d50` / `0x7023b0` / `0x702730` | |
| Cargar luces (`TOKEN/RADIO/NIVEL/INACTIVA`) | `0x701e80` | |
| Ambient (setter) | `0x701bc0` → global `0x838158` | |
| Tick de misión: hora y luz | `0x5ac560` → `0x5ab7b0`, `0x5ab730`, `0x53f270` | día/noche |
| Oido01 ctor / tick / msg | `0x61a7a0` / `0x61a590` / `0x61a830` | |
| Callback de ruido oído | `0x61a3c0` | tipos 1,2,3 |
| Registro de ruidos | `0x680530` (alta), `0x680220` (vejez), `0x680f10`/`0x680fe0` (búsqueda), `0x681220`, `0x6811b0` (tick) | global `0x83d654` |
| Alta de ruido | `0x681b90(tipo, id4cc, bicho, vol)`, `0x681660`, `0x681700`, `0x6817a0/0x6817f0` (+reproduce WAV `0x67f9c0`) | |
| Tabla id→radio | `.data 0x821de0` (48 × {id 4cc, float radio}); cuenta en `0x821f60` | |
| Memoria01 ctor / tick / msg | `0x6198d0` / `0x6196a0` / `0x6199a0`; alta `0x619780`, lectura `0x619650` | |
| AcVigilar parse / tick / msg | `0x4c0a60` / `0x4c1b90` / `0x4c10d0` | barrido |
| AcVigilar: giro de cabeza barrido | `0x4c1a30`; fijar `0x4bfb30`; zoom `0x4bf9b0`; alcance `0x4c0e60` | |
| AcVigilar: qué vio (despacho) | `0x4bfca0` | |
| AcPisada ctor (huella como objeto) | `0x496520` | |
| AcPisar | `0x4972b0` (parse) | NO LEÍDO a fondo |
| Mapa pisadas… | | NO LEÍDO |

## 3. VISTA (Vista01)
### 3.1 Campos y valores por defecto [hecho]
Estructura (offset en `this`; `this+4` = bicho dueño; el dueño tiene `x,y,z` en `+8,+0xC,+0x10`, **altura de ojos/cuerpo `+0x58`**, radio de colisión `+0x54`, bando `+0x108`, volumen/sector actual `+0xE4`, flags `+0x23C` y `+0x240`).

| Offset | Campo | Default (ctor `0x61b6e0`) | Origen |
|---|---|---|---|
| `+0x5C` | máscara de categorías visibles | `0xFFFFFFFF` en ctor, **se pone a 0 al parsear el MAC** (`0x61b050` termina con `+0x5c=0`) | SETVIS/CLEARVIS la modifican |
| `+0x60` | `ALT` altura del cono | **150.0** (`0x79988c`) | `.ALT` |
| `+0x64` (y copia `+0x70`) | alcance ("módulo") | **800.0** (`0x794cec`) | `.MOD v` → guarda **`2*v`** |
| `+0x68` (copia `+0x74`) | `ANG` apertura total | **70.0** (`0x796000`) | `.ANG` |
| `+0x6C` | `CABEZA` giro de cabeza respecto al cuerpo | 0 | `.CABEZA` |
| `+0x78` | prioridad de la orden de cabeza actual | −1 (se vuelve −1 cada tick) | |
| `+0x7C` | modo zoom activo | 0 | |
| `+0x80` | ángulo objetivo de cabeza | 0 | `MSGO_VISTA_SETANGCABEZA` |
| `+0x84` | `PASO` giro máx. de cabeza por tick | **90.0** (`0x793390`) | `.PASO` |
| `+0xA0/A4/A8/AC` | radios derivados (§3.2) | calculados | |
| `+0xB0..C4` | semiplanos del cono | calculados | |
| `+0x08..+0x44`, `+0x48` | lista de hasta **16** visibles (punteros) y su cantidad | | |
| `+0x54` | objeto "siempre visible" (seguimiento) | | |

Valores reales en los MAC (`research-c1\x\DATOS\MISIONES\*.MAC`, 96 MAC): la inmensa mayoría de bichos tienen `.VISTA [ Vista01 [ ] ]` (vacío = defaults 800/70°/150). Excepciones **[hecho, grep]**: `AVESTRUZ, LEON, PERRO`: `.ANG 90`; `BUNKER, TORRE`: `.MOD $Vision .ANG 40` (`$Vision` lo pone la misión); `NIDOMET`: `.MOD 320 .ANG 40` (alcance 640); `CANYON`: `ALT 150 MOD 400 ANG 70 CABEZA 0 PASO 90`; `PNZ2, PNZ3, TAN2DES`: `ALT 150 MOD 500 ANG 70` (alcance 1000); `TANQUETA`: `ALT 250 MOD 550 ANG 40` (1100); `SDK`: `ALT 250 ANG 40`. `GALLINA` no tiene Vista (solo Oido). Vehículos usan además `Vista02` (volumen de colisión, §3.7).
`Oido01`: 22 MAC con `[ ]` vacío y uno (`BARREAUT`) con `.UMBRAL 10` que **el código no lee** (§4).

Unidades: las del mundo del juego (el mismo espacio de `x,y` de los bichos). Equivalencia a píxeles/tiles: NO LEÍDO acá (ver agente de movimiento/mapa).

### 3.2 Cono: radios y semiplanos (`0x61b7c0`) [hecho]
- `A0 = +0x64` (radio completo). `luz = global 0x838158` (luz ambiente, §6; 1.0 por defecto).
- `A4 = luz * A0`; `A8 = A4`; `AC = A4 * 0.5`.
- Ángulos (grados): centro `c = heading_del_bicho + CABEZA`; borde izq `a1 = c − ANG/2`, borde der `a2 = c + ANG/2`. Normales: `n1 = (−sin a1, cos a1)` (`+0xB0,+0xB4`), `n2 = (sin a2, −cos a2)` (`+0xB8,+0xBC`), `n3 = ((cos a1+cos a2)/2, (sin a1+sin a2)/2)` (`+0xC0,+0xC4`, bisectriz). Conversión grados→rad `π/180`.
- "heading del bicho" = `*(float*)bicho` (el primer campo del objeto; `0x4dfce0` devuelve `*param_1`).

### 3.3 Reglas para que una entidad E sea "vista" (escaneo `0x61c5b0`, callback `0x61c4d0`) [hecho]
Se consultan las entidades en la caja envolvente `0x61ae90`. Para cada E se exige, **todo**:
1. **Categoría**: `E == this+0x54` **o** `(this+0x5C & E+0x240) != 0` **o** `(E+0x23C & 2) != 0` (flag 2 = lista "visible/chocable" de la entidad; ver §8 sobre la ambigüedad del nombre). Y `E != dueño+0x134`.
2. **Rango** `0x61b380` (d² = distancia² en XY, sin Z):
   - `d² > A0²` → no.
   - Si E **no** tiene (`0x23C & 0x40` agachado) ni (`0x23C & 0x1000` buceando) ni (`0x240 & 1` huella): `d² ≤ A4²` → visible clara (1); si no → intermedia (2).
   - Si **sí** tiene alguno de esos: `d² ≤ AC²` → clara (1); `d² > A8²` → no; si no → intermedia (2).
3. **Ángulo** `0x61b490`: con `r = E+0x54` (radio de E) y d = E−dueño: `d·n1 > −r`, `d·n2 > −r`, `d·n3 > const 0x792fa8 (=0.0)`. (El margen `r` hace que el borde del cono cuente al tocar el cuerpo.)
4. **Oclusión** `0x61b580`: solo si `[0x83fea0+0x150] != 0` y el dueño tiene sector `+0xE4`: rayo desde el ojo `(x,y,z+dueño.+0x58)` al objetivo `(x,y,z+E.+0x58)`; `0x5f9820` recorre los sectores/portales (cada paso con pendiente; falla si el rayo no sale por el sector) y luego `0x63e200` (obstáculos por volumen, hasta `E+0x50`). Ocluido si cualquiera falla. La regla: **un volumen/sector que bloquea el rayo a la altura de ojos esconde al objetivo**. Detalle de `0x5f9820` (formato sectores): NO LEÍDO a fondo → agente de mapa.
5. **Intermedia (2)**: se guarda con marca "en sombra" si **no** hay luz en la posición de E (`0x7023b0`→`0x701d50`) y luego se descarta (solo permanece si E está dentro del radio de algún foco/zona iluminada). **De día (luz=1) A4=A0 y no existe zona intermedia.**
6. Máximo **16** visibles por tick.
7. **Tapados entre candidatos**: para cada candidato con `0x23C & 2` se prueba (`0x529410/0x528f60`: proyección 2D del volumen del candidato desde la posición del observador) si tapa a otro candidato; el tapado se elimina.

Tras filtrar, para cada visible: si `dueño+0x108 == 1` (bando ALEMAN) se marca `E+0x23C |= 8` ("visto este tick"; `ClassBicho::update` lo pasa a `0x800000` y limpia el 8 al final del tick). Y se envía **`MSGA_VISTA_ELEMENTOVISIBLE`** al dueño (con E); si `E+0x240 & 0x400` (testigo) se envía **`MSGA_HE_VISTO_EL_TESTIGO`** a E con remitente el dueño **[hecho]**.

Bandos [hecho `0x50cf5c` ~]: `+0x108` = 0 NEUTRAL, 1 ALEMAN, 2 ALIADO (los comandos). No hay en el test de vista ninguna condición de "enemigo vs. aliado": filtra la categoría (flags) y la acción reacciona por bando de E (§3.5).

### 3.4 Modificadores del que es visto [hecho]
| Estado | Flag | Efecto | Dónde se activa |
|---|---|---|---|
| Agacharse | `0x23C |= 0x80 | 0x40`; además `bicho+0x58 = campo(+0x7C8) * 0.125` (`0x79a3e0`) | rango reducido a la mitad (`AC`), requiere luz en la zona `(AC..A8]`; altura del ojo del objetivo baja a 1/8 | `ClassAUAgacharse` (`0x512e70`, `0x4e5e00` anim `AGAC`) |
| Buceando | `0x23C |= 0x80 | 0x1000` | igual que agachado en el test de rango | `ClassAuBucear` (`0x4e9c10`) |
| Huella (`ClassAcPisada`) | `0x240 |= 1` | igual (rango reducido) | ctor `0x496520` |
| Alarma rota (`ALAM_ROTA_`) | `0x23C |= 0x40`, `0x240 |= 0x10000` | objeto con radio 20 | `0x7010b0` |
| Camuflaje / disfraz | NO LEÍDO en el test de vista. Hay `AuCamuflarse`, `AuDisfraz`, `MSGA_DISFRAZ_VISIBLE`, `MSGA_ESTOYDISFRAZADO`; el disfraz parece actuar vía el **bando** (`+0x108`) y mensajes de la acción (`AcVigilar` reacciona a `MSGA_NV_DESNUDO_VISTO`), no en `0x61b380` | → agente de acciones del jugador |

### 3.5 Qué se le avisa al guardia según lo visto (`AcVigilar::0x4bfca0`) [hecho]
Por tipo de E (`E+0x108`) y flags `0x240` de E (`E[0x90]`) / `0x23C` (`E[0x8f]`):
- **bando 0 (objetos)**: `&1` huella → `MSGA_PISADA_VISTA`/`MSGA_NV_PISADA_VISTA`/`MSGA_NV_NUEVA_PISADA_VISTA`; `&0x100` habitáculo con comando (`MSGA_GETINFO_HABITACULO`; `+0x108==2`) → `MSGA_CASA_VISTA`/`MSGA_NV_CASA_VISTA`; `&0x80` → `MSGA_SENUELO_VISTO`/`NV_SENUELO_VISTO`; `&0x800` → `MSGA_NV_TABACO_VISTO`; `&0x4000` → `MSGA_NV_ANIMALPELIGROSO_VISTO`.
- **bando 1 (alemán)**: `&0x200` (…); `&0x2000` → `MSGA_NV_ATONTADO_VISTO`; `&0x8000` → `MSGA_NV_DESNUDO_VISTO`; `&8` ignorado; si no: `0x23C&4` (**muerto**) → `MSGA_NV_MUERTO_VISTO`; `0x23C&0x4000` (esposado) → `MSGA_NV_ESPOSADO_VISTO`; si no `MSGA_ALEMAN_VISTO` + `MSGA_NV_ALEMAN_VISTO`.
- **bando 2 (comando)**: `MSGA_ENEMIGO_VISTO`/`MSGA_NV_ENEMIGO_VISTO`, vehículo enemigo `MSGA_VEHICENEMIGO_VISTO`, `MSGA_ALEMANATACANDO_VISTO`, y muerto `MSGA_NV_MUERTO_VISTO`.
Significado exacto del prefijo `NV_`: [hip] "no vigilado/ya visto"; no leído.
**Cuerpos que llaman la atención** ("Aliado muerto"/"Alemán muerto" de los diálogos `D_EO_VISTA01/02`): en runtime el mecanismo es `0x23C & 4` = muerto + categoría visible → `MSGA_NV_MUERTO_VISTO`. Qué hace cada acción con ese mensaje (alarma, ir a mirar): NO LEÍDO (agente IA). Los dos checkbox del editor parecen ser bits de la máscara `+0x5C` (SETVIS/CLEARVIS); asignación bit→casilla NO LEÍDA.

### 3.6 Mensajes del órgano (`0x61c8c0`) [hecho]
`MSG_GETBICHOSVISTOS` (devuelve cantidad y puntero a los 16), `MSGO_VISTA_SETVIS` (`mask |= v`), `MSGO_VISTA_CLEARVIS` (`mask &= ~v`), `MSGO_VEO_ELE` (¿ve a X? busca en la lista), `MSGO_VISTA_MIRAR` (fuerza escaneo), `MSGO_VISTA_SETANGCABEZA(ang, prioridad)` (si `prio ≥ +0x78`: `+0x80=ang normalizado`; y si no hay zoom, `+0x64=+0x70` alcance base), `…_CHANGEMOD(alcance*1000, ang, prio)` (`+0x64 = valor/1000`), `MSGO_VISTA_ZOOMIN` (alcance ×2 hasta tope 2×base y el ángulo baja proporcional, mínimo 5), `ZOOMOUT`/`SETALCANCENORMAL` (vuelve a base), `SETALCANCE`, `SETFACTORALCANCE` (alcance = base × factor), `MSGA_GETOBJVISTA[AMPLITUD][QUESITOS]` (devuelven el cono: pos, ojo `z+0x58`, heading+CABEZA, `ANG`, `A0/AC/A4`). Nadie envía `MIRAR` por nombre: el escaneo corre en el tick.
Giro de cabeza `0x61ac30`: `delta = norm(+0x80 − +0x6C)`; si `|delta| ≤ PASO` salta al objetivo; si no avanza `PASO` en el signo de delta. Con `PASO` 90 la cabeza llega al objetivo en 1–2 ticks.

### 3.7 Vista02 (volumen)
`ClassVista02`: ctor `0x61d2c0`, mensajes `0x61da20` (`MSGO_VISTA_SETOFFSET` offset x,y,z en `+0x5C..0x64`; `MIRAR` → `0x61d850`; `MSG_GETBICHOSVISTOS`, `MSGO_VEO_ELE`). Es el "volumen de colisión" (cilindro/polígono) con el que vehículos/barreras detectan: test `0x61d210`. Detalle: NO LEÍDO (solo cabecera). `ClassVisionVista` (`0x6b0a70`): NO LEÍDO.

## 4. OÍDO
### 4.1 Oido01 [hecho]
- Tick (`0x61a590`): si hay dueño, pregunta al registro de ruidos (`0x681220`) en la posición `dueño+8` con callback `0x61a3c0`. El registro tiene dos listas: **A** (128 entradas, vive 2 ticks, `0x680f10`) y **B** (32 entradas, `0x680fe0`, con contador de edad que sube cada tick sin expirar en `0x6811b0`); se mira A y, si no hubo nada, B. Una entrada "se oye" si `dist²(entrada, dueño) < radio²` (estricto) y `entrada.fuente != bicho dueño`.
- Callback `0x61a3c0` según `tipo` de la entrada: **1** → `MSGA_SONIDO_AMBIENTE`, **2** → `MSGA_SONIDO_ATENCION`, **3** → `MSGA_SONIDO_PELIGRO`, enviados al bicho con la entrada.
- `MSGO_OIDO_SONIDO` (`0x61a830`): guarda posición en `this+8..0x10`; si `dist(XY) < 200.0` (`0x794d30`, double) envía `MSGA_SONIDO` al dueño. `MSGO_OIDO_ESCUCHA` = misma consulta que el tick.
- **`Umbral` del editor no se usa en runtime**: slot de parseo `0x61a300` = `ret 4`. `.UMBRAL 10` (BARREAUT) es letra muerta salvo que lo lea otra clase. NO LEÍDO que alguna clase lo lea.
- Vejez: cada tick `0x680220` suma 1 a la edad; al llegar a **edad ≥ 2** se borra → un ruido vive **2 ticks (0,1 s)** [hecho].

### 4.2 Alta de ruidos (`0x680530`) [hecho]
`0x681b90(tipo, id, bicho, vol)` copia una entrada de 0x2C bytes (tipo, id, fuente, posición del bicho `+8..`, `+0xE4` …) y su radio = `tabla[id].radio` (busca por id en `0x821de0`; si el id no está en la tabla **no se registra**). Cap 128. Además reproduce el WAV (`0x6817a0`).

### 4.3 Tabla id→radio (`0x821de0`, 48 entradas) [hecho]
Los ids son constantes de 4 caracteres (en memoria little-endian: aquí ya decodificados al derecho). Radio en unidades del mundo.
Tabla completa (memoria→id real, radio), en orden de memoria. Por radio: 80 {ALTO,DETE,ATAK,GE01,GE02}; 125 {PING,PEDL,PEDW}; 150 {VMUE,VESP,QIEN,ESPG,APOE,AL01,AL04,AL10,KI03,RUGV,AVVE}; 300 {ALRM,ESPI,SOLD,AL12,ZO01,ZO02,LADR,RUGA,AVAT,CLXN,DCOY,TKTK,CLBA,FTRN}; 400 {FUSL,MET0}; 500 {MET1,NIDO,METL,METT}; 600 {PIPA}; 800 {SIRN,TELF}; 1200 {XGRA,GRAN,EBAR,TNKS,XPLO}; 0 {MXPL}. Detalle: OTLA→ALTO 80, EUMV→VMUE 150, PSEV→VESP 150, ETED→DETE 80, MRLA→ALRM 300, KATA→ATAK 80, IPSE→ESPI 300, NEIQ→QIEN 150, DLOS→SOLD 300, GPSE→ESPG 150, EOPA→APOE 150, 10LA→AL01 150, 40LA→AL04 150, 01LA→AL10 150, 21LA→AL12 300, 10OZ→ZO01 300, 20OZ→ZO02 300, 10EG→GE01 80, 20EG→GE02 80, 30IK→KI03 150, RDAL→LADR 300, VGUR→RUGV 150, AGUR→RUGA 300, EVVA→AVVE 150, TAVA→AVAT 300, NRIS→SIRN 800, FLET→TELF 800, NXLC→CLXN 300, YOCD→DCOY 300, KTKT→TKTK 300, ABLC→CLBA 300, NRTF→FTRN 300, GNIP→PING 125, APIP→PIPA 600, LSUF→FUSL 400, 0TEM→MET0 400, 1TEM→MET1 500, ODIN→NIDO 500, LTEM→METL 500, TTEM→METT 500, ARGX→XGRA 1200, NARG→GRAN 1200, RABE→EBAR 1200, SKNT→TNKS 1200, OLPX→XPLO 1200, LPXM→MXPL 0, LDEP→PEDL 125, WDEP→PEDW 125. Qué sonido (WAV) es cada id: NO LEÍDO → agente de sonido.

### 4.4 Quién emite (tipo, id) [hecho, grep de llamadas a `0x681b90`]
Tipo **3 (peligro)**: ALRM (20 sitios), XPLO, KI03, ZO01, ZO02, MET0, GRAN, EBAR, AL10…; tipo **2 (atención)**: ATAK (20), ALTO (8), LADR, VMUE, QIEN, AVVE, VESP, RUGV, RUGA, ESPG, DETE, AVAT, APOE, AL01/02/04…; tipo **1 (ambiente)**: TELF, ESPI, id leído del objeto (`+0x30`). Volumen pasado: `0.75` (`0x793240`) en casi todos. Pings: `0x681700(2,'PING',pos)`. Para el mapeo exacto acción→id, ver `grep 681b90` en los `fn_*.c` y agente de armas.
Quién emite el ruido del arma (tiro/silenciador) o de pisadas: NO LEÍDO (los disparos usan ids tipo MET0/MET1/FUSL? **[hip]** por nombres).

## 5. ZONAS DE SONIDO / SENSORES
- `ClassAcSensorSonido` (parse `0x4aabb0`: `.EVENT` (5 chars) → id de evento en `+0x28`; mensajes `0x4aac80`): si está activo (`+0x24==2`) y llega `MSGA_SONIDO_PELIGRO` o `MSGA_SONIDO_PANICO` **dispara el evento de misión `+0x28`** (`0x59a2a0`); `MSGA_ARGG` lo desactiva (`+0x24=0`) **[hecho]**. Es decir: sensor de ruido = ruido de tipo peligro/pánico en su zona → evento.
- `.SENSORES_SND_ZONA` en los MIS (11 mapas, p.ej. MAPA0001): lista `[ .ZONA ZONA_EXTERIOR .MENSAJE REXT ]`, `ZONA_TANQUE→RETA`, `ZONA_INTERIOR→REIN`, `ZONA_TEJADOS→RETE`: asocia zona nombrada → mensaje (parece ambiente/reverberación por zona, [hip]); su consumidor no fue leído. `.SENSORES_SND_ZONA` en MIS y `ClassGestorPorZonas_Sonidos` (`0x403f85`, vtable thunks): NO LEÍDOS.
- `ClassAcOjoDistante` (`0x40f312`…): NO LEÍDO.

## 6. LUZ, NOCHE, FOCOS
### 6.1 Luz ambiente [hecho]
- Global `0x838158` (float) = luz ambiente; 1.0 = pleno día; se resetea a 1.0 al cargar misión. `0x701bc0` la setea; `0x5ac560` (tick de misión) la llama con `0x5ab730(hora)`.
- `0x5ab730(h)` con `h = misión+0x48a0`: `h < 20 → 1.0`; `h > 21 → 0.4`; en medio `1.0 − 0.6*(h−20)`. (Ambient mínima de noche = **0.4**, constantes `0x7a28c0=20, 0x7a28c4=21, 0x7a28e4=0.4, 0x7a28d8=−0.6`.)
- `0x5ab7b0`: hora = `ticks*24 / (+0x4864) + inicio(+0x487c)` si el ciclo está habilitado (`+0x4870`), con tope 23.5 (`0x7a28e8`). El reloj vive en `ClassIntendencia09` (`0x5ab4b0`, recibe eventos de misión por id de 4 caracteres): evento **`RATA`** (`0x41544152`) activa el ciclo (`+0x4870=1`) y pone la hora de inicio **19.0** (`0x7a28bc`); evento **`CONA`** (`0x414e4f43`) pone hora **20.0** y `+0x486c=1` (arranca el oscurecimiento). Sin `RATA` no hay ciclo y la hora queda en `+0x487c` (0 → luz 1.0 = día). Los eventos los dispara el script de misión (no localizado en los MIS como texto) [hecho: manejador; hip: origen]. El divisor `+0x4864` (ticks por "hora") NO LEÍDO. `0x53f270` interpola colores del filtro nocturno (`ClassNightColorFilter` `0x618fe0`, horarios 7 / 9 / 19 / 20 / 21 de `0x79dd..`) [hecho: umbrales; interpretación color: hip].
- Resultado en la vista: alcance base por luz = `luz * MOD*2`; de noche (0.4) y 800 → 320 de vista libre, 160 si agachado; más lejos, solo con foco.

### 6.2 Focos / zonas iluminadas [hecho]
`0x701e80` carga la lista (cada entrada 0x38 B): `TOKEN` (32 B), `[x y z]` (`+0x20,+0x24,+0x28`), `RADIO` (`+0x2C`), `NIVEL` (`+0x30`), `INACTIVA` (`+0x34 = activo`). `0x701d50(idx, P)`: devuelve el primer foco activo (`NIVEL>0` y activo) cuyo círculo (XY) contiene a P (`d² ≤ RADIO²`, el test usa `<` negado: borde incluido). `0x702730`: intensidad en P = `min(1, ambient + Σ NIVEL)`. En visión solo importa "¿hay algún foco que cubra E?" (`0x7023b0`). Sección del MIS donde está (`ZONASILUMINADAS`, ver `5c34a0`): [hip]. Acciones `AcFoco/AcFocoDestruible/AcInterruptorFoco/AcControlaFoco/MotorFoco/AcFocoLocalizador` y mensajes `MSGA_ENCIENDE_FOCO/APAGA_FOCO/APAGAENCIENDE_FOCO/DESTRUYE_FOCO`: encienden/apagan el flag `+0x34`; cuerpos NO LEÍDOS. `ClassLinterna` y `ClassLightConeVolDynamic`: NO LEÍDOS (cono de luz dibujado; no entra en la lógica de vista que leí).

## 7. MEMORIA (Memoria01) [hecho]
- Ítem: `{next, vida, x, y, z, objeto}` (6 dwords); lista en `this+8`, cantidad en `this+0xC`.
- Tick `0x6196a0`: `vida -= 5`; si `< 1` se borra. Con `vida` inicial V dura `ceil(V/5)` ticks.
- `MSGO_MEM_PONITEM` (`0x619780`): si hay un ítem cuya posición está a `< 10.0` (`0x79466c`) y el mismo objeto (o alguno sin objeto) → se fusiona (toma el mayor `vida`; actualiza posición con la del objeto si lo hay) y se libera el nuevo; si no, se agrega al frente. `MSGO_MEM_GETNITEMS`, `MSGO_MEM_GETITEM(i)`.
- **Quién escribe y con qué `vida` inicial**: NO LEÍDO (los mensajes se resuelven por id; no se halló el emisor por cadena). Esto es lo que daría "cuánto recuerda un guardia".

## 8. VIGILAR (barrido), `AcVigilar` [hecho salvo lo marcado]
- MAC: `.ANGBARRIDO` (amplitud en grados, int; `+0x28`, copia `+0x2C`), `.DEMORA` (período en ticks, `+0x30`), `.VISTAELIPTICA` (`+0x7C`). En el MAC de bichos aparece `AcVigilar [ .CARISMA 400 .ANGBARRIDO $AngBarrido ]`.
- Estados `+0x24`: 0 apagado, 1 en pausa, 2 vigilando. `+0x34`: 0 barriendo, 1 fijando un objetivo (nombre en `+0x38`).
- Tick (`0x4c1b90`), si `+0x24 != 1`: `+0x18++` (contador). Barrido (`0x4c1a30`): `ang = sin(2π * (contador mod DEMORA)/DEMORA) * ANGBARRIDO` → `MSGO_VISTA_SETANGCABEZA_CHANGEMOD(ang, alcance_factor, prioridad +0x20)`. El alcance sale de `0x4c0e60` (factor `+0x78`=`LOOKSCAN_FACTOR/100` × alcance; con vista elíptica compensa la proyección isométrica).
- `MSGA_VIGILAR_ON` → `+0x24=2`, `+0x34=0` y contador inicial aleatorio (`DEMORA*rand/2π`); `MSGA_VIGILAR_OFF` → `+0x24=1`; `MSGA_FIJAR_VISTA(nombre,pos)` → fija la mirada (`0x4bfb30` calcula `ang = atan2 − heading`).
- **Pérdida de vista**: en estado 1 cuenta ticks `+0x74`; al llegar a **20** (o **4** si `+0x88 != 0`) envía `MSGA_ENEMIGO_PERDIDODEVISTA` y `MSGA_VIGILAR_ON` → vuelve a barrer [hecho `0x4c1b90`]. Zoom periódico `0x4bf9b0`: cada 10 ticks `MSGO_VISTA_ZOOMIN` con `+0x20`+40 [hecho; semántica hip].
- Mensajes: `MSGA_SET_ANGULO_BARRIDO`, `MSGA_RESTAURAR_ANGULO_BARRIDO`, `MSGA_LOOKSCAN_FACTOR`, `MSGA_TRANSMIGRATE/VAS_A_SER_TRANSMIGRADO` (guarda/restaura estado: control de un enemigo por el jugador).

## 9. Tiempo hasta alertarse
- Vista: 0 ticks de retardo propio (se avisa el mismo tick del escaneo, y se escanea cada tick). Memoria visual: las acciones hacen el resto.
- Pérdida de vista (AcVigilar): 20 ticks = 1 s (4 ticks = 0,2 s con `+0x88`).
- Ruido: 2 ticks de vida del evento; el bicho lo oye si su `Oido01` corre en esos ticks.
- Retardo/reacción de `AcBanpe2`, `AcPatrulla`, `AcDisparar` ante `MSGA_*_VISTO`, `NERVIOSISMO`: **NO LEÍDO** (agente IA).

## 10. NO LEÍDO (resumen)
Emisor de `MSGO_MEM_PONITEM` y vidas; `GestorPorZonas_Sonidos` y el consumidor de `SENSORES_SND_ZONA`, `AcOjoDistante`, `Linterna`, `LightConeVolDynamic`, `Vista02` interno, `VisionVista`; divisor de la hora (`+0x4864`), origen de los eventos `RATA`/`CONA`, sección del MIS de los focos; equivalencia unidades↔píxeles; efecto de camuflaje/disfraz en la percepción; `AcPisar`/ritmo de pisadas y ruido de pisadas; qué ids de sonido usan disparos/pisadas; reacción de cada acción ante `*_VISTO`; `0x5f9820` y `0x63e200` en detalle; `FUN_00786e60` (valores por defecto) no consultado: los valores de percepción salen de ctors/parsers (arriba), no de ese init.

## 11. Hallazgos para otros
- **Movimiento/mapa**: oclusión por sectores usa `bicho+0xE4` (sector actual) y `0x5f9820`; altura del ojo `+0x58`; agacharse escala `+0x58` por 0.125 (`0x79a3e0`).
- **IA/mensajes**: la tabla de ids de mensajes está en `.data 0x81a5b8` (0x29F entradas `{id, char*nombre}`, función de búsqueda `0x6119b0`); `MSGO_*` van a órganos (vía bicho+0x214..), `MSGA_*` a acciones. Bandos: 0 NEUTRAL, 1 ALEMAN, 2 ALIADO (`bicho+0x108`, parse `0x50cf5c`). Flags de bicho: `0x23C`: `2` visible/chocable [hip], `4` muerto, `8` visto este tick → `0x800000` tick anterior, `0x40` agachado, `0x80` agachado/"bajo", `0x1000` buceando, `0x4000` esposado, `0x8000/0x10000...` varios; `0x240`: `1` huella, `0x80`/`0x800`/`0x4000` señuelo/tabaco/animal peligroso, `0x200`, `0x2000` atontado, `0x8000` desnudo, `0x400` testigo, `0x100` habitáculo.
- **Armas/daño**: ids de ruido y radios (§4.3), p. ej. XPLO/GRAN/EBAR/TNKS 1200, ALRM 300, ATAK 80.
- **Sonido**: tabla de ids de 4 caracteres (decodificar al revés); radio de oído = propiedad del *sonido*, no del oyente.
- **Misiones**: luz ambiente por hora (`0x5ab730`, 20h–21h de 1.0 a 0.4), lista de focos `TOKEN/RADIO/NIVEL/INACTIVA`.
