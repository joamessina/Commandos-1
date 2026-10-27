# Traspaso desde el proyecto Commandos 2

Lo que se aprendió en `D:\Joaquin\commandos2-web` y sirve para Commandos 1. Los **formatos** de C2 no sirven (otro motor); el **método**, las herramientas y las lecciones sí. Los docs de C2 (`docs/formats`, `docs/engine`) son útiles como mapa de qué preguntas hacerle al exe de C1.

## 1. Método que funcionó (en este orden)
1. **Contenedor de datos**: decodificar `WAR_MP.DIR` (índice, nombres, offsets, compresión) y extraer todo a `D:\Joaquin\research-c1\x` con un script propio (modelo: `tools/from-c2/extract.py`). Verificar contra el total de bytes del archivo, no solo contra el conteo de entradas.
2. **Catálogo de tipos**: listar extensiones/magias y tamaños; agrupar por familia (gráficos, mapas, scripts, sonido). Documentar cada formato en `docs/formats/<x>.md` con evidencia (ejemplos en hex, ecuación de tamaño que cierra, % de archivos que parsean).
3. **Exe en Ghidra** (`tools/from-c2/run_import.cmd`, `decompall.cmd`, `DecompAll.java`): importar `coman_mp.exe`, decompilar todo a `all/fn_<dir>.c`, indexar en un pickle (`fn_index.pkl`) y buscar por cadena/subcadena (`fn.py find`). Para C++ con RTTI: `ExportVtables.java` + `rtti.py` dan clases y vtables (puede no haber RTTI en un exe de 1998: comprobarlo primero con `strings`).
4. **Leer el exe para cada comportamiento** (movimiento, IA, visión, daño, ruido, objetos) y escribirlo en `docs/engine/<x>.md` con direcciones. Tablas de datos del exe se vuelcan con `exed.py` (`read/u32/f32/cstr` sobre la copia en D:).
5. **Verdad terreno dinámica** (último, si hace falta): medir el original corriendo por lectura de memoria (`sample_game.py`) para confirmar números deducidos.
6. Recién entonces: parser en TS (TDD) → motor → render → UI.

## 2. Lecciones concretas
- Los strings del exe se buscan por **subcadena** (pueden venir con bytes pegados delante).
- Un formato en pre-orden con marcadores de fin se confunde con listas de hijos: un parser puede dar totales correctos y rutas mal. Verificar estructura al byte en TODOS los archivos reales.
- Las constantes de juego suelen estar en archivos de parámetros del propio juego (en C2: `PARGLOBAL.DAT`) y tablas del exe; buscarlas ahí antes de estimar.
- Tabla de switch decompilada con etiquetas "flotantes" denormales: dividir por 1,4013e-45 para recuperar el entero (`sw.py`).
- Para port 1:1 de movimiento: velocidad, giro, aceleración, ritmo de animación y duración de transiciones salen del código, no se ajustan a ojo. En C2 se descubrió tarde que el port usaba una velocidad única inventada (90 u/s) para todos.
- Documentar lo NO leído (`tasks/investigacion-pendiente.md`) además de lo leído; en C2 una afirmación falsa de "no se lee" costó una auditoría.
- Visor/explorador no es juego: aclarar siempre qué se puede hacer hoy en `npm run dev`.
- Probar en Chrome (extensión Claude in Chrome, `http://localhost:5173/`) con un hook `window.__game` para inspección.

## 3. Reglas de ingeniería (de C2, adoptar en el scaffold)
- Capas `src/formats` (bytes→datos, puro) → `src/engine` (lógica, sin DOM) → `src/render` → `src/app`; dependencias solo hacia la derecha.
- TDD; parsers tratan la entrada como no confiable; `npm run check:fast|task|full`; Vite + Vitest + ESLint + Stryker + dep-cruiser + size-limit (config en `D:\Joaquin\commandos2-web`, copiable). Ver `CONSTRAINTS.from-c2.md`.
- `GAME_DIR` en `.env.local` solo para desarrollo; el build no hace `fetch` de archivos del juego.
- SPEC.md §8.6 de C2: se analiza el exe solo para identificar algoritmos y datos; sin copiar código; los desensamblados quedan fuera del repo.

## 4. Qué reutilizar tal cual del repo de C2
`package.json`/configs (Vite, Vitest, ESLint, Stryker, tsconfig, dependency-cruiser), `CONSTRAINTS.md`, estructura de `tasks/` (plan, todo, micro-tareas), `src/formats/pck.ts` solo como ejemplo de lector con TDD. No copiar `src/engine` ni `src/formats` de C2 salvo utilidades genéricas.

## 5. Primeros pasos sugeridos para C1
1. `strings`/pefile sobre `coman_mp.exe`: ¿RTTI? ¿DirectDraw/DirectSound? ¿nombres de archivo de datos?
2. Abrir `WAR_MP.DIR` en hex: cabecera, tabla de entradas; comparar con `Legacy\WAR_MP.DIR`.
3. Importar el exe en Ghidra (en D:, no escribir en la carpeta del juego) y decompilar todo.
4. Armar `docs/COVERAGE.md` (qué formatos están leídos) y `tasks/research.md` (plan de lectura) antes de escribir código del motor.
5. Crear el scaffold TS copiando los configs de C2.

## 6. Datos de C2 que probablemente se repiten en C1 (hipótesis, no hechos)
Comandos con habilidades propias, vista en cono con rangos, alerta/calma de los soldados, ruido de acciones, cuerpos que llaman la atención, vehículos, mochila/objetos. En C1 la lógica está en el exe y en scripts/mapas: confirmar todo leyendo, nada se da por sentado.
