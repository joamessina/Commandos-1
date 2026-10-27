"""Agrupa las clases RTTI por familia y escribe un catálogo markdown.
uso: py -I tools/rtti_families.py <rtti.json> <exe_index.pkl> <salida.md>
"""
import collections, json, os, pickle, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

R = json.load(open(sys.argv[1])); F = pickle.load(open(sys.argv[2], 'rb'))
from fam import FAM

fam_of = {}
for c in R:
    for fam, rx in FAM:
        if re.search(rx, c): fam_of[c] = fam; break
    else: fam_of[c] = 'Otras'
by = collections.defaultdict(list)
for c in R: by[fam_of[c]].append(c)

def real(a):
    # una entrada de vtable suele ser un thunk de 5 B (jmp): se sigue hasta la función real
    d = F.get(a)
    while d and d['name'].startswith('thunk_') and len(d['calls']) == 1:
        d = F.get(next(iter(d['calls'])), None) or d
        if d['name'].startswith('thunk_') and len(d['calls']) != 1: break
    return d


def size_of(c):
    ms = {m for vt in R[c]['vts'] for m in vt['m']}
    reales = {real(m)['addr'] for m in ms if real(m)}
    return sum(F[a]['size'] for a in reales), len(ms)

lines = ['# Catálogo de clases del exe (RTTI)', '',
         f'{len(R)} clases con vtable, {sum(len(v["vts"]) for v in R.values())} vtables. Generado con `tools/rtti_c1.py` + `tools/rtti_families.py` sobre el exe de la raíz.',
         'Tamaño = bytes de código de sus métodos virtuales (sin contar funciones no virtuales que llaman). Herencia entre paréntesis.', '']
tot = {}
for fam, cs in sorted(by.items(), key=lambda kv: -sum(size_of(c)[0] for c in kv[1])):
    sz = sum(size_of(c)[0] for c in cs); nm = sum(size_of(c)[1] for c in cs)
    tot[fam] = (len(cs), nm, sz)
    lines += [f'## {fam} — {len(cs)} clases, {nm} métodos virtuales, {sz:,} B', '']
    for c in sorted(cs, key=lambda c: -size_of(c)[0]):
        s, n = size_of(c); b = R[c]['bases']
        lines.append(f'- `{c}` ({", ".join(b[:3])}{"…" if len(b) > 3 else ""}) — {n} mét., {s:,} B'.replace('()', '').replace(' ()', ''))
    lines.append('')
open(sys.argv[3], 'w', encoding='utf8').write('\n'.join(lines))
for fam, (a, b, c) in sorted(tot.items(), key=lambda kv: -kv[1][2]): print(f'{a:4d} clases {b:5d} met {c:9,d} B  {fam}')
