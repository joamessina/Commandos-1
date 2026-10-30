# Qué del HUD, cursores y armas NO está leído del exe (2026-10-30)

Regla: antes de implementar algo se lee su definición en el exe (tabla, función o memoria del juego en marcha); lo que no, queda acá como atajo con su fecha de revisión.

| Qué | Estado | Fuente / falta |
|---|---|---|
| Posiciones de ítems de la mochila (boina verde, marine, francotirador) | leído (memoria del juego) | `docs/lectura/hud.md` cierres 5-6; zapador: solo 3 de captura + 4 de otro comando; quién recalcula los offsets al elegir comando: sin leer |
| Ítems visibles en vehículo | leído (`FUN_0068E210`, flag `+0x90`) | contexto a pie (postura, buceando): sin leer |
| Foto grande solo en vehículo | leído (flag `+0x124` en memoria) | |
| Retícula del francotirador (`C_MIRILL`, hotspot 47,47) | leído (`FUN_005BFE20`) | cuándo se ve exactamente (¿solo apuntando?): sin leer |
| Cursores de armas (sprite por arma) | tabla leída del init del exe | **hotspot** (centro supuesto), variantes `C_N*` ("no aplicable") y `_ACT` (sobre blanco válido): regla de cuándo se usa cada una sin leer |
| Iluminado de ítems | inventado (0,4 de luz aditiva) | cómo ilumina el exe (`ILUMINAITEM`, `ACTUALILUMINADO`) |
| Mochila a la izquierda (espejo de x) y balas a la derecha | espejo leído de `FUN_006F4150`, sin captura | |
| Balas del francotirador (15 px, x=13, y=110) | medido en captura (izquierda) | derecha espejada sin captura; el exe: `ClassVentanaBalas` sin leer |
| Piedra: atonta como el puño, 30 s | **supuesto** | duración del aturdimiento por piedra (`MSGA_PEDRADA`), ruido, trayectoria |
| Puño: 600 ciclos, ATONTADO | leído (`guarda.md`) | sin chirivitas ni sonido `CACH` |
| Esposas: ESPOSAS1 | leído | animación del comando al esposar: no hay |
| Trucos Ctrl+X / Alt+I / Ctrl+Alt+N | leídos (tabla de atajos) | consumidor del flag de invencibilidad sin leer |
| Ítems sin implementar | mano, señuelo, control alemán, arpón, cepo, botiquín, tabaco, granada | leer cada acción `Au*` antes |
| Balsa: solo el marino la maneja, el resto va de pasajero | leído (`FUN_004B74D0`, `FUN_005034A0`) | intercambio de plazas con `MSGA_INTERCAMBIA_POS` sin implementar |
| Habilidades por comando (matriz de `docs/engine/acciones-jugador.md` §3) | en el doc, **no aplicada entera**: bomba (zapador) está por token y no por la acción del MIS; escalar, agacharse y otros no se filtran por comando | revisar cada fila de la matriz contra el código |
| Cepo y señuelo del inventario | reglas leídas (`obj-explosivos.md`), implementado en `engine/traps.ts` | señuelo arranca encendido y sin ítems ON/OFF aparte; un uso; sin sonidos; el boina verde no tiene `PONEBOMBA` |
| Soldados BAP1/BANPE1 miran, BAP2/BANPE2 caminan | leído (`soldado-acbap2.md` §0) | `NERVIOSISMO`, `PERSIGUESONIDO` y demás parámetros del MAC sin aplicar |
| Refuerzos por evento `REAC` (zona CAMPAMENTO) y patrulla libre | grupos y formación leídos (`policia.md`); zona leída del `.SEC` | `NSOLDIERS` con o sin cabo, regeneración, posiciones de ataque, sensor de sonido real |
| Sensor de zona de sonido (`.SENSORES_SND_ZONA`) | leído y verificado (`sonido.md`, cierre 2026-10-30) | falta quién recibe el evento tipo 6 y qué ruidos cuentan como peligro |
| Evento de zona → grupos que salen (`FUN_0059A2A0` tipo 6 → `FUN_0059A060` → `MSGA_ORDEN_PATROL_EXIT`) | difusión leída y verificada (`sonido.md` cierre 3) | el enlace tipo 6 → `FUN_0059A060` y qué ruidos son de peligro siguen sin leer |
