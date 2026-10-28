"""Lista funciones del indice en un rango. uso: py flist.py lo hi (hex)"""
import pickle, sys
idx = pickle.load(open(r'D:\Joaquin\research-c1\exe_index2.pkl', 'rb'))
lo, hi = int(sys.argv[1], 16), int(sys.argv[2], 16)
for a, f in sorted(idx.items()):
    if lo <= a < hi and f['size'] > 5:
        print('%08x %5d callers=%-3d calls=%-3d strs=%s apis=%s' % (a, f['size'], len(f['callers']), len(f['calls']), [s[:30] for s in f['strs'][:3]], sorted(f['apis'])[:3]))
