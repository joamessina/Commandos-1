"""Busca posibles escritores indirectos del bit OCLU en el C exportado de Ghidra.

Es una búsqueda de candidatos: alias, punteros y tipos reconstruidos requieren lectura manual.
"""
import pathlib
import re

raiz = pathlib.Path('D:/Joaquin/research-c1/ghidra/all')
cabecera = re.compile(r'^//// ([0-9a-f]+) (\S+)', re.M)
puntero = re.compile(r'(\w+)\s*=\s*\(uint \*\)\([^;\n]*\+ 0x23c\);\s*\*\1\s*=\s*\*\1\s*([|&])\s*(0x[0-9a-f]+|\d+)\s*;')
directa = re.compile(r'(?:\+ 0x23c\)|\[0x8f\])\s*=\s*[^;\n]*?([|&])\s*(0x[0-9a-f]+|\d+)\s*;')
asignacion = re.compile(r'^\s*(\w+)\s*=\s*(.*);\s*$')
modificacion = re.compile(r'^\s*\*(\w+)\s*=\s*\*\1\s*([|&])\s*(0x[0-9a-f]+|\d+)\s*;')
for archivo in sorted(raiz.glob('fn_*.c')):
    texto = archivo.read_text(encoding='utf-8', errors='replace')
    marcas = list(cabecera.finditer(texto))
    linea_inicio = 1
    posicion = 0
    for indice, marca in enumerate(marcas):
        linea_inicio += texto.count('\n', posicion, marca.start())
        posicion = marca.start()
        cuerpo = texto[marca.start():marcas[indice + 1].start() if indice + 1 < len(marcas) else len(texto)]
        for patron in (puntero, directa):
            for match in patron.finditer(cuerpo):
                operacion, valor = match.group(match.lastindex - 1), int(match.group(match.lastindex), 0)
                if (operacion == '|' and valor & 2) or (operacion == '&' and not valor & 2):
                    linea = linea_inicio + cuerpo.count('\n', 0, match.start())
                    print(archivo.name, linea, marca.group(1), marca.group(2), re.sub(r'\s+', ' ', match.group(0)))
        alias = set()
        for numero, linea in enumerate(cuerpo.splitlines(), linea_inicio):
            asignada = asignacion.match(linea)
            if asignada:
                nombre, expresion = asignada.groups()
                if '+ 0x23c)' in expresion and '*' in expresion:
                    alias.add(nombre)
                else:
                    alias.discard(nombre)
            cambio = modificacion.match(linea)
            if cambio and cambio.group(1) in alias:
                operador, valor = cambio.group(2), int(cambio.group(3), 0)
                if (operador == '|' and valor & 2) or (operador == '&' and not valor & 2):
                    print('ALIAS', archivo.name, numero, marca.group(1), marca.group(2), linea.strip())
