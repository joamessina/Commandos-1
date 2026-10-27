import re,glob,sys
pat=re.compile(sys.argv[1])
ctx=int(sys.argv[2]) if len(sys.argv)>2 else 0
for f in sorted(glob.glob(r'D:\Joaquin\research\ghidra\all\fn_*.c')):
    cur=None; lines=open(f,encoding='utf-8',errors='replace').read().split('\n')
    for i,l in enumerate(lines):
        if l.startswith('//// '): cur=l[5:].strip()
        elif pat.search(l):
            print(cur,'|',l.strip()[:140])
