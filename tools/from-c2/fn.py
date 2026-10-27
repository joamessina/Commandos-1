"""Índice del código decompilado de Comm2.exe. Uso:
  py fn.py get 6d0d20            -> texto de la función
  py fn.py find "texto|regex"    -> funciones que lo contienen (dirección, clase si la hay, línea)
  py fn.py class CAUAcuchillar   -> sus métodos virtuales con tamaño y primeras líneas
  py fn.py callers 6d0d20        -> funciones que llaman a esa dirección
"""
import glob, json, os, pickle, re, sys

ROOT = r'D:\Joaquin\research\ghidra\all'
CACHE = r'D:\Joaquin\research\fn_index.pkl'


def build():
    funcs = {}
    for p in sorted(glob.glob(os.path.join(ROOT, 'fn_*.c'))):
        text = open(p, encoding='utf8', errors='replace').read()
        parts = re.split(r'^//// ', text, flags=re.M)
        for part in parts[1:]:
            head, _, body = part.partition('\n')
            m = re.match(r'([0-9a-fA-F]+) (\S+) size (\d+)', head)
            if not m:
                continue
            funcs[int(m.group(1), 16)] = (m.group(2), int(m.group(3)), body)
    rtti = json.load(open(r'D:\Joaquin\research\rtti.json'))
    owner = {}
    for cls, vts in rtti.items():
        for vt in vts:
            for i, m in enumerate(vt['m']):
                owner.setdefault(m, []).append(f'{cls[:-2]}::v{i}')
    pickle.dump((funcs, owner), open(CACHE, 'wb'))


def load():
    if not os.path.exists(CACHE):
        build()
    return pickle.load(open(CACHE, 'rb'))


funcs, owner = load()


def label(a):
    o = owner.get(a)
    return ','.join(o[:3]) if o else ''


def get(a):
    f = funcs.get(a)
    if not f:
        # función que contiene a `a`
        best = max((k for k in funcs if k <= a), default=None)
        f = funcs.get(best)
        a = best
    return f'// {a:08x} {f[0]} size {f[1]} {label(a)}\n{f[2]}' if f else 'no encontrada'


def find(pat, ctx=0, limit=40):
    rx = re.compile(pat)
    n = 0
    for a, (name, size, body) in funcs.items():
        if rx.search(body):
            lines = body.split('\n')
            hits = [i for i, l in enumerate(lines) if rx.search(l)]
            print(f'{a:08x} {name} size {size} {label(a)}  [{len(hits)} líneas]')
            for i in hits[:3]:
                print('     ', lines[i].strip()[:160])
            n += 1
            if n >= limit:
                print('... (corte)')
                break


def callers(a):
    pat = re.compile(r'\b(FUN_|thunk_FUN_)0*%x\b' % a)
    for k, (name, size, body) in funcs.items():
        if pat.search(body):
            print(f'{k:08x} {name} {label(k)}')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'get':
        print(get(int(sys.argv[2], 16)))
    elif cmd == 'find':
        find(sys.argv[2], limit=int(sys.argv[3]) if len(sys.argv) > 3 else 40)
    elif cmd == 'class':
        rtti = json.load(open(r'D:\Joaquin\research\rtti.json'))
        for vt in rtti.get(sys.argv[2] + '@@', []):
            print('vtable', hex(vt['vt']))
            for i, m in enumerate(vt['m']):
                f = funcs.get(m)
                print(f'  v{i:<2} {m:08x} size {f[1] if f else "?"}')
    elif cmd == 'callers':
        callers(int(sys.argv[2], 16))


# --- anotación de constantes: _DAT_xxxxxxxx en .rdata se muestra con su valor como float/double/int
def annotate(text):
    import struct
    sys.path.insert(0, r'D:\Joaquin\research')
    import exe

    def rep(m):
        a = int(m.group(2), 16)
        b = exe.read(a, 8)
        if len(b) < 8:
            return m.group(0)
        f = struct.unpack('<f', b[:4])[0]
        d = struct.unpack('<d', b)[0]
        i = struct.unpack('<i', b[:4])[0]
        parts = []
        if abs(f) > 1e-6 and abs(f) < 1e7 and f == f:
            parts.append(f'f={f:g}')
        if abs(d) > 1e-9 and abs(d) < 1e9 and d == d:
            parts.append(f'd={d:g}')
        parts.append(f'i={i}')
        return f'{m.group(0)}/*{" ".join(parts)}*/'
    return re.sub(r'(_?DAT_)([0-9a-f]{8})', rep, text)


_get = get


def get(a):  # noqa: F811
    return annotate(_get(a))


if __name__ == '__main__' and sys.argv[1] == 'geta':
    print(get(int(sys.argv[2], 16)))
