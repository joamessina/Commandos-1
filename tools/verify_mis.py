"""Verificador del lenguaje `.CLAVE [ ... ]` (MIS/MAC/DAT/cfg) con la gramatica EXACTA del exe.
Gramatica (FUN_0060a6d0 + FUN_0060ad60 + FUN_0060b190 del exe):
  1. corta en 0x1A; '#' abre comentario hasta fin de linea; toda racha de blancos (espacio, \\t, \\r, \\n) = 1 espacio.
  2. tokens separados por espacio; '[' y ']' deben ser tokens sueltos; todo lo de profundidad >= 1 queda como
     UN solo item (texto interno) que se reparsea al acceder; no hay comillas ni ';' como comentario.
  3. un bloque con claves = pares (.CLAVE valor) en posiciones 0,2,4...; busqueda sin distinguir mayusculas.
uso: py -I verify_mis.py [carpeta MISIONES]   -> informe a stdout, exit 1 si hay anomalias
"""
import os, re, sys, glob, collections

def clean(t):
    t = t.split('\x1a')[0]
    out = []; st = 0; i = 0   # 0 normal, 1 racha de blancos, 2 comentario (igual que FUN_0060a6d0)
    while i < len(t):
        ch = t[i]
        if st == 0:
            if ch in ' \t\r\n':
                if not out or out[-1] != ' ': out.append(' ')
                st = 1
            elif ch == '#':
                if not out or out[-1] != ' ': out.append(' ')
                st = 2
            else: out.append(ch)
        elif st == 1:
            if ch not in ' \t\r\n': st = 0; continue   # reprocesa el caracter en estado 0
        elif ch in '\r\n': st = 1; continue
        i += 1
    return ''.join(out)

class Bad(Exception): pass

def items(text):
    """-> lista de items: str (palabra) o ('G', texto_interno) (grupo entre corchetes)."""
    toks = text.split(' '); res = []; depth = 0; buf = []
    for tk in toks:
        if tk == '': continue
        if tk == '[':
            depth += 1
            if depth > 1: buf.append(tk)
        elif tk == ']':
            depth -= 1
            if depth < 0: raise Bad('] sobrante')
            if depth == 0: res.append(('G', ' '.join(buf))); buf = []
            else: buf.append(tk)
        elif depth == 0: res.append(tk)
        else: buf.append(tk)
    if depth != 0: raise Bad('corchetes sin cerrar (%d)' % depth)
    return res

def tree(text):
    return [('G', tree(x[1])) if isinstance(x, tuple) else x for x in items(text)]

def keyed(node):
    """True si el nodo es un bloque clave/valor (item 0 empieza con '.')."""
    return bool(node) and isinstance(node[0], str) and node[0].startswith('.')

stats = collections.Counter(); anomalies = []
keycount = collections.Counter(); keyfiles = collections.defaultdict(set); keyparent = collections.defaultdict(collections.Counter)

def walk(node, path, fname):
    if keyed(node):
        for i, it in enumerate(node):
            if i % 2 == 0:
                if not (isinstance(it, str) and it.startswith('.')):
                    anomalies.append((fname, '/'.join(path), 'posicion par sin clave: %r' % (it,)))
                else:
                    k = it[1:].upper(); keycount[k] += 1; keyfiles[k].add(fname); keyparent[k][path[-1] if path else '<raiz>'] += 1
            elif isinstance(it, str) and it.startswith('.') and len(node) % 2 == 1 and False:
                pass
        if len(node) % 2: anomalies.append((fname, '/'.join(path), 'cantidad impar de items (%d)' % len(node)))
    for i, it in enumerate(node):
        if isinstance(it, tuple):
            nm = node[i-1][1:].upper() if i > 0 and isinstance(node[i-1], str) and node[i-1].startswith('.') else '#%d' % i
            walk(it[1], path + [nm if nm[0] != '#' else '[]'], fname)

def main():
    d = sys.argv[1] if len(sys.argv) > 1 else r'D:\Joaquin\research-c1\x\DATOS\MISIONES'
    files = sorted(glob.glob(d + r'\*.MIS') + glob.glob(d + r'\*.MAC') + glob.glob(d + r'\*.DAT'))
    trees = {}; byext = collections.Counter()
    for p in files:
        f = os.path.basename(p); raw = open(p, 'rb').read().decode('latin1')
        try:
            t = tree(clean(raw))
        except Bad as e:
            anomalies.append((f, '', 'NO PARSEA: ' + str(e))); continue
        trees[f] = t; byext[f.rsplit('.', 1)[1]] += 1
        walk(t, [], f)
        stats['archivos_ok'] += 1
    print('archivos parseados: %d de %d  %s' % (stats['archivos_ok'], len(files), dict(byext)))
    # forma de la raiz
    roots = collections.Counter(t[0] if t and isinstance(t[0], str) else '?' for t in trees.values())
    print('claves de raiz:', dict(roots))
    # ---- macros: variables $X usadas en MAC vs claves de la instancia MIS
    mac_vars = {}; mac_decl = {}
    for f, t in trees.items():
        if not f.endswith('.MAC'): continue
        raw = open(os.path.join(d, f), 'rb').read().decode('latin1')
        mac_vars[f[:-4].upper()] = {m.upper() for m in re.findall(r'\$([A-Za-z0-9_]+)', clean(raw))}
        decl = []
        for i, it in enumerate(t):
            if isinstance(it, str) and it.upper() == '.VARIABLES' and isinstance(t[i+1], tuple):
                decl = [x for x in t[i+1][1] if isinstance(x, str)]
        mac_decl[f[:-4].upper()] = decl
    types = collections.Counter(); defaults = 0; undecl = []
    for m, decl in mac_decl.items():
        names = set()
        for v in decl:
            types[v[0]] += 1
            nm = v[1:].split('.', 1)
            names.add(nm[0].upper()); defaults += ('.' in v[1:])
        for u in mac_vars[m] - names: undecl.append((m, u))
    print('tipos de variable declarados (1a letra):', dict(types), '| con default (.valor):', defaults)
    print('variables $X usadas y NO declaradas en .VARIABLES:', undecl[:10], len(undecl))
    inst = 0; missing = collections.Counter(); extra = collections.Counter(); noclass = 0; unknown = set(); seenvars = collections.Counter()
    def elements(node, f):
        nonlocal inst
        # busca cualquier bloque con .MACRO (instancia)
        if keyed(node):
            kv = {node[i][1:].upper(): node[i+1] for i in range(0, len(node) - 1, 2) if isinstance(node[i], str)}
            if 'MACRO' in kv and isinstance(kv['MACRO'], str):
                inst += 1; m = kv['MACRO'].upper()
                if m not in mac_vars: unknown.add((f, m)); return
                need = mac_vars[m]; have = set(kv) - {'MACRO', 'CLASS', 'TOKEN', 'XYZ', 'TIP', 'NIVEL', 'BOXSELECCIONREL', 'ANGULO'}
                for n in need - set(kv): missing[(m, n)] += 1
                for n in need & set(kv): seenvars[m] += 1
        for it in node:
            if isinstance(it, tuple): elements(it[1], f)
    for f, t in trees.items():
        if f.endswith('.MIS'): elements(t, f)
    print('instancias .MACRO en las MIS: %d | MACs desconocidas: %s' % (inst, sorted(unknown)))
    print('variables $X que la instancia NO define (se leen como bloque vacio):', sum(missing.values()), 'casos;', len(missing), 'pares (mac,var)')
    for k, v in sorted(missing.items(), key=lambda x: -x[1])[:15]: print('   ', k, v)
    # ---- anomalias
    print('anomalias estructurales:', len(anomalies))
    for a in anomalies[:25]: print('   ', a)
    # ---- volcado de claves
    out = os.path.join(os.environ.get('TEMP', '.'), 'claves_c1.tsv')
    with open(out, 'w', encoding='utf8') as fo:
        for k, n in sorted(keycount.items()):
            fo.write('%s\t%d\t%d\t%s\n' % (k, n, len(keyfiles[k]), ','.join('%s:%d' % kv for kv in keyparent[k].most_common(3))))
    print('claves distintas (.CLAVE):', len(keycount), '-> volcado en', out)
    return 1 if anomalies or stats['archivos_ok'] != len(files) else 0

if __name__ == '__main__':
    sys.exit(main())
