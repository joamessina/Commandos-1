"""Sprites .BMP dentro de WAD (CARAS, cursores, texturas de agua/suelo, barras): verificacion + render.
Hallazgo [datos]: len(buf1) == h*(w+2)+1 en TODOS los .BMP (campos[0]=h, campos[1]=w, misma convencion (h,w) que los RLE).
Render con stride w+2 (hip: 2 columnas de relleno por fila + 1 byte final).
uso: py -I tools/bmp_sprite_check.py <carpeta DATOS extraida> <carpeta map_mp con Fase000N.WAD> [png_salida] [WAD_a_renderizar]
"""
import glob, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wad_check as W
import wad_render as R

datos, mapmp = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(datos + '/**/*.WAD', recursive=True)) + sorted(glob.glob(mapmp + '/*.WAD'))
n = ok = 0
for f in files:
    pals, sp, _ = W.parse(open(f, 'rb').read())
    for s in sp:
        if s['name'].upper().endswith('.BMP'):
            n += 1
            h, w = s['w'], s['h']  # wad_check llama w a campos[0]: aqui es la ALTURA
            ok += len(s['b1']) == h * (w + 2) + 1 and s['flag'] == 0 and not s['b2']
print(f'.BMP en WAD: {n}, cumplen len==h*(w+2)+1, flag=0, sin buf2: {ok}')
assert n == ok, 'hay .BMP que no cumplen'
if len(sys.argv) > 4:
    f = [x for x in files if x.upper().endswith(sys.argv[4].upper())][0]
    pals, sp, _ = W.parse(open(f, 'rb').read())
    items = []
    for s in sp:
        if s['name'].upper().endswith('.BMP'):
            h, w = s['w'], s['h']; pal = pals[s['cola']][0] if s['cola'] < len(pals) else b'\0' * 512
            rows = []
            for y in range(h):
                rows.append([R.rgb565(struct.unpack_from('<H', pal, v * 2)[0]) + (255,) for v in s['b1'][y * (w + 2):y * (w + 2) + w]])
            items.append((w, h, rows))
    cw, ch = max(i[0] for i in items) + 4, max(i[1] for i in items) + 4
    cols = min(len(items), 8); nr = (len(items) + cols - 1) // cols
    W_, H_ = cols * cw, nr * ch
    img = [(90, 90, 90, 255)] * (W_ * H_)
    for i, (w, h, rows) in enumerate(items):
        ox, oy = (i % cols) * cw + 2, (i // cols) * ch + 2
        for y, row in enumerate(rows):
            for x, px in enumerate(row): img[(oy + y) * W_ + ox + x] = px
    R.png(sys.argv[3], W_, H_, img)
    print(len(items), 'bmps ->', sys.argv[3], W_, 'x', H_)
