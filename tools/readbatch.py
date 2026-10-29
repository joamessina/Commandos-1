"""Lectura sistematica del exe: imprime la proxima tanda de funciones SIN LEER de una familia, en forma compacta, y las anota en el registro.
Registro: tasks/lectura-exe.tsv (addr<TAB>familia<TAB>tanda). Lo que se imprime se da por leido (hay que leerlo de verdad).
uso:
  py -I tools/readbatch.py resumen                       -> funciones / bytes leidos y pendientes por familia
  py -I tools/readbatch.py familias                      -> nombres exactos de familia
  py -I tools/readbatch.py tanda "<familia>" [KB=24]     -> imprime la proxima tanda (KB de codigo) y la marca como leida
  py -I tools/readbatch.py rango <lo> <hi> [KB=24]       -> proxima tanda de funciones sin leer con lo <= direccion < hi (cualquier familia); las marca
  py -I tools/readbatch.py faltan <lo> <hi>              -> cuantas funciones/KB sin leer quedan en el rango
  py -I tools/readbatch.py ver <hex> [<hex>...]          -> imprime funciones concretas (compactas) sin anotarlas
Familias omitidas por no ser logica del juego: CRT / libreria, SEH (desenrollado de excepciones), std de C++.
"""
import collections, os, pickle, re, sys, time

R = r'D:\Joaquin\research-c1'
HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(HERE, '..', 'tasks', 'lectura-exe.tsv')
SKIP = ('CRT / librer', 'Compilador: desenrollado', 'Librer\u00eda est\u00e1ndar C++')
IX = pickle.load(open(os.path.join(R, 'exe_index2.pkl'), 'rb'))
LAB = pickle.load(open(os.path.join(R, 'labels.pkl'), 'rb'))
NOISE = re.compile(r'ExceptionList|pcStack_|__security_check_cookie|DAT_008382e0 \^|^\s*uStack_4 = 0xffffffff|^\s*local_4 = 0xffffffff|^\s*local_c = |WARNING:|^\s*$')
DECL = re.compile(r'^\s+(undefined\d?|int|uint|float|float10|bool|char|byte|code|void|double|longlong|ulonglong|short|ushort|LARGE_INTEGER)\b[^=()]*;\s*$')


def fam(a):
    return LAB.get(a, ('SIN ATRIBUIR', None, None))[0]


def klass(a):
    return LAB.get(a, (None, None, None))[1]


def ledger():
    d = {}
    if os.path.exists(LEDGER):
        for l in open(LEDGER, encoding='utf8'):
            p = l.rstrip('\n').split('\t')
            if len(p) >= 3 and p[0] != 'addr': d[int(p[0], 16)] = p[2]
    return d


_text = {}


def body(a):
    f = IX[a]['file']
    if f not in _text:
        cur, buf, d = None, [], {}
        for l in open(os.path.join(R, 'ghidra', 'all2', os.path.basename(f)), encoding='latin1'):
            m = re.match(r'//// ([0-9a-f]{8}) ', l)
            if m:
                if cur is not None: d[cur] = buf
                cur, buf = int(m.group(1), 16), []
            elif cur is not None: buf.append(l.rstrip('\n'))
        if cur is not None: d[cur] = buf
        _text[f] = d
    return _text[f].get(a, [])


def compact(a):
    out, started = [], False
    for l in body(a):
        if not started:
            if l.strip() == '{': started = True; out.append('{')
            elif l.strip() and not NOISE.search(l): out.append(l)   # firma
            continue
        if NOISE.search(l) or DECL.match(l): continue
        out.append(l)
    return '\n'.join(out)


def show(a, mark=None):
    f = IX[a]
    k = klass(a)
    strs = [s[:50] for s in f['strs']][:6]
    print(f"\n## {a:08x} {f['size']}B callers={len(f['callers'])}{' ' + k if k else ''} [{fam(a)}]" + (f'  strs={strs}' if strs else ''))
    print(compact(a))


def todo(familia):
    done = ledger()
    xs = [a for a in IX if fam(a) == familia and a not in done and IX[a]['size'] > 5 and not IX[a]['failed']]
    xs.sort(key=lambda a: (klass(a) or '', a))
    return xs


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'resumen'
    if cmd == 'resumen':
        done = ledger()
        t = collections.defaultdict(lambda: [0, 0, 0, 0])
        for a, f in IX.items():
            r = t[fam(a)]; r[0] += 1; r[1] += f['size']
            if a in done: r[2] += 1; r[3] += f['size']
        print(f"{'familia':58} {'funcs':>6} {'KB':>6} {'leidas':>6} {'KB':>6}")
        for k, r in sorted(t.items(), key=lambda kv: -kv[1][1]):
            print(f"{k[:58]:58} {r[0]:6} {r[1] // 1024:6} {r[2]:6} {r[3] // 1024:6}" + ('   (omitida)' if k.startswith(SKIP) else ''))
    elif cmd == 'familias':
        for i, k in enumerate(sorted({fam(a) for a in IX})): print(f'#{i}', k)
    elif cmd == 'ver':
        for h in sys.argv[2:]: show(int(h, 16))
    elif cmd in ('tanda', 'rango', 'faltan'):
        if cmd == 'tanda':
            familia, kb = sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 24
            if familia.startswith('#'): familia = sorted({fam(a) for a in IX})[int(familia[1:])]   # indice de `familias`
            xs = todo(familia)
        else:
            lo, hi = int(sys.argv[2], 16), int(sys.argv[3], 16)
            kb = int(sys.argv[4]) if len(sys.argv) > 4 else 24
            familia = f'rango {lo:x}-{hi:x}'
            done = ledger()
            xs = sorted(a for a in IX if lo <= a < hi and a not in done and IX[a]['size'] > 5 and not IX[a]['failed'] and not fam(a).startswith(SKIP))
            if cmd == 'faltan':
                print(len(xs), 'funciones,', sum(IX[a]['size'] for a in xs) // 1024, 'KB sin leer'); sys.exit()
        budget, picked = kb * 1024, []
        for a in xs:
            if picked and budget - IX[a]['size'] < 0: break
            picked.append(a); budget -= IX[a]['size']
        if not picked: print('nada pendiente en', familia); sys.exit()
        tanda = time.strftime('%Y%m%d-%H%M%S')
        new = not os.path.exists(LEDGER)
        with open(LEDGER, 'a', encoding='utf8') as fh:
            if new: fh.write('addr\tfamilia\ttanda\n')
            for a in picked: fh.write(f'{a:08x}\t{familia}\t{tanda}\n')
        import contextlib, io
        out = os.environ.get('TANDA_OUT')
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            print(f'# tanda {tanda}: {len(picked)} funciones, {sum(IX[a]["size"] for a in picked)} B; pendientes tras esta: {len(xs) - len(picked)}')
            for a in picked: show(a)
        if out:
            open(out, 'w', encoding='utf8').write(buf.getvalue())
            txt = buf.getvalue()
            print(txt.splitlines()[0], '->', out, len(txt.splitlines()), 'lineas')
        else: print(buf.getvalue())
