"""Renderiza sprites de un WAD de C1 a una hoja PNG (sin dependencias) para verificar a ojo.
uso: py -I tools/wad_render.py <archivo.WAD> <salida.png> [max_sprites=48] [columnas=8]
Fondo gris; opaco = índice->RGB565 de la paleta del sprite; FE (mezcla 50%) = negro con alfa 50%.
"""
import struct, sys, zlib
sys.path.insert(0, __file__.rsplit('tools', 1)[0] + 'tools')
import wad_check as W


def rgb565(c):
    return ((c >> 11 & 31) * 255 // 31, (c >> 5 & 63) * 255 // 63, (c & 31) * 255 // 31)


def sprite_pixels(s, pal):
    """-> filas de (r,g,b,a) ; solo sprites RLE (con b2)."""
    w, h = struct.unpack_from('<II', s['b2'], 4)
    t = struct.unpack_from(f'<{h}I', s['b2'], 12)
    b1, rows = s['b1'], []
    for y in range(h):
        p, fin, row = t[y], (t[y + 1] if y + 1 < h else len(b1)), []
        while p < fin:
            op = b1[p]
            if op == 0xFF:
                row += [(0, 0, 0, 0)] * b1[p + 1]; p += 2
            else:
                blend = op == 0xFE
                n = b1[p + 1] if blend else op
                p += 2 if blend else 1
                for v in b1[p:p + n]:
                    r, g, b = rgb565(struct.unpack_from('<H', pal, v * 2)[0])
                    row.append((0, 0, 0, 128) if blend else (r, g, b, 255))
                p += n
        rows.append(row)
    return w, h, rows


def png(path, w, h, rgba):
    raw = b''.join(b'\0' + bytes(c for px in rgba[y * w:(y + 1) * w] for c in px) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) +
                           chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    pals, sp, _ = W.parse(open(sys.argv[1], 'rb').read())
    nmax, cols = int(sys.argv[3]) if len(sys.argv) > 3 else 48, int(sys.argv[4]) if len(sys.argv) > 4 else 8
    items = [(s, sprite_pixels(s, pals[s['cola']][0])) for s in sp if s['b2']][:nmax]
    cw = max(w for _, (w, h, r) in items) + 4; ch = max(h for _, (w, h, r) in items) + 4
    nr = (len(items) + cols - 1) // cols
    W_, H_ = cols * cw, nr * ch
    img = [(90, 90, 90, 255)] * (W_ * H_)
    for i, (s, (w, h, rows)) in enumerate(items):
        ox, oy = (i % cols) * cw + 2, (i // cols) * ch + 2
        for y, row in enumerate(rows):
            for x, (r, g, b, a) in enumerate(row):
                if a:
                    bg = img[(oy + y) * W_ + ox + x]
                    img[(oy + y) * W_ + ox + x] = (r, g, b, 255) if a == 255 else tuple(bg[k] * (255 - a) // 255 for k in range(3)) + (255,)
    png(sys.argv[2], W_, H_, img)
    print(len(items), 'sprites ->', sys.argv[2], W_, 'x', H_)
