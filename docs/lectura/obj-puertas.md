# Puertas, barreras, alambradas, interruptores, focos (exe `coman_mp.exe`)

**[hecho]** = leído con dirección; **[hip]** = interpretación. 20 ciclos/s. Macros: `BARRERA.MAC`, `BARREAUT.MAC`, `FOCO.MAC`, `INTERFOC.MAC`; las puertas, alambradas e interruptores sueltos se declaran en el `.MIS` (bloques `acPuertaCandado`, `acAbrePaso`, `AcInterruptor`), no hay `.MAC` propio.
Los eventos de 4 letras (`HUGE`, `GEPE`, `CHES`…) son mensajes a la Intendencia (`mision-intendencia.md` §5).

## 1. `ClassAcPuertaCandado` (`0x4A3A30…0x4A4CA0`): puerta corredera con candado [hecho]
Parámetros (`FUN_004A3A30`): `RECORRIDO n` (0…100; `+0x34 = 100 − min(n,100)` = **ancho mínimo en %** al abrir), `LADOCERRADO` `DERECHO`→`+0x28=1` / `IZQUIERDO`→`2` / otro→0 (lado desde el que se puede abrir), `ENVIAREVENTO` (+0x40, 1 = emite eventos), `EVENTOABRIR` (+0x6C) / `EVENTOCERRAR` (+0x70) (ids de evento de 4 letras), `NOSOLIDA_CUANDOABIERTA` (+0x38), `DESCUBREESPIA` (+0x48), `CAMBIARSECTOR` o `XYSECTOR [x y]` (+0x44 = sector que bloquea la puerta; bit `+0x50 & 4` = "bloqueado"), `ACELERACION f` (+0x74; si presente `+0x78=1`), `GEMELA nombre` (+0x4C: puerta hermana; los mensajes se le reenvían). Defectos del ctor: ancho actual **100**, `+0x34` 100, **paso `+0x30 = 5` (% por ciclo)**, estado inicial 3.
Estados `acc+0x24` y efectos (`FUN_004A4330`, tick `FUN_004A4CA0`):

| estado | qué hace |
|---|---|
| **3** init | resuelve la gemela por nombre; pasa a 4 |
| **4 cerrada** | `bicho+0x23C &= ~1`; sonido apagado; sector `+0x44 |= 4` (bloqueado). Si hay pedido (`+0x88`) y (puerta `+0x3C` "siempre abierta" **o** el lado correcto) → 5 |
| **5 abriendo** | sector `+0x44` desbloqueado; `acc+0x3C=0`; si `DESCUBREESPIA`, envía `MSGA_HAS_USADO_ALGO_QUE_PUEDE_DESCUBRIRTE` al que la abrió; arranca sonido `'PCAM'` (0x5043414D, precargado en el ctor con volumen 0.75); cada ciclo el ancho `+0x2C` baja `+0x30` (5) hasta `+0x34`; manda `MSGA_ASIGNA_ANCHO(ancho)` al volumen. Con `ACELERACION` el avance es cuadrático: `ancho = 100 − t²·acel` (t en ciclos). Al llegar → 6 |
| **6 abierta** | espera: si hay pedido y **nadie a la vista** (`+0x84==0`, lo pone `MSGA_VISTA_ELEMENTOVISIBLE` cada ciclo) → 7. Emite `EVENTOABRIR` (si `ENVIAREVENTO`) y, si `NOSOLIDA_CUANDOABIERTA`, `bicho+0x23C |= 1` |
| **7 cerrando** | ancho `+= paso` hasta 100; emite `EVENTOCERRAR`; al llegar → 4. Quita `+0x23C & 1` |
| **8 destruida** | tras `MSGA_ARGG`: `FUN_005086E0(1)`, sector desbloqueado para siempre, `+0x98=0` |
- Tiempos: con paso 5 y ancho 100→(100−RECORRIDO): **hasta 20 ciclos (1 s)** para abrir del todo; igual al cerrar.
- `MSG_ACTUASOBRE` (clic del jugador/AU): recuerda al actor (`+0x8C`) y calcula `ang = ángulo(actor − puerta) − ángulo_puerta` (normalizado); si `LADO==0` (cualquier lado) o (`DERECHO` y `ang<0 ∨ ang>180`) o (`IZQUIERDO` y `0<ang<180`) → pedido de abrir (`+0x40=1`, `+0x88=1`). Es decir: **solo se abre desde el lado correcto**.
- `MSGA_ABRIR_PUERTACANDADO` (solo en estado 4 ó 7): pedido de abrir sin comprobar el lado; `…_SIEMPRE`: además `+0x3C=1` (queda abierta hasta que alguien la cierre); `MSGA_CERRAR_PUERTACANDADO` / `MSGA_BARRERA_BAJA` (en 5 ó 6): pedido de cerrar. Todos se reenvían a la gemela.
- Se usa en el `.MIS` para puertas de bases (M4 `PUERTA_SUR1`, la Intendencia la abre con `…_SIEMPRE` al evento `ABPU`).

## 2. `ClassAcBarrera` (`0x43CEE0…0x43EC90`): barrera de carretera [hecho]
Parámetros (`FUN_0043CEE0`): `XYZCONTROL [x y z]` (punto del cuartelillo que la controla, +0xC0), `DIMSELECCION [w h]` (caja de clic), `VOLCOLISIONSUBIDA [w h]` (huella cuando está levantada), `BARRERAGEMELA` (nombre, +0xF4), `DISTANCIA [a b]` (desplazamiento del brazo +0xEC/+0xF0), `XYSECTOR` (sector bloqueante), `AUTOMATICA` (+0xD0). MAC `BARRERA`: `ENEGIA 40`, `MASA 3000`, `AUTOMATICA 0`, `DISTANCIA [60 110]`, `VOLCOLISIONSUBIDA [8 8]`, `DIMSELECCION [20 20]`, vista `Vista02`, y `AcExplotaTilesBarrera` (se rompe con tiles `BARR0007/0009.RLE`); `BARREAUT` = automática.
Estado `acc+0xB0`: **0** reposo · **1 abriendo** · **2 cerrando** · **3 destruida**; `acc+0xB8` = 1 si está **abierta**; el recorrido dura **`acc+0x168` ciclos = nº de cuadros de la animación `BARR`** (dato del `.ANM`; `FUN_00509B60`). Se anima el brazo y se mueve la huella de colisión.
- `MSG_ACTUASOBRE`: si está abriendo o abierta ⇒ cerrar, si no ⇒ abrir. `MSGA_BARRERA_ABRE` abre; `MSGA_BARRERA_BAJA` cierra; al terminar de cerrar envía `MSGA_BARRERA_BAJADA` al dueño (el soldado/cuartelillo que la llamó). `MSGA_SETDUENO(bicho)` fija el dueño y devuelve `XYZCONTROL`. `MSGA_TEST_BARRERA` → `+0xB8`.
- **Automática**: abierta, sin nadie a la vista (`+0xCC==0`) y `AUTOMATICA` ⇒ cuenta `+0xB4`; a los **> 30 ciclos (1,5 s)** se cierra sola. Se abre automáticamente al oír un sonido ambiente `'CLXN'` (klaxon, `0x434C584E`) si es automática.
- `MSGA_VISTA_ELEMENTOVISIBLE`: si lo visto no está muerto y tiene el bit `0x38&2` ⇒ reenvía `MSGA_VEO_ELE` al dueño y a la gemela y marca `+0xCC`.
- `MSGA_ARGG` (destruida): estado 3 (queda abierta/rota; sector desbloqueado, `FUN_00507E80`).

## 3. `ClassAcAbrePaso` (`0x424410…0x425420`): alambrada cortable [hecho]
Parámetros: `CORTABLE` (+0x28; lo pone `MSGA_HACE_CORTABLE`), `TAMAX`/`TAMAY`/`DELTAX`/`DELTAY` (caja del tile), `VOLUMEN` (volumen donde están los tiles), `TILEANTIGUO`, `TILENUEVO`.
- `MSGA_CORTA_ALAMBRE` (lo envía el AU `Alicate`, `au-jugador.md` §0b): solo si `CORTABLE≠0` y todavía no cortada ⇒ `+0x30=1` y enciende la marca.
- Tick `FUN_00425420`: con `+0x30` y `CORTABLE` ⇒ `FUN_004252F0`: `+0x2C=1` (cortada), **desbloquea el sector** (`bicho+0xE4`, `+0x50 &= ~4`), apaga el bicho (`FUN_006156B0/615670/615750`) y **cambia el tile** `TILEANTIGUO → TILENUEVO` en el volumen (`FUN_00425150`: busca en la lista de tiles del volumen el de nombre `TILEANTIGUO` más cercano al punto y lo sustituye, `+0x14 = 0x10`).
- `MSGA_CORTA_ALAMBRE` ignora el mensaje si ya está cortada.

## 4. `ClassAcInterruptor` (`0x475D40…0x476F60`) e `ClassAcInterruptor12` [hecho]
Parámetros (`FUN_00475FB0`): `ESTADOINICIAL` (`ACTIVADO` ⇒ estado 5 y anim invertida), `EVENTOACT` (+0x30) y `EVENTODES` (+0x58) = ids de evento de 4 letras, `OBJETO` (+0x34, bicho enlazado), sonido (`'xxxx'` +0x54), `BOXSEL [x y w h]` (caja de clic). Anim `MOVER`.
Estado `acc+0x24`: 3 init · **4 desactivado** · **5 activado**. `MSG_ACTUASOBRE` ⇒ pedido (`+0x28=1`). Tick `FUN_00476940`: con pedido, consulta al objeto enlazado con `MSGA_INTERRUPTOR` (`FUN_00475E10`, por defecto 1 = permitido); si lo permite: anima `MOVER` (vel **−1** al desactivar, **+1** al activar), suena, **emite el evento** (`FUN_0059A2A0(0, id, 0)` ⇒ slot 1 de la Intendencia, que reparte a patrullas y a la lógica de misión) y cambia de estado. `AcInterruptorFoco` (`0x4772E0`): al clic manda `MSGA_APAGAENCIENDE_FOCO` a los focos (§5). `AcIzarBandera` (`0x477530…`): al `MSGA_INTERRUPTOR` sube/baja la bandera por riel (`MSGO_MOTOR_SETRAIL`, anim `IZADA`, objeto `MASTIL`).

## 5. `ClassAcFoco` (`0x468BD0…0x46AA40`): foco/reflector [hecho en lo jugable]
Parámetros: `RADIO` (MAC por defecto **90**), `POS_CONO`, `LONGITUD`, `APERTURA` (cono de luz), `HORAENCENDIDO` (+0x6C, **hora del día**), `RUTA` (el foco puede barrer por una ruta), lista `FOCOS` (focos hermanos). Estado `acc+0x68`: 2 apagado · 4 encendido · 5 destruido · 7 parpadeando.
- `MSGA_APAGAENCIENDE_FOCO` alterna; `MSGA_APAGA_FOCO`/`ENCIENDE_FOCO` fuerzan; `MSGA_DESTRUYE_FOCO` ⇒ estado 5 (lo manda `AcFocoDestruible` al recibir `MSGA_IMPACTO`).
- **Encendido por la hora** (`FUN_00468FA0`): cada ciclo compara `HORAENCENDIDO` contra `Intendencia.vtable+0x54` (hora del día; en la base devuelve **0**, solo `ClassIntendencia09` la devuelve, `mision-intendencia.md` §7); si `HORAENCENDIDO < hora` ⇒ estado 4. Es decir, **solo en la misión nocturna los focos se encienden por reloj**; en las demás solo por interruptor o desde el principio.
- Parpadeo: temporizador aleatorio `rand() % 0x97 + 100` = 100…246 ciclos.
- El cono es un `ClassLightConeVolDynamic` (luz) y el foco ve con un órgano de vista; los comandos iluminados son vistos (reglas de `organos.md`).

## 6. Otros leídos solo en estructura
- `ClassAcControlCompuerta` (`0x454050…`): compuerta/esclusa con control (`MSGA_BARRERA_BAJADA`), alterna el bit `+0x50 & 4/0x100` del sector que cierra. `CAcPuenteLevadizo` / `CAcCtPuenteLev` (`0x4A1580`, `0x4557D0`): puente levadizo y su control.
- `ClassAcInterfono` / `ClassAcContInterfono` (`0x4756C0`, `0x451FC0`): interfono (`MSGA_LLAMAR_INTERFONO`, `TOKEN`): al usarlo el guardia llama a otros.
Estas cuatro clases no aparecen en las 8 misiones salvo una vez cada una; se anotó solo la estructura.

## Dudas abiertas
- Puentes levadizos, compuertas e interfonos: no se leyó el cuerpo (motivo: ocurren en una sola misión cada uno y dependen de rieles/motores de la P6; las condiciones y tiempos salen de la animación y del motor de riel `MotorRail`).
- Duración en ciclos de la apertura de la barrera: es el nº de cuadros de la animación `BARR` del `.ANM` (dato, no constante del exe).
