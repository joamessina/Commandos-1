# Continuación de los huecos ≥70 % — 2026-10-30

Fuentes: `coman_mp.exe` de raíz, `research-c1/ghidra/all2`, tabla de sonidos y WAR_MP.DIR de raíz. Líneas de C originales reproducibles con `py tools/consulta-exe.py VA`; los rangos de ensamblador son VA, no líneas. Investigación sin cambios en el motor ni archivos extraídos al repositorio. Complementa [cierre-70.md](cierre-70.md); prevalecen las correcciones explícitas siguientes.

## 1. Minimapa: coordenadas, clic y marcadores [hecho]

| Función | Archivo de `all2`, líneas | Lectura |
|---|---|---|
| `FUN_005C4BA0` | `fn_005c0000.c:2804–2848` | Carga MAP: SCALE, XY (cadena en0x79F2F4) y BITMAP; pasa los cuatro valores a la interfaz. |
| `FUN_006F84E0` | `fn_006c0000.c:39656–39789` | Carga `LIBRETAS\`, guarda escala en +0xBC, offsets en +0xC0/+0xC4 y sprite en +0x94. |
| `FUN_006F8800` | `fn_006c0000.c:39792–39889` | Iteración, color y cruces de entidades. |
| `FUN_006F8AD0` | `fn_006c0000.c:39893–40078` | Fondo, rectángulo de cámara y llamada a marcadores. |
| `FUN_006FA700` | `fn_006c0000.c:41191–41329` | Primer clic habilita; siguientes convierten y centran la cámara. |
| `FUN_005F7F20` / `FUN_005F7D50` | `fn_005c0000.c:35699` / `35649–35695` | Reconstrucción de posición del centro de la vista sobre el escenario; hay búsqueda de superficie y un fallback. No asumir siempre Z=0. |
| `FUN_006B1BC0` | `fn_00680000.c:36147–36153` | Zoom = `*(vista+0x94)+0x2C`, float. |

### Mundo → cruces

En `0x6F8949…0x6F8998`, con `T=truncar hacia cero`, `s=escala`, `ox/oy=offsets`:

```
mx = ox + T(s * T(entidad.x))
my = oy + T(s * T(entidad.y))
```

Son XY del mundo: **no** se proyectan primero al isométrico. El recorte es semiabierto: origen ≤ coordenada < origen+tamaño, rectángulo +0xAC…+0xB8. Luego suma el origen de la ventana y dibuja dos segmentos de tres píxeles (cruz de cinco píxeles únicos). La doble truncación importa para posiciones fraccionarias.

Orden de clasificación y ternas de color de tres shorts en `bicho+0x200`:

| Prioridad | Condición | Terna |
|---|---|---|
| 1 | virtual+8 devuelve2, o apariencia+0x108==2 | (0,0,255) |
| 2 | virtual+8 devuelve3 | (250,250,250) |
| 3 | flags+0x23C &0x400000 | (255,192,71) |
| 4 | flags+0x23C &0x200 | (255,0,0) |
| 5 | flags+0x240 &0x4000 | (0,207,0) |

Antes exige virtual+8>0; si ninguna condición coincide, omite la entidad. En esta función no hay consulta del cono de visión ni filtro explícito de muerto; no agregar uno por intuición. El resultado depende también de quién sigue en la lista del mundo.

### Clic → cámara

`0x6FA923…0x6FA990`: si +0x1E8==0 lo pone a1 y termina esa rama; ese primer clic no recentra. En los siguientes, si la conversión del punto a coordenadas locales tiene éxito:

```
wx = T((clicLocal.x - rectMapa.x) / s)
wy = T((clicLocal.y - rectMapa.y) / s)
```

Busca sector con `FUN_005F6C60(wx,wy)` y calcula Z con el plano `sector+0x20/+0x24/+0x28`; sin sector usa0. Proyecta XYZ mediante `FUN_00496860` y centra con `FUN_006B3F50`; requiere visor actual y que `global+0x534 != 1` (`0x6FA9CD…0x6FAA51`). No aplicar una segunda inversa isométrica al clic.

### Rectángulo de cámara y tamaño

`0x6F8BEC…0x6F8DF2`: toma centro de vista, reconstruye XYZ con `FUN_005F7F20`, trunca XY y aplica la misma escala/offset. Con ancho W y alto H del visor, matriz inversa en cámara+0x64/+0x68/+0x6C/+0x70 y zoom z:

```
rw = T(s * (W*inv00 + H*inv01) / z)
rh = T(s * (W*inv10 + H*inv11) / z)
origenRect = centroMapa - T((rw,rh)/2)
```

Terna del rectángulo (63,63,63). No es un cálculo nuevo de los cuatro vértices del frustum. La ventana colapsada (+0x7C==+0x1F4) o la ausencia de visor omiten rectángulo y marcadores en este dibujante.

`FUN_006F05C0`, `fn_006c0000.c:33846–33860`, ensamblador `0x6F05C6…0x6F0624`: suma offsets cámara+0x24/+0x28 al punto entero, trunca y aplica inversa2×2. Se usa en `0x6F867D…0x6F86ED` para obtener dimensiones del rectángulo del mapa a partir del par global+0x100/+0x104, antes de escalar. No confundir esta conversión inversa con la fórmula de los marcadores. Umbral colapsado13 si ancho>alto;20 en otro caso.

### Datos reales

`node --experimental-transform-types tools/verifica-faltantes.ts`: **9 libretas, 2.003 filas RLE**, offsets y longitud de cada fila válidos. Siete miden185×229; LIBR0002/0008 miden260×200. Todas BMP8 con compresión4 de C1, formato ya descrito en `docs/formats-graficos.md`; no es un formato nuevo sin identificar.

M0: SCALE=0,06379, XY=(10,19) y LIBR0000.RLE. M9 reutiliza LIBR0004.RLE, M10 LIBR0008.RLE. Los siete tutoriales nombran LIBR0008.BMP aunque el contenedor trae LIBR0008.RLE: **pendiente** resolver el alias en el cargador antes de imponer coincidencia literal de extensión. También quedan paletas/hover del HUD y contraste visual de las coordenadas en ambas orientaciones.

## 2. Pisadas: bucle de agua y ruido IA [hecho]

| Función | Archivo y líneas | Regla |
|---|---|---|
| `FUN_004BB590` | `fn_00480000.c:35982–36029` | AcUsuarioGoto construye en +0x54 un sonido persistente de categoría1 y tag PASW. |
| `FUN_004BB370` | `fn_00480000.c:35896–35937` | Pide MOTOR_GETSECTORESPISADOS; devuelve si **algún** sector tiene tipo1 (agua). Retorno EAX confirmado en `0x4BB401…0x4BB443`. |
| `FUN_004BBDD0` | `fn_00480000.c:36238–36357`, en especial36334–36351 | En estado+0x28==1 consulta agua si+0x44==0; si cambia respecto de+0x50 habilita/deshabilita el bucle. Actualiza posición cada tick con006819A0. |
| `FUN_004BB170/004BB180` | `fn_00480000.c:35784–35801` | Enciende/apaga el sonido; apagar limpia+0x50. |
| `FUN_00681BE0` | `fn_00680000.c:1655–1725` | Inicializa categoría, tag, propietario, posición/sector y parámetros de reproducción. |
| `FUN_00680D50` | `fn_00680000.c:856–887` | Habilita registro IA y reproducción continua por separado; al apagar retira el primero y detiene el handle. |
| `FUN_006807E0` | `fn_00680000.c:444–470` | Registro IA exige encontrar tag en la tabla de radios; si no está, devuelve falso. |
| `FUN_0067F5A0` | `fn_00640000.c:48405–48438` | Reproducción continua posicional y atenuación; `sonido.md` S2.2 explica la fórmula. |

`0x4BB5EB` carga **float0,3 desde0x799110**, `0x4BB5FB` pasa PASW y `0x4BB600` categoría1. La tabla de sonidos lo asocia con **PASOSAGU.WAV** (`research-c1/sound_table.tsv`, tag0x50415357). El volcado de los48 radios `py tools/audita-datos-exe.py --ruidos` **no contiene PASW**: la solicitud de alta IA falla por ese filtro aunque el audio se reproduzca. No inventar radio de audición para pisadas de agua.

**Corrección de alcance de `sonido.md` S2.1:** el barrido0,75 abarca las llamadas puntuales00681B90/0067F9C0 enumeradas allí; no demuestra que todos los sonidos de gameplay, incluidos objetos continuos00681BE0, usen0,75. PASW es un contraejemplo confirmado0,3.

No hay temporizador de un WAV por cada apoyo en esta cadena: habilita un **bucle** al cambiar la condición de agua. Las huellas visuales son AcPisada (`FUN_00495BF0`, `fn_00480000.c:12746`, GETINFO), otro objeto. **Pendiente:** demás modos de locomoción/subclases y contraste auditivo en ejecución; no se concluye que ningún otro personaje pueda emitir pasos.

## 3. CLancha y CTanque: selección, pérdida y reactividad [hecho]

Todas las líneas siguientes son de `fn_00440000.c`.

| Operación | CLancha | CTanque |
|---|---|---|
| Constructor real | `00452B90`,11487 | `00456D80`,14081 |
| Carga de parámetros | `00452C80`,11556 | `00456E80`,14151 |
| Adoptar candidato | `004531B0`,11734–11776 | `00457470`,14358–14398 |
| Seleccionar/reemplazar | `00453350`,11803–11836 | `004575A0`,14402–14435 |
| Tick | `00453420`,11840–11892 | `00457720`,14474–14526 |
| Mensajes | `004535A0`,11896–11957 | `004578A0`,14530–14602 |
| Serialización (no constructores) | `00453780`,11961 | `00457670`,14439 |

Offsets de **acción**, no del vehículo:

| Campo | Lancha | Tanque |
|---|---|---|
| candidato / blanco retenido | +0x188 / +0x18C | +0x18C / +0x190 |
| estado | +0x54 | +0x58 |
| aviso de vista / contador sin aviso | +0x4C / +0x50 | +0x50 / +0x54 |
| vista interesante | +0x48 | +0x4C |

VISTA_ELEMENTOVISIBLE acepta clasificador1/6 y copia la posición del candidato a+0x28..+0x30. Selector rechaza muerto (`+0x23C&4`) y custodia2. Con blanco ya retenido, un candidato distinto solo lo reemplaza si su distanciaXY² es **estrictamente menor** que+0x40, distancia guardada al adoptar; la igualdad conserva el anterior. Confirmado ensamblador `0x453384…0x4533B7`: resta punto+0x28 y posición propia. Si el candidato muerto coincide con el blanco, pide estado3.

Adoptar pone aviso1, contador0, activa «vista interesante», copia blanco y punto de disparo, guarda distancia y manda FIJAR_VISTA. Lancha suma altura+0x58 del blanco a Z; tanque copia Z directamente. Ambos pasan a estado2.

Tick: estado1 llama selector;2 dispara;3 manda VIGILAR_ON y PATRULLA_UNPAUSE, limpia blanco y vuelve0. Al final, con blanco retenido: sin aviso incrementa contador; con aviso lo limpia. **contador>3** → desactiva «vista interesante», limpia blanco y deja estado3; la reanudación ocurre al procesar ese estado en un tick posterior. Son cuatro ejecuciones del contador sin aviso, no una duración garantizada en segundos ni cuatro fotogramas de render.

Disparo: `00452DD0` (11606) manda PILOTO_DISPARAPUNTO sobre su dueño; `00457040` (14217) lo manda al contenedor+0x134 del conductor y lo para, pausando patrulla. No intercambiar destinatarios. La lancha condiciona el paro por un getter del motor; su umbral FPU exacto queda pendiente.

Tanque carga **NOVERHASTA en acción+0x48** (00456E80); TRIGGER_REACT lo limpia y llama `FUN_00508410(0)`. ENTRADA_HABITACULO llama00508410 con ese valor; lancha pasa0. `FUN_00508410`, `fn_00500000.c:5524–5530`, escribe **bicho+0x224=(argumento==0)**. No equivale a desactivar la propia acción. Falta identificar todos los consumidores de ese campo y conductores de jeep/camión/tren/avión; no dar esta máquina compartida por toda la IA vehicular.

## 4. Aves y recinto: datos y límites precisos

### Grafo cargado [hecho]

`FUN_006FF1F0`, `fn_006c0000.c:44738–44959`, lee NUMPAJAROS, ANIM, SONIDOS, TIEMPOES y BASES. Cada base tiene ESAEREA, PLANEA, XYZ y lista CONEXION. Registros de **0x1A8 bytes**, XYZ en registro+0x198/+0x19C/+0x1A0 respecto del inicio de la tabla+0x3C, ESAEREA+0x194 y PLANEA+0x1A4; cantidad de conexiones al principio. Conserva **cada entrada** de CONEXION en orden (44904–44925), sin deduplicar. Crea NUMPAJAROS entidades desde el primer XYZ y las identifica `pajaro%d`.

`FUN_006FEE80`, mismo archivo44602–44734: para animación GAVIOTA/gaviota crea AcGaviota; otras crean AcPajaro. Por tanto **no atribuir el movimiento de gaviota a loros y pájaros genéricos**.

`FUN_006FE6D0`,44343–44431: si hay exactamente dos conexiones y ESAEREA!=0 elige la que no es el nodo anterior; fuera de esa rama filtra por rumbo y usa azar sobre las entradas candidatas o todas las conexiones. Como las listas conservan repetidos, deduplicarlas cambia probabilidades en la rama aleatoria. No son aristas de un conjunto matemático sin multiplicidad.

Validación real de22 grupos: **211 bases,470 conexiones,24 entradas repetidas**, todos los XYZ numéricos y todos los índices dentro del grafo. Incluye los grafos repetidos por M4/M9 como usos separados. M0: cinco gaviotas, grafos de31/19/21/20/24 bases (115 en total),230 conexiones. M5 usa ANIM loro/loro1; no AcGaviota. M4/M9 contienen ALTURA, pero este cargador lee XYZ/ESAEREA/PLANEA: no sumar ALTURA a Z sin seguir otro consumidor que lo haga.

### Recinto [hecho parcial]

`FUN_00465380`, `fn_00440000.c:24246–24308`, carga nombre y máscara, y `FUN_00465990` (24499–24518) la reconstruye. Avestruz: `FUN_00428EF0`, `fn_00400000.c:413679`, y `FUN_004296B0` (413972–413991). El objeto de zona tiene12 B `{índice, dword, bit}`; representa una zona de un espacio de160 bits, **no** una máscara de160 bits almacenada ahí.

`004655B0` (24312–24329) / `00429380` (413835–413852) comparan **sector actual del animal**, no destino, y ponen/quitan0x1000000 en bicho+0x23C. Tick del felino00468370 (26035–26251) lo actualiza en estados4/5/6/7/10. Su golpe (26146–26154) consulta distancia/contador y aplica daño: no hay una comprobación directa de recinto en ese bloque. Los ayudantes de ruta004665C0 y0042A860 mandan BUSCADOR_IRA_SINESCALAS; tampoco prueban por sí solos confinamiento.

**Corrección:** «solo ataca dentro de su recinto» de `animales.md` §2 no queda demostrado por estas funciones. Sigue pendiente el consumidor final del bit y las restricciones de navegación; no afirmar ni que nunca sale ni que puede atravesar cualquier límite. No se usa ausencia de coincidencias textuales como prueba de inexistencia de consumidores.

## 5. Estado del lote

| Área de pendientes | Antes | Ahora, estimación | Falta concreta |
|---|---:|---:|---|
| HUD de M0 | 90 % | 95 % | Paletas/hover, contextos restantes y validación en pantalla. Minimapa matemático leído. |
| Vehículos | 85 % | 90 % | Otras familias, consumidores+0x224 y transiciones de orilla en ejecución. |
| Animales | 85 % | 90 % | Consumidor final de recinto y comprobación de vuelo/sombra en pantalla. |
| Oído | 85 % | 90 % | Demás emisores/modos; PASW de AcUsuarioGoto ya separado de IA. |

Porcentajes de conocimiento aproximado, no cobertura medida del binario ni implementación. No se cambió src/. No hubo sesión del original ni capturas: las conclusiones de C/asm y datos no equivalen a validación audiovisual. `npm run check:task` pasó: typecheck, lint,245 tests y90,26 % de ramas globales. El verificador real recorrió19 MIS y96 MAC, además de las9 libretas.
