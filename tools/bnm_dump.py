"""Lector genérico del flujo BNM de C1 (ANM). Formato confirmado en el exe (FUN_00622bc0/00622cf0):
  'BNM ' ; luego registros:  hdr u32 | mask u32 | payload[(hdr&0xFFFF) + 4*nptr]
  nptr = (hdr>>16)&0xF ; tipo = hdr>>24 ; fin = hdr==0xFF000000.
  payload = nptr ranuras u32 (si el bit i de mask está activo, la ranura es un offset relativo
  al inicio de los datos que siguen a las ranuras) + (hdr&0xFFFF) bytes de datos.
uso: py -I tools/bnm_dump.py <archivo.ANM> [-v]   |   py -I tools/bnm_dump.py --all <carpeta>
"""
import collections, glob, struct, sys


def records(b):
    assert b[:4] == b'BNM ', 'sin magia BNM'
    p, out = 4, []
    while True:
        assert p + 4 <= len(b), 'se corta antes del fin'
        hdr = struct.unpack_from('<I', b, p)[0]
        if hdr == 0xFF000000:
            assert p + 4 == len(b), f'bytes sobrantes tras el fin: {len(b) - p - 4}'
            return out
        n, size, tipo = (hdr >> 16) & 0xF, hdr & 0xFFFF, hdr >> 24
        assert p + 8 + size + 4 * n <= len(b), 'registro pasa del fin'
        mask = struct.unpack_from('<I', b, p + 4)[0]
        slots = list(struct.unpack_from(f'<{n}i', b, p + 8))
        data = b[p + 8 + 4 * n:p + 8 + 4 * n + size]
        for i in range(n):
            if mask >> i & 1:  # puntero relativo: se resuelve a cadena para mostrar
                a = slots[i]; e = data.find(b'\0', a)
                slots[i] = ('ptr', a, data[a:e].decode('latin1') if 0 <= a < size and e >= 0 else None)
        out.append((tipo, mask, slots, data))
        p += 8 + 4 * n + size


if __name__ == '__main__':
    if sys.argv[1] == '--all':
        ok = bad = 0
        shape = collections.Counter()
        for f in sorted(glob.glob(sys.argv[2] + '/**/*.ANM', recursive=True)):
            try:
                for t, m, s, d in records(open(f, 'rb').read()):
                    shape[(t, len(s), len(d) > 0)] += 1
                ok += 1
            except Exception as e:
                bad += 1; print('FALLA', f.split('/')[-1], e)
        print('ok', ok, 'mal', bad)
        for k, v in sorted(shape.items()): print(' tipo,nslots,tiene_datos', k, v)
    else:
        for r in records(open(sys.argv[1], 'rb').read()):
            print(r[0], hex(r[1]), r[2], r[3] if '-v' in sys.argv else len(r[3]))
