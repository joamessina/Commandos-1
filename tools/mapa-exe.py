"""Genera anclas del mapa general sin copiar código ni bytes del juego.

Uso: py tools/mapa-exe.py D:/Joaquin/research-c1/ghidra/all2
"""
import argparse
from bisect import bisect_right
import hashlib
import re
from pathlib import Path


ANCLAS = [
    ("Arranque y núcleo", "005c2790", "Inicio: cámara, recursos, configuración y pantallas", "docs/lectura/render.md"),
    ("Arranque y núcleo", "005c47d0", "Ciclo general y limitador de frecuencia", "docs/exe-lectura.md"),
    ("Arranque y núcleo", "006bffe0", "Bomba de mensajes de Windows", "docs/exe-lectura.md"),
    ("Arranque y núcleo", "0062d050", "Opciones por defecto, incluido MAXFPS", "docs/exe-lectura.md"),
    ("Arranque y núcleo", "00786e60", "Inicialización de globales e ítems IT_*", "docs/exe-lectura.md"),
    ("Archivos y scripts", "005d02b0", "Carga WAD", "docs/exe-lectura.md"),
    ("Archivos y scripts", "0060ad60", "Construcción del bloque de script de misión", "docs/lectura/mision-intendencia.md"),
    ("Archivos y scripts", "0060b190", "Búsqueda de clave en un bloque de script", "docs/lectura/mision-intendencia.md"),
    ("Entidades y mensajes", "0050bf30", "Actualización de la lista de acciones del bicho", "docs/engine/ia-mensajes.md"),
    ("Entidades y mensajes", "0050bea0", "Reparto de mensajes a las acciones del bicho", "docs/engine/ia-mensajes.md"),
    ("Entidades y mensajes", "00508900", "Lectura de ACCIONES del bicho", "docs/engine/ia-mensajes.md"),
    ("Entidades y mensajes", "00649e70", "Fábrica de acciones por nombre", "docs/engine/ia-mensajes.md"),
    ("Entidades y mensajes", "006119b0", "Consulta de identificador de mensaje por nombre", "docs/engine/ia-mensajes.md"),
    ("IA y percepción", "004364a0", "AcBap: llamador del buscador de ruta", "docs/lectura/buscador.md"),
    ("IA y percepción", "006afc10", "Clasificación de lo visto", "tasks/pendientes.md"),
    ("IA y percepción", "0061c5b0", "Escaneo de Vista01", "docs/lectura/organos.md"),
    ("IA y percepción", "0061b580", "Oclusión de Vista01 por sectores y obstáculos", "docs/lectura/organos.md"),
    ("IA y percepción", "0061a830", "Mensajes de Oido01", "docs/lectura/organos.md"),
    ("IA y percepción", "006196a0", "Envejecimiento de recuerdos de Memoria01", "docs/lectura/organos.md"),
    ("Movimiento, rutas y colisión", "00447200", "Mensajes de AcBuscador", "docs/lectura/buscador.md"),
    ("Movimiento, rutas y colisión", "006283d0", "Solicitud de ruta", "docs/lectura/buscador.md"),
    ("Movimiento, rutas y colisión", "0057e950", "Pasadas de simulación de los bichos", "docs/lectura/sim-vehiculos.md"),
    ("Movimiento, rutas y colisión", "0057e6e0", "Movimiento con limitación y colisión", "docs/lectura/sim-vehiculos.md"),
    ("Movimiento, rutas y colisión", "005f17c0", "Tick del motor común de vehículo", "docs/lectura/sim-vehiculos.md"),
    ("Movimiento, rutas y colisión", "005f9820", "Recorrido de sectores para visibilidad", "docs/lectura/organos.md"),
    ("Jugador, armas y daño", "004eff40", "Carga de armas y munición desde MAC", "docs/lectura/au-disparar.md"),
    ("Jugador, armas y daño", "004f1a50", "Máquina de estados de AUDisparar", "docs/lectura/au-disparar.md"),
    ("Jugador, armas y daño", "006771a0", "Raycast de disparo", "docs/lectura/au-disparar.md"),
    ("Jugador, armas y daño", "0045f400", "Recepción de daño por energía y blindaje", "docs/lectura/impactos.md"),
    ("Jugador, armas y daño", "005986a0", "Envío de MSGA_IMPACTO a la víctima", "docs/lectura/impactos.md"),
    ("Misión, eventos y objetivos", "0059eaa0", "Tick de la intendencia base", "docs/lectura/mision-intendencia.md"),
    ("Misión, eventos y objetivos", "0059cf00", "Evaluador de fin de misión", "docs/lectura/mision-intendencia.md"),
    ("Misión, eventos y objetivos", "0059a2a0", "Despacho de eventos por tipo y slot virtual", "docs/lectura/sonido.md"),
    ("Misión, eventos y objetivos", "0059a060", "Difusión de eventos a patrullas y escuchas", "docs/lectura/sonido.md"),
    ("Misión, eventos y objetivos", "005a2760", "Reposición de grupos desde casas", "docs/lectura/mision-intendencia.md"),
    ("Render y animación", "005b7ec0", "Construcción de la matriz de cámara", "docs/lectura/render.md"),
    ("Render y animación", "00591de0", "Actualización de capas y posición gráfica del bicho", "docs/lectura/render.md"),
    ("Render y animación", "006bcda0", "Proyección del volumen a pantalla", "docs/lectura/render.md"),
    ("Render y animación", "006bced0", "Dibujo de los tiles del volumen", "docs/lectura/render.md"),
    ("Render y animación", "00659c80", "Blitter RLE con mapa de luz", "docs/exe-lectura.md"),
    ("HUD y pantallas", "0068e210", "Visibilidad de ítems en vehículo", "tasks/verificacion-exe.md"),
    ("HUD y pantallas", "006f4150", "Espejo de la mochila", "tasks/verificacion-exe.md"),
    ("HUD y pantallas", "005bf6b0", "Cambios de estado de pantallas y música", "docs/lectura/sonido.md"),
    ("Guardado y preferencias", "005c34a0", "Lectura de bloques de partida y preferencias", "docs/exe-lectura.md"),
    ("Guardado y preferencias", "0062d530", "Lectura del bloque PREFERENCES", "docs/exe-lectura.md"),
    ("Audio y ruido de IA", "00682970", "Tick de fuentes de ambiente", "docs/lectura/sonido.md"),
    ("Audio y ruido de IA", "0067f9c0", "Reproducción de sonido posicional", "docs/lectura/sonido.md"),
    ("Audio y ruido de IA", "00680530", "Consulta de la tabla de radios de ruido", "docs/lectura/sonido.md"),
    ("Audio y ruido de IA", "006ffae0", "Sensor de sonidos por zona", "docs/lectura/sonido.md"),
]


def generar(carpeta, raiz):
    patron = re.compile(r"^//// ([0-9a-f]{8}) (\S+) size (\d+)$", re.MULTILINE)
    funciones = {}
    huellas = []
    for archivo in sorted(carpeta.glob("fn_*.c")):
        datos = archivo.read_bytes()
        texto = datos.decode("utf-8", errors="replace").replace("\r\n", "\n")
        saltos = [m.start() for m in re.finditer("\n", texto)]
        huellas.append(f"{archivo.name}: {hashlib.sha256(datos).hexdigest()}")
        marcas = list(patron.finditer(texto))
        for i, marca in enumerate(marcas):
            direccion, nombre, tam = marca.groups()
            if direccion in funciones:
                raise ValueError(f"Dirección duplicada: {direccion}")
            inicio = bisect_right(saltos, marca.start()) + 1
            fin = bisect_right(saltos, marcas[i + 1].start()) if i + 1 < len(marcas) else len(saltos) + (not texto.endswith("\n"))
            funciones[direccion] = (archivo, nombre, int(tam), inicio, fin)
    if not funciones:
        raise ValueError("No hay funciones exportadas en la carpeta indicada")
    corregida = carpeta.parent / "bigfn.c"
    if corregida.exists():
        datos = corregida.read_bytes()
        texto = datos.decode("utf-8", errors="replace")
        marca = re.match(r"//// \w+ -> (\S+) @ ([0-9a-f]{8}) size (\d+)", texto)
        if not marca:
            raise ValueError("Cabecera inesperada en bigfn.c")
        nombre, direccion, tam = marca.groups()
        if direccion not in funciones:
            raise ValueError("La corrección no pertenece al inventario")
        if funciones[direccion][2] < int(tam):
            funciones[direccion] = (corregida, nombre, int(tam), 1, len(texto.splitlines()))
        huellas.append(f"{corregida.name}: {hashlib.sha256(datos).hexdigest()}")
    salida = [
        "# Mapa general del exe — funciones y líneas",
        "",
        f"Fecha: 2026-10-30. Exe de referencia: `coman_mp.exe` de la raíz; exportación local de Ghidra `{carpeta.name}`, con `bigfn.c` si está disponible.",
        "",
        f"Inventario comprobado en esta exportación: **{len(funciones):,} funciones**, **{sum(f[2] for f in funciones.values()):,} bytes** declarados por sus cabeceras. No equivale al tamaño del exe ni a cobertura de lectura semántica.",
        "",
        "Las líneas son del **C exportado por Ghidra**, numeradas desde 1; el exe binario no tiene líneas fuente. Cada fila enlaza la cabecera real, da el intervalo completo de la función y enlaza la nota previa que explica su atribución. Se comprobó existencia, dirección, nombre y tamaño de todas las anclas; eso no significa releer íntegramente todos sus cuerpos en esta tarea. Los nombres funcionales en español son descripciones nuestras, no símbolos recuperados del original.",
        "",
        "La exportación inicial `all` conserva 29.304 funciones y declara 13.395 B para `FUN_00786e60`; `all2` declara 37.808 B, igual que `bigfn.c`. **Ese tamaño no garantiza que el C represente todos sus bloques**: las escrituras de mochila en 0x78B6D0…0x78BCD1 aparecen en el ensamblador y no en ese C (ver [cierre-70.md](lectura/cierre-70.md) §2). No mezclar líneas entre exportaciones. El generador solo sustituye la entrada por `bigfn.c` si su tamaño declarado es mayor, sin contarla dos veces.",
        "",
        "## Arquitectura para orientarse",
        "",
        "El arranque prepara recursos y configuración; el núcleo coordina ciclos mediante llamadas virtuales. Las entidades reúnen acciones, órganos y simulación. Las acciones reciben mensajes; los órganos resuelven órdenes según prioridad; motores y simuladores separan intención y desplazamiento. La intendencia mantiene objetivos, eventos y patrullas. Render y audio tienen consumidores propios. Esta organización resume las lecturas enlazadas abajo; no es un grafo de llamadas completo ni prueba un orden global entre subsistemas.",
        "",
        "Lecturas de referencia: [IA y mensajes](engine/ia-mensajes.md), [simulación](lectura/sim-vehiculos.md), [intendencia](lectura/mision-intendencia.md), [render](lectura/render.md), [sonido](lectura/sonido.md).",
    ]
    grupo_anterior = None
    for grupo, direccion, descripcion, doc in ANCLAS:
        archivo, nombre, tam, inicio, fin = funciones[direccion]
        lineas_doc = (raiz / doc).read_text(encoding="utf-8").splitlines()
        coincidencias = [n for n, linea in enumerate(lineas_doc, 1) if direccion.lower() in linea.lower()]
        if not coincidencias:
            raise ValueError(f"{direccion} no figura en {doc}")
        if grupo != grupo_anterior:
            salida += ["", f"## {grupo}", "", "| Función / VA | Papel documentado | C de Ghidra (líneas; bytes) | Lectura previa |", "|---|---|---|---|"]
            grupo_anterior = grupo
        enlace = archivo.resolve().as_posix()
        doc_enlace = (raiz / doc).resolve().as_posix()
        salida.append(f"| `{nombre}` / `0x{direccion.upper()}` | {descripcion} | [{archivo.name}:{inicio}](<{enlace}:{inicio}>) · {inicio}–{fin}; {tam} B | [{Path(doc).name}:{coincidencias[0]}](<{doc_enlace}:{coincidencias[0]}>) |")
    salida += [
        "", "## Límites y zonas a investigar", "",
        "La [atribución global](exe-cobertura.md) histórica deja 10.093 funciones (27,9 % de bytes de funciones) sin dueño. Es una medición de esa clasificación, no de cuánto comportamiento falta portar. Red, editor, CRT y limpieza de excepciones aparecen allí; este mapa no les asigna funciones concretas sin lectura adicional. Tampoco cierra SAVB, el núcleo completo ni todas las reacciones de AcBap2. Consultar [pendientes](../tasks/pendientes.md) y los cierres de cada lectura: varias secciones antiguas de exe-lectura.md conservan dudas ya resueltas después.",
        "", "No se reconstruyó el entry point PE/CRT ni se verificó el flujo jugando o leyendo memoria. Una llamada virtual requiere resolver la vtable antes de afirmar qué implementación ejecuta; los thunks requieren seguir su salto. Ghidra puede omitir argumentos FPU y reconstruir mal switches. Las direcciones VA son la referencia estable; las líneas cambian al reexportar.",
        "", "## Reproducir y validar las referencias", "",
        "Desde la raíz: `py tools/mapa-exe.py D:/Joaquin/research-c1/ghidra/all2`. El generador falla si falta una función, hay direcciones repetidas o la nota citada no contiene su dirección. Solo lee la exportación y los docs; escribe este mapa. No copia cuerpos ni bytes del juego al repo.",
        "", "Huellas SHA-256 de los archivos C usados (para detectar cambios de líneas):", "",
    ]
    salida += [f"- `{huella}`" for huella in huellas]
    return "\n".join(salida) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("carpeta", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    contenido = generar(args.carpeta, repo)
    (repo / "docs/exe-mapa-general.md").write_text(contenido, encoding="utf-8")
    print(f"Mapa generado: {len(ANCLAS)} anclas verificadas")
