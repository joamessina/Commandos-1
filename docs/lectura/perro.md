# Lectura del exe — `ClassAcPerro` (perros guardianes): `0x48E6D0–0x491E40`

**Cierre del desvío aleatorio (2026-10-30):** [cierre-70.md §6](cierre-70.md#6-animales-huecos-de-avestruz-gaviota-y-perro). `FUN_0045D6F0(a,b)=b+rand·(a−b)/32767`. En caso7 de `FUN_0048F9B0` (0x48FED0…0x48FF3C), magnitud10…45°, signo positivo con `rand()%3==0`, negativo en los otros dos casos; se suma al rumbo y el punto queda a85 unidades. Resuelve la duda del final: no es uniforme en ±45°.

**[hecho]** leído con dirección; **[hip]** interpretación. Constantes verificadas. Los perros usan el motor de rutas de `AcPatrulla` (mensajes `MSGA_PATRULLA_*`) mientras no han visto nada, y el `BUSCADOR` sin escaleras (`MSGA_BUSCADOR_IRA_SINESCALAS`) para perseguir.

## 1. Parámetros del MAC (`FUN_0048E8C0`) [hecho]
| Clave | Efecto |
|---|---|
| `AMO` | nombre del bicho amo (`+0x84`, 0x20 B) y `+0x54 = 1` ("tiene amo"). Se resuelve en el orden 3 con `FUN_0064A660` |
| `LADRADOR` | `+0x58` (entero); si ≠ 0 el perro solo **ladra** (no ataca): ver orden 0x10 |
Además: máscara de visión `MSGO_VISTA_SETVIS = 0x204`, precarga el sonido `LADR`, y `bicho+0x23C |= 0x200` ("ve"). Ctor `FUN_0048F160`: orden inicial **3**, `+0x9A` = 1.0.

## 2. Ladrido [hecho]
`FUN_0048EAC0` (cada ciclo cuando se llama): `+0x4C--`; al llegar a 0 emite `LADR` como **sonido de atención** (tipo 2, `FUN_00681B90(2,'LADR',…)`, radio de oído 200 u: lo oyen los soldados `AcBap` con `SONIDO_ATENCION`) y pasa al siguiente de la tabla cíclica de 25 intervalos (`0x812100`): **20, 15, 5, 5, 10, 25, 20, 5, 5, 5, 10, 20, 5, 5, 20, 5, 5, 20, 20, 5, 5, 5, 5, 30, 10** ciclos (`+0x50` = índice, módulo 25).

## 3. Animaciones del perro (`FUN_0048F3E0`, `acc+0xA8`) [hecho]
0 parado/andar (`ANDAR` por defecto) · 1 `CORRER` · 2 `SENTADO` · 3 `SENTADO` (junto a un amo caído) · 4 `SALTAR` · 5 `LADRAR`. `FUN_0048F690(destino, id, velocidad)`: manda `BUSCADOR_IRA_SINESCALAS` (velocidad por defecto **3.0**, `0x793F74`); si no hay camino: `BUSCADOR_STOP` y marca "llegó/falló" (`+0xB4=1`, `+0xB8=1`); corre (`CORRER`) si la velocidad pedida ≥ **5.0** (`0x793734`).

## 4. Mensajes (`FUN_004909F0`) [hecho]
(Salvo en órdenes 0x11 y 0x12.) `VISTA_ELEMENTOVISIBLE`: clase 1 (comando) → `FUN_0048F040` (presa: solo si no está muerto y `+0x194` es 0/1; se queda con la **más cercana**: `+0x2C` presa, pos `+0x6C`, flag `+0x64`); clase 0xE → guarda el objeto en `+0xE8` · `SONIDO_PANICO/PELIGRO`: si `+0x40 < 1` guarda el punto (`+0xC4..`), `+0xBC=1`; si el emisor es el amo `+0xDC=1`; `bicho+0x118 = 600` · `SONIDO_ATENCION` (si `+0x44 < 1`): `+0xC0=1`, punto, idem · `COLISION_DINAMICA`: `+0xD0 = (colisionado == presa)` · `MOTOR_CRISIS` / `DESTINOINALCANZABLE` / `BUSCADOR_CRISIS_POR_SABOTAJE`: `+0xB4=1, +0xB8=1, +0xE0=1` · `BUSCADOR_LLEGADA`: `+0xB4=1, +0xB8=0` · `IMPACTO`: `bicho+0x118 = 600` · `DONDE_ESTA_TU_OBJETIVO`: en órdenes 7-9 y 0x10 responde la posición de la presa · `SUSTITUYE_BICHO` · `ARGG`: orden **0x11** (muerto), `23C &= ~0x200`. Todo lo demás → `FUN_004C2A60`.

## 5. Reacciones (`FUN_00491510`, en este orden) [hecho]
1. **Presa vista** (`FUN_004910C0`, `+0x64`): ladra (atención); `+0xA4 = 3` (nivel de alerta máximo); si el amo está caído (`23C & 4` o `& 0x204000`) → `bicho+0x118 = 600`. **Sin amo**: orden **9** (ir a morder) o **0x10** si `LADRADOR`. **Con amo**: si `bicho+0x118 < 200` → orden **7** (ponerse entre el amo y la presa) si no **9**.
2. **Objetivo** (`FUN_004911A0`, `+0xE8`, nivel `< 3`): `+0xA4=2`; pregunta `DONDE_ESTA_TU_OBJETIVO` a ese objeto y va (orden **0xD**, 100 ciclos) a esa posición.
3. **Sonido** (`FUN_004912C0`): peligro (`+0xBC`, nivel `< 2`; `+0x40=15`) o atención (`+0xC0`, nivel `< 1`; `+0x44=15`): si va con el amo (orden 4) y está a menos de **40** u (`0x795780=1600`) y el sonido no es del amo, lo ignora; si no `+0xA4=1`, orden **0xD** hacia el punto y se gira hacia él.
`+0xA4` = nivel de atención (0 ninguno … 3 presa).

## 6. Órdenes (`acc+0x24`; tick `FUN_00491DE0` → `FUN_00491550`; entrada `FUN_0048F9B0`; salida `FUN_0048EDB0`) [hecho]
Al final de cada tick se limpian `+0xBC,+0xC0,+0x64,+0xD0,+0xDC,+0xE0,+0xE8` (eventos de un ciclo) y se descuentan `+0x40` y `+0x44`.
| Orden | Significado | Qué hace |
|---|---|---|
| 3 | arranque | resuelve `AMO`; con amo → orden 4; sin amo: si el nombre estaba definido pero no existe → 0x12 (inactivo), si no → orden **5** |
| **4** | **junto al amo** | reacciones; si no reacciona: `FUN_004904C0` — punto de seguimiento a **30** u (`0x793D30`) del amo; velocidad = distancia al punto × **1.5** (`0x793830`), mínima **5.0**; si dist² al punto ≤ `10000` (100 u) para y se sienta (`SENTADO`; el amo caído: `SENTADO` fijo) cuando está a menos de 5 u (25) o a menos de 30 (900) y el amo está quieto; si no corre |
| **5** | patrulla (ruta de `AcPatrulla`) | `PATRULLA_UNPAUSE` al entrar; si hubo crisis de motor `PATRULLA_INVERT_ROUTE`; reacciones. Al salir: `PATRULLA_PAUSE` |
| **7** | **ponerse entre el amo y la presa** | ladra; corre al punto intermedio (`FUN_0048F9B0` caso 7: entre amo y presa; a menos de **100** (dist² `0x793538`) del amo usa la mitad de la distancia, si no `100`/`0x794CE8`); al llegar → orden **8**; si `bicho+0x118 ≥ 200` → **9** |
| **8** | **encarar a la presa** | `FIJAR_VISTA` en la presa, parado, `+0xE4 = 100` ciclos; ladra y anima `LADRAR` (`FUN_0048F3E0(5)`); sin presa a la vista cuenta atrás y vuelve al amo; `bicho+0x118 ≥ 200` → 9 |
| **9** | **correr a morder** | `bicho+0x118 = 600`; cada **25** ciclos (`+0x48`) rehace el camino a la presa a velocidad **5.0**; ladra; si la presa está a menos de **60** u (dist² `0x796280 = 3600`) → orden **0xA**; si choca con ella (`+0xD0`) o llega → **muerde**; al agotarse `+0xE4` → vuelve (`FUN_004914B0`) |
| **0xA** | **salto** (anim `SALTAR`) | `bicho+0x118 = 600`; si choca (`+0xD0`): `FUN_00508610` y muerde; luego orden 0xB; si no, al acabar el tiempo vuelve a 9 |
| **0xB** | tras morder | cuenta `+0xE4` (o espera llegada) y vuelve a la posición previa (`+0x78`), orden **0xC** |
| **0xC** | volver | reacciones, cuenta atrás → 0xD |
| **0xD** | **mirar un punto / espera** | reacciones; cuenta atrás `+0xE4`; cuando vale **50** se gira **180°** (`0x793E68`); al acabar: sin amo → orden 5; con amo → orden 4 (o 0xE si estaba volviendo, `+0xAC`) |
| 0xE | volver al punto guardado | reacciones; al llegar → 0xD + giro de 180° |
| 0xF | oyó algo | reacciones; se gira hacia la última dirección; al acabar → 0xD; si el amo está caído y está cerca → vuelve a 4 |
| **0x10** | **ladrador**: encara y ladra | cada ladrido anima `LADRAR`; cada 20 ciclos se gira hacia la presa; sin presa → `FUN_004914B0` |
| 0x11 | muerto (`ARGG`) | |
| 0x12 | inactivo / sin amo | no se actualiza |
Salidas (`FUN_0048EDB0`): 5 → `PATRULLA_PAUSE`; 8, 9, 0x10 → `VIGILAR_ON`, "ya no es interesante", oculta la marca de visión; 0xA → `MSGO_MOTOR_SETVEL(5.0)`; 0xC → `RESTAURAR_ANGULO_BARRIDO`.
Otras: orden 0xD con sonido de amo caído: ladra.
**Mordisco**: en las órdenes 9 y 0xA, con `+0xD0` (el perro choca con la presa): `FUN_005986A0(perro, presa, tipo 4 = MORDISCO, daño 0x19 = 25)`.

## Dudas abiertas
- Valor exacto de `FUN_0045D6F0(45.0, 10.0)` del caso 7 de `FUN_0048F9B0` (desvío aleatorio de la dirección de los paseos en el orden 0xB; rango de ±45° y 10; se leyó el uso pero no la función; sirve para elegir un rumbo aleatorio a **85** u (`0x797470`) a velocidad 3.0 y `+0xE4 = 30`). No afecta a reglas de juego visibles.
- El ladrido cuenta como `SONIDO_ATENCION` (tipo 2) por el primer argumento de `FUN_00681B90`; el mapa tipo→mensaje es el de `organos.md`.
