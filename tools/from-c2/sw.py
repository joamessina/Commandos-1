"""Decodifica los switch de una función decompilada: etiquetas (enteros o flotantes denormales) -> valor asignado -> nombre de secuencia.
Uso: py sw.py 6c6f60 [var]"""
import pickle, re, sys, json
funcs, owner = pickle.load(open(r'D:\Joaquin\research\fn_index.pkl', 'rb'))
names = json.load(open(r'D:\Joaquin\research\p2\seqtable.json'))
DEN = 1.401298464324817e-45

def lab(tok):
    tok = tok.strip()
    if tok.lower().startswith('0x'):
        return int(tok, 16)
    if re.fullmatch(r'-?\d+', tok):
        return int(tok)
    v = float(tok)
    return round(v / DEN)

def run(addr):
    body = funcs[addr][2]
    out = []
    labels = []
    for line in body.split('\n'):
        m = re.match(r'\s*case\s+([^:]+):', line)
        if m:
            labels.append(lab(m.group(1)))
            continue
        if re.match(r'\s*default:', line):
            labels = []
            continue
        m = re.search(r'(?:uVar\d|iVar\d)\s*=\s*(0x[0-9a-fA-F]+|\d+)\s*;', line)
        if m and labels:
            val = int(m.group(1), 0)
            out.append((labels, val, names[val] if val < len(names) else '?'))
            labels = []
            continue
        m = re.search(r'iVar\d\s*=\s*bVar\d\s*\+\s*(0x[0-9a-fA-F]+|\d+)\s*;', line)
        if m and labels:
            val = int(m.group(1), 0)
            out.append((labels, f'+{val}', f'{names[val] if val < len(names) else "?"}/{names[val+1] if val+1 < len(names) else "?"}'))
            labels = []
    return out

if __name__ == '__main__':
    for a in sys.argv[1:]:
        print('=====', a)
        for labels, val, nm in run(int(a, 16)):
            print(labels, '->', val, nm)
