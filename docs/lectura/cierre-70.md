# Investigación de las áreas que figuraban con ≥70 % (2026-10-30)

Pedido: investigar todas las filas con estimación ≥70 % de `tasks/pendientes.md`, incluidas las marcadas como implementadas. Son **23 filas** (14 de A, 8 de B y 1 de C). Se agrupan donde comparten reglas. No se cambió comportamiento del port.

**[hecho]**: lectura de C de Ghidra o desensamblado del exe de raíz, con dirección y línea/VA abajo. **[previo]**: regla documentada anteriormente, conservada como tal. **[pendiente]**: límite concreto; no se convierte una atribución en lectura completa. Los porcentajes de la lista son estimaciones, no una medición de funciones entendidas. Esta pasada no declara estos subsistemas al 100 %.

Fuentes: `D:/Joaquin/research-c1/ghidra/all2/fn_*.c`, RTTI `class_methods.tsv`, y `D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe`, solo lectura. Las líneas siguientes pertenecen a **all2**, no a `all`. El exe no tiene líneas fuente. Para reproducir: `py tools/consulta-exe.py <VA>`; `--asm` consulta instrucciones reales y anota cadenas inmediatas.

## 1. Cobertura del pedido y estado real

| Fila original | % anterior | Resultado de la investigación / referencia |
|---|---:|---|
| A: escaleras y ascensor | 85 | Entrada/salida y cancelación documentadas en `q1-escaleras.md`; el flag de uso por buzo lo carga el bicho, §9. |
| A: buceo | 80 | Condición exacta de agua y restauración de geometría comprobadas, §9. |
| A: plantar bomba | 90 | Animación de colocar/recoger localizada por separado; no falta descubrir la regla básica, §9. |
| A: CASA04 / matar ocupantes | 90 | Regla previa en `mision-intendencia.md`; falta del port no equivale a falta de lectura, §9. |
| A: Zodiac | 75 | Reparto de daño del piloto y bloqueo por pinchado, §3; plazas y estados ya estaban leídos. |
| A: nidos de ametralladora | 85 | Ráfaga y ocupación previas; distinguir nido del cerebro del cañonero, §9. |
| A: casas y cuarteles | 85 | Reserva y reposición comprobadas; cerrado el receptor del evento de sonido, §4. |
| A: reacción a cadáveres | 70 | Clasificador comprobado; cadáver/esposado/atontado son categorías distintas, §7. |
| A: objetos del mapa | 80 | Puertas, focos, testigos y trampas tienen lectura previa; límites delimitados, §9. |
| A: eventos y patrullas | 85 | Cerrado tipo 6 → intendencia → difusión del evento, §4. |
| A: munición y armas | 85 | Corregidos recargas y significado de la piedra; §5. |
| A: HUD de misión 0 | 80 | Cerrada tabla de posiciones por personaje; postura y dibujo del ítem, §2. |
| A: fin de misión | 75 | Rango de campaña comprobado; no era desconocido, §8. |
| A: noche y luces | 85 | Reloj comprobado; no activar una hora inventada, §9. |
| B: vehículos | 75 | Lectura nueva de Pilotaje, CLancha, CTanque y TiroAlBlanco; §3. |
| B: animales | 70 | Setter/tick de avestruz, vuelo de gaviota y aleatoriedad del perro, §6. |
| B: presos, testigos y policía | 70 | Corregido el disparador de huida de presos; §7. |
| B: estados del soldado | 70 | Diferenciadas pedrada/cachiporra y variantes de animación; §5 y §7. |
| B: oído | 70 | Los 48 radios comprobados, comparación de distancia y sensor por sector, §4. |
| B: camuflaje/uniformes/control | 70 | Condición de control comprobada; el resto ya documentado en AU, §5. |
| B: armas y objetos del jugador | 80 | Recarga, consumo, granada, tabaco y piedra comprobados; §5. |
| B: controles | 70 | Cerrado el caso del clic izquierdo sobre un aliado, §8. |
| C: fase del barrido de cabeza | 70 | Fórmula previa y consumidor localizados, §9. |

## 2. HUD: la tabla que faltaba y por qué no coincidía con capturas

### 2.1 Posiciones por personaje [hecho]

La tabla de `0x822FA0` describe valores iniciales. Hay **otra tabla en `0x822768`**, registros de **16 B** `{idÍtem, tipoPersonaje, x, y}`, terminada por id −1. `FUN_00695470` (`fn_00680000.c:15317`, comparación en 15331) busca por ambos identificadores. Sus coordenadas son cero en el archivo PE porque se inicializan al arrancar.

El inicializador **en `0x78B6D0…0x78BCD1`** escribe esas coordenadas. El C exportado de `FUN_00786e60` no muestra estas escrituras aunque su intervalo declarado las abarque: hay un bloque terminado en `RET`, precedido por `INT3`. No alcanza buscar nombres `DAT_00822770` en Ghidra para concluir que nadie escribe. Se leyó el bloque en el exe y se reconstruyeron solo sus `MOV` constantes con `tools/audita-datos-exe.py --mochila` (rechaza instrucciones distintas de MOV/RET).

Cadena completa:

1. `FUN_0068E210`, `fn_00680000.c:10989`: para los ítems con el flag de recolocación emite el registro de interfaz **0x58**, con id del ítem y `bicho+0x7A8` (tipo de personaje).
2. `FUN_00699AE0`, mismo archivo **19353–19355**: caso 0x58 → `FUN_006954D0`.
3. `FUN_006954D0`, **15343–15355**: busca la pareja y llama a `FUN_006F3A90`, después recoloca todos los botones con `FUN_006F4300`.
4. `FUN_006F3A90`, `fn_006c0000.c:36378`, escribe **`ox = anchoFondo − x − 2`, `oy = altoFondo − y − 2`** en `botón+0xFC/+0x100` (36404–36405).
5. `FUN_006F4150`, mismo archivo **36599–36629**, aplica el lado de la ventana: flag `+0x23C != 0` → `pantallaX=origenX+ox`; cero → `pantallaX=origenX+anchoFondo−anchoBotón−ox`. `pantallaY=origenY+oy`. No invertir estos dos casos.

Con fondo de **112×149**, la fórmula es `(ox,oy)=(110−x,147−y)`. Ejemplos contrastados con las mediciones previas de `hud.md` Cierre 6:

| Tipo (`bicho+0x7A8`) | Ítem | Ancla x,y | Offset resultante |
|---|---|---|---|
| 0, boina | piedra (8) | 67,129 | **43,18** |
| 0, boina | puño (93) | 41,133 | **69,14** |
| 0, boina | esposas (87) | 86,56 | **24,91** |
| 1, francotirador | piedra (8) | 28,72 | **82,75** |
| 1, francotirador | mirilla (15) | 99,148 | **11,−1** |
| 2, marine | piedra (8) | 29,128 | **81,19** |
| 2, marine | traje (17) | 54,61 | **56,86** |
| 2, marine | arpón (85) | 43,142 | **67,5** |
| 3, zapador | piedra (8) | 55,138 | **55,9** |
| 3, zapador | granada (7) | 94,39 | **16,108** |
| 3, zapador | activador (16) | 71,67 | **39,80** |
| 3, zapador | cartucho (5) | 125,115 | **−15,32** |
| 3, zapador | cepo (6) | 126,161 | **−16,−14** |
| 4, conductor | piedra (8) | 29,76 | **81,71** |

El activador del zapador no coincide con el valor de otra captura/personaje (`−8,79`): conservar contexto de personaje e id, no mezclar las mediciones. Los tipos 5/6/7 tienen más entradas; el script las enumera, pero el fondo puede ser distinto: no usar 112×149 universalmente. **No se tomó ninguna captura ni se leyó memoria nueva** en esta sesión.

### 2.2 Postura, disponibilidad e iluminación [hecho con límites]

`FUN_0068E210`, `fn_00680000.c:10953–11010`: id **0x54=levantarse** se ofrece cuando está agachado (`bicho+0x23C & 0x40`), sin flags `0x200/2` del estado del interfaz y sin sector con `+0x50 & 0x400`; id **0x53=agacharse** se ofrece cuando no está agachado y sin esos flags `0x200/2`. Hay además filtros por acción actual (`+0x503` del objeto de interfaz), disfraz del espía y flags particulares del ítem. El filtro de vehículo está en **11030–11047**: permiso `ítem+0x90`, consulta virtual de disponibilidad, y exclusión `ítem+0xA8`. **No basta la lista del MIS.**

`FUN_0051E480`, `fn_00500000.c:20956–21004`: el botón elige estado 1/2/3 con sus flags, selección y sprite alternativo. `FUN_0051E5E0`, **21008–21098**, cambia la paleta del sprite según `+0x11C/+0x120` y usa el dibujo alternativo en estado 3. No aparece una suma universal de brillo de 0,4: ese valor sigue siendo un atajo del port. **[pendiente]** traducir exactamente los índices de paleta y todos los flags a condiciones de hover/selección.

Balas: `FUN_006F5380`, `fn_006c0000.c:37449–37516`, repite el sprite tantas veces como `ventana+0x98` y avanza **el ancho del sprite** (`sprite+0x20`, 37504), no una separación arbitraria fija. Libreta: `FUN_006F8AD0` (**39893**) dibuja el mapa y el rectángulo de cámara; `FUN_006FA700` (**41191**) transforma el clic y recentra la cámara. **[pendiente]** completar sus transformaciones FPU y la carga del recurso LIBR; no alcanza con haber identificado el dibujante.

## 3. Vehículos: pilotaje, daños y conductores

### 3.1 Pilotaje [hecho]

`ClassAcPilotaje`: vtable slots 1/4/5 remiten a **`FUN_00492C60` / `FUN_00494580` / `FUN_004946C0`** (`fn_00480000.c:11255`, **12162**, **12227**). Se consultó RTTI y se siguieron sus thunks. El parser lee `REPARTEIMPACTO`→`+0x48`, `ATROPELLA`→`+0x4C`, `ATENUAIMPACTO`→`+0x54`, `FUERZA`→`+0x60`, `NORMALVEL/FASTVEL`→`+0x9C/+0xA0`, `CHIVABANDO`→`+0x28`, `NOSIGUECHIVANDO` invertido→`+0x2C`, `SALIDAATIERRA`→`+0x88` y `FTCANSHOOT`→bit4 de `+0x98`. `TIEMPOBOCINA` por defecto **50 ciclos**.

`FUN_004946C0` pierde nombres/argumentos en el C; se comprobó el ensamblador real:

- `0x49478B` identifica **PILOTO_GOTOVEL**: si `+0x58==0`, destino no nulo → `MSGO_MOTOR_GOTO`; velocidad no nula → `MSGO_MOTOR_SETVEL` (conversión entera a float, **0x4948A4**). No inventar una rampa de aceleración en esta acción.
- `0x4948CE` identifica **PILOTO_PARAR** → motor PARAR y sonidos de ralentí.
- `0x494B53/0x494B84`: **NODEJARSUBIR / ESTOY_PINCHADA** → `+0x58=1`, limpia permisos en `bicho+0x254` y corta sonidos.
- `0x49506C`: **IMPACTO**, con `REPARTEIMPACTO!=0`, llama a `FUN_004942B0`.
- `0x49528B/0x49537C`: entrada/salida de habitáculo ajusta apariencia, sonidos y avisos de descubrimiento; `FUN_00492720` (11029) calcula la apariencia efectiva según ocupantes. No es solo una bandera gráfica.

### 3.2 Reparto de impacto a ocupantes [hecho]

**`FUN_004942B0`**, `fn_00480000.c:12032–12113`: ignora tipo **14=CEPO**; cuenta ranuras ocupadas; con `ATENUAIMPACTO` multiplica primero el daño por **0,25** (`fld/fmul qword 0x796378`, **0x49431D–0x49432B**, constante volcada). Divide el daño entero por nº de ocupantes (`idiv`, **0x494332**). Aplica a los ocupantes con `bicho+0x138==0`; el de la primera ranura tiene tratamiento posterior: recibe su parte si es el único superviviente marcado como conductor, o si el daño de esa parte es menor que su energía. Sin supervivientes manda **ULTIMO_PASAJERO_MUERTO** al vehículo. No reemplazar esto por daño igual e incondicional a toda la tripulación.

**Zodiac [previo + conexión nueva]:** estados 4/5/6/7/8/9/10 y condición «impacto mientras está vacío o último pasajero muerto» están en `obj-contenedores.md` §3. El pinchado se conecta al bloqueo de Pilotaje anterior. Intercambiar plazas y elegir un nuevo piloto al salir ya están leídos en `FUN_004B74D0`/`004B8450`; no son huecos de investigación.

**Varada [hecho]:** `FUN_005EF940`, `fn_005c0000.c:30528`, selecciona SimBalsa (`motor+0xD8`) si no hay sector o su tipo es1/3, y SimObjeto (`+0xDC`) en el resto; lo guarda en `motor+8/+0x10`. `FUN_005EFA00` (**30574**) cambia al Sim acuático al volver de tierra a agua. `FUN_005F00E0` (**30894**) convierte giro en impulsos diferenciales según radio del bicho. La inercia y límites de ambos Sim ya están en `sim-vehiculos.md` §5; **[pendiente]** verificar en pantalla la transición y su interacción con las salidas. No se afirma que un solo impacto hunda siempre una balsa ocupada.

### 3.3 CLancha, CTanque y TiroAlBlanco [hecho]

`AcCLancha`: mensajes **`FUN_004535A0`** (`fn_00440000.c:11896`): lo visto de clase 1/6 se guarda como objetivo; entrar al habitáculo desactiva su control anterior; responde DONDE_ESTA_TU_OBJETIVO. `FUN_00453350` (**11803**) filtra muerto/custodia y decide cambiar objetivo; `FUN_00452DD0` (**11606**) envía PILOTO_DISPARAPUNTO, para el motor y pausa la patrulla cuando corresponde. El tick `FUN_00453420` despacha estados 1/2/3. **No es otro integrador físico.**

`AcCTanque`: `FUN_004578A0` (**14530**) añade TRIGGER_REACT (limpia `+0x48`) y ENTRADA_HABITACULO (restaura ese control). `FUN_004575A0` (**14402**) elige objetivo; `FUN_00457040` (**14217**) envía disparo al **vehículo contenedor**, para su motor y pausa la patrulla del ocupante. Tick `FUN_00457720` despacha estados 1/2/3. **[pendiente]** transcribir todas las entradas/salidas y el selector de blancos antes de implementar estos cerebros.

`AcTiroAlBlanco` **no es pilotaje**: `FUN_004B3B00` (`fn_00480000.c:31263`) lee POSBLANCO/POSMIRARIMPACTOS, desfasa al soldado con suma del nombre %10; `FUN_004B4AE0` (**31872**) alterna apuntar/disparar/fumar/ir a mirar con contadores (intervalo de tiro 80 ciclos y cambios a 30/300/50). `FUN_004B4890` (**31797**) maneja llegada, crisis y suspensión/reactivación de acción secundaria. El tick reproduce `FUSL`; no se encontró aplicación de daño en ese cuerpo: no atribuirle un arma de vehículo.

`FUN_006BB320` (`fn_00680000.c:42231`) también consultada: propietario fijado → igualdad de id; sin propietario, exige distancia estrictamente menor que radio y consulta geométrica adicional para id0. **[pendiente]** semántica completa del objeto de consulta y sus consumidores; no se declara cerrada la fila C originalmente al 0 %.

## 4. Casas, patrullas y oído: cadena del sensor cerrada

**[hecho]** Las vtables de Intendencia base y 00…09 tienen en **slot7 / +0x1C** el thunk **0x409016 → `FUN_0059CEA0`**. `class_methods.tsv` da la misma entrada en todas. El cuerpo (`fn_00580000.c:23054–23069`) primero activa alarma con `FUN_0059A410`, combina cinco palabras de máscaras de zona (`+0x4828…+0x4838`) y llama **`FUN_0059A060(evento)`**. Queda cerrado el hueco «¿el tipo 6 llega a las patrullas?» de `sonido.md`.

**Corrección de estructura [hecho]:** `FUN_00681170` (`fn_00680000.c:1158–1166`) pasa al gestor por zonas **`sonido[10]`, que es el puntero de sector en +0x28**, junto con `sonido[0]` (categoría). Por tanto `FUN_006FFAE0` (`fn_006c0000.c:45066`) lee **las máscaras del sector en `sector+0x2C+i*4`**, no un array de máscaras copiado dentro del sonido. `FUN_00681660` (`fn_00680000.c:1325`) escribe precisamente el sector en `+0x28`. No hace falta inventar un escritor de máscaras dentro del registro de sonido de 44 B.

Cadena: **emisor/categoría → cola de ruido → `FUN_00681170` → gestor de zonas → `FUN_006FFD80` → evento tipo6 → `FUN_0059CEA0` → `FUN_0059A060` → patrullas/escuchas**. Los filtros de tipo están en `FUN_006FFA00` (`fn_006c0000.c:45010`): ambiente1, atención2, peligro3; por defecto máscara4 (solo peligro), TODOS=7. La categoría viene del emisor; el tag no la codifica.

**48 radios comprobados directamente** con `py tools/audita-datos-exe.py --ruidos`; coinciden con `obj-explosivos.md` §0. `FUN_00680530` admite hasta128 sonidos instantáneos; `FUN_006807E0` hasta32 persistentes. Un tag no registrado se rechaza. `FUN_00680F10/00680FE0` (`fn_00680000.c:1006/1068`) aceptan **distanciaXY² < radio²**, sin comprobación de altura/oclusores en estos consumidores. El callback de Oido01 añade sus propios filtros.

**[pendiente]** reconstruir específicamente la emisión de pisadas audibles y distinguirla de `AcPisada` (huellas visuales). La tabla de 48 radios ya estaba completa; no mantener «falta el resto de la tabla» como investigación pendiente. Los sonidos concretos de disparo/explosión aún requieren seguir cada emisor; GRAN se verificó como categoría3 en §5.

Casas [hecho]: `FUN_0044D420` (`fn_00440000.c:8215–8297`) lee CARCEL/NUMREGENSOLDIERS y diferencia cárcel0x100 / cuartel0x200 / casa0x400. `FUN_005A2760` (`fn_00580000.c:26577`, condición26620–26641) regenera un **grupo completo** con flag0x20 y reserva>1; reserva corta reduce NSOLDIERS a reserva−1 (también se consume el sargento). `FUN_005A2AD0/005A3500` reponen **soldados individuales**, ya leídos en `policia.md`. No confundir ambas operaciones ni descontar siempre uno por grupo.

## 5. Armas, estados, camuflaje y objetos del jugador

### 5.1 Recargas y consumo: dos contradicciones resueltas [hecho]

`0x8143C0` incluye un registro **NULO en índice0**; pistola empieza en **0x814468**. Paso0xA8, terminador id9 en0x8149A8: **10 registros contando NULO y terminador**. `FUN_004EF880/004EF910` (`fn_004c0000.c:30137/30186`) indexan desde1.

| Arma | Recarga (ciclos) | Munición por disparo |
|---|---:|---:|
| Pistola | **1** | 1 |
| Mirilla | 10 | 1 |
| Metralleta | **10** | **5** |
| Ballesta | 10 | 1 |
| Granada | 1 | 1 |
| Arpón | 60 | 1 |
| Piedra | 20 | 1 |
| Escopeta | 20 | 1 |

Volcado reproducible: `py tools/audita-datos-exe.py --armas`. `FUN_004F07E0` (**30676–30689**) solo sobrescribe la recarga de pistola si CFG+0x60 !=−1. El cierre viejo de `au-disparar.md` que dice «pistola10» es incorrecto; el que dice «metralleta1» también. La tabla inicial del mismo doc tenía correctamente 1/10. No confundir cadencia del disparo con duración de animación o actualización visual.

### 5.2 Piedra ≠ cachiporra [hecho]

`CAcPiedra` es el nombre RTTI (no `ClassAcPiedra`). `FUN_00492110` (`fn_00480000.c:10755`) guarda la primera colisión y solo marca víctima si apariencia !=2. `FUN_004926C0` (**11004**) decide caída o impacto en su primer paso. `FUN_00492520` (**10939**) manda **MSGA_PEDRADA**, sin daño, y emite PEDL; `FUN_004925E0` (**10967**) distingue sectores1/3/5 (CAERAGUA/PEDW) del resto (CAERTIERRA/PEDL).

El receptor **guarda**: `FUN_004722E0`, `fn_00440000.c:32524–32526`, llama a `FUN_004710C0` (**31545**). Esta solo cambia ATONTADO a ATONTADO_ESTATICO (o variante desnuda) **si ya tenía bit0x200000**. No crea el aturdimiento ni pone contador600.

El receptor **BAP**: `FUN_004370D0`, `fn_00400000.c:423001–423009`, incrementa su clase de sonido/reacción (`+0x68`), marca `+0x124`, guarda información del impacto y llama `FUN_004362E0` (**422013**), también solo modifica la animación si ya estaba atontado. El bloque siguiente maneja **CACHIPORRAZO** por separado. El atajo del port «piedra duerme600 ciclos» **contradice estos dos receptores**. Los efectos de otra familia se verifican en su cerebro, no se extrapolan.

### 5.3 Granada, tabaco y control [hecho / previo]

- Granada: `FUN_0046FEC0` (`fn_00440000.c:30720–30751`) emite **GRAN categoría3** en su primer ciclo y aplica daño radial con tipo2 y parámetros del objeto. No calcula una mecha ni una trayectoria aquí. Creación y parámetros ya estaban leídos en `au-disparar.md`; falta implementación, no descubrir si existe vuelo.
- Tabaco: `FUN_005133B0` (`fn_00500000.c:12877`) crea y descuenta la cajetilla; `FUN_00676860` (`fn_00640000.c:42500`) la registra como **CAJETILLA** en el sector. **No emite ruido en esos cuerpos.** La acción es **CAcTabaco**: `FUN_004B23F0` (`fn_00480000.c:30332`) negocia PUEDO_IR_A_COGERTE / ESTOY_YENDO_A_COGERTE / YA_NO_VOY_A_COGERTE. `FUN_004B1FD0` (**30143**) decide entre candidatos por distancia3D; si otro está más cerca rechaza al nuevo, y al aceptarlo se avisa NO_VENGAS al anterior. `FUN_004B1F00` (**30080**) consume el contador y libera su estado al terminar. La frase previa «distracción por sonido» no está demostrada por esta cadena. **[pendiente]** seguir la detección de la cajetilla y todas las acciones de fumar antes de elegir el estímulo del port.
- Control alemán: `FUN_004301B0` (`fn_00400000.c:418522–418535`) habilita `bicho+0x24C & 0x4000` solo si `+0x23C & 0xC00000==0` y `acción+0x178==0`; esto alimenta TomarControlAleman. El parpadeo del icono tiene una condición dinámica, no disponibilidad fija de la lista MIS.
- **[previo]** botiquín34 HP/cuadro10, jeringuilla letal tipo9/cuadro10, uniformes por rango, enterrarse cancelado si lo ven, arrastre y soltado de cuerpos: `au-jugador.md` §§1,2,8,9. No se releyó completa la serialización ni todos los getters; no atribuirles una investigación nueva.

## 6. Animales: huecos de avestruz, gaviota y perro

**Avestruz [hecho]:** `FUN_0042B2C0`, `fn_00400000.c:415248–415451`, ya leído completo: estado4 reanuda patrulla; 5 vuelve a punto/ruta; 6 fija vista y persigue (renovación10); 7 anima **ATACA**, conserva víctima, activa bit0x2000000; 8 para/vigila con espera por defecto100; 9 pide ruta a punto con velocidad alternativa. Tick **`FUN_0042C910`** (**415940–416145**) verifica blanco, distancia y ruta; en estado7, **cuando contador==5**, aplica **MORDISCO tipo4, daño25** si está suficientemente cerca (**416044–416047**). No inferir daño por tamaño del animal.

**Recinto [hecho]:** `FUN_00429380` (avestruz, **413835**) y `FUN_004655B0` (felino, `fn_00440000.c:24312`) comparan la máscara del recinto con la máscara del **sector del animal** y actualizan bit0x1000000. `FUN_005F4430` (`fn_005c0000.c:33649`) es **búsqueda de nombre** en una tabla de entradas de32 B; no comprueba paredes ni confina físicamente al animal. **[pendiente]** seguir todos los lectores del bit y validadores de destino antes de afirmar «nunca sale del recinto».

**Gaviota [hecho]:** `FUN_0046E760`, `fn_00440000.c:29813–29969`, lee posición/sector, elige nodos y avanza con vector normalizado: velocidad **8 unidades por ciclo**, caída/herida **10** (`fld qword` y constantes0x796170/0x794AA0). Se cambia destino al quedar a distanciaXY²<**16** (4 unidades). `FUN_006FE6D0` (`fn_006c0000.c:44343`) recorre vecinos del grafo, prefiere rumbos compatibles y elige al azar; `FUN_006FE8E0` (**44435**) elige vecino más alejado del estímulo. No es vuelo aleatorio libre. El tick actualiza la sombra sobre el plano del sector y avanza su animación a3,5 (`0x795A94`). El cambio entre aleteo/planeo depende de la altura de los destinos. **[pendiente]** comprobación en pantalla de aterrizaje y sombra, y parámetros del grafo desde los datos.

**Perro [hecho]:** `FUN_0045D6F0`, `fn_00440000.c:18470`, devuelve **`b + rand·(a−b)/32767`**. El desensamblado0x45D6F0…0x45D727 confirma el divisor double32767. En el caso7 de `FUN_0048F9B0` (`fn_00480000.c:9551`), **0x48FED0…0x48FF3C**: genera magnitud uniforme **10…45°**, otro `rand()%3` conserva el signo positivo si es0 y lo invierte en los otros dos casos (constante double−1 en0x796190). Lo suma al rumbo y elige punto a **85 unidades**. No es uniforme en −45…+45 ni incluye desvíos menores que10°. Perro **sí muerde** (25, `perro.md`): la frase de `animales.md` «felino/avestruz son los únicos que hieren» excluía erróneamente al perro.

## 7. Presos, policía, cadáveres y estados

**Corrección al Cierre2 de `presos-testigos.md` [hecho]:** `FUN_005A96F0`, `fn_00580000.c:31398`, consulta una **ruta** desde las constantes XY(1513,1327) y comprueba ausencia de alemanes en ella; no recorre guardias en alarma. `FUN_005A97A0` (**31420**) devuelve1 si encuentra un elemento de la lista `+0x48B8` **vivo**, no esposado/atontado (`+0x23C &0x204000==0`) y activo (`+0x38 &4`). Tampoco consulta nivel de alarma.

El tick `FUN_005A9A60` (**31538–31588**) los combina: si `+0x487C!=0`, **no queda ningún vigilante activo** y la ruta de `FUN_005A96F0` es válida → selecciona **CHHU**; si no, bajo las otras condiciones del tick → **CHES**. El resultado se guarda en `+0x485C`, emisión única por `+0x4878`. La comprobación usa contador recargado a5 y decrementado en los otros ticks: no describirla como una consulta directa a la alarma ni prometer exactamente5 ticks entre ejecuciones sin contar la recarga.

**Cadáveres [hecho]:** `FUN_006AFC10`, `fn_00680000.c:34921–35057`, devuelve para apariencia alemana **2=muerto, 3=esposado, 5=atontado**, antes de la categoría de soldado normal; no son el mismo estímulo. La respuesta se decide en cada cerebro. Las cadenas enteras BAP2/Gestapo siguen fuera de este lote (fila original55 % /0 %), aunque compartan receptor.

**[previo]** custodia/liberación (`detenido.md`), escolta de AcVigilante (`vigilar-vigilante.md` B), formación/paciencia/arresto de AcpSargento (`policia.md`, incluidos los cierres2 que ya corrigen offsets), reactividad de Testigo (`presos-testigos.md` §3). Se revisaron esas lecturas al delimitar huecos; no declarar «solo falta leer» una regla que ya tiene función y offsets.

## 8. Controles y puntuación

**Clic sobre aliado [hecho]:** `FUN_0069A4F0`, `fn_00680000.c:19565–19659`, busca al aliado en la interfaz y consulta `FUN_005BB2B0` (`fn_00580000.c:47006`). Si es seleccionable, existe su subinterfaz y el virtual+0x64 de la subinterfaz actual devuelve0 → `FUN_00699760` (selección). En otro caso manda ACTUASOBREELEMENTO. Por tanto **izquierdo sobre aliado puede seleccionar**, según el modo/acción actual, no es siempre una orden. `FUN_00598810` (**18930**) solo copia/normaliza el registro del clic; `FUN_006964B0` (`fn_00680000.c:16268`) separa envío local de envío de orden de red.

**Rango de campaña [hecho]:** `FUN_0059BA60` (`fn_00580000.c:22081`) suma el rango de la misión al score en G+0x460 y devuelve si hubo ascenso. `FUN_0063CD20` (`fn_00600000.c:44159`) = **min(4, score/6)**, división entera; `FUN_0063CD50` (**44174**) = **min(5, score−6·rango)**. `FUN_0063CC40` (**44130**) combina puntuaciones de tiempo y daño; el denominador de daño que pasa es **númeroAliados×200**, no una suma recién supuesta de máximos de vida. Ya estaba en `ui-misiones-guardado.md`: era deuda de implementación. **[pendiente]** comprobar los códigos de fin no portados y la presentación exacta de bajas contra `FUN_00570510`.

## 9. Reglas ya documentadas y comprobaciones de datos

- **Escaleras [hecho parcial + previo]:** el lector general del bicho `FUN_0050C490` (`fn_00500000.c:8984`) lee ESCALAUSABLEPORBUZO. No inventar que todos los comandos o todas las escaleras valen al bucear. La trepada/cancelación está en `q1-escaleras.md`; **[pendiente]** filtro exacto del cursor de piolet, ya señalado allí.
- **Buceo [hecho]:** `FUN_004E95A0` (`fn_004c0000.c:25964`) exige lista no vacía de sectores pisados **todos tipo1**; `FUN_004E9730` (**26042**) además comprueba estado+0x824&0x4000. `FUN_004E97B0` (**26075**) restaura R/H y ojo guardados, limpia bits0x80/0x1000/0x80000. No cambiar el criterio de inicio por «cerca del agua».
- **Bombas [hecho parcial + previo]:** `FUN_004FA800` (`fn_004c0000.c:37072`) usa PONEBOMBA a velocidad+1/prioridad6; `FUN_004FAA60` (**37173**) la usa invertida/prioridad10 para recoger. La manipulación efectiva y elección de lugar están en `au-jugador.md` §9. CASA04 y destrucción de ocupantes están en `mision-intendencia.md`; este lote no cambió objetivos.
- **Nidos [previo]:** `obj-armas-fijas.md` §1 contiene el cuerpo `FUN_00488670` (10 tiros, un tiro por ciclo, pausa10) y los receptores del ocupante. No confundir la lectura jugable del nido con una máquina completa del cañonero, marcada parcial en §3 del mismo doc.
- **Objetos [previo]:** `obj-puertas.md` tiene condiciones y estados de puertas, interruptores y focos; `obj-explosivos.md` tiene bomba/cepo/señuelo; `presos-testigos.md` contiene Testigo. **[pendiente]** puentes/compuertas/interfonos y artillero completo, cuyo alcance previo era solo estructural. No marcarlos cerrados por contigüidad de direcciones.
- **Noche [hecho parcial + previo]:** `FUN_005AB7B0` (`fn_00580000.c:33385`) devuelve la hora fija+0x487C mientras+0x4870==0; luego usa el parámetro de ticks, DURACIONCICLO y topes. Las curvas, filtros y focos están leídos en `render.md` Cierre2 y `obj-puertas.md` §5. **No fijar hora21 para mejorar el aspecto sin un dato/evento que lo autorice**. **[pendiente]** activación real de la cadena de eventos, solapes y bancos de paleta en pantalla.
- **Barrido [hecho]:** `FUN_004C0C30` (`fn_004c0000.c:84`, cálculo160–166) suma caracteres pares/impares del token, toma el índice y tabla16 de `vigilar-vigilante.md` A1; la fase inicial es **(tabla[índice]+20)×5**, no solo `suma&15`. `FUN_004C1A30` (**533**) calcula ángulo y manda SETANGCABEZA_CHANGEMOD. No se verificó desfase jugando esta sesión.

**Datos reales [hecho]:** `node --experimental-transform-types tools/verifica-investigacion.ts` leyó y parseó directamente el WAR_MP.DIR de raíz: **19 MIS +96 MAC**, **21.298 listas**. No se escribió en la instalación ni se guardaron archivos extraídos.

| Clave contrastada | Usos / archivos |
|---|---:|
| HABILIDAD / TIPOVEH | 29/25 · 36/35 |
| REPARTEIMPACTO / ATROPELLA | 10/9 · 21/16 |
| NUMREGENSOLDIERS | 34/13 (reservas explícitas0/4/8/14/16 y variable de macro) |
| ESPERAEVENTO / ENLAZAR | 295/14 · 686/12 |
| EXITHOME_EVENTS / REACT_EVENTS | 52/10 · 47/10 |
| ZONARECINTO | 9/3 (leones y avestruces, incluida macro) |
| PRESO / OTROVIGI / CARCEL | 13/5 · 9/3 · 13/7 |
| ESCALAUSABLEPORBUZO | 25/14 (0/1 y variable de macro) |
| MATABICHOSSECTOR | 4/4 |
| PIEDRAS / GRANADAS | 51/17 · 6/6 |
| HORAENCENDIDO / ILUMINADA | 6/4 · 1/1 |
| DURACIONCICLO / LANZALLA | 0/0 · 0/0 (solo ausencia de esas claves literales, no ausencia de la funcionalidad) |

## 10. Qué queda y cómo usar esta lectura

**Continuación:** [cierre-faltantes-70.md](cierre-faltantes-70.md) cierra coordenadas/clic/marcadores del minimapa, la cadena PASW de agua, selección/pérdida de blanco de CLancha/CTanque y el contraste de22 grafos de aves. Quedan los límites precisos allí indicados; este párrafo actualiza la lista histórica siguiente.

Este documento cubre las **23 filas solicitadas** con revisión de sus lecturas, consultas nuevas y contraste de datos. Las conclusiones nuevas están separadas de reglas previas. Quedan los límites explícitos de cada sección: vuelo/recinto completo, todos los estados de conductores, piolet, minimapa/FPU, todos los contextos del HUD, pisadas audibles, presentación de resultados y comprobación visual. **No reemplaza esos límites por un 100 %.**

Las correcciones que afectan al port (piedra, colocación de mochila, categoría/sector de sonido y selección de aliado) son tareas de implementación posteriores con pruebas. Aquí no se implementan: el pedido fue investigar. No se reescribió el registro histórico `tasks/lectura-exe.tsv`, que mezcla tandas anteriores y no distingue una consulta parcial de una lectura íntegra.
