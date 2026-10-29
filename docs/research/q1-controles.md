# Q1 — Controles del mouse: qué botón hace qué (punto A)

Fuente: exe de la raíz. **[hecho]** = leído con dirección. Pedido del usuario (2026-10-28): saber qué botón emite cada orden, para corregir el visor (hoy: izquierdo = elegir/mover, derecho = mover, Mayús o doble derecho = correr; tomado del juego "conocido", no del exe).

## Cadena completa [hecho]
1. **Windows → índice de evento** (`FUN_006C22D0`): `WM_LBUTTONDOWN 0x201 → 0x24`, `LBUTTONUP 0x202 → 0x26`, `LBUTTONDBLCLK 0x203 → 0x2B`, `RBUTTONDOWN 0x204 → 0x25`, `RBUTTONUP 0x205 → 0x27`, `RBUTTONDBLCLK 0x206 → 0x2C`. Los empuja a la cola de entrada (`FUN_00599350` → `FUN_00598C80`, hasta 99 eventos con x, y) y el despachador `FUN_005993F0` los entrega como mensajes con `Mayús/Ctrl` sumados en el tercer parámetro (`DAT_0083FE90 & 0xC0` y `& 0x30`).
2. **Tabla de ids de mensaje** (`0x81A5B8`, 0x29F entradas `{id, nombre}`, volcada con `tools/msgtab.py`): `0x24 MSG_BOTON1` · `0x25 MSG_BOTON2` · `0x2B BOTON1DBLCLK` · `0x2C BOTON2DBLCLK` · `0x26/0x27 BOTON1/2RELEASE` · `0x28/0x29 BOTON1/2CANCEL` · `0x2A MOUSEMOVE`. Es decir **BOTON1 = izquierdo, BOTON2 = derecho** (el juego no tiene cambio de botones en este camino; si hay una opción de invertirlos no está en estas funciones).
3. **El cursor del mundo** (`FUN_0053E0xx`/`FUN_0053DCD0`, clase del cursor) convierte cada uno a su versión en coordenadas del mundo: `0x2D BOTON1VIRTUAL`, `0x2E BOTON2VIRTUAL`, `0x2F/0x30 …DBLCLKVIRTUAL`, `0x31/0x32 …RELEASEVIRTUAL`, `0x33 MOUSEMOVEVIRTUAL`; y a las de "modo selección" `0x34…0x39 …SELECCION`, `0x3A MOUSEMOVEVIRTUALSELECCION`. El picking (cursor → sector más alto bajo el píxel) está en `q1-render.md` §1.4.
4. **La ventana del juego** (`FUN_005BD030`) recibe esos mensajes y los reparte (`FUN_005BA1A0…5BA420`).

## Qué hace cada botón [hecho]
| Mensaje | Manejador | Efecto |
|---|---|---|
| `BOTON1VIRTUAL` / `BOTON1SELECCION` (izq. simple) | `FUN_005BA1D0`/`5BA1A0` → **`FUN_0069A4F0`** | Es **la orden**: emite `MSGA_ACTUASOBREPUNTO` (clic en el suelo), `MSGA_ACTUASOBREELEMENTO` (clic sobre un objeto/personaje) o `MSGA_ACTUASOBREZONASELECCION`, hacia los personajes seleccionados (`FUN_00694370` reparte; con varios seleccionados usa las variantes `MULTIPLEACTUASOBREPUNTO`). |
| `BOTON1DBLCLK*` (izq. doble) | `FUN_005BA230`/`5BA200` → **`FUN_0069A790`** | Lo mismo con las variantes `…DBLCLK`. **`AuGoTo` corre si el mensaje es `…DBLCLK`** (`FUN_004F68A0`). O sea: **un clic izquierdo camina, doble clic izquierdo corre**. |
| `BOTON2VIRTUAL` / `BOTON2SELECCION` (der., al apretar) | `FUN_005BA260` | Anota el punto de partida de un rectángulo (`+0x13E4/E8/EC`) y, con ciertas teclas (`DAT_0083FE90 & 0xC0`), avisa a `FUN_005355D0`. **También se reparte a las acciones de los personajes** (`FUN_00694370`): es el mensaje que `AUEscalar` toma como "parar/cancelar" (`q1-escaleras.md` §3). |
| `BOTON2RELEASE*` (der., al soltar) | `FUN_005BA2F0`/`5BA420` | Calcula el rectángulo entre el punto de apretado y el de soltado. **Si mide < 3 px**: `FUN_0069A9F0` (reenvía `BOTON2VIRTUAL`, `0x2E`, al objetivo bajo el cursor). **Si no**: `FUN_0069AAD0` = **selección por rectángulo** (recorre los personajes y selecciona los que cruzan el rectángulo; si queda uno lo marca solo, si son varios usa el grupo). |
| `BOTON2CANCEL` | `FUN_005BD030` | Pone a 0 `+0x13E4` (anula el rectángulo en curso). |

## Conclusión para el port
- **Izquierdo = ordenar** (caminar / usar escalera / actuar sobre objeto); **doble izquierdo = correr**. Es lo que se midió en vivo con el original (el izquierdo movió el bote; el derecho no).
- **Derecho = seleccionar y cancelar**: arrastrar dibuja el rectángulo de selección, un derecho corto actúa sobre lo que hay bajo el cursor y, como mensaje, **detiene/cancela la acción en curso** (en la escalera: queda a mitad de camino).
- El visor actual está al revés en tres cosas: derecho = mover, Mayús = correr, y el izquierdo sobre un comando = seleccionarlo.

## NO LEÍDO
- Qué hace exactamente el izquierdo cuando se hace clic sobre **un aliado** (¿lo selecciona o es `ACTUASOBREELEMENTO` con otro significado?): `FUN_0069A4F0` pasa por `FUN_00598810`/`FUN_006964B0`/`FUN_005BB2B0`, no leídas.
- Cuál es el efecto de `BOTON2VIRTUAL` en las demás acciones (`AuGoTo` no lo maneja: lo ignora la base `FUN_004BB830`; falta ver si la base lo trata como parar). Hay 11 manejadores más con `BOTON2VIRTUAL` (`FUN_004E9F40`, `4EC770`, `4F5430`, `5034A0`, `68B220`, `68FE50`…).
- Atajos de teclado (R16), zona de scroll por borde de pantalla, y los modos de la interfaz (`+0x1418`: 0/1/2/3).
