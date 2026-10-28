"""Une claves de archivos (claves_c1.tsv de verify_mis.py) con lecturas del exe (keyscan.py) y clase lectora.
uso: py vocab.py > vocab_c1.tsv"""
import os, re, collections
T = os.environ.get('TEMP', '.')
fk = {l.split('\t')[0]: l.rstrip('\n').split('\t') for l in open(T + r'\claves_c1.tsv', encoding='utf8')}
ek = {l.split('\t')[0].upper(): l.rstrip('\n').split('\t') for l in open(r'D:\Joaquin\research-c1\exe_keys_getblock.tsv', encoding='utf8')}
m2c = {}
for l in open(r'D:\Joaquin\research-c1\class_methods.tsv', encoding='latin1'):
    p = l.rstrip('\n').split('\t')
    if len(p) >= 4:
        try: m2c.setdefault(int(p[3], 16), p[0])
        except ValueError: pass
# direcciones de metodos (tras seguir stubs) -> clase, via vtres
import json, struct, pefile
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
def follow(va):
    for _ in range(5):
        try: b = pe.get_data(va - base, 5)
        except Exception: return va
        if b[0] == 0xE9: va = (va + 5 + struct.unpack('<i', b[1:])[0]) & 0xFFFFFFFF
        else: break
    return va
rt = json.load(open(r'D:\Joaquin\research-c1\rtti.json'))
fcls = collections.defaultdict(set)
for c, v in rt.items():
    for vt in v['vts']:
        for m in vt['m']: fcls[follow(m)].add(c)
print('clave\tocurrencias\tarchivos\tpadre_tipico\tstring_exe\tlecturas_exe\tfunciones\tclases')
for k in sorted(set(fk) | set(ek)):
    f = fk.get(k); e = ek.get(k)
    fn = [int(x, 16) for x in e[3].split(',')] if e and len(e) > 3 and e[3] else []
    cl = sorted({c for a in fn for c in fcls.get(a, ())})
    print('\t'.join([k, f[1] if f else '0', f[2] if f else '0', (f[3].split(',')[0] if f and len(f) > 3 else ''), e[1] if e else '', e[2] if e else '0', e[3] if e else '', ','.join(cl)]))
