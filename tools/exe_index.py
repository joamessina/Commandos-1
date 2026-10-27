"""Indexa TODAS las funciones decompiladas (fn_*.c de Ghidra) en un pickle consultable.
Por función: dirección, nombre, tamaño, llamadas (callees), cadenas literales, APIs/CRT nombradas,
globales DAT_, vtables. Calcula callers y cuenta líneas.
uso: py -I tools/exe_index.py <carpeta all/> <salida.pkl>
"""
import glob, pickle, re, sys, collections

HEAD = re.compile(r'^//// ([0-9a-f]{8}) (\S+) size (\d+)$', re.M)
CALL = re.compile(r'\b(?:thunk_)?FUN_([0-9a-f]{8})\b')
STR = re.compile(r'"((?:[^"\\\n]|\\.)*)"')
DAT = re.compile(r'\bDAT_([0-9a-f]{8})\b')
VT = re.compile(r'\bPTR_vftable_([0-9a-f]{8})\b')
API = re.compile(r'\b([A-Za-z_][A-Za-z0-9_@]{2,})\(')
SKIP = {'if', 'while', 'for', 'switch', 'return', 'sizeof', 'FUN', 'thunk_FUN'}


def main(src, out):
    fns = {}
    for f in sorted(glob.glob(src + '/fn_*.c')):
        t = open(f, encoding='utf8', errors='replace').read()
        ms = list(HEAD.finditer(t))
        for i, m in enumerate(ms):
            body = t[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(t)]
            addr = int(m.group(1), 16)
            calls = {int(x, 16) for x in CALL.findall(body)} - {addr}
            apis = {a for a in API.findall(body) if not a.startswith(('FUN_', 'thunk_FUN_')) and a not in SKIP}
            fns[addr] = dict(addr=addr, name=m.group(2), size=int(m.group(3)), lines=body.count('\n'),
                             calls=calls, strs=STR.findall(body), apis=apis,
                             dats={int(x, 16) for x in DAT.findall(body)}, vts={int(x, 16) for x in VT.findall(body)},
                             failed='decompile failed' in body or '// exception' in body, file=f.split('\\')[-1].split('/')[-1])
    callers = collections.defaultdict(set)
    for a, d in fns.items():
        for c in d['calls']:
            callers[c].add(a)
    for a, d in fns.items():
        d['callers'] = callers.get(a, set())
    pickle.dump(fns, open(out, 'wb'))
    n = len(fns)
    print('funciones', n, '| lineas', sum(d['lines'] for d in fns.values()), '| fallidas', sum(d['failed'] for d in fns.values()))
    print('con cadenas', sum(1 for d in fns.values() if d['strs']), '| sin llamadas ni llamadores', sum(1 for d in fns.values() if not d['calls'] and not d['callers']))
    print('thunks', sum(1 for d in fns.values() if d['name'].startswith('thunk_')), '| bytes de codigo', sum(d['size'] for d in fns.values()))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
