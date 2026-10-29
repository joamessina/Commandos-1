# Tabla de flags del bicho: `+0x23C`, `+0x240`, `+0x24C`, `+0x250` (y campos de bicho vistos en las clases de enemigos)

Compilada leyendo **quién pone / quién limpia / quién prueba** cada bit en todo el decompilado (barrido automático por constante + lectura de los puntos clave). Nivel de certeza: **[hecho]** = el código que lo pone y el que lo lee dejan claro el sentido; **[hip]** = coherente con los usos pero no hay un nombre en el código; **[sin cerrar]** = ver "Dudas abiertas". Ctor base del bicho (`FUN_00534580`): `+0x23C=0`, `+0x240=0`, **`+0x24C=3`**, `+0x250=0`, `+0x244=0x2D (45)`, `+0x248=0x28 (40)`. Los comandos (`ClassBichoArrestado`, ctor `FUN_00511950`) hacen `+0x23C |= 0x20000` y `+0x24C |= 0x683`.

## `bicho+0x23C` — estado propio (lo ven las acciones del propio bicho y los observadores)
| Bit | Significado | Quién lo pone → quién lo lee |
|---|---|---|
| `0x00000001` | proyectil/arma activa (misil, llamarada) [hip] | ctor de `AcMisil` y `AcLanzallamas`; `AcMina` y `AcPilotaje` lo exigen en 0 para actuar |
| `0x00000002` | cuerpo sólido que puede ser alcanzado por un tiro / listado por la vista [hecho] | `FUN_00675AB0` (el rayo del tiro solo considera cuerpos con este bit) y `ClassVista01` |
| `0x00000004` | **muerto** [hecho] | `AcMuerte` estado 3 (`muerte.md`); lo lee todo |
| `0x00000008` | "un alemán me está viendo este ciclo" [hecho] | lo pone el órgano de vista de un bicho de apariencia 1 sobre cada elemento que ve (`FUN_0061C5B0`, `|= 8`); `FUN_0050BF30` (cada ciclo) lo traslada a `0x800000` y lo apaga |
| `0x00000010` | [sin cerrar] (probado en `AuBucear`, `FUN_0057E2A0`, `FUN_006BB570`) | |
| `0x00000020` | la ficha tiene animación `REPOSO` [hecho] | `FUN_00507E00` |
| `0x00000040` | **agachado** [hecho] | `AUAgacharse` (`au-jugador.md`) |
| `0x00000080` | agachado pedido / en curso (también lo pone Bucear) [hecho] | `AUAgacharse`, `AUBucear`; `AcMuerte` usa prioridad 10 si está agachado |
| `0x00000100` | casa/habitáculo (lo pone `AcCasa`) [hip] | `ClassAcCasa` |
| `0x00000200` | **"ve"** (visión activa de un enemigo) [hecho] | MAC de `AcBap`, `AcPerro`, `AcAleman`; se limpia al morir/ser neutralizado |
| `0x00000400` | marca de `AcBoundAround` / cuerpo recogible rebotando [hip] | ctor de `AcBoundAround` |
| `0x00000800` | marca de `Intendencia03` (misión) [hip] | `FUN_005A6EF0` |
| `0x00001000` | **buceando** [hecho] | `AUBucear` (junto con `0x80` y `0x80000`); `AcMuerte` apaga el buceo al morir |
| `0x00002000` | **lleva una carga** que reduce la velocidad en `0x795E18` [hip] | `AUManejaItem` (`FUN_004F97A0`); `FUN_004BB080` resta a la velocidad de marcha |
| `0x00004000` | **esposado / inmovilizado** [hecho] | `AcBap` orden 0x17 (`soldado-acbap.md`), `AcGuarda` 6; lo lee el clasificador (`3`) |
| `0x00008000` | arrastra un cadáver [hecho] | `AUGarfio` |
| `0x00010000` | **fumador** (lleva tabaco) [hecho] | `TENGOTABACO` (MAC), `AcBap2` al recoger tabaco; `FUN_00434410`; se apaga al cogerle el tabaco de muerto (`FUN_00513CE0`) |
| `0x00020000` | **comando (bicho arrestable)**: puesto por el ctor de `ClassBichoArrestado` [hecho]; probado en `AcBap` (`ECHAR_CHARLA`: un soldado solo atiende a quien no tenga este bit, salvo la Gestapo), `AUUsar/AUCoger`, `Intendencia` [hip: el espía disfrazado lo pierde] | |
| `0x00040000` | **patrullando en marcha** [hecho] | `AcPatrulla` (`patrulla.md`) |
| `0x00080000` | **oculto** (bucear/camuflaje) [hecho] | `AUBucear`, `AUCamuflarse` (`FUN_004F37A0`) |
| `0x00200000` | **atontado** [hecho] | `AcBap` orden 0x1B, `AcGuarda` 7 |
| `0x00400000` | **desnudo** (uniforme robado) [hecho] | `MSGA_ESTAS_DESNUDO` |
| `0x00800000` | **visto por un alemán en el ciclo anterior** [hecho] | `FUN_0050BF30` (traslada el `0x8`); lo prueban `Camuflarse` (se cancela), `Disfraz` (bloquea), `QuitaUniforme`, `AcSerEspia` |
| `0x01000000` | [sin cerrar] | `FUN_004655B0`, `FUN_00429380` lo ponen y quitan |
| `0x02000000` | animal peligroso en alerta [hip] | `FUN_0042B2C0`, `FUN_00466DD0` lo ponen; lo prueba `AcBap` (clase 0xD) |
| `0x04000000` | "ya reconocido por un soldado" [hip] | `FUN_00432F60` lo pone sobre un `0x02000000` |
| `0x07000000` (grupo) | los tres bits anteriores: un objeto de clase `0xD` con alguno de ellos es una amenaza (perro/animal) para `AcBap` (`FUN_00430A90`, voz `AL10`) y `AcGuarda` (`+0x3C=2`); `AcVigilante`/`AcFusilador` usan `0x06000000` | |
| `0x08000000` | **sometido por una acción de contacto** (esposas, cachiporra, jeringuilla, cuchillo): con el bit puesto la acción no exige "llegué" [hecho por uso; el que lo pone está en `FUN_0047FE30`/`FUN_0047AFE0`] | `AUEsposas`, `AUCachiporra`, `AUJeringuilla`, `AUAcuchillar` |
| `0x10000000` | [sin cerrar] (`FUN_004A23E0`/`4A0D20`: relacionado con la sangre `SANGRE`; lo prueban `FUN_00574860`/`57E2A0`) | |
| `0x20000000` | **soldado alemán con uniforme** (marca de guarda) [hip] | `AcGuarda` (MAC) y `FUN_005104A0` (disfraz del espía `ESPIAA7`) lo ponen/quitan |
| `0x40000000` | [hip] "tiene el bit `0x2000` en su plantilla" | `FUN_00510130` |
| `0x80000000` | insignia/uniforme que la **Gestapo** detecta [hecho] | `FUN_004347E0` (`AcBap` Gestapo) |

## `bicho+0x240` — apariencia ante los demás (lo lee el clasificador `FUN_006AFC10`, `soldado-acbap.md`)
| Bit | Significado |
|---|---|
| `0x0001` | (objeto) **huellas** → clases 8/9 [hecho] |
| `0x0002` | **de pie / activo**: `AcBap` lo repone al levantarse del esposado/atontado; `AcMuerte` lo cambia por `0x10` al morir [hecho] |
| `0x0004` | (otra postura activa); `AcMuerte` lo cambia por `0x20` [hecho el cambio, hip el sentido] |
| `0x0008` | oculto en habitáculo / no cuenta como visto [hecho] |
| `0x0010` | quieto (venía de `2`): muerto o inmóvil [hecho] |
| `0x0020` | quieto (venía de `4`) / `AcPresoChusma` [hecho] |
| `0x0080` | (objeto) **señuelo** → clase `0xA` [hecho] |
| `0x0100` | (objeto) **habitáculo/casa** → clase 7 [hecho] |
| `0x0200` | **mirando fijamente** algo (`FIJAR_VISTA`: perros, guardias) → clase `0xE`: los soldados le preguntan `DONDE_ESTA_TU_OBJETIVO` y van a mirar [hecho] |
| `0x0400` | no visible para la IA (el órgano de vista no lo reporta) [hip] |
| `0x0800` | (objeto) **cajetilla de tabaco** → clase `0xB` [hecho] |
| `0x1000` | **esposado** (apariencia) [hecho] |
| `0x2000` | **atontado** (apariencia) → clase 5 [hecho] |
| `0x4000` | (objeto) **animal peligroso** → clase `0xD`; (alemán) "agresor identificable" [hecho/hip] |
| `0x8000` | **desnudo** (apariencia) → clase 4 [hecho] |
| `0x10000` / `0x20000` | marcas internas de `FUN_007010B0` / `FUN_004946C0` [sin cerrar] |

## `bicho+0x24C` — acciones del jugador que admite este bicho (bits que consultan los cursores y las acciones AU)
Valor base **3**; comandos **0x683**; cadáver: `0x28` (+`0x40` si es aliado, +`0x8000` si lleva tabaco). Pocos lectores (`TomarControlAleman` y la interfaz); casi todo son escritores. [hip en conjunto]
| Bit | Significado |
|---|---|
| `0x0020` | tiene alguna interacción abierta (`+0x250 ≠ 0`); se apaga cuando `+0x250` queda en 0 [hecho] |
| `0x0100` / `0x20000` | marcas de reacción de alarma/huida (`AcBap` las pone al salir de un orden; `AcGeneral` (`EV_HUIDA`) y la entrada del orden 0x1A las limpian) [hip] |
| `0x0400` | marca de "atontado" (se alterna al entrar/salir de 0x1B) [hip] |
| `0x2000` | **sabe empujar**: la interfaz (`FUN_00688870`) solo deja empujar si el personaje seleccionado lo tiene y el objeto es de tipo 8 (`AcPuntoEmpuje`) [hecho] |
| `0x4000` | **uniforme/control disponible**: lo pone `AcBap/AcGuarda` cuando el soldado queda esposado o atontado y vestido, se apaga si está desnudo; lo exige `AUTomarControlAleman` [hecho] |
| `0x8000` | cadáver con **tabaco recogible** (`AcMuerte`; se limpia en `FUN_00513CE0`) [hecho] |
| `0x10000` | uniforme quitable (esposado/atontado vestido) [hip] |
| `0x40` | cadáver de comando [hip] |
| `0x80000` | marca temporal tras soltarse de un arresto [hip] |
Durante un arresto (`INICIO_ARRESTO`) `AcBap` guarda `+0x24C` y lo pone a 0; `FIN_ARRESTO` lo restaura.

## `bicho+0x250` — "qué tipo de recogible soy" (se compara con `ficha+0x7B0` del que lo recoge, ver `au-jugador.md` §5)
| Bit | Significado |
|---|---|
| `0x001` bomba · `0x002` lancha · `0x004` señuelo | [hecho, `AUCoger`] |
| `0x008` granadas · `0x010` metralleta · `0x020` balas del francotirador | cajas `AcRecogeArma` [hecho] |
| `0x100`, `0x200`, `0x204` | genéricos / equipo (`FUN_005132C0`) [hecho por `AUCoger`] |
| **`0x400` cadáver** · **`0x800` esposado** · **`0x1000` atontado** | **cuerpo recogible** (máscara `0x1C00` del Garfio): lo pone `AcMuerte` (0x400), `AcBap` al esposar (0x800) y atontar (0x1000), y lo limpian al levantarse [hecho] |
| `0x2000/0x4000/0x8000` | genéricos (`0x6000` en `AUCoger`) [hecho] |
| `0x10000` | misil [hecho, `AUCoger`] |

## Campos de bicho usados por las clases de enemigos (para el port)
`+0x58` altura de ojo · `+0x108` apariencia (0 objeto, 1 alemán, 2 aliado) · `+0x118` **contador de alerta** (`AcBap`: `NERVIOSISMO×20` al impacto; `600` en perros/guardias) · `+0x124` modo tutorial · `+0x128` ocupado/herido · `+0x130` en escalera · `+0x134` contenedor (casa/vehículo) en el que está · `+0x13C` bloque de movimiento · `+0x184..0x18C` dirección del último golpe (para la caída) · `+0x190` tipo de plantilla · `+0x194` **custodia**: 0 normal, 1 libre, 2 detenido (`detenido.md`) · `+0x198` datos del contenedor · `+0x1F8` bando · `+0x208/+0x20C` energía / energía máxima · `+0x214` órgano de vista · `+0x220` motor · `+0x224/+0x228` seleccionable / seleccionable-2 · `+0x230` camuflado (`=1`) · `+0x238` energía base.

# Índice de clases de enemigos leídas en este informe
`soldado-acbap.md` (base AcBap) · `soldado-acbap2.md` (AcBap1/2, Banpe1/2) · `guarda.md` · `vigilar-vigilante.md` · `patrulla.md` · `ac-disparar.md` · `detenido.md` · `muerte.md` · `buscador.md` · `perro.md` · `fusilador-general-lider.md`. No leídas: `AcpAndar`, `AcpPatrullero`, `AcpSargento` (policías/gente, `0x4C3170–0x4DD700`), `AcPresoChusma`, `AcPresoTraidor`, `AcTestigo`, `AcSeguir`, `AcEscoltado`, `AcFelino`, `AcGaviota`, `AcGallina`, `AcAvestruz`, `AcOjoDistante`. (`AcMetrallero`, `AcTorreta`, `AcCanonero`: ver `obj-armas-fijas.md`, lo cubrió el otro agente.)

## Dudas abiertas
- Bits `23C` `0x10`, `0x1000000`, `0x10000000` y `240` `0x10000/0x20000`: el código que los pone vive en `FUN_004655B0`, `FUN_00429380`, `FUN_004A23E0`, `FUN_007010B0`, `FUN_004946C0` (clases de objetos de misión y de animales fuera del encargo del enemigo humano); no se pudo nombrarlos sin leer esas clases.
- Los bits de `+0x24C` no tienen lectores directos salvo `0x2000` y `0x4000`; los demás se interpretaron por quién los pone y cuándo los quita.
