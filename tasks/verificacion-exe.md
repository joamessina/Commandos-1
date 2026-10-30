# Qué del HUD, cursores y armas NO está leído del exe (2026-10-30)

Regla: antes de implementar algo se lee su definición en el exe (tabla, función o memoria del juego en marcha); lo que no, queda acá como atajo con su fecha de revisión.

**Continuación 2026-10-30:** [`cierre-faltantes-70.md`](../docs/lectura/cierre-faltantes-70.md) lee minimapa, bucle PASW de agua y selección/transiciones CLancha/CTanque; valida9 libretas y22 grafos contra el DIR raíz. PASW usa volumen0,3 y carece de radio IA. No se implementó ninguna regla nueva; siguen pendientes recinto final, otras locomociones/conductores, paletas/hover y verificación audiovisual.

Mapa general (2026-10-30): `docs/exe-mapa-general.md` enlaza 49 funciones con VA, líneas reales y notas previas. Se verificaron cabeceras contra `ghidra/all2` (37.026 funciones); `all` es anterior y tiene29.304. **Corrección tras cierre-70 §2:** el tamaño declarado de `FUN_00786e60` (37.808 B) no demuestra C completo: el bloque de mochila0x78B6D0…0x78BCD1 solo se recuperó del ensamblador. Es navegación y atribución documentada, no lectura semántica de todas las funciones; no se verificó en ejecución.

| Qué | Estado | Fuente / falta |
|---|---|---|
| Posiciones de ítems por personaje | **leído del exe y contrastado con memoria previa** | `cierre-70.md` §2: tabla0x822768, init0x78B6D0, registro0x58 y fórmula de offsets. Incluye zapador/conductor; falta aplicar tabla completa al port. |
| Ítems visibles por contexto | vehículo y postura leídos (`FUN_0068E210`) | `cierre-70.md` §2; restan todos los flags de acción/disfraz y su implementación. |
| Foto grande solo en vehículo | leído (flag `+0x124` en memoria) | |
| Retícula del francotirador (`C_MIRILL`, hotspot 47,47) | leído (`FUN_005BFE20`) | cuándo se ve exactamente (¿solo apuntando?): sin leer |
| Cursores de armas (sprite por arma) | tabla leída del init del exe | **hotspot** (centro supuesto), variantes `C_N*` ("no aplicable") y `_ACT` (sobre blanco válido): regla de cuándo se usa cada una sin leer |
| Iluminado de ítems | inventado (0,4 de luz aditiva) | `cierre-70.md` §2: el dibujante elige paleta y estado alternativo; falta traducir los índices/hover. No se confirmó una suma0,4. |
| Mochila a la izquierda (espejo de x) y balas a la derecha | espejo leído de `FUN_006F4150`, sin captura | |
| Balas del francotirador (15 px, x=13, y=110) | medición previa; dibujante leído | `FUN_006F5380`: repite por nº de balas y avanza ancho del sprite (`cierre-70.md` §2). Origen/lado completo sin captura nueva. |
| Piedra: atonta como el puño, 30 s | **contradicho por el exe; pendiente corregir el port** | `cierre-70.md` §5.2: BAP/Guarda no crean aturdimiento al recibir PEDRADA; no corresponden600 ciclos. PEDL/PEDW y caída leídos. |
| Puño: 600 ciclos, ATONTADO | leído (`guarda.md`) | sin chirivitas ni sonido `CACH` |
| Esposas: ESPOSAS1 | leído | animación del comando al esposar: no hay |
| Trucos Ctrl+X / Alt+I / Ctrl+Alt+N | leídos (tabla de atajos) | consumidor del flag de invencibilidad sin leer |
| Ítems sin implementar | mano, señuelo, control alemán, arpón, cepo, botiquín, tabaco, granada | leer cada acción `Au*` antes |
| Balsa: solo el marino la maneja, el resto va de pasajero | leído (`FUN_004B74D0`, `FUN_005034A0`) | intercambio de plazas con `MSGA_INTERCAMBIA_POS` sin implementar |
| Habilidades por comando (matriz de `docs/engine/acciones-jugador.md` §3) | en el doc, **no aplicada entera**: bomba (zapador) está por token y no por la acción del MIS; escalar, agacharse y otros no se filtran por comando | revisar cada fila de la matriz contra el código |
| Cepo y señuelo del inventario | reglas leídas (`obj-explosivos.md`), implementado en `engine/traps.ts` | señuelo arranca encendido y sin ítems ON/OFF aparte; un uso; sin sonidos; el boina verde no tiene `PONEBOMBA` |
| Soldados BAP1/BANPE1 miran, BAP2/BANPE2 caminan | leído (`soldado-acbap2.md` §0) | `NERVIOSISMO`, `PERSIGUESONIDO` y demás parámetros del MAC sin aplicar |
| Refuerzos por evento `REAC` (zona CAMPAMENTO) y patrulla libre | grupos y formación leídos (`policia.md`); zona leída del `.SEC` | `NSOLDIERS` con o sin cabo, regeneración, posiciones de ataque, sensor de sonido real |
| Sensor de zona de sonido (`.SENSORES_SND_ZONA`) | leído y verificado | `cierre-70.md` §4: recibe sector (`sonido+0x28`) y categoría del emisor; máscaras en sector+0x2C, no dentro del sonido. Falta completar emisores/pisadas. |
| Evento de zona → grupos que salen (`FUN_0059A2A0` tipo6 → `FUN_0059A060`) | **cadena cerrada** | slot7 de todas las intendencias:0x409016 → `FUN_0059CEA0` → `FUN_0059A060`; activa alarma y combina zonas. Falta portar cadena completa. |
