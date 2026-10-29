# Q1 — Colisión del Sim del peatón (punto D): `FUN_0057E520`, deslizamiento y paredes

Fuente: exe de la raíz. **[hecho]** = leído con dirección; **[hip]**; **NO LEÍDO**. Pregunta del usuario: qué hace el original cuando el paso choca (¿desliza?) y cuándo se considera que choca (hoy el port anula el paso entero y solo mira el sector del punto de llegada).

## Estructura [hecho]
- `FUN_0057E6E0` = **Sim::Actualizar** (uno por ciclo por cuerpo). Virtuales del `SimPeaton`: `+0x1C` posición/estado, `+0x20` estado previo, `+0x10` máscara de pruebas (**`0xFF`**, `FUN_0066ABB0`), `+0x40` **limitar el paso** (`FUN_0066BCD0`: paso máximo `Sim+0xC0` = radio, giro máximo `Sim+0xC4` = 45°, z = 0 si el Sim es plano), `+0x2C` confirmar (`FUN_00573DF0`: escribe x, y, z, ángulo y sector en el bicho, `bicho+0xE4`), `+0x30` respuesta a choque (`FUN_005739D0`).
- Algoritmo: con la máscara `& ~0x10` (se quita "choque contra cuerpos dinámicos"; esos los resuelve otro mecanismo), **hasta 3 veces** calcula el paso limitado y prueba `FUN_0057E520(1, destino, …)`; si pasa, confirma y termina. **Las 3 pruebas son idénticas** (el paso limitado no cambia entre intentos, son redundantes salvo cambios de otro hilo). Si fallan las 3: `FUN_0057E520(0, …)` y, si pasa, llama `+0x30`, que **pone `Sim+0xA8 = 1` (marca "choqué") y devuelve 0 → no hay reintento**. **No hay deslizamiento**: un paso bloqueado se descarta entero y el cuerpo no se mueve en ese ciclo. Esto **confirma** el atajo del port (`stepBody` anula el paso) en esa parte.
- `FUN_0057E520(modo, pos, estado, sim, máscara)` = "¿está libre `pos`?" (1 = libre). Si falta el sector actual lo busca (`FUN_005F6C60`). Pruebas por bit de la máscara (el peatón usa `0xEF`, o sea bits 1, 2, 4, 8 y 0x20-0x80 sin función):
  | bit | función | qué prueba |
  |---|---|---|
  | 0x1 | `FUN_00577290` | **cambio de sector**: sigue el movimiento por las aristas (`FUN_005757B0`) desde el sector actual hasta el que contiene el destino; cada sector nuevo lo acepta o no el `Parachoques` (`vtable+0x44`); si lo cruza, actualiza `bicho+0xE4` (`+0x48`). Es lo que portamos con `simBlocked`/`stepOk` pero **por cruce de arista, no solo en el punto final**. |
  | 0x2 | `FUN_005775B0` | **suelo**: altura del cuerpo menos plano del sector `< −0.01` → respuesta vertical del `Parachoques` (`+0x10`). |
  | 0x4 | `FUN_0057B660` | **paredes de sector**: ver abajo. |
  | 0x8 | `FUN_0057CEA0` | **cuerpos y volúmenes** en un árbol espacial (`DAT_0083F954`, nodos con 4 hijos en `+0, +0x30, +0x60, +0x90`): por cada cuerpo, círculo contra círculo (`FUN_0057C400`, `FUN_0057A780`), con la respuesta del `Parachoques` (`+0x14`: código 2 → `FUN_00573A80`, 3 → `FUN_0057CC60`). |
  | 0x10 | `FUN_0057E2A0` | cuerpos dinámicos (se quita para el peatón). |

## Paredes de sector (bit 4, `FUN_0057B660`) [hecho en estructura]
- Recorre (BFS por vecinos, hasta 1023 sectores) las **aristas del sector actual** y de sus vecinos. Para cada arista con **`0 ≤ d < R + ε`** (`d = a·x+b·y+c` con la recta normalizada de la arista, interior positivo; `ε = 0.01` (`_DAT_007A11E8`, doble); `R` = radio del cuerpo, **dos radios** `param_2[7]` y `[10]`, el del cilindro de colisión y el de subida) llama a `FUN_005786A0`: contacto exacto **círculo contra segmento** (tipo 5: el pie de la perpendicular cae dentro del segmento y `|d| < R+ε`; tipo 3: contacto con un **extremo** de la arista, a distancia < R) y arma el punto/normal de contacto.
- Si hay contacto, responde el `ParachoquesPeaton` (`FUN_0066ADF0`, vtable `+0xC`), con el sector del otro lado de la arista:
  1. **¿Pisable?** `FUN_0066AD30` (la que ya portamos como `simBlocked`: sector nulo, `NTrans`, DEEPWATER a pie, no-agua en modo agua, `SoloAg` de pie). Si **no** es pisable → choque (código 3), salvo que el vecino sea el mismo sector del cuerpo.
  2. Si es pisable: **diferencia de altura** en el punto de contacto `dz = z_vecino − z_propio`: con `dz > 0.1` (`0x796368`) choca si `dz >` subida máxima del Parachoques (`+0x14`, **15**); con `dz < −0.1` choca si `dz < −bajada` (`+0x10`, **20**); entre −0.1 y 0.1 pasa. Una excepción para el tipo 4 (`CONVEYOR`) usando una dirección de cinta (`FUN_00574C30`).
- **Consecuencia**: el original no deja que el cuerpo se acerque a una arista bloqueante a menos de **R ≈ 10 + ε** (R = radio del cilindro, `RENDERVOL … .R 10`), ni a un vértice suyo. Por eso el pathfinder mantiene 11 de margen (`q1-rutas.md`). El port actual solo rechaza el paso si **el punto de llegada** cae en un sector bloqueado: el comando se acerca hasta tocar la pared y la ruta de A* nunca lo lleva a menos de 11, pero un clic a menos de 10 de una pared lo dejaría pegado a ella en el port y a 10 en el original.
- Las aristas de **fin de mapa** (sin vecino, `neighbors = −1`) son siempre bloqueantes (`FUN_0066AD30(null)` → no pisable).

## `CHOQ*.VOL` y cuerpos [hip]
- `FUN_0057CEA0` recorre cuerpos con posición `(+8,+0xC,+0x10)`, radio `+0x54` y forma `+0x50`; los `CHOQ*.VOL` (prismas poligonales y cilindros `RADIO`) se cargan por `FUN_006178A0/617580` (POLY, RADIO, POINT; TILE y EXTRAINFO se descartan) y **[hip]** son los que alimentan ese árbol. Falta leer cómo se insertan (¿una entrada por POLY?) y `FUN_0057C400/57A780` (contacto círculo-polígono/prisma). Los `CHOQ` son del mismo mapa (8 archivos); tamaños: `docs/engine/graficos-mapa.md` §colisión.

## Qué portar (cuando se decida)
1. **Margen de pared**: en `Unit.blocked`, además del sector del punto de llegada, probar las aristas del sector y vecinos a menos de `R+ε` del punto: contacto círculo-segmento y, si la arista es bloqueante (vecino no pisable o escalón fuera de [−20, +15] según `dz` en el contacto), anular el paso. Con tolerancias 0.1 en `dz`.
2. Marcar `choque` (`Sim+0xA8`) cuando se anula un paso: lo consume el motor para detectar "atascado" (es el origen del contador de `TPathTool`, cuyo umbral de 9 ciclos ya está en `Unit`).
3. Bit 8 (cuerpos y `CHOQ`): después de leer cómo se arma el árbol.

## NO LEÍDO
`FUN_005757B0` (seguimiento de arista al cruzar), `FUN_005758A0`, `FUN_0057C400`, `FUN_0057A780`, `FUN_0057CC60`, `FUN_00573A80`, `FUN_0057E2A0`, `FUN_00574C30`; quién escribe `Sim+0xC0/+0xC4` (radio y giro máximo) para el peatón; el árbol de cuerpos (`DAT_0083F954`).
