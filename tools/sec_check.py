"""Verificador del .SEC (magia 'NIBS') de C1: sectores de navegacion. Layout leido en el exe:
FUN_005FBEA0 (cargador), FUN_005F9EC0 (lista de sectores), FUN_005FA5F0 (grupos con nombre), FUN_005F4A40 (pares).
  'NIBS' ; u32 nV ; nV x (f32 x, f32 y)                                  vertices globales
  lista1 ; lista2                                                         cada lista: u32 n ; n x sector
  sector = u32 nverts, f32 A, f32 B, f32 C, u32 tipo, u32 ?, u32 ?, u32 flags, u32 namelen,   (0x24 B)
           name[namelen], [si flags&0x20: f32,f32], nverts x u32 indice de vertice
           plano del sector: z = A*x + B*y + C
  grupos: u32 ng ; ng x { u32 nitems, u32 namelen, name, nitems x (i32 lista(<=0 -> lista1, >0 -> lista2), i32 sector) }
  pares:  u32 n ; n x (u32,u32)    (enlaces entre sectores de lista1, FUN_005F4340)
  'TW1' ; para cada sector de lista1, para cada vertice (arista): i32 vecino (-1 = ninguno)
  'TW2' ; { i32 s1 ; i32 arista1 ; i32 s2(+nlista1) ; i32 arista2 } hasta s1 == -1 (conexiones lista1<->lista2)
  'TW3' ; i32 indices de sector (lista1) hasta EOF (flag 0x10000)
uso: py -I tools/sec_check.py <carpeta con *.SEC>
"""
import glob, struct, sys


def parse(b):
    assert b[:4] == b'NIBS'
    p = 4
    def u(fmt='<I'):
        nonlocal p
        v = struct.unpack_from(fmt, b, p); p += struct.calcsize(fmt); return v if len(v) > 1 else v[0]
    nv = u(); verts = [u('<ff') for _ in range(nv)]
    def lista():
        out = []
        for _ in range(u()):
            nvt, A, B, C, tipo, k1, k2, flags, nl = u('<I3fIIIII')
            name = b[p:p + nl].decode('latin1'); skip(nl)
            fl = u('<ff') if flags & 0x20 else None
            idx = [u() for _ in range(nvt)]
            assert all(i < nv for i in idx), 'indice de vertice fuera de rango'
            out.append(dict(n=nvt, plane=(A, B, C), tipo=tipo, flags=flags, name=name, idx=idx, k=(k1, k2), fl=fl))
        return out
    def skip(n):
        nonlocal p; p += n
    L1 = lista(); L2 = lista()
    groups = []
    for _ in range(u()):
        ni, nl = u('<II'); name = b[p:p + nl].decode('latin1'); skip(nl)
        groups.append((name, [u('<ii') for _ in range(ni)]))
    pairs = [u('<II') for _ in range(u())]
    return dict(verts=verts, L1=L1, L2=L2, groups=groups, pairs=pairs, pos=p), b, p


if __name__ == '__main__':
    for f in sorted(glob.glob(sys.argv[1] + '/*.SEC')):
        b = open(f, 'rb').read()
        try:
            d, b, p = parse(b)
        except Exception as e:
            print(f.split('/')[-1], 'FALLA', repr(e)); continue
        tail = b[p:p + 3]
        print(f.replace('\\', '/').split('/')[-1], len(b), 'V', len(d['verts']), 'L1', len(d['L1']), 'L2', len(d['L2']), 'grupos', len(d['groups']), 'pares', len(d['pairs']), 'pos', p, 'tag', tail)


def tail(b, d):
    """TW1/TW2/TW3 hasta EOF; devuelve (nTW1 aristas, nTW2 enlaces, nTW3) y exige terminar exactamente en EOF."""
    p = d['pos']
    assert b[p:p + 3] == b'TW1'; p += 3
    n1 = sum(s['n'] for s in d['L1'])
    nb = struct.unpack_from(f'<{n1}i', b, p); p += 4 * n1
    assert all(v == -1 or 0 <= v < len(d['L1']) + len(d['L2']) for v in nb), 'vecino TW1 fuera de rango'
    t2 = []
    if b[p:p + 3] == b'TW2':
        p += 3
        while True:
            s = struct.unpack_from('<i', b, p)[0]; p += 4
            if s == -1: break
            t2.append(struct.unpack_from('<iii', b, p)); p += 12
    t3 = []
    if b[p:p + 3] == b'TW3':
        p += 3
        while p + 4 <= len(b): t3.append(struct.unpack_from('<i', b, p)[0]); p += 4
    assert p == len(b), f'sobran {len(b) - p} B'
    return len(nb), sum(v != -1 for v in nb), len(t2), len(t3)


if __name__ == '__main__':
    print('--- cola TW1/TW2/TW3 (aristas, aristas con vecino, enlaces TW2, indices TW3), exige EOF exacto')
    for f in sorted(glob.glob(sys.argv[1] + '/*.SEC')):
        d, b, p = parse(open(f, 'rb').read())
        print(f.replace(chr(92), '/').split('/')[-1], tail(b, d))
