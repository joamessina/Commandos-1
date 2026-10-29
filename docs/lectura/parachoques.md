# Lectura del exe — Colisión (Parachoques): 68 funciones, 3 KB (tanda 20261029-002243)

**[hecho]** leído con dirección. Cada vehículo/cuerpo tiene un `Parachoques*` que decide qué hace al tocar una **arista de sector** (`FUN_0057B660` → `vtable+0xC`) y qué respuesta da a choques con cuerpos (`+0x14` y `+0x10`). Código devuelto: **0 = pasa · 3 = bloquea (duro) · 2 / 1 = respuestas de golpe** (2 = “destruye/explota el vehículo si no hay obstáculo que lo frene”, 1 = rebote/ignorar; son constantes por clase en los virtuales `+0x10/+0x14/+0x18`).

| Clase | Regla de arista (el vecino `V` al otro lado) |
|---|---|
| **Peatón** (`FUN_0066ADF0`) | ver `q1-colision.md`: bloquea si `V` no es pisable (`FUN_0066AD30`) o si el escalón sale de [−bajada, +subida] (15/20); marca `+0x30 \|= 4`; respuesta de choque con cuerpo `FUN_0066A8E0`: marca `+0x30 \|= 8`, devuelve 3 salvo que `+0x2C & 8`. |
| **DuroAuto** (`FUN_00665960`) | 3 si no hay `V`, `V` tiene NTrans (bit 2 de `flags`), o `V` es agua (tipo 1 o 3); también 3 si el escalón sube más de `+0x14` o baja más de `−(+0x10)`; si el obstáculo es una rampa (tipo 4) pasa. Si bloquea y no tiene `+0x18` (el "freno"), devuelve **2** (choque fuerte). Choques: 3 / 2 / 1. |
| **DuroTanque** (`FUN_0066EA00`) | igual que el auto (no entra en agua, mismo escalón) pero 3→**2** si no hay freno; choques 3 / 2 / 1. |
| **DuroLancha** (`FUN_00668DF0`) y **DuroSub** (`FUN_0066E0A0`) | 3 si no hay `V`, NTrans o **`V` no es agua** (tipo ≠ 1 y ≠ 3): solo navegan por agua; choques 3 / 3 / 1. |
| **DuroBalsa** (`FUN_00667600`) | 3 solo si no hay `V` o `V` tiene NTrans (la balsa no mira el tipo); `FUN_00667660` al chocar **multiplica ×0.5 la velocidad (x, y, z y giro) del Sim** y devuelve 3; choques 3 / 2. |
| **DuroMisil** (`FUN_00669210`) | 3 si no hay `V` o `V` no es agua (el misil explota contra tierra); choques 3 / 1 / 1. |
| **Objeto** (`FUN_00669C20`; cajas, barriles empujables) | 3 si no hay `V`, o (sin empuje `+0x14` y `V` con NTrans); si el objeto tendría que subir más de `+0x10` en el contacto lo deja pasar solo si el suelo de `V` queda por debajo del propio (`V.plano(x,y) + 0.1`); rampa tipo 4 pasa; choques 3. |
| **Ave** (`FUN_00666800`) | 3 solo si el vecino del contacto es nulo (borde del mapa); vuela sobre todo lo demás. |
| **Rail** (`FUN_0066C350`) | **nunca bloquea** (0) y no responde a golpes (1) — el tren va por su vía. |
| **Pasivo**, **Nulo** | 1 / sin efecto. |
| **Escalador** (`FUN_00667F50…80`) | respuestas 3 / 2 / 2 (ver `q1-escaleras.md`: solo exige sector no-NTrans). |
| **Seguidor** (`BlandoSeguidor`, `DuroSeguidor`; `FUN_0066D380` ctor) | no bloquea por aristas (0); para choque con cuerpos arma un volumen de 4 puntos de lado `radio·0.5`. Comparación de dueños `FUN_00574970`: dos cuerpos pertenecen al mismo "grupo" si comparten el mismo padre (`+8`) y el segundo tiene índice menor (`+0xC`). |

Clases base `ISimBicho` / `ISimParachoques` (vtables); constructores/destructores son rutina. El resto de la tanda (destructores `…vftable`) no tiene lógica.
