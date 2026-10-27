"""Atribuye CADA función del exe a un subsistema y mide la cobertura.
Fuentes (en orden de confianza): rtti (método virtual de una clase) > api (llama a AIL_/winsock…) >
nombre (CRT/Unwind) > llamadores (todos los llamadores de una familia) > contiguidad (vecinas por dirección).
Esto es ATRIBUCIÓN por script, no lectura: ver docs/exe-cobertura.md para qué se leyó a fondo.
uso: py -I tools/exe_classify.py <exe_index.pkl> <rtti.json> <labels.pkl> <salida.md>
"""
import bisect, collections, json, os, pickle, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fam import FAM
import re

F = pickle.load(open(sys.argv[1], 'rb')); R = json.load(open(sys.argv[2]))
lab = {}  # addr -> (familia, clase|None, fuente)


def fam_of(c):
    for fam, rx in FAM:
        if re.search(rx, c): return fam
    return 'Otras clases'


def real(a):  # sigue la cadena de thunks hasta la función real
    seen = set()
    while a in F and F[a]['name'].startswith('thunk_') and len(F[a]['calls']) == 1 and a not in seen:
        seen.add(a); a = next(iter(F[a]['calls']))
    return a


# 1) rtti
for c, e in R.items():
    fam = fam_of(c)
    for vt in e['vts']:
        for m in vt['m']:
            r = real(m)
            if r in F and r not in lab: lab[r] = (fam, c, 'rtti')
# 2) api / nombre
API = [('Sonido', lambda a: any(x.startswith('_AIL_') or x.startswith('AIL_') for x in a)),
       ('Red / multijugador', lambda a: bool({'socket', 'send', 'recv', 'connect', 'accept', 'bind', 'listen', 'WSAStartup', 'gethostbyname'} & a)),
       ('Ventanas / mensajes Windows', lambda a: bool({'CreateWindowExA', 'RegisterClassA', 'DefWindowProcA', 'PeekMessageA', 'DispatchMessageA', 'SetWindowPos', 'DialogBoxParamA', 'CreateDialogParamA'} & a)),
       ('Archivos / E-S', lambda a: bool({'CreateFileA', 'ReadFile', 'WriteFile', 'SetFilePointer', 'FindFirstFileA', 'FindNextFileA', 'GetFileSize'} & a))]
for a, d in F.items():
    if a in lab: continue
    n = d['name']
    if n.startswith('Unwind@'): lab[a] = ('Compilador: desenrollado de excepciones (SEH)', None, 'nombre'); continue
    if not n.startswith(('FUN_', 'thunk_FUN_', 'LAB_')) and not n.startswith('thunk_'): lab[a] = ('CRT / librería (nombre conocido)', None, 'nombre'); continue
    for fam, test in API:
        if test(d['apis']): lab[a] = (fam, None, 'api'); break
# thunks heredan
for a, d in F.items():
    if a not in lab and d['name'].startswith('thunk_'):
        r = real(a)
        if r != a and r in lab: lab[a] = (lab[r][0], lab[r][1], 'thunk')
# 3) llamadores (propaga hacia callees y hacia callers únicos), iterativo
for it in range(12):
    ch = 0
    for a, d in F.items():
        if a in lab or not d['callers']: continue
        fams = collections.Counter(lab[c][0] for c in d['callers'] if c in lab)
        tot = len(d['callers'])
        if fams:
            f, n = fams.most_common(1)[0]
            if n == tot or (n >= 2 and n / tot >= 0.8 and sum(fams.values()) == n):
                lab[a] = (f, None, 'llamadores'); ch += 1
    if not ch: break
# 4) contiguidad
order = sorted(F)
labeled_idx = [i for i, a in enumerate(order) if a in lab]
for i, a in enumerate(order):
    if a in lab: continue
    j = bisect.bisect_left(labeled_idx, i)
    prev = lab[order[labeled_idx[j - 1]]][0] if j > 0 else None
    nxt = lab[order[labeled_idx[j]]][0] if j < len(labeled_idx) else None
    if prev and prev == nxt: lab[a] = (prev, None, 'contiguidad')

pickle.dump(lab, open(sys.argv[3], 'wb'))
tot_fn, tot_b = len(F), sum(d['size'] for d in F.values())
by = collections.defaultdict(lambda: collections.Counter()); byb = collections.defaultdict(lambda: collections.Counter())
for a, d in F.items():
    fam, c, src = lab.get(a, ('SIN ATRIBUIR', None, '-'))
    by[fam][src] += 1; byb[fam][src] += d['size']
rows = sorted(by, key=lambda f: -sum(byb[f].values()))
out = ['# Atribución de TODAS las funciones del exe a subsistemas', '',
       f'{tot_fn:,} funciones, {tot_b:,} bytes de código. Método y límites: `tools/exe_classify.py`. **Atribuir no es leer**: sirve para saber a qué parte del juego pertenece cada función y qué queda sin dueño.', '',
       '| Subsistema | Funciones | Bytes | % código | rtti | api/nombre | llamadores | contigüidad |', '|---|---:|---:|---:|---:|---:|---:|---:|']
for f in rows:
    s, b = by[f], byb[f]
    out.append(f'| {f} | {sum(s.values()):,} | {sum(b.values()):,} | {100 * sum(b.values()) / tot_b:.1f} | {s["rtti"] + s["thunk"]} | {s["api"] + s["nombre"]} | {s["llamadores"]} | {s["contiguidad"]} |')
sin = by['SIN ATRIBUIR']
out += ['', f'**Sin atribuir:** {sum(sin.values()):,} funciones, {sum(byb["SIN ATRIBUIR"].values()):,} bytes ({100 * sum(byb["SIN ATRIBUIR"].values()) / tot_b:.1f} % del código).']
open(sys.argv[4], 'w', encoding='utf8').write('\n'.join(out))
print('\n'.join(out[4:]).replace('|', ' ')[:3500])
