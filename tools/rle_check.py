"""Verifica el formato RLE de C1 contra todos los .RLE reales.
Formato (confirmado en el exe, blitter FUN_00659c80, y contra los 88 archivos):
  BMP 8 bpp con biCompression=4; paleta SIEMPRE 256x4 B (ignora biClrUsed) en 54..1078;
  tag[4] libre, u32 w, u32 h, u32 fila_off[h] (relativo al inicio de datos), datos.
  Fila: FF n = n transparentes | FE n + n bytes = n píxeles mezclados 50% con el fondo
        | n<FE + n bytes = n píxeles opacos.
uso: py -I tools/rle_check.py <carpeta con DATOS extraído>
"""
import collections, glob, struct, sys

PAL, TAG = 54, 54 + 1024


def decode(b):
    """-> (w, h, paleta_bgra, filas, ops); fila = lista de (modo, indice): modo 0 opaco, 1 mezcla 50%; None = transparente."""
    assert b[:2] == b'BM' and struct.unpack_from('<I', b, 30)[0] == 4, 'no es RLE de C1'
    off = struct.unpack_from('<I', b, 10)[0]
    w, h = struct.unpack_from('<ii', b, 18)
    assert (w, h) == struct.unpack_from('<II', b, TAG + 4) and w > 0 and h > 0
    assert off == TAG + 12 + 4 * h, 'la tabla de filas no termina en el inicio de datos'
    tabla = struct.unpack_from(f'<{h}I', b, TAG + 12)
    data = b[off:]
    ops, filas = collections.Counter(), []
    for y in range(h):
        p, fin, fila = tabla[y], (tabla[y + 1] if y + 1 < h else len(data)), []
        while p < fin:
            op = data[p]
            if op == 0xFF:
                n = data[p + 1]; fila += [None] * n; p += 2; ops['skip'] += 1
            else:
                blend = op == 0xFE
                n = data[p + 1] if blend else op
                p += 2 if blend else 1
                assert p + n <= fin, f'fila {y}: literal pasa del fin'
                fila += [(int(blend), v) for v in data[p:p + n]]; p += n
                ops['blend' if blend else 'opaque'] += 1
        assert p == fin and len(fila) == w, f'fila {y}: {len(fila)} px de {w}'
        filas.append(fila)
    return w, h, b[PAL:PAL + 1024], filas, ops


if __name__ == '__main__':
    ok = bad = 0
    tot = collections.Counter()
    for f in sorted(glob.glob(sys.argv[1] + '/**/*.RLE', recursive=True)):
        try:
            tot += decode(open(f, 'rb').read())[4]; ok += 1
        except Exception as e:
            bad += 1; print('FALLA', f.split('DATOS')[-1], e)
    print('ok', ok, 'mal', bad, 'ops', dict(tot))
