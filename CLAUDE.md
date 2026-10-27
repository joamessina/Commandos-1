# commandos1-web

Port al navegador de **Commandos: Beyond the Call of Duty** (Commandos 1, 1998–99, Pyro Studios/Eidos), por ingeniería inversa. El jugador carga SUS archivos; el repo nunca contiene assets.

**Antes de hacer nada, leé `docs/traspaso-desde-commandos2.md`**: resume el método, las reglas del usuario y las lecciones del proyecto hermano (Commandos 2, `D:\Joaquin\commandos2-web`, ~35 docs de formatos y motor).

## Reglas del usuario (Joaquín; español rioplatense, directo)
1. **Nada inventado.** Todo comportamiento, UI, IA, animación y velocidad sale de los archivos o del exe del juego. Si falta el dato: leer el exe/datos antes de escribir código. Un atajo se marca `shortcut: <límite>, <cuándo mejorar>`.
2. **Primero investigar, después implementar.** No subir nada al navegador hasta entender el formato/la regla (orden explícito en C2).
3. **Acción rápida y autónoma**: comandos de lectura/diagnóstico sin pedir permiso. Acciones destructivas: avisar.
4. Commits locales permitidos (el git "real" lo arma él después). Terminar con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
5. Verificar siempre contra los archivos reales, no solo con tests sintéticos (un parser puede dar totales correctos con estructura mala).
6. `CONSTRAINTS.from-c2.md` = las reglas de calidad del proyecto hermano; adoptarlas al armar el scaffold, sin debilitarlas.

## El juego
- Instalado en `D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty` (Steam). **Solo lectura**, nunca escribir ahí.
- `coman_mp.exe` (4,5 MB) = ejecutable principal de la raíz (Steam, `steam_api.dll`). `WAR_MP.DIR` (66 MB) = archivo de datos único. `Legacy\` trae otra copia (`WAR_MP.DIR` 65 MB, `Tutorial.exe`, `TestApp.exe`, `MPLAYER\`): comparar antes de asumir que son iguales; tomar como referencia el de la raíz.
- Carpeta suelta: `DATOS\{musica,rolling,recursos\bmps,brief_mp}` (wav, `.ROL`, bmps), `VIDEO\*.avi`, `OUTPUT\*.cfg`.
- Es un juego 2D isométrico de 1998 (DirectDraw, 8/16 bits): se espera un formato muy distinto al de C2 (que es 3D + `.Y64` prerenderizado). No asumir nada de los formatos de C2; sí el método.

## Disco y herramientas
- Trabajo de investigación en `D:\Joaquin\research-c1` (extracciones, decompilado, JSON). Ghidra ya instalado: `D:\Joaquin\tools\ghidra_12.1.4_PUBLIC` (JDK 21). Python con `py` (no existe `python` en Git Bash); capstone y pefile instalados con pip --user.
- Scripts reutilizables copiados de C2 en `tools/from-c2/` (rutas de C2 escritas dentro: adaptar las constantes `EXE`/`D:\Joaquin\research`).
- Windows, Git Bash: heredocs con `\` se rompen → usar Write/Edit; `cat > archivo` sin heredoc cuelga.
- Si en el futuro se mide el juego en vivo: `tools/from-c2/sample_game.py` (ReadProcessMemory, solo lectura) como plantilla.
