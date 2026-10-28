"""Parser del .VOL de mapa de C1 + composicion de la fase a PNG (verificacion visual).
Sintaxis leida en el exe (FUN_00616830/006159A0/00614040): POLY/POLYRAMPA/POINT/RADIO/EXTRAINFO/TILE/TILEID.
TILE x,y,w,h,sx,sy,g,"sprite","flags" : destino (x,y) en px de mapa, tamano (w,h), origen del recorte (sx,sy), flags X/Y/L.
uso: py -I tools/vol_render.py <MAPAnnnn.VOL> <FASEnnnn.WAD> <salida.png> [--skip-water] [--stats]
"""
import re, struct, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wad_check as W
import wad_render as R


def parse_vol(text):
    text = re.sub(r';.*', '', text)
    dim, polys, extra = None, [], []
    for line in text.splitlines():
        s = line.strip()
        if not s or s in '{}': continue
        m = re.match(r'MAPDIMXY\s+(\d+)\s*,\s*(\d+)', s)
        if m: dim = (int(m[1]), int(m[2])); continue
        m = re.match(r'POLY(RAMPA)?\s+"([^"]*)"\s*,(.*)', s)
        if m:
            n = [int(v) for v in m[3].split(',')]
            polys.append(dict(name=m[2], rampa=bool(m[1]), num=n, pts=[], tiles=[], radio=None, extrainfo=None)); continue
        m = re.match(r'POINT\s+(-?\d+)\s*,\s*(-?\d+)', s)
        if m: polys[-1]['pts'].append((int(m[1]), int(m[2]))); continue
        m = re.match(r'RADIO\s+(-?\d+)', s)
        if m: polys[-1]['radio'] = int(m[1]); continue
        m = re.match(r'EXTRAINFO\s+(.*)', s)
        if m: polys[-1]['extrainfo'] = [int(v) for v in m[1].split(',')]; continue
        m = re.match(r'TILE(ID)?\s+(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*"([^"]*)",\s*"([^"]*)"', s)
        if m:
            v = [int(x) for x in m.groups()[1:8]]
            polys[-1]['tiles'].append(dict(x=v[0], y=v[1], w=v[2], h=v[3], sx=v[4], sy=v[5], g=v[6], name=m[9], flags=m[10])); continue
        m = re.match(r'EXTRASPRITE\s+"([^"]*)"', s)
        if m: extra.append(m[1]); continue
        if s.startswith('MAPTABPOLYS'): continue
        raise ValueError('linea no reconocida: ' + s)
    return dim, polys, extra


def sprite_rgba(s, pals):
    pal = pals[s['cola']][0] if s['cola'] < len(pals) else b'\0' * 512
    if s['b2']:
        w, h, rows = R.sprite_pixels(s, pal); return w, h, rows
    h, w = s['w'], s['h']  # wad_check: w=campos[0]=ALTO
    rows = [[R.rgb565(struct.unpack_from('<H', pal, v * 2)[0]) + (255,) for v in s['b1'][y * (w + 2):y * (w + 2) + w]] for y in range(h)]
    return w, h, rows


if __name__ == '__main__':
    dim, polys, extra = parse_vol(open(sys.argv[1], encoding='latin1').read())
    pals, sp, _ = W.parse(open(sys.argv[2], 'rb').read())
    by = {}
    for s in sp: by.setdefault(s['name'].lstrip('-').upper(), s)
    cache, miss = {}, 0
    nt = sum(len(p['tiles']) for p in polys)
    assert all(len(p['tiles']) == p['num'][-1] for p in polys), 'ntiles de cabecera != TILE leidos'
    assert all(len(p['pts']) == p['num'][-2] for p in polys if not p['rampa']), 'nvert != POINT leidos'
    print(f'MAPDIM {dim}  polys {len(polys)}  tiles {nt}  extrasprite {len(extra)}')
    if '--stats' in sys.argv: sys.exit()
    Wd, Hd = dim
    img = [(0, 0, 0, 255)] * (Wd * Hd)
    for p in polys:
        if p['name'] == 'AGUA' and '--skip-water' in sys.argv: continue
        for t in p['tiles']:
            key = t['name'].lstrip('-').upper()
            if key not in by: miss += 1; continue
            if key not in cache: cache[key] = sprite_rgba(by[key], pals)
            sw, sh, rows = cache[key]
            sx = t['sx'] % sw if by[key]['b2'] else t['sx']
            w = min(t['w'], sw - sx) if by[key]['b2'] else t['w']
            for yy in range(t['h']):
                sy = t['sy'] + yy
                if not 0 <= sy < sh: continue
                dy = t['y'] + (t['h'] - 1 - yy if 'Y' in t['flags'] else yy)
                if not 0 <= dy < Hd: continue
                for xx in range(w):
                    if not 0 <= sx + xx < len(rows[sy]): continue
                    px = rows[sy][sx + xx]
                    if px[3] == 0: continue
                    dx = t['x'] + (w - 1 - xx if 'X' in t['flags'] else xx)
                    if 0 <= dx < Wd:
                        if px[3] == 255: img[dy * Wd + dx] = px
                        else:
                            b = img[dy * Wd + dx]; img[dy * Wd + dx] = tuple(b[k] // 2 for k in range(3)) + (255,)
    print('sprites no encontrados en el WAD:', miss)
    if '--hash' in sys.argv:
        import hashlib
        print('md5', hashlib.md5(bytes(c for px in img for c in px)).hexdigest()); sys.exit()
    R.png(sys.argv[3], Wd, Hd, img)
    print('->', sys.argv[3])
