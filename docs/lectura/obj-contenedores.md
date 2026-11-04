# Objetos-contenedor: Casa / Cuartel / Cárcel, UsaHabitaculo, Zodiac, Ascensor (exe `coman_mp.exe`)

Lectura del exe para el port. **[hecho]** = leído con dirección. **[hip]** = interpretación. `bicho` = el objeto dueño de la acción (`acc+0x1C`); `acc` = el objeto de la acción. 20 ciclos/s.
Datos de apoyo: macros reales en `D:\Joaquin\research-c1\x\DATOS\MISIONES\*.MAC` (CASA, CARCEL, CUARTEL, CUARTELG, ZODIAC5, …).

## 0. Convenciones del motor que se ven en estas clases
- **Apariencia** `bicho+0x108`: 0 objeto, 1 alemán, 2 aliado (comando). **Clase de bicho** (`vtable+8`): `1` `ClassBicho` (enemigo/animal), `2` `ClassBichoAliado` (controlado por el jugador), `3` `ClassBichoArrestado` [hecho: leídos los 3 stubs `mov eax,1/2/3`]. Un alemán "tomado" (`+0x23C & 0x20000`) cuenta como bando 2 (`FUN_004B79D0`).
- **Bits de `bicho+0x23C`** vistos aquí: `1` objeto puesto/estático (no cuenta para colisión con minas, cepos), `4` muerto/destruido, `0x20000` aliado en contenedor/capturado, `0x40` agachado. `+0x254 |= 8` y `+0x24C |= 4` = "se puede usar/entrar" (el AU compara `obj+0x254 & ficha+0x7AC`; ver `au-jugador.md` §11).
- **Mensajes**: cada acción responde a un `MSG*` por su id de `FUN_006119B0(nombre)`; `bicho→vtable+0x50(msg, a, b)` = enviarse mensaje a las acciones del bicho.
- **Registro de habitáculo** (lo que cuelga de `bicho+0x198` y lo que leen todas las acciones de uso): 

| off | campo |
|---|---|
| +0x00 | tipo (`0` = casa/objeto; el Zodiac lo deja ≠0 vía su vehículo) |
| +0x08 | capacidad (nº de ranuras; la Casa pone **20 = 0x14** con `FUN_004B77A0(0x14)`) |
| +0x0C | ocupantes actuales |
| +0x10 | **máscara de tipo**: `1` TIERRA, `2` AGUA, `4` AIRE, `8` BALSA, `0x40` ARMA_ESTATICA (= bits de `HABILIDAD`), y de casa: `0x80` casa "de uso", `0x100` cárcel, `0x200` cuartel con regeneración, `0x400` casa normal |
| +0x14 | flags (el Zodiac enciende el bit 8) |
| +0x20 | puntero a ranuras de **0x50 B**: `+0x00` flag, `+0x04` nombre (0x2C), `+0x34..0x3C` punto de **salida** xyz, `+0x40..0x48` punto de **entrada** xyz, `+0x4C` ocupante |
| +0x24 | "conductor" (puntero al ocupante de la ranura 0) |
| +0x30 | índice de ranura (lo escribe `FUN_004B70B0`: copia la ranura al registro del ocupante) |

## 1. `ClassAcCasa` (`0x44D420…0x44E720`): casas, cuartel, cárcel
**Parámetros del MAC** [hecho, `FUN_0044D420`]: `XYZENTRADA [x y z]` (+0x30; si falta = posición del bicho), `XYZSALIDA` (+0x3C; si falta = la entrada), `CARCEL n` (`+0x48 = n>0`), `NUMREGENSOLDIERS n` (`+0x5C`), `WAV [ .SONIDOABRIR cccc .SONIDOCERRAR cccc .TOCARWAV n ]` (+0x58 abrir, +0x54 cerrar, +0x4C tocar sí/no), `DOOR`, `RADIO`, `ANGULOABIERTA/CERRADA` (los usa el gráfico; el exe de la acción no los lee). Avisa por consola de "punto de entrada/salida no válido" si el sector (`FUN_005F6C60`) tiene el bit `0x50 & 4`.
Tras leer: capacidad 20, y todas las ranuras reciben `entrada = +0x30`, `salida = +0x3C`. `bicho+0x23C |= 1`, `bicho+0x240 |= 0x100`.
**Tres tipos de casa** según `+0x48` y `+0x5C` [hecho, fin de `FUN_0044D420`]:

| caso | máscara `+0x70` | cadena tipo (`FUN_00507600`) | usable por el jugador (`+0x254&8`, `+0x24C&4`) |
|---|---|---|---|
| CARCEL>0 (cárcel) | `0x100` | `'RAC0'` | **solo mientras haya un aliado dentro** (se enciende/apaga cada ciclo en `FUN_0044E190`) |
| no cárcel, NUMREGEN>0 (cuartel) | `0x200` | `'AUG0'` | no (bits apagados) |
| no cárcel, NUMREGEN=0 (casa) | `0x400` | `'SAC0'` | sí |

**Mensajes (`FUN_0044E240`)** [hecho]:
- `MSG_ACTUASOBRE` (clic): si no es cárcel → responde `MSG_SOY_UNA_CASA` al actor (con el bicho-casa como dato) para que el AU lo trate como casa; si es **cárcel con aliado dentro** (`FUN_0044DD50`) → `FUN_0044DDA0`: manda `MSGA_SALIR_HABITACULO` a cada ocupante aliado (liberación) y suena `SONIDOABRIR` (si `+0x4C`).
- `MSGA_ENTRA_EN_HABITACULO` (un bicho entra): si es de clase 2 y no arrestado (`+0x194≠2`) y la puerta estaba cerrada (`+0x28==1`) → abre (anim de puerta, `+0x2C=4` ciclos de retardo antes de volver a cerrar) y suena `SONIDOCERRAR` si `+0x4C`.
- `MSGA_SALIDA_DE_HABITACULO`: suena `SONIDOCERRAR` solo si no es cárcel.
- `MSGA_GETINFO_HABITACULO` → devuelve el registro (`acc+0x60`). `MSGA_GET_ENTRADA_CASA` → xyz de entrada. `MSGA_CASA_GET_NREGENSOLDIERS` → `+0x5C`; `MSGA_CASA_SUBSTRACT_NREGENSOLDIERS(n)` → `+0x5C -= n` (lo usa la Intendencia al sacar patrullas, `mision-intendencia.md` §6).
- `MSGA_ARGG` (la casa muere/explota): `+0x5C = 0` y **todos los ocupantes reciben impacto tipo 1 (BOMBA, muerte) de 100** (`FUN_0044D300` → `FUN_005986A0(ocupante,ocupante,1,100)`).
- `MSGA_IMPACTO` (cuando el bicho es otro, p.ej. cañonero): ver `obj-armas-fijas.md`.

**Tick (`FUN_0044E190`)** [hecho]: cuenta de la puerta (`+0x28`: 0 abierta/abriendo, 1 cerrada; `+0x2C` retardo); **defensa de la casa**: si `NUMREGEN>0` *o* hay algún alemán vivo dentro (`FUN_004B7860` cuenta ocupantes con `+0x108==1`, sin `0x20000` y de clase≠2) llama `FUN_0044DF30`: si hay algún aliado dentro (`+0x108==2`) y el enfriamiento `+0x50` es 0, **cada aliado no arrestado recibe impacto tipo 0 (disparo) de `0x1E` = 30** y `+0x50 = 4` (⇒ 30 de daño cada **5 ciclos** mientras haya enemigos dentro). Si `+0x50≠0` solo lo decrementa.
Es decir: **entrar a un cuartel (o a una casa con soldados dentro) es mortal para los comandos** [hecho el mecanismo; el "alemán dentro" sale de la lista de ocupantes].

**`ClassAcCasaLogica`** (cuartel lógico, `0x44E800…`): parámetro `TOKENCASA` (+0x2C, nombre de la casa). En su estado 3 (si hay token) busca la casa y le manda `MSGA_EXPLOTA_AVISAME_AL_EXPLOTAR`; al recibir `MSGA_EXPLOTA_AHORAEXPLOTO` envía `MSGA_ARGG` al bicho, `MSG_DESACTUAR`, y apaga sus marcas (`FUN_00615750/615670/6156B0/6156E0`) ⇒ el cuartel destruido deja de regenerar/atraer. Prioridad 900 (CUARTEL) o 200 (CASA/CARCEL) en el MAC.

**Valores de los MAC** [hecho]: `CASA.MAC`: `ENEGIA 1`, `.WAV [.SONIDOCERRAR PCAS .TOCARWAV $TocarWav]`, `ANGULOCERRADA 135`, `NUMREGENSOLDIERS 0`, `RADIO 30`, `DOOR 10`. `CARCEL.MAC`: `.WAV [.SONIDOABRIR PCRA .SONIDOCERRAR PCRC]`, `CARCEL 1`. `CUARTEL.MAC`: `NUMREGENSOLDIERS $NumRegenSoldiers`, entrada=salida=`$PuntoSalida`, y acción lógica con prioridad 900. `ENEGIA 1` (se destruye con cualquier impacto de explosión).

## 2. `ClassAcUsaHabitaculo` (`0x4B71D0…0x4BA760`): entrar/salir de contenedores (acción del *ocupante*)
- `HABILIDAD [ … ]` (`FUN_004B71D0`): `TIERRA`→bit 1, `AGUA`→2, `AIRE`→4, `BALSA`→8, `ARMA_ESTATICA`→0x40; máscara en `acc+0x44`. En las MAC de soldados: `acUsaHab [ .HABILIDAD ARMA_ESTATICA ]` (artilleros), prioridad 100–200.
- **Elegir ranura al entrar** (`FUN_004B74D0`) [hecho]: si `registro+0x10 & habilidad ≠ 0` (el ocupante *sabe conducir* ese contenedor): busca la **ranura 0** libre y se hace conductor (`registro+0x24 = ocupante`); si la 0 está ocupada y el actual no es conductor legítimo (`+0x23C & 0x20000` o `registro+0x24==0` y el otro sin `0x20000`) le envía `MSGA_INTERCAMBIA_POS(0)` al ocupante viejo y toma su lugar (el viejo pasa a pasajero, `bicho+0x138=1`). Si **no** sabe conducir: primera ranura libre ≥1 (`FUN_004B6FB0`), o cualquier libre si no hay.
- Capacidad / conteos [hecho]: `FUN_004B7860` (alemanes vivos), `FUN_004B7030` (clase 2 o `0x20000`), `FUN_004B78E0` (aliados), `FUN_004B79D0` (bando efectivo: 1 alemán→2 si es clase 2 o `0x20000`).
- **Posición de salida** (`FUN_004B90A0`, 2712 B) [hecho]: radio `r = 2·radio_ocupante + radio_contenedor` (`bicho+0x54`). Primero prueba el ángulo del contenedor + `acc+0x84`; luego barre `ang = 0, 3°, 6°… < 45°` (consts `0x797928 = 3`, `0x79747C = 45`) y para cada ángulo prueba **8 puntos simétricos** (±x/±y y las diagonales) y acepta el primero que cumpla: sector cuyo z cuadra con `|z − z_sector| ≤ 35` (`0x793774`, `FUN_004B7A30`), sin colisión (`FUN_0057F0B0(ocupante,pos,radio,0x10)`) y dentro del mapa (`FUN_004B7EB0`). Variante para clase 3 (`FUN_004B7FB0`): hasta **120 intentos** con ángulo al azar alternando ±3°. Para contenedores de forma poligonal (`+0x50==4`) proyecta el punto contra el borde (`FUN_004B7C80/7AE0`).
- **Entrar** (`FUN_004BA2E0` / `FUN_004BA520`) [hecho]: `FUN_004BA180` (mete al ocupante en la ranura: `contador+1`), pone `bicho+0x134 = contenedor`, `bicho+0x138 = ranura`, `MSGA_INSERTA_EN_HABITACULO` o `MSGA_ENTRA_EN_HABITACULO` al contenedor, `MSGO_ENTRAOSALE_DE_HABITACULO` al motor del contenedor, `MSGO_MOTOR_BORRAFISICA` al motor del ocupante y `MSGA_ENTRADA_HABITACULO` al propio ocupante; después `004B83A0` guarda y retira listas según los bits del ocupante. Ver precisión de choque abajo.

**Choque del pasajero (lectura 2026-11-03) [hecho]:** ambas vías de entrada llaman `004B83A0`, que guarda `bicho+0x38` en `acción+0x40` y, si estaba el bit 2, llama `00615750` para quitar al ocupante de la lista `CHOC`. Esta retirada sucede también cuando el habitáculo tiene tipo `0x40`: la condición del tipo solo gobierna la retirada de otro bit y el cambio de visibilidad. Al salir, `004B9DE0` llama `004B7420` solo si su tercer argumento es distinto de cero; esta restaura `CHOC` mediante `00616020` si el bit 2 estaba guardado y ya no está activo. Por separado, `MSGO_MOTOR_BORRAFISICA` llega al manejador base de motor (`all/fn_00600000.c:10880–10902`): puede limpiar la estructura de simulación mediante `0060F410` y llama al virtual `+0x2C`; el nombre del mensaje por sí solo no demuestra que retire la ficha de la lista. Al reconstruirse la búsqueda espacial desde `CHOC`, el pasajero retirado no se incorpora como peatón independiente; la Zodiac mantiene su propio cuerpo. Esto no fija el instante exacto en que deja de figurar en una búsqueda ya construida, no implica inmunidad a otros daños y no sustituye el contraste en ejecución.
- **Salir** (`FUN_004B9DE0`) [hecho]: libera la ranura (`FUN_004B85E0`), pone `bicho+0x134 = 0`, `FUN_004B7420` (restaura visibilidad), `MSGA_SALIDA_HABITACULO` al ocupante, `MSGA_SALIDA_DE_HABITACULO` al contenedor, `MSGO_ENTRAOSALE…` y `MSGO_MOTOR_PARAR`. Si el que sale era conductor, `FUN_004B8450` recorre los demás ocupantes: el primero cuya `MSGA_HABILIDAD_CONDUCTORA & registro+0x10` ≠ 0 recibe `MSGA_INTERCAMBIA_POS(0)` y pasa a conducir.
- `FUN_004BA1F0/4BA250/4BA280`: si el ocupante muere (`+0x23C & 4`) dentro, se lo expulsa a un punto libre; si no, se lo mantiene en la posición del contenedor (`bicho.pos = contenedor.pos`, ángulo y sector copiados).

## 3. `ClassAcZodiac` (`0x4C1DF0…0x4C2850`): bote neumático [hecho]
Máquina de estados `acc+0x24` (cuenta `acc+0x28`, duración `acc+0x78` = **ciclos de la animación en curso**, dato del `.ANM`):

| estado | qué | animación / efecto |
|---|---|---|
| **4** ANDAR | inflado y navegable (inicial) | `ANDAR`; `bicho+0x24C \|= 4` (se puede subir) |
| **5** inflando | tras `MSG_ACTUASOBRE`/`MSGA_SALIDADECONTENEDOR` estando plegado | `INFLAR` vel +1; al acabar → 4 |
| **6** plegar | se puede recoger solo con **0 ocupantes** (`registro+0xC==0`) | quita `+0x24C & 4`; envía `MSGA_NODEJARSUBIR` a sí mismo → 7 |
| **7** desinflando | | `INFLAR` vel **−1**; al acabar → 8; `+0x24C &= ~0x20` |
| **8** plegado | objeto recogible | espera `MSG_ACTUASOBRE` (flag `acc+0x34`) para pasar a 5 |
| **9** pinchado | impactado y vacío, o último pasajero muerto | `PINCHAR` vel +1; quita `+0x24C&4`; envía `MSGA_ESTOY_PINCHADA`; luego → 10 y `bicho+0x230=0x14` (flotando/hundiéndose 20 ciclos si el sector es de tipo 3) |
- En 4: si `registro+0xC==0` pone `+0x24C |= 0x20` (vacío); si no, lo quita. Si `acc+0x30` (última tripulación muerta) **o** (`acc+0x2C` impacto recibido **y** 0 ocupantes) → estado **9** (pinchado).
- `MSGA_OBJETO_RECOGER` (un comando lo intenta recoger, `FUN_004C2250`): en 4 con 0 ocupantes → 6 (plegar); en 8 → devuelve 1 (puede recogerse); en 9/10 → vuelve a 8 y devuelve 1.
- `MSGA_IMPACTO` → `acc+0x2C=1`. `MSGA_ULTIMO_PASAJERO_MUERTO` → `MSGA_PILOTO_PARAR`, `MSGO_MOTOR_OFF` (prioridad 999) y `acc+0x30=1`. `MSGA_ENTRADAENCONTENEDOR` (el bote entra en una mochila) → estado 8.
- MAC `ZODIAC5`: `acZodiac[.CARISMA 999]`, `acvehdescubierto`, `acPilotaje [.TIPOVEH BALSA .REPARTEIMPACTO 1 .CHIVABANDO 1 .ATROPELLA 0 .WAV[.SONIDOAVANCE REMA]]`, `INFO [[ENTRADA [20 0 0] SALIDA [55 0 0] ANIMACION EMBARCADO ANGULO 180 PINTABLE 1] …]`, `MASA 400`, `CILINDRO R 30 H 40`. El movimiento lo da `MotorVehiculoBalsa` (fuera de esta nota, ver P6).

## 4. `ClassAcAscensor` (`0x4271A0…0x427FA0`): montacargas por riel [hecho]
- `RAIL [ [x y z] [x y z] ]` (`FUN_004271D0`, la clave literal es la cadena `RAIL` en `0x793220`): extremos A (`+0x28..0x30`) y B (`+0x34..0x3C`); `+0x40` = longitud. Sonidos `'ASAR'` (arranque; su duración dividida por 50 = `acc+0x6C/0x64`) y `'ASPA'` (parada). La posición actual como fracción del riel: `FUN_00427630 = ((P−A)·(B−A))/|B−A|²`.
- `MSGA_ACTIVA_ASCENSOR` (lo manda el clic o el AU de misil `MSG_ITEM_ACTIVADO`): elige como destino **el extremo más lejano del actual** (compara distancias² en XY a A y a B), manda al motor `MSGO_MOTOR_SETRAIL` con el segmento A→B y velocidad **0,02** (`0x793294`), `acc+0x70=1`.
- Tick `FUN_00427CC0`: si `acc+0x5C` (hay carga que mover) reenvía `MSGO_MOTOR_GOTO` al destino (y arranca `ASAR`); si no: si `+0x70` estaba en 1 lo apaga y, **si el habitáculo del ascensor tiene ocupantes (`registro+0xC>0`), pone `+0x5C=1`** (se mueve solo cuando lleva a alguien); si no, `MSGO_MOTOR_PARAR` y `ASPA`.
- `MSGA_MOTOR_PUNTOALCANZADO` → fija posición, limpia destino, envía `MSGA_SHUTTLE_HEPARADO(sector)`.
- Ejemplo de uso en M0 `AcAscensor`; el MAC `ASCENSOR` no está en la lista de MAC extraídos (los ascensores se arman en el `.MIS` con `RAIL`).

## Dudas abiertas
- Ninguna sobre las clases de esta nota. (Las ocupaciones de `AcCLancha`, `AcCTanque` y `AcPilotaje` —conducción— son del tema P6, Motores, y no se leyeron aquí; motivo: la tarea pidió AcZodiac como bote, y su movimiento sale de `MotorVehiculoBalsa`.)
