"""Verifica el formato WAD de C1 contra todos los .WAD reales (extraídos de WAR_MP.DIR).
Layout (leído en el exe: FUN_005d02b0, FUN_00647580/00645fb0, FUN_00648360/00648000):
  cab[400] ; u32 A ; A x { pal[512] (256 x RGB565) ; nombre[13] } ; u32 B ;
  B x { nombre[32] ; u32 s1 ; u32 s3 ; u32 f3c ; u32 f44 ; campos[16] (w,h,?,flag@+12) ;
        buf1[s1] ; si flag: u32 s2 + buf2[s2] ; buf3[s3] ; u32 cola }
uso: py -I tools/wad_check.py <carpeta DATOS extraída>
"""
import collections, glob, struct, sys


def parse(b):
    assert len(b) >= 408, 'archivo corto'
    p = 400
    a = struct.unpack_from('<I', b, p)[0]; p += 4
    assert a < 4096, f'A absurdo {a}'
    assert p + a * 525 + 4 <= len(b), 'paletas pasan del fin'
    pals = []
    for _ in range(a):
        pals.append((b[p:p + 512], b[p + 512:p + 525].split(b'\0')[0].decode('latin1'))); p += 525
    n = struct.unpack_from('<I', b, p)[0]; p += 4
    assert n < 100000, f'B absurdo {n}'
    sprites = []
    for i in range(n):
        assert p + 68 <= len(b), f'sprite {i}: cabecera pasa del fin'
        name = b[p:p + 32].split(b'\0')[0].decode('latin1')
        s1, s3, f3c, f44 = struct.unpack_from('<IIII', b, p + 32)
        campos = struct.unpack_from('<IIII', b, p + 48)
        p += 64
        buf1 = b[p:p + s1]; p += s1
        buf2 = b''
        if campos[3]:
            s2 = struct.unpack_from('<I', b, p)[0]; p += 4
            buf2 = b[p:p + s2]; p += s2
        buf3 = b[p:p + s3]; p += s3
        assert p + 4 <= len(b), f'sprite {i} ({name}): buffers pasan del fin'
        cola = struct.unpack_from('<i', b, p)[0]; p += 4
        sprites.append(dict(name=name, w=campos[0], h=campos[1], pal=f3c, flag=campos[3], b1=buf1, b2=buf2, b3=buf3, cola=cola, f44=f44, c2=campos[2]))
    return pals, sprites, p


if __name__ == '__main__':
    ok = bad = 0
    restos = collections.Counter(); colas = collections.Counter()
    for f in sorted(glob.glob(sys.argv[1] + '/**/*.WAD', recursive=True)):
        b = open(f, 'rb').read()
        try:
            pals, sp, fin = parse(b)
            restos[len(b) - fin] += 1
            for s in sp: colas[s['cola']] += 1
            ok += 1
        except Exception as e:
            bad += 1; print('FALLA', f.split('DATOS')[-1], e)
    print('ok', ok, 'mal', bad, '| bytes sobrantes al final (valor:archivos)', dict(restos.most_common(6)))
    print('cola de sprite (valor:n)', dict(colas.most_common(6)))
