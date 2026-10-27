# CONSTRAINTS

Contrato de calidad de `commandos2-web`. Lo leen las personas y los agentes. **Nunca se afloja para que un cambio pase**: si una regla estorba, se discute acá, con motivo y fecha, no se silencia en el código.

Última medición: 2026-10-15. Falla un check a mitad de tarea → **se bloquea** y se arregla antes de seguir.

## Piso (siempre, sin números)

| Regla | Comando | Por qué |
|---|---|---|
| TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | `tsc --noEmit` | Los parsers de binarios viven de índices y `undefined`; que el compilador los marque. |
| ESLint `strictTypeChecked`, 0 warnings, **sin `eslint-disable`** (`noInlineConfig`) | `eslint . --max-warnings 0` | Un warning tolerado se vuelve ruido; una regla silenciada se vuelve deuda invisible. |
| Cero secretos (siempre `--redact`) | `gitleaks dir . --redact --no-banner --config .gitleaks.toml` | El repo será público; no debe filtrar claves ni rutas privadas. |
| Cero tests `.only` | `vitest` con `allowOnly: false` | Un `.only` olvidado oculta fallos. |
| Prohibido en el diff: `@ts-ignore`, `@ts-expect-error` sin motivo, `.skip`, `.todo`, tests borrados, stubs sin implementar, umbrales bajados | `/constraints guard` | Es la forma habitual de "poner verde" sin arreglar. |
| **Nunca se versionan ni se redistribuyen archivos del juego** (`*.pck`, `*.Y64`, `*.pop`, assets extraídos) | `.gitignore` + revisión | El jugador aporta sus propios archivos; el repo solo contiene código. |

## Números exigidos

| Métrica | Umbral | Comando | Por qué ese número |
|---|---|---|---|
| Cobertura (líneas, ramas, funciones, sentencias) en `src/formats` y `src/engine` | **≥ 90 %** | `vitest run --coverage` | Es lógica pura (bytes → datos). Hoy 100 %; 90 deja margen sin permitir ramas sin probar. `src/render` (WebGL) queda fuera: no se prueba bien con unit tests. |
| Mutación (calidad de las aserciones) en `src/formats` y `src/engine` | **rompe < 85 %**, advierte < 90 % | `stryker run` | Hoy 97,67 %; los 3 mutantes vivos son comparaciones de borde equivalentes (`<=` vs `<` con igual resultado). El piso de 85 admite ~5 % de equivalentes en código nuevo sin aceptar tests flojos. Incremental (`reports/stryker-incremental.json`): solo re-prueba lo cambiado. |
| Peso del bundle de entrada | **≤ 350 kB gzip** | `size-limit` | three.js ≈ 180 kB gzip + motor ≈ 170 kB de margen. Hoy 708 B porque todavía no entra three; bajar el límite cuando exista el bundle real. |
| Dependencias sin vulnerabilidades conocidas | **0** (dev incluidas) | `osv-scanner scan source --lockfile package-lock.json` | Parsear archivos binarios no confiables en el navegador: la cadena de suministro es parte del riesgo. |
| Análisis estático de seguridad | **0 hallazgos** | `semgrep scan --config p/typescript --metrics=off --error --quiet src` | Detecta patrones inseguros (`eval`, regex catastróficas, etc.) sin escribir reglas propias. |
| Dependencias entre módulos | **0 violaciones** | `depcruise src --config .dependency-cruiser.cjs` | `formats` solo entiende bytes; `engine` no conoce WebGL/DOM (corre en tests y workers); sin ciclos. |
| Entrada no confiable | Todo parser **debe** probar: magia inválida, archivo truncado, offsets fuera de rango, estructuras sin cerrar, anidamiento/tamaños exagerados | (tests del parser) | Un archivo malicioso no puede colgar la pestaña, gastar memoria ni leer fuera del buffer. |
| Verificación contra archivos reales | Todo formato nuevo se comprueba además contra la instalación del juego (conteos, invariantes, **estructura**, no solo "no explota") | `npm run verify:real` (hecho en T2; `GAME_DIR` apunta a la carpeta del juego, falla si falta; no entra en `check:*` porque requiere el juego instalado) | El primer lector de PCK pasó 10 tests y 100 % de cobertura **con el árbol de directorios mal**: los tests sintéticos reproducían mi suposición equivocada. Solo los datos reales la desmintieron. |
| Tests y fixtures | Solo bytes **sintéticos** armados a mano; ningún byte extraído del juego entra al repo | revisión + `/constraints guard` | Evita redistribuir material con copyright. |

## Dónde corre cada cosa (por costo)

| Etapa | Comando | Contenido | Hoy | Tope |
|---|---|---|---|---|
| Mientras se edita | `npm run check:fast` | tipos, lint, secretos | 3 s | 15 s |
| Al terminar la tarea | `npm run check:task` | fast + arquitectura + tests con cobertura | 5 s | 90 s |
| Revisión / antes de integrar | `npm run check:full` | task + bundle + semgrep + osv + mutación | 19 s | sin tope (es CI) |

Atajo conocido: `check:task` corre **toda** la suite, no solo lo tocado (`shortcut: suite completa, pasar a vitest --changed cuando check:task supere 60 s`).

## Medido, no exigido (se vigila, no bloquea)

| Métrica | Hoy (2026-10-15) | Nota |
|---|---|---|
| Tests | 20 | |
| Cobertura | 100 % (57/57 sentencias, 43/43 ramas) | |
| Mutación | 97,67 % (125 muertos, 1 timeout, 3 vivos de 129) | Vivos = bordes equivalentes. |
| Bundle | 693 B | Sube cuando entre three. |
| Mutación (2026-10-21, `stryker run --force`, 32 archivos) | **88,17 %** global | Sobre el piso de 85 %. Por archivo de `src/engine`: `weapons` 99 %, `world` 94 %, `raster` 93 %, `behavior` 92 %, `grip` 89 %, `nav` 79 %, `pose` 78 % (los dos últimos con muchos mutantes equivalentes: bucles `<` / `<=` sobre listas con relleno, valores por defecto de `?? ` que nunca se usan). **Con `incremental` Stryker no vuelve a probar los mutantes estáticos (las tablas de datos); usar `--force` para medir de verdad.** |
| Lectura de tabla real (`DATA.PCK`, 4805 archivos) | 12 ms en caliente | El primer acceso a H: tras un rato puede tardar ~20 s (disco/antivirus), no es el parser. |

`/constraints ratchet` registra estos valores como piso que no puede bajar.

## Dimensiones descartadas (con motivo)

| Dimensión | Motivo | Se retoma cuando |
|---|---|---|
| Accesibilidad (axe-core), Core Web Vitals (Lighthouse), FPS | No hay una URL ni una escena corriendo; inventar un check sería una aspiración sin herramienta real. | Exista el visor/escena jugable. Hasta entonces, no se declara. |
| CI en GitHub Actions | No hay remoto todavía. Los mismos tres scripts se enchufan tal cual. | Se cree el repositorio remoto. |
| `tools/` (scripts de investigación) | Se descartan al terminar de descifrar cada formato; ESLint los ignora. Lo valioso queda en `docs/formats/` y en los parsers con tests. | Nunca: no es código de producción. |

## Excepciones

| # | Excepción | Motivo | Responsable | Vence |
|---|---|---|---|---|
| 1 | `vitest` y `@vitest/coverage-v8` fijados en **4.1.12** + `.npmrc` con `legacy-peer-deps=true` | `@stryker-mutator/vitest-runner` 10.0.0 revienta con Vitest 5.0.5 (`Converting circular structure to JSON` en `VitestTestRunner.init`, y lo disfrazaba como "0 mutantes muertos"). Con Vitest 4 npm falla con `edgesOut` salvo `legacy-peer-deps`. | Joaquín | **2026-12-15**: reintentar Vitest 5 si Stryker publicó un arreglo y quitar `.npmrc`. |
| 2 | `overrides: { qs: ^6.16.0 }` | `qs` 6.15.1 llega transitivo por Stryker (solo dev) con 3 avisos GHSA (CVSS 6.3). | Joaquín | Cuando Stryker actualice `typed-rest-client`; quitar el override. |

## Instalación de herramientas (esta PC)

- `gitleaks` 8.30.1 y `osv-scanner` 2.7.0: binarios en `D:\Joaquin\tools\bin` (checksums SHA256 verificados), en el PATH de usuario.
- `semgrep` 1.181.0: `pip install --user semgrep` (Windows nativo); necesita `PYTHONUTF8=1`. Scripts en `%APPDATA%\Python\Python312\Scripts`.
- Terminales nuevas heredan el PATH; en una sesión abierta antes del cambio hay que reiniciarla.

## Para agentes

Leer este archivo antes de tocar código. Si un cambio no pasa un check: arreglar el código, **no** el check. Para cambiar una regla, agregar una fila en "Excepciones" con responsable y fecha, y avisar a Joaquín.
