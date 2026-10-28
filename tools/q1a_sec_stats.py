"""Estadisticas de semantica de .SEC (R4): flags/tipos/k1,k2, grupos, TW1/TW2/TW3 sobre los archivos reales.
uso: py -I tools/q1a_sec_stats.py <carpeta con *.SEC>   (reusa tools/sec_check.py)
"""
import collections, glob, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sec_check import parse

NAMES = {1: 'Inclin', 2: 'Superp', 4: 'NTrans', 8: 'NCamin', 0x10: 'Ocluso', 0x20: 'Corriente', 0x40: 'PEscal', 0x80: 'PExplo',
         0x100: 'NVista', 0x200: 'NCorri', 0x400: 'SoloAg', 0x800: 'NTirar', 0x1000: 'NTirAt', 0x10000: 'Cubierto'}


def fl(v):
    return '|'.join(n for b, n in NAMES.items() if v & b) or '0'


for f in sorted(glob.glob(sys.argv[1] + '/*.SEC')):
    b = open(f, 'rb').read()
    d, b, p = parse(b)
    L1, L2 = d['L1'], d['L2']
    print('==', os.path.basename(f), 'A', len(L1), 'B', len(L2))
    for nm, L in (('A', L1), ('B', L2)):
        c = collections.Counter(); ct = collections.Counter(); ck = collections.Counter(); flat = 0
        for s in L:
            c[fl(s['flags'])] += 1; ct[s['tipo']] += 1; ck[s['k']] += 1
            flat += s['plane'][0] == 0 and s['plane'][1] == 0
        print(' ', nm, 'tipos', dict(ct), 'planos planos', flat, 'k(u1,u2) top', ck.most_common(3))
        print('    flags', dict(c.most_common(8)))
    for name, items in d['groups']:
        fs = collections.Counter(fl((L1 if l <= 0 else L2)[s]['flags']) for l, s in items)
        print('  grupo', repr(name), 'n', len(items), 'listas', collections.Counter(l for l, s in items), 'flags', dict(fs.most_common(3)))
    # TW1: vecinos ya relativos a A?
    pos = d['pos']
    n1 = sum(s['n'] for s in L1)
    if b[pos:pos + 3] == b'TW1':
        nb = struct.unpack_from(f'<{n1}i', b, pos + 3)
        print('  TW1 vecinos >= nA:', sum(v >= len(L1) for v in nb), 'de', sum(v != -1 for v in nb))
        q = pos + 3 + 4 * n1
        t2 = []
        if b[q:q + 3] == b'TW2':
            q += 3
            while True:
                s = struct.unpack_from('<i', b, q)[0]; q += 4
                if s == -1: break
                t2.append(struct.unpack_from('<iii', b, q)); q += 12
            print('  TW2', len(t2), 'ej', t2[:3], 'B de TW2 (s2-nA) en rango:', all(0 <= t[1] - len(L1) < len(L2) for t in t2) if t2 else None)
        if b[q:q + 3] == b'TW3':
            t3 = struct.unpack_from(f'<{(len(b) - q - 3) // 4}i', b, q + 3)
            print('  TW3', len(t3), 'flags de esos sectores A:', dict(collections.Counter(fl(L1[i]['flags']) for i in t3).most_common(4)))
