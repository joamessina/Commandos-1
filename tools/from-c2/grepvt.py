import pickle,re,sys,json
funcs,owner=pickle.load(open(r'D:\Joaquin\research\fn_index.pkl','rb'))
rtti=json.load(open(r'D:\Joaquin\research\rtti.json'))
cls=sys.argv[1]; pats=[re.compile(p) for p in sys.argv[2:]]
key=[k for k in rtti if k.startswith(cls)]
seen=set()
for k in key:
    for vt in rtti[k]:
        for i,m in enumerate(vt['m']):
            if m in seen or m not in funcs: continue
            seen.add(m)
            body=funcs[m][2]
            hits=[l.strip() for l in body.split('\n') if any(p.search(l) for p in pats)]
            if hits: print(f'v{i} {m:08x} size {funcs[m][1]}'); [print('    ',h[:150]) for h in hits[:6]]
