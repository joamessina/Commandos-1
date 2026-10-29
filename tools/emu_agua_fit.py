"""Verifica los modelos del agua (tipo 2 y tipo 1) contra la emulacion de FUN_006491E0 (exe de la raiz).
uso: py tools/emu_agua_fit.py   (SIN -I: unicorn/pefile estan en el sitio de usuario). Solo lectura del exe.
Los modelos son los que porta src/render/water.ts."""
import sys
sys.path.insert(0, 'tools')
from emu_agua import run, tablas

S8, S32 = tablas()
xs = [x for y in range(256) for x in range(256)]
ys = [y for y in range(256) for x in range(256)]


def model2(phase, ox, oy):
    """Tipo 2 (16.16 con acarreo). dst[i*258+j] = (col origen, fila origen) con origen de 256 de ancho; ox suma a la
    coordenada j, oy a la i."""
    p, a, b = int(phase * 65536), int(ox * 65536), int(oy * 65536)
    out = {}
    for i in range(256):
        for j in range(256):
            y16 = (j << 16) + S32[((p >> 16) + 2 * i) & 255] + a
            k = ((p + y16) >> 16) & 255
            out[i, j] = ((((i << 16) + S32[k] + b) >> 16) & 255, (y16 >> 16) & 255)
    return out


def model1(phase, ox, oy):
    """Tipo 1 (bytes). dst[r*258+c] = (v, u): u = fila, v = columna del origen."""
    A, B, C = int(phase), int(oy), int(ox)
    out = {}
    for r in range(256):
        for c in range(256):
            u = (C + c + S8[(A + r) & 255]) & 255
            out[r, c] = ((B + r + S8[(u + A) & 255]) & 255, u)
    return out


def malos(typ, model, phase, ox, oy):
    ex, ey = run(xs, phase, ox, oy, typ), run(ys, phase, ox, oy, typ)
    m = model(phase, ox, oy)
    return sum(1 for i in range(256) for j in range(256) if (ex[i * 258 + j], ey[i * 258 + j]) != m[i, j])


if __name__ == '__main__':
    casos = ((0.0, 0, 0), (3.4, 0, 0), (200.7, 123.4, 321.9), (77.25, -4.2, 9.9), (12345.678, 5.5, 6.6), (300.0, -7.0, 11.0))
    for typ, model in ((2, model2), (1, model1)):
        for ph, ox, oy in casos:
            print('tipo', typ, ph, ox, oy, 'pixeles distintos:', malos(typ, model, ph, ox, oy))
