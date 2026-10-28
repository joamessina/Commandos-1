"""Recorta el PNG del mapa y marca puntos. uso: py -I q1b_crop.py in.png out.png cx cy [w h] [x:y:color ...]
Marcas: cruz de 7 px; color r|g|b|y|w. Coordenadas en pixeles de mapa."""
import sys, zlib, struct

def read_png(p):
    d = open(p, 'rb').read(); pos = 8; idat = b''
    while pos < len(d):
        n, t = struct.unpack('>I4s', d[pos:pos + 8]); c = d[pos + 8:pos + 8 + n]; pos += 12 + n
        if t == b'IHDR': w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', c)
        elif t == b'IDAT': idat += c
    assert bd == 8 and il == 0 and ct in (2, 6), (bd, ct, il)
    bpp = 3 if ct == 2 else 4; st = w * bpp; raw = zlib.decompress(idat); rows = []; prev = bytearray(st); o = 0
    for _ in range(h):
        f = raw[o]; cur = bytearray(raw[o + 1:o + 1 + st]); o += 1 + st
        for i in range(st):
            a = cur[i - bpp] if i >= bpp else 0; b = prev[i]; c2 = prev[i - bpp] if i >= bpp else 0
            if f == 1: cur[i] = (cur[i] + a) & 255
            elif f == 2: cur[i] = (cur[i] + b) & 255
            elif f == 3: cur[i] = (cur[i] + ((a + b) >> 1)) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c2), abs(a - c2), abs(a + b - 2 * c2)
                cur[i] = (cur[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c2)) & 255
        rows.append(cur); prev = cur
    return w, h, bpp, rows

def write_png(p, w, h, rows):
    raw = b''.join(b'\0' + bytes(r) for r in rows)
    def ch(t, c): return struct.pack('>I', len(c)) + t + c + struct.pack('>I', zlib.crc32(t + c))
    open(p, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b''))

if __name__ == '__main__':
    W, H, bpp, rows = read_png(sys.argv[1]); cx, cy = int(sys.argv[3]), int(sys.argv[4])
    a = sys.argv[5:]; cw, ch_ = 360, 260
    if len(a) >= 2 and a[0].isdigit() and a[1].isdigit(): cw, ch_ = int(a[0]), int(a[1]); a = a[2:]
    x0, y0 = max(0, min(W - cw, cx - cw // 2)), max(0, min(H - ch_, cy - ch_ // 2))
    out = [bytearray(b''.join(bytes(rows[y][x * bpp:x * bpp + 3]) for x in range(x0, x0 + cw))) for y in range(y0, y0 + ch_)]
    col = {'r': (255, 0, 0), 'g': (0, 255, 0), 'b': (0, 128, 255), 'y': (255, 255, 0), 'w': (255, 255, 255)}
    for m in a:
        x, y, c = m.split(':')
        x, y = int(x) - x0, int(y) - y0
        for d in range(-6, 7):
            for (px, py) in ((x + d, y), (x, y + d)):
                if 0 <= px < cw and 0 <= py < ch_: out[py][px * 3:px * 3 + 3] = bytes(col[c])
    write_png(sys.argv[2], cw, ch_, out)
    print('crop', x0, y0, cw, ch_)
