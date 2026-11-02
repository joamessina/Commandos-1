# Pantalla de carga y altura de disparos (2026-11-02)

## Pantalla de carga

`FUN_005C64B0` (`fn_005c0000.c:2845–2901`) dibuja `LOAD0002.RLE` y prepara la barra `LOAD0001.RLE`; la carga de misión también usa la variante `LOAD0003.RLE` al guardar (`FUN_005C0500`). `FUN_006EC8E0` (`fn_006c0000.c:26286–26542`) dibuja el fondo `LOAD0000.RLE` centrado, con el texto centrado y desplazado 5 px; la barra arranca a `(fondoX + anchoFondo − 281, fondoY + altoFondo − 38)`. `FUN_00506010` actualiza el ancho de la barra y lo alinea a múltiplos de 16.

Los archivos reales están en `DATOS/RECURSOS/BMPS/SYSTEM/MISC/`. `LOAD0000` mide 313×212 y contiene al boina verde y el marco; `LOAD0001` es la barra de 264×23; `LOAD0002` es el texto de carga de 282×31. Son BMP de 8 bits con compresión propia 4, no BMP estándar: `FUN_00647BA0` carga cabecera, paleta y datos, y `FUN_00646530` separa la tabla de filas de la paleta. El port muestra esos recursos y mantiene la pantalla durante la preparación del video; sus porcentajes representan etapas propias de carga y no pretenden reproducir cada incremento del exe.

## Armas, distancia y trayectoria

- El arpón usa alcance **200** (`FUN_00678180/006781C0`, `fn_00640000.c:37300–37320`, constante `0x794CF8`). Para apuntar a un bicho, `FUN_00677560` arma posiciones con `FUN_006760C0` y compara **dx² + dy² + dz²** con `(alcance + 0,1)²`; el asm `0x6775C5–0x67762E` confirma las tres componentes, que el decompilado oculta. Las posiciones incluyen la altura de ojo `bicho+0x58` (`0x6760CB–0x6760E9`).
- Para un punto del suelo `FUN_00677710` (`0x67774D–0x677799`) compara únicamente dx² + dy² con alcance², pero después verifica la trayectoria 3D hasta el punto.
- Ambas pruebas llaman a `FUN_006771A0` (`fn_00640000.c:36948–37004`): comprueba el rayo entre alturas contra sectores (`FUN_005F9820`), volúmenes (`FUN_0063E820`) y cuerpos. Los wrappers de pistola, mirilla y arpón usan la misma familia de pruebas, con su alcance respectivo. `FUN_004F1A50` termina una orden de disparo cuya prueba falla; no manda al comando a acercarse (`armas-restantes.md` §0).
- El port ahora usa el alcance 3D contra personas, comprueba altura del rayo al cruzar sectores y rechaza el disparo si no se puede hacer. En M0 se comprobó un caso real desde altura 0 a un soldado en altura 65: el borde del muelle bloqueó el disparo. **Límites:** el recorrido de sectores usa `Nav.sight` y la comprobación de oclusión existente; faltan el trazado original de volúmenes y la búsqueda del primer cuerpo interpuesto. Pueden quedar discrepancias con edificios, objetos y casos de borde.
