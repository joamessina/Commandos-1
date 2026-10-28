"""Busca funciones del exe por subcadena en sus strings. uso: py xs.py <subcadena> [...]"""
import pickle, sys
idx = pickle.load(open(r'D:\Joaquin\research-c1\exe_index2.pkl', 'rb'))
for pat in sys.argv[1:]:
    for a, f in sorted(idx.items()):
        hit = [s for s in f['strs'] if pat.lower() in s.lower()]
        if hit:
            print('%s %08x size %d callers %d: %s' % (pat, a, f['size'], len(f['callers']), [h[:60] for h in hit[:6]]))
