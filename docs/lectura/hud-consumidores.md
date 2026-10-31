# HUD compartido: consumidores y correcciones (2026-10-30)

Las líneas citadas corresponden a `D:/Joaquin/research-c1/ghidra/all2/`. Lectura del exe original y del `WAR_MP.DIR` raíz. No se modificó el port. Este informe prevalece sobre las hipótesis históricas de `hud.md`.

## 1. Caras, barra de vida y ranuras [hecho]

`FUN_006F48E0`, `fn_006c0000.c:36953–37103`, construye un registro de cara de 0x6C bytes. Tiene dos botones de animación: principal en +0x44, secundario en +0x48. El secundario recibe `ALCAT000/001/003/004/005.BMP` y empieza oculto. Por tanto, **la ventana extra del marco ancho es otro botón de cara**; no se debe inferir que un marco ancho simplemente significa «comando seleccionado».

`FUN_006F91C0`, mismo archivo:40206–40335, elige `MARC0000` si el botón secundario no está visible y `MARCA000` si está visible. Solo procesa entradas cuyo botón principal está visible (+0x3C). Calcula la barra:

```
porcentaje = trunc(vidaActual * 100 / vidaMaxima)
alto = trunc(porcentaje * 37 / 100)
x = origenRanura + 47 + (secundarioVisible ? 24 : 0)
y = 39 - alto
ancho = 9
recorteFuenteY = 37 - alto
```

No dibuja cuando alto=0. El código no añade un clamp. El puntero a vida está en registro+0x60 y el máximo en +0x64; `FUN_006F4D70` (:37173–37208) los actualiza y pide redibujado cuando cambia la vida. El productor `FUN_0068E210`, `fn_00680000.c:10914–10921`, obtiene esos valores de bicho+0x208/+0x20C mediante el mensaje 0x19.

`FUN_006F9D40`, `fn_006c0000.c:40712–40762`, coloca cara principal en (origen+6,1) y secundaria en (origen+55,1). Avanza ancho del marco+3: **65 o 89**, a partir de los 62/86 píxeles reales. Corrige los 63 píxeles medidos anteriormente. `FUN_006FAC70` (:41332–41526) carga ambos marcos; su valor inicial 10 en +0x7C es capacidad del vector de registros, **no diez estados de salud**.

`FUN_006F99B0` (:40458–40539) busca el token principal o secundario y marca botón+0xEC=1. `FUN_0051D810`, `fn_00500000.c:20419–20441`, consume esa marca en cada actualización y la limpia; con botón y padre visibles, y +0xE8=0, selecciona avance/retroceso con `0051A7A0`/`0051A810` (:18111–18142). `FUN_004E0210`, `fn_004c0000.c:18561–18581`, avanza la animación con contador; su constructor `004E00A0` (:18475–18520) fija intervalo inicial 1. No es un índice calculado a partir de vida.

`FUN_006F4C80`, `fn_006c0000.c:37133–37172`, actualiza +0x5C y el selector +0xE8 del botón a través de `0051B640`; oculta la cara secundaria. `0051B350`, `fn_00500000.c:18835–18931`, dibuja el tile fijo +0x100 cuando +0xE8!=0; en otro caso la animación embebida +0x108 (tile+0x110). El disparador 0x1B se recibe en `00697100`/`00697C90`, `fn_00680000.c:17007–17024,17706–17747`.

## 2. Alarma [hecho]

`FUN_006FA220`, `fn_006c0000.c:40960–41043`, construye **ClassLinterna**, registra actualización con argumento 0x14 y arranca el índice global en cero. `006F76A0` (:38975–39042) carga fondo `ALMR0000` y animación inicial `ALMR0001`.

`FUN_006F7830` (:39043–39175) centra el fondo respecto de la animación, dibuja ambos y avanza la tabla de punteros 0x837ADC. Verificada directamente con `py tools/audita-hud.py`:

`ALMR0001 → ALMR0002 → ALMR0001 → ALMR0003 → reinicio`.

En índice 2 activa flag de tile 0x10; lo limpia en los demás. El avance está en el dibujante: no afirmar una duración en segundos sin medir la frecuencia efectiva del despacho. `0069D7C0`, `fn_00680000.c:21605–21625`, guarda ClassLinterna en gestor+0x348 y la oculta inicialmente. `0059A410`, `fn_00580000.c:20909–20927`, al consumir activación de alarma pide mostrarla con `005BAEC0(1)`; `0059EAA0` (:24479) la oculta con argumento 0. Cadena: `005BAEC0 → 0041291D → 006F3460 → virtual +0x2C`.

## 3. CIRC: marcadores sobre el mundo [hecho]

`FUN_005C9FE0`, `fn_005c0000.c:5649–5675`, carga siete nombres `CIRC%04ld.RLE` a la tabla 0x84059C. `005C93C0` (:5152–5259) usa el índice +0x0C del marcador, proyecta XYZ con `00463450` y dibuja con desplazamiento **(-17,-95)**. No son indicadores de energía.

`005CA9B0` (:6042–6074) crea `{x,y,z,frame=0,contador=1}` y lo agrega al vector de visor+0x150. `005C9620` (:5260–5293) avanza frame, pone contador 1 normalmente y 5 al salir del frame 5; al superar 6 marca XYZ=-1 y retorna finalizado. `005CA080` (:5676–5704) libera los marcadores terminados; `005CA110` (:5705–5728) dibuja los vivos. Los campos frame/contador son enteros: el tipo float inferido por Ghidra produce literales engañosos.

Productores: `006968E0`/`00696950`, `fn_00680000.c:16436–16488`, destacan elementos por token o por la tabla 0x822358 (incluye señuelo), cuando visor habilitado y elemento+0x130=0. `0068A100` (:8079) y `0068F680` (:11651) también agregan marcadores durante interacción del jugador. Falta atribuir esas dos ramas a cada orden concreta.

## 4. Botones, postura, ojo y cámara [hecho]

Gestor construido por `0069D7C0`, `fn_00680000.c:21461–21850`:

| Offset | Componente / id |
|---|---|
| +0x328 | Mochila, 0x16 |
| +0x330 | Ojo, 0x2F |
| +0x334 | Cámara, 0x30 |
| +0x338 | Información, 0x31 |
| +0x33C / +0x340 | Agachar/levantarse, 0x53/0x54 |
| +0x344 | Aviso REDLENTA |
| +0x348 | Linterna de alarma |
| +0x34C | Libreta/minimapa |
| +0x350 / +0x354 | Barra superior y tramo derecho |
| +0x360 | Columna lateral |

`0069CEB0` (:21068–21096) oculta ambos botones de postura al resetear la interfaz; `00699AE0` (:19339–19353) vuelve a mostrar cada uno si recibe su id. `0068E210` (:10953–11006) produce esos ids según bit 0x40 de bicho+0x23C, máscaras 0x200/2 del estado de subinterfaz y, para levantarse, la restricción 0x400 del objeto bicho+0xE4. Por tanto la regla no se reduce a invertir un booleano agachado.

`0069BAB0` (:20301–20351) mapea C/S a ids 0x53/0x54 solo si su botón está visible. `0069A0D0` (:19363–19511) entrega ambos a la subinterfaz activa por `00696640`.

El mismo dispatcher crea `ClassPulsacionPendienteOjo`, `...Camara` y `...Info` para ids 0x2F/30/31; los bloquean gestor+0x1D8/+0x1DC. La segunda variante del ojo emite `MSG_VISIONDINAMICA`; cámara e información cancelan el modo pendiente al recibir esa variante. No se debe tratar un clic en cámara como movimiento inmediato sin pasar por este modo.

`0069D220` (:21193–21391) recompone posiciones al cambiar lado: cámara en x del ojo−70; información x del ojo−100, y=5; agachar respecto de barra derecha x+15,y+14 (a 512 px usa x+7); levantarse x+65 (a 512 usa x+48). Llama a los posicionadores de mochila, minimapa y columna. Las coordenadas se aplican a través de `0051CF70`, cuyo ajuste por lado debe conservarse.

## 5. Recursos y paletas reales [hecho]

`node --experimental-transform-types tools/audita-hud-recursos.ts` decodifica **69 WAD, 403 sprites y 286 paletas** de GLOBAL/CARAS/OPCIONES. Imprime nombre de paleta y huella SHA-256 abreviada; no exporta bytes del juego. Los colores se leen de la paleta RGB565 original de 512 bytes. Nombre vacío identifica una paleta propia del sprite, no un nombre de override.

La instalación actual contiene **cinco bancos de resolución**, incluido 1280X720. 512X384 y 640X480 tienen **tres** sprites; no cuatro. Alturas verticales: 512→339;640→442;800→280+275;1024→337+386;1280→337+386. No escalar esos recursos suponiendo que suman el alto de pantalla.

El audit identifica los overrides `CAMARA.PAL`, `P_AGACHA.PAL`, `P_DEPIE.PAL`, `P_DOBLEZ.PAL`, `P_INTER.PAL`, y todos los nombres de OPCIONES/CARAS. Confirma excepciones como `P-BOTEDE.PAL` y `P-CARTUC.PAL` (guion, no guion bajo). `GRANADA.WAD` y `MALETIN.WAD` no tienen paleta nominal adicional. El parser actual conserva colores pero descarta los nombres; el port necesita exponer esos nombres para reproducir `005CDF70` y el override de `0051E5E0` (ver cierre-80 §2).

`006089E0`, `fn_00600000.c:6590–6717`, carga ON/OFF en **ClassLineaBotonMenu**, campos +0x40/+0x44. No son estados de un ítem de mochila. `00696860`, `fn_00680000.c:16407–16422`, muestra REDLENTA, y `0069D6B0` (:21412–21424) lo oculta. El productor `00536FE0`, `fn_00500000.c:38595–38609`, consume un aviso +0x27C y pasa por `005BAE40`. Falta atribuir el productor de ese flag en la red.

## 6. Posición y modos pendientes [hecho]

`0051CF70`, `fn_00500000.c:19972–20003`, usa el ancho/alto del sprite, asigna x recibido y usa y del padre si y=-1. El argumento de lado no altera x dentro de esta función. `006F1A80`, `fn_006c0000.c:34861–34906`, ancla BARRA01 al origen del padre; `006F2EA0` (:35705–35739) pone BARRA02 en el x recibido. `006F1B50` (:34907–34969) pone la columna en x=0 para lado0, o anchoPadre−anchoSprite para el otro; lado0 activa flag0x10 en los dos segmentos y el otro lo limpia. Su alto es la suma de los dos segmentos.

Ojo: `00695F50`, `fn_00680000.c:15971–16028`, sobre terreno coloca TESTIGO en XYZ/sector y manda `MSGA_ACTIVAR_TESTIGO`; sobre objeto manda `MSG_VISIONDINAMICA` con su id. `00698890` (:18247) consulta `MSGA_GETOBJVISTAQUESITOS` para elegir cursor 34/35. Cámara: `00697570` (:17192–17224), sobre terreno manda movimiento a `005C91A0` y limpia el objetivo seguido; sobre objeto de clase1/2 lo entrega a `006EB130`. `00696200` (:16092–16105) cancela seguimiento. `00696230` (:16106–16115) elige cursor38 sin objeto y37 con objeto. Información: `006962F0` (:16160–16172) abre información mediante `0058AE10(visor,1)`.

Los métodos de entrada/destrucción `006961B0/00696180` y `006962A0/00696270` (:16060–16159) fijan cursor y encienden/apagan +0xE4 del botón correspondiente. `0069E7C0` (:21925) procesa los modos temporales por máscaras de teclas 0xC0/0x1800, su cancelación, el reset de interfaz y el avance de cursor. No se infiere el nombre de una tecla únicamente a partir de esa máscara.

## 7. Cursores: hotspots y tiempos extraídos [hecho]

`tools/audita-hud.py` interpreta las instrucciones de preparación de argumentos del inicializador **0x78C030…0x78E6E1** hasta su registro nulo: **81 cursores**. Rechaza instrucciones no contempladas. Las llamadas al thunk0x4033B9 terminan en `0069EFB0` (`fn_00680000.c:22330–22401`); registros de0xDC bytes, cinco ranuras de sprite, cinco pares de hotspots y cinco tiempos. No se confundieron los floats de XYZ con esos enteros.

`0069F1D0` (:22439–22484) incrementa contador y cambia cuadro cuando **contador > tiempo**, o si se fuerza actualización. Reinicia índice al superar4 o encontrar sprite -1; publica hotspot del cuadro. `006451C0`, `fn_00640000.c:3264–3348`, conserva el punto del mouse y resta el hotspot nuevo: confirma que los pares son hotspots, no posición de pantalla.

| Cursor | Hotspot | Tiempo almacenado |
|---|---|---:|
| Flecha | (0,0) | 1 |
| Pistola / no pistola | (0,3) / (0,11) | 1 |
| Cuchillo | (0,0) | 1 |
| Cuchillo activo | (0,0) → (5,5), mismo sprite | 2 por cuadro |
| Punto de mira / no punto | (8,8) / (16,16) | 1 |
| Mira | (11,12) | 1 |
| Piedra | (9,12) | 1 |
| Explosivo | (8,9) | 1 |
| Mano | (0,11) → (0,9) | 2 por cuadro |
| Esposas | (0,11), dos sprites | 2 por cuadro |
| Puño/cachiporra | (8,8), activos con dos sprites | 1 quieto,2 activo |

El auditor imprime todos los registros y la VA de cada llamada. El cruce de `tools/audita-hud-recursos.ts` comprueba **107 referencias** de sprites de cursor contra `GLOBAL/CURSORES.WAD` del DIR raíz: la única cadena que no coincide es `C_ROBAR2.BMP `, con espacio final en `CUR_ROBAR`. Conservar como discrepancia; la lectura no prueba por sí sola el efecto en pantalla ni posibles vías alternativas de resolución. El atajo «armas centradas» queda refutado.

Tooltips: `00695730`, `fn_00680000.c:15512–15639`, obtiene textos localizados para ojo/cámara/info y añade su atajo; postura usa C/S; los ítems restantes consultan la subinterfaz y la tabla de teclas0x8226D8. `0051EB80`, `fn_00500000.c:21240–21336`, atiende `MSG_GETTOOLTIP` si +0x104 está habilitado y delega allí. Las caras usan `006F9550`, `fn_006c0000.c:40336–40457`, con nombre localizado y número de selección+1; excluye ids0x6B…0x7E. `006F3CB0` (:36470–36598) responde por la mochila y distingue botón derecho (variante1) e izquierdo (variante0).

**Aparición y posición del panel [hecho]:** `MSG_GETTOOLTIP` es id0x77 (tabla0x81A5B8, registro0x81ADE8, contrastado con el exe). `0058B010` (`fn_00580000.c:8083–8163`) recibe movimiento0x2A, obtiene el control bajo el mouse y, si ya hay texto, lo vuelve a consultar; si cambió o quedó vacío reinicia el contador de espera en +0x24. `0058B250` (:8195–8222) consulta el texto del control al llegar el contador a **40**, incrementándolo una vez por llamada; el dibujante `0058B3D0` (:8295–8420) exige contador >40 y texto no vacío. Una interacción puede forzar la consulta: `0058AE10` (:7934–7950) pone el contador en40 para el control actual.

`0058B3D0` calcula ancho = ancho medido del texto +14 y alto = métrica de fuente +10. El origen inicial es `(mouseX, mouseY+36)`; si rebasa el borde derecho o inferior lo desplaza para que entre, y después limita x/y al borde superior izquierdo. Dibuja el texto en `(panelX+7,panelY+5)`. La unidad del contador es una llamada al actualizador, no se afirma tiempo en segundos sin medir el bucle real. `006B4060` (`fn_00680000.c:37650–37706`) compone la respuesta del visor a0x77 consultando los receptores asociados al objetivo bajo el cursor.

Aviso REDLENTA: productor localizado en `00534DD0`, `fn_00500000.c:37218–37278`. Usa QueryPerformanceCounter y factor0x84622C; si la duración convertida supera150, fija +0x27C. Si supera60000 y +0x204 está activo, sigue la ruta de desconexión. No sustituir esos valores por segundos sin determinar la unidad del factor.

**Unidad de REDLENTA [hecho]:** `005D2C50` (`fn_005c0000.c:12961–12984`, asm0x5D2C71–0x5D2C93) inicializa el factor como `1000.0 / QueryPerformanceFrequency`; el double de 0x793F78 se verificó con `py tools/audita-datos-exe.py --numeros 793f78`. `00534DD0` usa la diferencia baja del contador multiplicada por ese factor y trunca antes de comparar. Así, el aviso salta al superar **150 ms** y la rama de desconexión al superar **60.000 ms**, con las condiciones anteriores. El asm0x534E76–0x534E9C muestra que la conversión usa la palabra baja de la diferencia: no extrapolar sin límite a intervalos más largos.

**Marcadores CIRC al seleccionar [hecho]:** `006F9550` (`fn_006c0000.c:40430–40448`) envía el token de la cara pulsada a `0069BC90`. Esta función (`fn_00680000.c:20381–20446`) busca la subinterfaz y, si hay selección activa, la máscara de entrada cumple `(flags&0x30)==0` y `(flags&0xC0)!=0`, selecciona el objetivo y llama su slot virtual +0x68. `class_methods.tsv` atribuye ese slot a `0068A100` para `ClassSubInterfaceAleman` y `0068F680` para `ClassSubInterfaceAliado`; ambos agregan un marcador CIRC en la posición obtenida por su slot +0x20, siempre que exista el visor. El registro `0069F4D0` (:22625–22665) sitúa códigos −34/−30 en bits4/5 y −27/−26 en bits6/7; el sondeo `00598DA0` los atribuye a **Ctrl y Mayús** respectivamente (`ui-misiones-guardado.md` §sondeo). Esta rama corresponde a pulsar la cara con **Mayús y sin Ctrl**.

**Muerte de aliado [hecho]:** el despachador `00515A30` (`fn_00500000.c:14620–15103`) recibe `MSGA_ARGG` (:14685–14707), lo transmite a la acción, actualiza flags y llama slot +0x6C de la subinterfaz guardada en bicho+0x834. El slot27 de `ClassSubInterfaceAliado` lleva a `00690D20`, seguido por `0068E210 → 00697100 → 006F4C80 → 0051B640` según la cadena detallada abajo. El botón termina con +0xE8=1 y el dibujante `0051B350` selecciona el tile fijo. Esta cadena explica el cambio ante `MSGA_ARGG`; queda verificar la secuencia visual del original en pantalla.

## Límites que siguen abiertos

**Cadena adicional del estado de cara:** el slot virtual27 (`+0x6C`) de `ClassSubInterfaceAliado` apunta al thunk `004056D7` → `00690D20` (`class_methods.tsv:7670`). `ClassBichoArrestado` implementa su propio slot28 con `00511930` (`fn_00500000.c:11549–11560`), que llama slot `+0x6C` de la subinterfaz en bicho+0x910. Al ejecutar el setter, `0068E210` (`fn_00680000.c:10882–10887`) emite registro0x1B con valor1; `00697100` (:17007–17024) lo entrega por token a `006F4C80` (`fn_006c0000.c:37133–37172`), que cambia +0xE8 del botón mediante `0051B640`. `0051B350` dibuja el tile fijo si +0xE8 no es cero. El emisor del aliado se identificó en el párrafo «Muerte de aliado» anterior.

Los modos ojo/cámara/info, posicionadores, hotspots, panel de tooltips, unidad de REDLENTA, cadena de muerte y la llamada principal de CIRC desde la cara quedaron leídos arriba. Sigue pendiente la selección de variantes de cursor por cada acción. También sigue pendiente el contraste en ejecución de temporización, recortes y tutorial BMP/RLE: no se halló un proceso `coman_mp` abierto en esta sesión. El barrido de recursos no sustituye ese contraste; no se declara el HUD terminado.
## 8. Selección de cursor en la interfaz de aliados [hecho]

`FUN_006909B0` (`fn_00680000.c:12315–12470`) recalcula el cursor según el estado y el blanco bajo el puntero. En estado 2 comienza con id `0x14` (`CUR_ARROW`). Para un blanco que cumple `FUN_0068D610` (`10205–10217`: tipo virtual 1 y filtro `FUN_00513420`), usa `0x15`; si además el elemento tiene tipo interno 5 y ficha asociada, prueba sus flags: con alguno de `0x3F`, usa `0x49` salvo bit `0x20` sin el bit 8 de `ficha+0x14`, que da `0x48`; si está ese bit 8 usa `0x4A`. Sin ninguno de `0x3F`, pero con alguno de `0x780`, usa `0x48`. La tabla original identifica esos tres ids como `CUR_ENTRA_CASA`, `CUR_ENTRA_VEHI` y `CUR_ENTRA_ZODIAC`, respectivamente (`tools/audita-hud.py`). Son condiciones sobre flags, no una autorización universal para entrar.

Si no hay blanco y `FUN_0068F180` encuentra un resultado, usa `0x20`. Otros filtros son `FUN_0068DA50` y `FUN_0068DEA0`: pueden sustituirlo por `0x39` o `0x3B`; sus condiciones exactas están en `fn_00680000.c:10417–10431` y `10677–10689`. En estado 4, cuando el registro de ítem tiene `+0xA0` o `+0xA4` activos, la misma función elige el par almacenado en `+0x78/+0x7C` o recalcula según el blanco; en estados 3 y 5 y el otro caso de estado 4 busca la acción por el id del ítem `+0x48` y le pasa el blanco al slot virtual `+0x40`. Esto deja la decisión concreta en cada acción.

`FUN_00513140` (`fn_00500000.c:12732–12746`) publica cuatro valores de cursor. El gestor `FUN_00699AE0` (`fn_00680000.c:19230–19240`) recoge los dos ids no nulos de mensajes `0x1C`/`0x1D`; este último exige la bandera `+0x2FC`. En cada actualización `FUN_0069CD60` (`21007–21050`) parte del id 20 para ambos, procesa la lista de la subinterfaz y llama a `FUN_006EEE00` con el primero o, si el slot virtual `+0x48` devuelve distinto de cero, el segundo. En la subinterfaz aliada ese slot es `FUN_0068D370` (`10053–10086`): en estados 3/5 consulta el ítem `+0x1410`, en estado 4 el `+0x140C`; si existe la acción de su id `+0x48`, devuelve el slot de acción `+0x3C`, si no devuelve cero.

Por ejemplo, el slot `+0x40` de cuchillo `FUN_004E52C0` (`fn_004c0000.c:22923–22938`) pone a uno `acción+0x198` si hay blanco cuyo tipo virtual no es 2; su slot `+0x3C`, `FUN_004E52A0` (`22914–22920`), devuelve si ese campo vale cero. Cachiporra usa el mismo criterio con `acción+0x19C`, invirtiendo directamente el valor en `FUN_004EA520` y devolviéndolo en `FUN_004EA510` (`26576–26600`). Por tanto, para esas acciones se solicita la segunda variante si falta blanco o el blanco es de tipo 2 (aliado); para otros tipos se solicita la primera. La aceptación definitiva de la orden tiene condiciones adicionales y no debe inferirse solamente del cursor.

En M0, esposas usa el mismo criterio que cuchillo (`004F43E0/004F4400`, `fn_004c0000.c:32935–32959`). Botiquín invierte la condición: `004E8A50/004E8A40` (`25410–25435`) selecciona la primera variante solo si hay un aliado tipo2 con energía actual menor que su máximo; en los demás casos devuelve la segunda. Las acciones de bomba, cepo, señuelo y balsa heredan el slot `004BAEA0`, que devuelve cero, y el actualizador `004BAF30`, vacío (`fn_00480000.c:35566–35572`, `35631–35637`): este mecanismo elige siempre la primera variante, sin demostrar por sí solo que el lugar sea válido. Para disparar, `004F1030` (`fn_004c0000.c:31012–31039`) guarda blanco y coordenadas; `004F0830` (`30703–30724`) consulta el id del ítem y la prueba de disparo `004F05B0` y pide la segunda variante si esa prueba falla. También la pide si el dueño tiene `+0x134` distinto de cero o no se reconoce el ítem. El `void` atribuido a `004F05B0` por Ghidra es incompleto: este llamador comprueba el valor devuelto por las rutinas por arma.

Para el buzo, `FUN_004E93D0` (`fn_004c0000.c:25859–25889`) publica cursor 20 por defecto, 21 si el blanco tiene `+0x1FC` y 74 si tiene el bit `0x1000` de `+0x254`; este último prevalece si se cumplen ambos. `FUN_004E9F40` (`26393–26417`, `26450–26464`) guarda como destino especial al blanco que cumpla alguno de esos flags y reconoce la colisión con él. Igualmente delega la orden de movimiento cuando el blanco no los cumple: marcar un destino especial y aceptar una orden de movimiento no son la misma comprobación. El `.MIS` de M0 declara `ESCALA03` como utilizable por buzo; los demás valores se resuelven con sus macros.
