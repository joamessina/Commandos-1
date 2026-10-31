# Cierre de huecos de investigación de Misión 0 — 2026-10-30

Este documento completa y delimita la investigación que faltaba en la sección A de `tasks/pendientes.md`. Se apoya en el exe raíz y en los documentos previos; cada dato nuevo cita C de Ghidra `research-c1/ghidra/all2` con línea. «Falta» distingue investigación estática que aún se puede hacer de portar o comprobar el juego, que no es lectura adicional del exe.

## Instancias reales de M0 [hecho, DIR raíz]

`node --experimental-transform-types tools/investiga-mision0.ts` lee directamente `DATOS/MISIONES/MAPA0000.MIS` (53.671 bytes, dentro de `WAR_MP.DIR`) y evita depender del inventario de otras misiones. El bloque `.MISSION` declara una música `FASES.WAV`, seis sonidos OLEA y uno WIND en `.AMBIENTE`, cada uno con posición y volumen propios, y un único sensor `.SENSORES_SND_ZONA` para `CAMPAMENTO` que envía `REAC`. No es una alarma global por cualquier sonido: `ClassGestorPorZonas` exige coincidencia de zona y tipo en su máscara (`sonido.md`, `FUN_006FFAE0`/`006FFA00`), y el evento tipo6 se difunde a grupos y reactividades (`cierre-70.md` §4; `mision-intendencia.md` §5). El script también expone las cinco entradas `.PATRULLAS`, `EXITHOME_EVENTS REAC` y los bloques `.ELEMENTOS`; los detalles de cada patrulla se imprimen acotados para no extraer recursos binarios.

La lista real de elementos confirma que M0 trae `EXPL_ANTENA` con `AcExplotaCasa`, daño de disparo deshabilitado (−1), bomba 1 y proyectil de tanque 1; al destruirse cambia tiles de ANTENA/CASA04. El jugador inicia con FRANCOT y LANCHERO; FRANCOT tiene armas MIRILLA/PISTOLA/PIEDRA, 6 balas de mira, 100 piedras y botiquín con `.USOS 5` (diez curas efectivas; ver tabla). Hay cuatro bombas `BOMBA1..4`, CEPO, SEGNUELO, un `METRBASE2`, tres `NIDOMET`, cuatro macros CASA y un ZODIAC5; no hay FOCO en los bloques `.ELEMENTOS` de M0. Hay 22 instancias `MINASUB` nombradas en el macro (no toda mina está sobre superficie). El script focal lee los bloques directamente y muestra clase, token, macro y coordenadas sin extraer assets.

Los cinco grupos reales son: `PATRULLA1` (3, `CASA_REACT_01`, regeneración1, `EXITHOME_EVENTS=REAC`), `PATRULLA2` (1, sin HOME ni evento de salida), `PATRULLA3` (2, `CASA_REACT_02`, regeneración1, REAC), `PATRULLA4` (2, mismo HOME y REAC) y `PATRULLA06` (2, `CASA_REACT_03`, regeneración1, REAC). Por eso cuatro grupos escuchan salida REAC y el grupo suelto no se vuelve un refuerzo de casa por inferencia. El catálogo cruzado real (`node --experimental-transform-types tools/mac-catalogo.ts <salida>`) confirma que MAPA0000 instancia BAP1 cinco veces, BAP2 seis, BANPE1 trece, BANPE2 cuatro, NIDOMET tres, METRBASE tres, CASA cuatro, MINASUB22 y ZODIAC5 una. `BAP1.MAC` declara `NERVIOSISMO`, barrido, patrulla/vigilancia y órgano OIDO; BAP2 agrega acción `AcBap2`, también con OIDO. En el nivel raíz de MAPA0000 no aparece `.REACTIVIDADES`; la reacción de zona explícita es la salida de los cuatro grupos inscritos en `EXITHOME_EVENTS=REAC`. El grupo suelto no tiene ese comportamiento.

## Luces y activación de la misión 0 [hecho]

El foco no se enciende por hora en M0: `FUN_00468FA0` (`fn_00440000.c:26443–26458`) compara `HORAENCENDIDO` con la hora que devuelve la intendencia y solo cambia a encendido si `HORAENCENDIDO < hora` (26452–26456). La intendencia base da cero; solo la misión nocturna 9 provee reloj (`obj-puertas.md` §5; `mision-intendencia.md` §7). El barrido real en `cierre-80.md` §9 encontró `ILUMINADA 1` y `HORAENCENDIDO 20.50` en MAPA0009, no M0. Por eso, en M0 un foco solo se enciende si su estado inicial o un interruptor lo ordenan. `AcInterruptorFoco` envía `MSGA_APAGAENCIENDE_FOCO` (`obj-puertas.md` §4); las reglas y parámetros del foco están leídos en §5. La receta de día y paletas está en `render.md` §C2.5: el pase diurno usa identidad; los focos solo afectan si hay uno activo.

## Sombras, agua y partículas [hecho con límite]

No hay sombra dinámica genérica para cada comando: la sombra de voladores es otra secuencia del ANM. `FUN_0046E180` (`fn_00440000.c:29591–29623`) crea `VOLARSOMBRA`; el selector `FUN_0046E2B0` (`fn_00440000.c:29627–29664`) actualiza secuencia de vuelo y sombra. Edificios y objetos usan tiles con alfa precompuesto. Las estelas de agua usan emisores del ANM, no una sombra nueva: `render.md` §§2.2 y Cierre 6 describen hotspots y animación del mar; Cierre 7b documenta la composición de sombras en tierra sobre el agua. Los parámetros de inicialización de agua, sangre y humo están ampliados en `render.md` §2.2; aún faltan partes de su actualización fina y el contraste visual.

## Acciones declaradas por aliado en M0 [hecho]

`node --experimental-transform-types tools/audita-acciones-m0.ts` recorre también los bloques anidados del `MAPA0000.MIS` real. Los cuatro registros siguientes son declaraciones del archivo: la tabla no supone que todos estén disponibles desde el primer ciclo.

| Token | Acciones y parámetros particulares declarados |
|---|---|
| `FRANCOT` | `AuDisparar`: MIRILLA, PISTOLA y PIEDRA, seis cargas de mirilla y 100 piedras; `AuBotiquin` con `.USOS 5`, que el ejecutable convierte en diez cargas. |
| `LANCHERO` | cuchillo, buceo, pistola, arpón y 100 piedras; `AcUsaHab` con habilidad BALSA, `AuUsarVehiculo` restringida a BALSA y `AuManejaBalsa` con `ZODIAC5`, `IT_BALSA`, `LANZABARCA`. |
| `COMANDO` | cuchillo, pistola, piedra y escopeta, 100 piedras; escalar con `ESCALAMUROS SI`, cargar barril y cuerpo (`AuGarfio`), señuelo `SEGNUELOUNO`, esposas y cachiporra. |
| `ARTIFIC` | pistola y piedra, 100 piedras; manejar `BOMBA1` a `BOMBA4` y `CEPO`. |

Cada uno declara además movimiento, uso y recogida, escalada, vehículos, entrada en habitáculo, tabaco y toma de control alemán; las prioridades y la lista completa se obtienen del auditor. Los ids de acción y la relación ítem→acción están en `docs/engine/acciones-jugador.md` §§4–6; la ejecución de cada acción en ese documento §7 y `au-jugador.md`. Declarar una acción no implica que cualquier blanco sea válido ni que el ítem ya esté disponible. El mismo recorrido recursivo encuentra BAP1=5, BAP2=6, BANPE1=13 y BANPE2=4: confirma que el conteo de 28 de las entradas directas no omitió instancias adicionales de esas cuatro macros en otros bloques.

**Corrección del botiquín [hecho]:** `FUN_004E8B50` (`fn_004c0000.c:25455–25488`, asm `0x4E8B7A–0x4E8BBF`) carga `.USOS` y multiplica por dos antes de guardarlo en `acción+0x1A0`. Con `.USOS 5` de FRANCOT el contador inicial es 10. `FUN_004E8C30` (`25502–25525`) resta uno solo si el blanco sigue herido y recibe hasta 34 puntos de energía, y retira el ítem cuando el contador llega a cero. Por tanto, son hasta diez curas efectivas, no cinco; el valor del archivo no es directamente la cantidad de curas.

### Emisores de atención y peligro vinculados a M0 [hecho]

El sensor de CAMPAMENTO usa el tipo de sonido y el sector del emisor, no solo la distancia al guardia: `FUN_00681170` (`fn_00680000.c:1158–1167`) entrega sector y categoría al gestor; `FUN_006FFAE0` y `FUN_006FFA00` (`fn_006c0000.c:45066–45088`, `45010–45023`) comprueban zona y máscara. La categoría predeterminada del sensor es peligro (3), por lo que las voces o emisores de atención (2) no bastan por sí solos para disparar `REAC`.

| Fuente y condición | Ruido para IA | Relación con el sensor |
|---|---|---|
| Bomba al detonar, `FUN_00440D30` (`fn_00440000.c:355–395`) | `XPLO`, categoría 3, radio 1200 | Puede disparar `REAC` si el sector pertenece a CAMPAMENTO. |
| Mina al detonar, `FUN_00483540` (`fn_00480000.c:1682–1764`) | `XPLO`, categoría 3, radio 1200 | Igual; la mina submarina también usa este emisor. |
| Barril al explotar, `FUN_0043F9B0` (`fn_00400000.c:427205–427245`) | `EBAR`, categoría 3, radio 1200 | Igual, sujeto al sector donde explota. |
| Señuelo activado, `FUN_004A8CB0` (`fn_00480000.c:24185–24214`) y registro `FUN_00680D50` (`fn_00680000.c:856–887`) | `DCOY`, categoría 2, radio 300 | Puede ser oído por guardias; no pasa por sí solo el filtro de peligro predeterminado. |
| Piedra al golpear o caer, `FUN_00492470`, `00492520` y `004925E0` (`fn_00480000.c:10906–10935`, `10939–10985`) | `PEDL` en tierra o impacto, `PEDW` en agua; categoría 2, radio 125 | Atención; no activa por sí sola el sensor de peligro. Un impacto también manda `MSGA_PEDRADA` al blanco. |
| Nido al disparar, `FUN_00487C70` y `00488670` (`fn_00480000.c:4555–4661`, `4968–5027`) | `NIDO`, categoría 3, radio 500 | Su emisión durante la ráfaga puede activar `REAC` si el sector del nido está en CAMPAMENTO, incluso cuando dispara un enemigo. |
| Guardia BAP2 ante bandera de cuerpo, `FUN_0043A200` y `FUN_00430DF0` (`fn_00400000.c:424133–424157`, `419095–419105`) | `VMUE`, categoría 2, radio 150 | Atención; no activa por sí sola el sensor de peligro. |
| Guardia cuando `FUN_00430C40` permite la voz (`fn_00400000.c:418991–419008`) | `ALRM`, categoría 3, radio 300 | Puede activar el sensor si se emite dentro de la zona. |

Los radios vienen de la tabla `0x821DE0` (`obj-explosivos.md` §0), y son el alcance de percepción de guardias: el filtro de zona del sensor no se calcula con esos radios. El señuelo puede provocar después otras acciones de los guardias; la fila solo describe el sonido `DCOY` original.

**Extensión real de CAMPAMENTO [hecho]:** `tools/audita-sectores-m0.ts` lee `MAPA0000.SEC`: 481 sectores, todos en la lista base. El grupo `CAMPAMENTO` declara 482 pares y cubre **473 sectores distintos**; las nueve entradas restantes repiten índices válidos. Los ocho sectores excluidos son 45, 46, 58, 71, 72, 146, 159 y 452; seis son agua profunda y dos tierra. Así, el nombre CAMPAMENTO no implica que el sensor esté limitado a la vecindad visual de los cuarteles. `FUN_005FA5F0` (`fn_005c0000.c:37004–37085`) interpreta cada par como selector de lista e índice: selector menor que 1 usa la lista base; otro usa la superpuesta; ignora índices fuera de rango y marca en el sector el bit del grupo. M0 no contiene sectores superpuestos, por lo que estos 473 índices son inequívocos para esta misión. La implementación compartida `ZoneEvents` usa solo el segundo valor del par: su efecto en otras misiones con lista superpuesta queda pendiente de corregir y verificar.

### Bajas mostradas al finalizar [hecho]

`FUN_00570510` (`fn_00540000.c:32187–32238`) dibuja tres contadores en columna, en `(centroX+30, centroY−177)`, `(centroX+30, centroY−138)` y `(centroX+30, centroY−99)`. Los obtiene respectivamente de `FUN_0063CB40`, `0063CB60`, `0063CB80` (`fn_00600000.c:44068–44092`): son contadores de categorías 4, 2 y 1. La escritura de baja `FUN_0059A5B0` (`fn_00580000.c:21031–21052`) incrementa según el valor exacto de `bicho+0x244`.

El origen de esas categorías está en `FUN_0059D6D0` (`23412–23489`): si el elemento ya tiene una categoría 1/2/4 la conserva; para los demás, al hallar `AcMuerte` y el bit 2 de `bicho+0x240` añade la categoría 4, `AcExplotaVeh` añade 2 y `AcExplotaCasa` añade 1. Estas etiquetas describen la clasificación por acción y flags, no prueban que toda baja de la primera fila sea alemana ni que un elemento con varias categorías se contabilice igual que uno con una sola; el incremento mostrado exige igualdad exacta. Los rótulos gráficos y la pantalla en ejecución siguen pendientes de contraste.

## Explosión y demolición de CASA04 [hecho; contraste pendiente]

Las clases de mina, bomba, barril y explosión ya están leídas en `obj-explosivos.md` §§0–3: `FUN_00483540` detona mina; `FUN_00440D30` bomba; `FUN_0043F9B0` barril; sus efectos llaman `FUN_00571FE0`, reproducen `XPLO` y crean cráter solo fuera del agua. Las acciones de destrucción de edificio y sus materiales están en `render.md` §4 y `mision-intendencia.md` §§4,6. No queda una regla de explosión de M0 por descubrir en esos documentos; falta verificar el resultado jugable y completar el port donde aún se usa `shortcut:`.

## Casas, refuerzos, patrulla y voces [reglas compartidas leídas]

La reserva no se consume si falla la creación: `FUN_005A2AD0` (`fn_00580000.c:26671–26734`) consulta `MSGA_CASA_GET_NREGENSOLDIERS`, toma entrada y crea; solo si `FUN_0059F7E0` devuelve no cero incrementa grupo y descuenta una unidad (26717–26728). La regeneración de grupo y el evento de alarma se describen en `mision-intendencia.md` §4; el difusor `FUN_0059A060` sale por `EXITHOME_EVENTS`/`REACT_EVENTS` (`cierre-70.md` §4, `cierre-80.md` §6). En `FUN_0059A2A0` (`fn_00580000.c:20865–20906`), tipo 6 es llamada virtual en slot `+0x1C` (20897–20899); el dispatch común por misión está documentado en `mision-intendencia.md` §5.

La reacción de cadáver/espía tiene voz de atención primero y alarma después: `sonido.md` Cierre 5 atribuye VMUE/VESP a categoría 2 y ALRM, tras 20 ciclos, a categoría 3, con flags por motivo. Los MAC concretos de M0 instancian BAP1, BAP2, BANPE1 y BANPE2; sus atributos efectivos se resuelven desde `BAP1.MAC`, `BAP2.MAC`, `BANPE1.MAC`, `BANPE2.MAC` más overrides del `.MIS`. La jerarquía común precarga las voces y define la reacción (`cierre-70.md` §5; `soldado-acbap.md` §«Cadena de reacciones»). Se leyó el parser/filtro de zona y las transiciones principales de AcBap2 en `soldado-acbap2.md`; quedan la correlación de sus flags de subclase con slots virtuales y los overrides de tokens concretos. El receptor final de cada token no se debe inferir del nombre BAP2.

## Zodiac y acciones del jugador [lectura previa cierra los mecanismos comunes]

`sim-vehiculos.md` y `cierre-70.md` §3 documentan daño, pinchado y transición de simulación de balsa a objeto; `vehiculos.md` §2 describe llegada/velocidad y `au-jugador.md` §10 establece que bajar requiere velocidad menor que 0,01 y que el sector bajo el bote no sea agua (FUN_00503030/00503340). `cierre-80.md` §3 cierra NOVERHASTA y el umbral de desplazamiento de lancha. Lo restante del Zodiac es verificar los límites de orilla con datos/ejecución y portar la transición; no reabrir la física ya documentada.

Bombas y armas: `au-jugador.md` §9/Cierre 7 de `render.md` contiene la máquina de caminar, girar, animar `PONEBOMBA` y activar/manipular al terminar; `cierre-80.md` §7 ya confirma espera por duración `bicho+0x8CC`. `cierre-70.md` §5 corrige piedra y recargas. La matriz por comando está en `docs/engine/acciones-jugador.md` §3; la investigación pendiente se limita a acciones que no tengan receptor/condición citado allí, no a releer todas las armas.

## Huecos que siguen abiertos

### Cruce de instancias de guardias (continuación, DIR raíz)

`node --experimental-transform-types tools/audita-soldados-m0.ts` enumera las entradas directas de `.ELEMENTOS` y muestra por token todas las variables suministradas a su MAC, además de las acciones y órganos de las cuatro plantillas. Resultado: **28 entradas**: BAP1=5, BAP2=6, BANPE1=13, BANPE2=4. Son entradas de configuración, no 28 soldados activos simultáneamente:15 declaran `TODOS`,8 `DIFICIL`,4 `FACIL` y `BAP2_NIVEL2` no declara `.NIVEL`.

**Filtro de dificultad [hecho]:** el jugador elige fácil o difícil antes de entrar; sigue pendiente implementar ese menú. El cargador `FUN_00609930` (`fn_00600000.c:7433–7505`) parte de −1 para cada entrada; solo `FACIL` lo cambia a0 y `DIFICIL` a1. Si queda −1, la procesa sin comparar la dificultad seleccionada; si es0/1, exige igualdad con `juego+0x45C`. Una clave ausente genera bloque vacío (`00424660`, `fn_00400000.c:409885–409895`) y `0060A4E0` escribe cadena vacía (`fn_00600000.c:7908–7915`, confirmado por asm0x60A4E8–0x60A4FB). Por tanto `BAP2_NIVEL2`, igual que las15 entradas `TODOS`, pasa el filtro en ambas dificultades. El conteo del filtro sobre estas28 entradas es **20 en fácil y24 en difícil**; no incluye guardias de otras macros ni refuerzos que puedan aparecer después. No supone una dificultad predeterminada para el jugador.

Los11 BAP1/BAP2 traen un override `.AcPatrulla` con rutas particulares; los17 BANPE no declaran esa variable directamente en estas entradas. Todos declaran `.TENGOTABACO 1`. Los tres tokens `BANPE1_2_PLAYA`, `BANPE1_4_PLAYA_D` y `BANPE1_4_PLAYA_F` declaran `.AngBarrido 35`. Las cuatro plantillas llevan `Oido01`, `Vista01`, `MotorAndante`, `AcDisparar` y `AcVigilar`; sus prioridades y parámetros completos se pueden reproducir con el auditor. El resultado no demuestra por sí solo que los defaults de variables sin declarar sean iguales ni que todos los estímulos disparen una reacción.

**Valores comunes de esas 28 entradas [hecho]:** las cuatro macros usan `.NERVIOSISMO $UmbralNerviosismo`, sin valor por defecto en la declaración; ninguna de las 28 instancias aporta la variable (auditor `tools/audita-soldados-m0.ts`). La sustitución ausente genera bloque vacío (`FUN_00424660`, `fn_00400000.c:409897–409909`), el lector `FUN_00431530` solo sobrescribe si el bloque tiene contenido (`419540–419551`) y el constructor base `FUN_00434840` inicializa `+0x44` a 50 (`421205–421230`, `421330–421352`). Así, el nerviosismo efectivo es **50** para esas entradas, salvo modificación posterior en ejecución. En las diez entradas BAP2/BANPE2 tampoco se pasan `PERSIGUESONIDO`, `PERSIGUEPISADAS` ni `VELDEJARPATRULLA` a la acción: se conservan los defaults del constructor de la subclase, 1, 1 y 3,0 respectivamente (`soldado-acbap2.md` §1). Que esos parámetros coincidan no hace iguales sus rutas ni todos sus estímulos.

### Reacciones BAP2: identificación de flags y voces [hecho]

Las funciones de la subclase leen offsets de la estructura, no números de mensaje aislados. `FUN_0043A200` (`fn_00400000.c:424133–424157`) consume **+0xE4** (cuerpo/objeto visto), cambia alerta a10, pasa destino **+0x26C** e identificador **+0x408** al slot +0x84 y marca vista interesante con `004310B0`. Si **+0xF0** está activo llama `00430DF0` (VMUE); en caso contrario `00430E30` (AL02). Ambas voces usan categoría2 (`fn_00400000.c:419095–419118`).

`FUN_0043A290` (424160–424179) consume **+0xE8**, destino +0x278 e id +0x40C, eleva alerta a8 y llama `00430F30` (AL04, categoría2; 419160–419169). `FUN_0043A300` (424181–424202) consume **+0xFC**, destino +0x29C e id +0x3F0 y fija alerta5. Estos offsets se correlacionan con las escrituras de la base documentadas en `soldado-acbap2.md` §2; no todos esos objetos son cadáveres.

`FUN_00433430` (420534–420594) deriva el estímulo de sonido marcado en +0xF4 al slot +0x68 con alerta12 cuando el bicho no está en el estado excluido. `FUN_0043B470` (424787–424860) implementa ese slot en BAP2: consulta `PERSIGUESONIDO` en +0x660; cuando procede usa buscador y velocidad +0x698, y si no puede iniciar o no persigue, mira el punto durante100 ciclos. En ciertos estados y distancias consulta `005F9820`; su resultado modifica la persecución, por lo que no corresponde afirmar que todo sonido siempre se persigue.

- Completar el cruce de overrides del `.MIS` contra los MAC de BAP1/BAP2/BANPE1/BANPE2, sobre todo las reacciones especializadas de BAP2; el base `AcBap2` sigue parcialmente leído en `soldado-acbap.md` y M0 no tiene lista raíz `.REACTIVIDADES`.
- Terminar el mapeo por cerebro de qué mensajes de audio son de atención o peligro y qué acciones concretas de M0 los emiten. M0 tiene OLEA/WIND de ambiente y sensor CAMPAMENTO→REAC; falta asociar los emisores de atención/peligro de cada guardia y comprobar su radio/condición.
- Completar el cruce de armas/acciones por comando para las instancias presentes en M0; la matriz de habilidades y `au-jugador.md` contienen reglas compartidas, pero falta una tabla token→acción→receptor para M0.
- Paletas concretas del HUD y posibles recursos BMP/RLE del tutorial no afectan reglas de misión; permanecen como deuda del HUD general documentada en `cierre-80.md` §2.

Además de implementación y prueba en pantalla, sigue abierta investigación estática en las tres líneas del listado anterior. El cierre no se puede declarar hasta correlacionar los overrides concretos de MAPA0000 y sus MAC. Las comprobaciones visuales/auditivas del port quedan separadas: leer el exe no demuestra que el navegador reproduzca el resultado.
