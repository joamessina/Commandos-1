# Usar gemini-cli como lector de apoyo (2026-10-30)

Sirve para **leer en bloque** código decompilado y devolver resúmenes con líneas citadas; no decide reglas ni escribe código del repo. Todo dato que devuelva se verifica contra el decompilado antes de usarlo (la primera consulta, sobre el sensor de sonido por zona, salió correcta: `docs/lectura/sonido.md`, Cierre 2026-10-30).

- Instalado: `@google/gemini-cli` 0.66.0 (global, npm). Autenticación: **clave de API** (`GEMINI_API_KEY`, la cargó Joaquín); "Sign in with Google" ya no sirve para cuentas personales.
- Modelos: el por defecto da 503 por demanda; `gemini-2.5-flash` ya no está para cuentas nuevas; **`gemini-3.5-flash` funcionó**. Si falla, probar `gemini-3-flash-preview` o `gemini-3.1-flash-lite`.
- Forma de uso (sin tocar el repo): armar un recorte del decompilado (`sed -n a,bp archivo`) con marcas "##### ORIGEN: archivo, líneas" y una consulta con reglas ("citá función y línea; si no se puede determinar escribí NO FIGURA EN EL MATERIAL"), y mandarlo por entrada estándar: `cat consulta.txt recorte.c | gemini -m gemini-3.5-flash -p "Respondé la CONSULTA ..." > salida.txt` (en segundo plano: puede tardar y reintentar).
- Recortes chicos (≈30 KB) bastan; los `fn_*.c` enteros pesan ~1 MB.
- Privacidad: el recorte sale a servidores de Google (código decompilado de un juego con copyright); en el plan gratuito de la API Google puede usar los datos. Mandar solo lo necesario y nunca nada fuera de `research-c1/ghidra`.
