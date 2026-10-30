# Los 96 `.MAC`: qué traen y qué falta usar (2026-10-30)

Lectura completa de los 96 `DATOS/MISIONES/*.MAC` (idénticos en número en `WAR_MP.DIR` de la raíz y en el de `Legacy\`), cruzados con los usos en los 19 `.MIS` (ver `mis-todos.md`).
Catálogos reproducibles: `node --experimental-transform-types tools/mac-catalogo.ts <carpeta>` (solo lectura del juego). Ya generados:

- **`docs/lectura/mac-macros.tsv`**: una fila por macro (bytes, clase, bando, variables, acciones con prioridad `CARISMA`, órganos, gráfico, volumen de colisión, otras claves, instancias en los `.MIS` y por misión).
- **`docs/lectura/mac-acciones.tsv`**: las 62 acciones distintas (en cuántas macros, prioridades, parámetros de ejemplo, si el código y los docs las nombran).
- **`docs/lectura/mac-claves.tsv`**: las 233 claves distintas de los `.MAC`.

## Qué es un `.MAC`

Una plantilla de elemento (167 a 3 227 bytes; el total ronda los 140 KB). Un elemento del `.MIS` la instancia con `.CLASS MACRO .MACRO X` y rellena las variables `$Nombre`. El encabezado de cada `.MAC` explica el tipo de variable por la primera letra
(`C` cadena, `P` punto, `G` gráfico, `A` acción concreta, `X` acción elegible; además se ven `E` ángulo/entero, `N` número, `V` sí/no, `T` token, `F` ruta). Estructura de `BAP2.MAC` (el soldado más usado):

```
.CLASS BICHO   .BANDO ALEMAN   .ANGULO $Angulo   .VOLCOLISION [ CILINDRO [ .R 10 .H 29 ] ]
.GRAPH [ .ANIM $Grafico .RENDERVOL [ CILINDRO [ .R 10 .H 40 ] ] ]   .LISTAS [ EJEC CHOC SELE VISI ]
.REACTIVIDADES $Reactividades   .MASA 100   .SEHUNDE 1
.ACCIONES [ [AcMuerte [.CARISMA 999]] [AcBap2 [.CARISMA 600 .NERVIOSISMO .. .TENGOTABACO ..]] [$AccionSecundaria [.CARISMA 600]]
            [AcDisparar [.CARISMA 500]] [AcVigilar [.CARISMA 400 .ANGBARRIDO ..]] [AcBuscador [.CARISMA 300]] [$AcPatrulla [.CARISMA 200]] [AcUsahab ..] [AcPisar [.CARISMA 100]] ]
.ORGANOS [ .VISTA [Vista01 []] .MOTOR [MotorAndante []] .OIDO [Oido01 []] ]
```

`.CARISMA` = prioridad de la acción: manda la de mayor carisma que quiera actuar (la muerte siempre gana con 999). Es la regla de arbitraje del exe (`docs/engine/ia-mensajes.md`); el port la resuelve a mano en `Soldier.tick`.

## Mapa de macros (96)

| Familia | Macros | Instancias en los `.MIS` |
|---|---|---|
| Soldados alemanes | `BAP1` (15), `BAP2` (231), `BANPE1` (79), `BANPE2` (182), `BAP2MET`, `BAPDIANA` (0), `GTPOBAP2` (2), `GTPOBNP2` (4), `FUSILER` (3), `GENERAL` (3), `GUARDA` (1), `VIGILER` (8), `MAQUINER` (1), `MAQUINP` (1) | 530 |
| Prisioneros | `PRESOCHU` (12), `PRESOJUG` (6), `PRESOTRA` (3) | 21 |
| Animales | `PERRO` (1), `LEON` (3), `AVESTRUZ` (4), `GALLINA` (4) | 12 |
| Edificios | `CASA` (165), `CUARTEL` (30), `CUARTELG` (1), `CARCEL` (6), `BUNKER`, `TORRE` (0) | 202 |
| Objetos | `BARRIL` (23), `BOMBAACT` (22), `BOMBARET`, `CAJA*` (5), `CEPO` (7), `SEGNUELO` (13), `TESTIGO` (19), `UNIFORME` (6), `ESCALA` (54), `FOCO`/`FOCODEST`/`INTERFOC` (3), `BANDERA`/`BANDERAC` (35), `BOYA` (1), `MINA`/`MINASUB` (22), `PEMPUJE` (30), `METRBASE` (21), `NIDOMET` (25), `MAQUINA` (2), `ASPAMOL` (2) | ~290 |
| Vehículos | `ZODIAC`, `ZODIAC5` (3), `ZODIAC17`, `BARMAD`, `CAMION*`, `CAMDES*`, `COCHE*`, `JEEP_V`, `FURGO_V` (3), `KUBE_V` (9), `KUBETUT` (1), `CISTERNA`, `PNZ2/3*`, `SDK*`, `TANQUETA`, `TAN2DES*`, `HORCHE_V`, `CANYON`, `DEPOSEMP` (7), `VAGON`, `VAGEMPUJ` (2), `VEHIFANT` (4), `CBARTREN` | ~40 |

**40 de los 96 no se instancian en ningún `.MIS`** (`BAP2MET BAPDIANA BARMAD BARREAUT BARRERA BOMBARET BUNKER CAJA CAJAGRAN CAMDES CAMDES_V CAMDES2V CAMION CANYON CBARTREN CISTER_V CISTERNA COCHE_V COCHEEMP HORCHE_V JEEP_V KUBEDE_V MINA NOTOY NOTOYM PNZ2 PNZ3 PNZ3_V PTODEBIL SACO SDK SDK_V TAN2DE_V TAN2DES TANQTA_V TANQUETA TORRE TRAVIESA VAGON ZODIAC17`).
Los vehículos aparecen en los `.MIS` con la variante `_V` (o la de nombre corto en los casos de `ZODIAC`/`KUBETUT`/`DEPOSEMP`); el resto no se instancia nunca y no hace falta portarlo.

## Misión 0: 18 macros, 82 instancias

`BANPE1`×13, `BAP2`×6, `BAP1`×5, `BANPE2`×4, `MINASUB`×22, `BOMBAACT`×4, `ESCALA`×4, `CASA`×4, `CUARTEL`×3, `BARRIL`×3, `NIDOMET`×3, `BANDERA`×3, `METRBASE`×3, `ZODIAC5`×1, `BOYA`×1, `CEPO`×1, `SEGNUELO`×1, `TESTIGO`×1.

Lo que el código ya nombra: BANDERA, BANPE1/2, BAP1/2, BARRIL, BOMBAACT, BOYA, CASA, CEPO (solo el ítem del HUD), CUARTEL, ESCALA, MINASUB. **No lo nombra**: `METRBASE`, `NIDOMET` (los nidos funcionan por la acción `AcNidoMetralleta`/`.TOKENARTILLERO`, no por el macro), `SEGNUELO`, `TESTIGO`, `ZODIAC5` (el bote se arma por `boatSlots`, sin pasar por el macro).

Los cuatro tipos de soldado son **cuatro clases de acción distintas** (`AcBap1`, `AcBap2`, `AcBanpe1`, `AcBanpe2`) con la misma prioridad 600 pero otro cerebro. El port usa una sola lógica (`AcBap2`) para todos; con 13 `BANPE1` en la misión 0 es lo más importante que falta leer del cerebro de `AcBanpe1` (`.COMPANERO` es una variable propia suya).

## Acciones (62 distintas)

Las 62 están descritas en los docs; el código nombra 13. Por frecuencia: `AcPisar` (43 macros), `AcPilotaje` (31), `AcExplotaVeh` (29), `$AcPatrulla` (22), `AcBuscador` (21), `AcVigilar` (19), `AcMuerte` y `AcUsaHab` (17), `AcDisparar` (13), `AcTorreta` (11), `AcBap2` (6), `$AccionSecundaria` (5), `AcVehDescubierto`/`AcEmpujable` (5)… Con una sola macro: `AcFusilador`, `AcGeneral`, `AcGuarda`, `AcVigilante`, `AcPerro`, `AcFelino`, `AcGallina`, `AcAvestruz`, `AcMaquina`, `AcSocavon`, `AcLapa`, `AcPuntoEmpuje`, `AcSegnuelo`, `AcTestigo`, `AcUniforme`, `AcCepo`, `AcRecarga`, `AcCogeBombas`, `AcRecogeArma`, `AcTiroAlBlanco`, `AcBichoExpl`, `AcTransmiteImpacto`…

Prioridades (`.CARISMA`) que se repiten: muerte 999 · muerte de animal 700 · cerebro del soldado 600 · disparar 500 · vigilar 400 · buscar 300 · patrullar/usar habitáculo 200 · pisar 100; vehículos: explotar 900, piloto 100–300.

**Para la misión 0 lo pendiente es**: `AcBanpe1`/`AcBap1` (cerebros distintos), `AcBuscador` (21 macros: ir a buscar), `AcTestigo`, `AcSegnuelo`, `AcCepo`, `AcFoco` (1 instancia) y `AcExplotaVeh` (el tanque y el camión explotan por daño, 29 macros).

## Variables más usadas

`EAngulo` (58 macros), `AAcPatrulla` (31), `NReactividades` (29), `GGrafico` (26), `CAngMarchaAtras` (26, vehículos), `CAngBarrido` (16), `VTENGOTABACO` (10), `CUmbralNerviosismo` (10), `TPiloto` (6), `XAccionSecundaria` (5), `FRuta` (5), `NColorBurbujas`/`CVolumenAgua`/`CStartFrame` (4), `PPuntoSalida`, `PPosCono`, `NReacAlarma`, `NHoraEncendido` (3). `StartFrame` es la variable que alimenta `.GRAPH .STARTFRAME`: era la clave que no tenía consumidor al animar BOYA/BANDERA (ver `tasks/pendientes.md`).

## Claves sin código ni docs (solo 5 de 233)

`.NOVERHASTA` (5 macros), `.POSCOMEDERO3/4/5` (1: el avestruz), `.PARTICLELIFE` (1). Lo demás está descrito en los docs.
Claves de uso frecuente sin código: `.LISTAS` (93 macros: EJEC CHOC SELE VISI TIP = qué listas del mundo integra el elemento), `.MASA`, `.MOTOR` (los órganos: `MotorAndante`, `MotorAliado`, `MotorBalsa`…), `.CONTENEDOR`, `.SEHUNDE`, `.ENEGIA`, `.REACTIVIDADES`, `.TIPOVEH`, `.CHIVABANDO`, `.TIEMPO`, `.WAV`, `.PEPINAZOTANQUE`, `.BOMBA`, `.DANO`, `.PINTABLE`.

## Qué hacer con esto (orden propuesto)

1. **Cerebros de soldado de la misión 0**: leer `AcBanpe1` (13 instancias), `AcBap1` (5), `AcBanpe2` (4) y `AcBuscador` antes de portarlos; hoy todos usan la lógica de `AcBap2`.
2. **Objetos de la misión 0 sin portar**: `AcTestigo`, `AcSegnuelo`, `AcCepo`, `AcFoco`, y las variables de `ZODIAC5` (`TPiloto`, `ENEGIA`: sin leer cómo las usa el bote).
3. **Explosión de vehículos** (`AcExplotaVeh`: `.RADIO`, `.DANO`, `.TIEMPO`, impactos): 29 macros, afecta al tanque y al camión de la misión 0.
4. Volver a `mis-todos.md`: esperar eventos y cambio de ruta (`.ESPERAEVENTO`, `.ENLAZAR`), refuerzos (`.PATRULLAS .REGENERATE`), reacciones por zona.
5. Para las misiones 1–10: las 40 macros sin uso no hacen falta; sí `AcFusilador`, `AcGeneral`, `AcGuarda`, `AcVigilante`, `AcPerro`, `AcFelino`, los vehículos `_V` y `AcPuntoEmpuje` (30 instancias, 7 misiones).

Limitación: "en código" y "en docs" se miden por coincidencia de texto del nombre.

## Seguimiento: punto 1 hecho (2026-10-30)
- `AcBap1`/`AcBanpe1` = la base `AcBap` (sin lógica propia, `soldado-acbap2.md` §0): ante un estímulo (disparo, cuerpo) **miran el punto 100 ciclos y vuelven**, no caminan. Implementado en `engine/soldier.ts` (opción `walks: false`, activada en `main.ts` por la acción `AcBap1`/`AcBanpe1` del MAC): afecta a 18 soldados de la misión 0 (13 `BANPE1`, 5 `BAP1`). `BAP2`/`BANPE2` siguen caminando.
- `AcBuscador` = el ejecutor de "ir a un punto" (`MSGA_BUSCADOR_IRA`): ya lo cubre `Unit.goTo` + `Soldier.investigate`; no tiene lógica de decisión propia.

## Seguimiento: punto 2 hecho en parte (2026-10-30)
- **Hallazgo**: `CEPO` y `SEGNUELO` de la misión 0 no son objetos sueltos del mapa: cuelgan como `.ELEMENTOS` del inventario del zapador (`ARTIFIC`: CEPO y las 4 bombas) y del boina verde (`COMANDO`: `SEGNUELOUNO`), y los usa la acción `AuManejacepo`/`AuManejaSegnuelo` del propio comando.
- **Implementado** (`engine/traps.ts`, `app/main.ts`): ítem CEPO (zapador) y ítem SENUELO (boina verde) del HUD → el próximo clic en el suelo lo coloca (camina, `PONEBOMBA` si el comando la trae, se dibuja con su `.ANM`). Cepo armado: mata (impacto 14) al soldado/animal que lo pisa a menos de 20 y se cierra con la animación `PILLAR`; un comando no lo activa. Señuelo: encendido emite ruido de radio 300 cada 30 ciclos (los soldados lo oyen: BAP1 miran, BAP2 caminan); el mismo ítem lo alterna.
- shortcut: el señuelo arranca encendido y no hay ítems ON/OFF aparte (el exe tiene `ACTSENUELOON/OFF`); un uso por objeto (sin recoger); sin sonidos; el boina verde no tiene la animación `PONEBOMBA` (coloca en el acto); el cursor al colocar es el del explosivo.
- **Sin hacer**: `AcTestigo` (el testigo ya se dibuja; falta `MSGA_ACTIVAR/DESACTIVAR_TESTIGO` y su efecto en los objetivos), `AcFoco`/`INTERFOC` (luces, la misión 0 es de día), variables de `ZODIAC5`.
