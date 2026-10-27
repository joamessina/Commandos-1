# Atribución de TODAS las funciones del exe a subsistemas

37,026 funciones, 2,787,187 bytes de código. Método y límites: `tools/exe_classify.py`. **Atribuir no es leer**: sirve para saber a qué parte del juego pertenece cada función y qué queda sin dueño.

| Subsistema | Funciones | Bytes | % código | rtti | api/nombre | llamadores | contigüidad |
|---|---:|---:|---:|---:|---:|---:|---:|
| SIN ATRIBUIR | 10,093 | 777,362 | 27.9 | 0 | 0 | 0 | 0 |
| Acciones de objetos/enemigos (ClassAc*, ctorAccion*) | 4,973 | 610,748 | 21.9 | 1312 | 0 | 1352 | 2309 |
| Editor interno | 2,382 | 246,680 | 8.9 | 918 | 0 | 653 | 811 |
| CRT / librería (nombre conocido) | 1,828 | 207,243 | 7.4 | 0 | 1219 | 110 | 499 |
| Compilador: desenrollado de excepciones (SEH) | 9,522 | 168,250 | 6.0 | 0 | 7537 | 18 | 1967 |
| Acciones del jugador (ClassAU*) | 1,228 | 100,797 | 3.6 | 617 | 0 | 323 | 288 |
| Motores | 787 | 99,875 | 3.6 | 302 | 0 | 259 | 226 |
| Interfaz / HUD / controles | 694 | 78,640 | 2.8 | 161 | 0 | 144 | 389 |
| Menús y front-end | 923 | 74,149 | 2.7 | 389 | 0 | 201 | 333 |
| Simulación / bichos | 871 | 68,671 | 2.5 | 463 | 0 | 174 | 234 |
| Misión / intendencia / puntuación | 558 | 64,122 | 2.3 | 219 | 0 | 141 | 198 |
| Cámara / zonas de selección | 573 | 61,722 | 2.2 | 148 | 0 | 124 | 301 |
| Núcleo del motor | 319 | 56,592 | 2.0 | 73 | 0 | 42 | 204 |
| Partículas / efectos / paleta | 323 | 39,672 | 1.4 | 69 | 0 | 57 | 197 |
| Render / dibujo / vídeo | 330 | 23,663 | 0.8 | 137 | 0 | 32 | 161 |
| Red / multijugador | 266 | 19,223 | 0.7 | 106 | 20 | 39 | 101 |
| Sonido | 296 | 17,324 | 0.6 | 111 | 38 | 11 | 136 |
| Órganos (vista, oído, memoria) | 120 | 12,521 | 0.4 | 44 | 0 | 33 | 43 |
| Librería estándar C++ (std) | 236 | 11,576 | 0.4 | 100 | 0 | 30 | 106 |
| Impacto / daño / explosiones | 136 | 10,642 | 0.4 | 68 | 0 | 47 | 21 |
| Ventanas / mensajes Windows | 37 | 8,021 | 0.3 | 0 | 29 | 6 | 2 |
| Pathfinding / búsqueda | 73 | 7,666 | 0.3 | 21 | 0 | 16 | 36 |
| Otras clases | 84 | 7,631 | 0.3 | 44 | 0 | 26 | 14 |
| Guardado / carga de partidas | 51 | 3,853 | 0.1 | 15 | 0 | 5 | 31 |
| Órganos (editables) — ctorOrgano* | 132 | 3,802 | 0.1 | 75 | 0 | 50 | 7 |
| Colisión (Parachoques) | 174 | 3,620 | 0.1 | 147 | 0 | 20 | 7 |
| Archivos / E-S | 17 | 3,122 | 0.1 | 0 | 13 | 4 | 0 |

**Sin atribuir:** 10,093 funciones, 777,362 bytes (27.9 % del código).