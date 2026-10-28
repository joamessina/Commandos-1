"""Quien llama a una funcion del exe (incluyendo via stubs jmp de 5 B). uso: py tools/callers.py <hex>..."""
import pickle, sys
ix = pickle.load(open(r'D:\Joaquin\research-c1\exe_index2.pkl', 'rb'))
for t in (int(a, 16) for a in sys.argv[1:]):
    tg = {t} | {a for a, f in ix.items() if f['size'] == 5 and t in f['calls']}
    out = sorted({c for a in tg if a in ix for c in ix[a]['callers']} | {a for a, f in ix.items() if f['calls'] & tg and a not in tg})
    print(hex(t), 'via', [hex(x) for x in sorted(tg)])
    print('   ', [(hex(c), ix[c]['size']) for c in out if c in ix])
