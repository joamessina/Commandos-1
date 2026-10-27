import re,struct,json,sys
sys.path.insert(0,'.')
from exe import *
data_secs=[s for s in SECS if s[4] in ('.rdata','.data')]
text_lo,text_sz=SECS[0][0],SECS[0][1]
def in_text(v): return text_lo<=v<text_lo+text_sz
# todas las descriptor strings
descs={}
for m in re.finditer(rb'\.\?A[VU]([A-Za-z0-9_?$@]+?)@@\x00',DATA):
    va=off2va(m.start())
    if va: descs[va-8]=m.group(1).decode()+'@@'
print(len(descs),'type descriptors')
# buscar dwords en .rdata
def find_dword(val,secs):
    pat=struct.pack('<I',val); res=[]
    for v,vs,ro,rs,_ in secs:
        seg=DATA[ro:ro+rs]
        for mm in re.finditer(re.escape(pat),seg):
            if mm.start()%4==0: res.append(v+mm.start())
    return res
out={}
for dva,name in descs.items():
    cols=[]
    for p in find_dword(dva,data_secs):
        c=p-12
        o=va2off(c)
        if o is not None and struct.unpack_from('<I',DATA,o)[0]==0:
            cols.append(c)
    for col in cols:
        for p in find_dword(col,data_secs):
            vt=p+4
            meths=[]
            i=0
            while True:
                o=va2off(vt+4*i)
                if o is None: break
                v=struct.unpack_from('<I',DATA,o)[0]
                if not in_text(v): break
                meths.append(v); i+=1
                if i>300: break
            out.setdefault(name,[]).append({'vt':vt,'n':len(meths),'m':meths})
json.dump(out,open('rtti.json','w'))
print(len(out),'clases con vtable')
