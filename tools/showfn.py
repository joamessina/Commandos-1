"""Muestra el decompilado de una o más funciones por dirección hex.
uso: py -I tools/showfn.py <carpeta all/> <hex> [<hex>...]
"""
import glob, re, sys

want = {int(a, 16) for a in sys.argv[2:]}
for f in sorted(glob.glob(sys.argv[1] + '/fn_*.c')):
    t = open(f, encoding='utf8', errors='replace').read()
    ms = list(re.finditer(r'^//// ([0-9a-f]{8}) (\S+) size (\d+)$', t, re.M))
    for i, m in enumerate(ms):
        if int(m.group(1), 16) in want:
            print(t[m.start(): ms[i + 1].start() if i + 1 < len(ms) else len(t)].rstrip())
            print()
