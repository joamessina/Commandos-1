"""Claves que el exe lee con GetBlock (FUN_00424660) y quien las lee. Salida TSV: clave, dir_string, #lecturas, funciones(prim.).
uso: py keyscan.py > salida.tsv"""
import sys, struct, pefile, collections, bisect, pickle
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
sec = pe.sections[0]; code = pe.get_data(sec.VirtualAddress, sec.Misc_VirtualSize); cb = base + sec.VirtualAddress
def follow(va):
    for _ in range(4):
        o = va - cb
        if 0 <= o < len(code) and code[o] == 0xE9: va = (va + 5 + struct.unpack('<i', code[o+1:o+5])[0]) & 0xFFFFFFFF
        else: break
    return va
def cstr(va):
    try: d = pe.get_data(va - base, 48)
    except Exception: return None
    s = d.split(b'\0')[0]
    return s.decode('latin1') if 1 <= len(s) < 40 and all(32 <= c < 127 for c in s) else None
idx = pickle.load(open(r'D:\Joaquin\research-c1\exe_index2.pkl', 'rb')); ks = sorted(idx)
def owner(va): return ks[bisect.bisect_right(ks, va) - 1]
tg = {follow(0x424660)}
res = collections.defaultdict(list); i = 0
while True:
    i = code.find(b'\xE8', i)
    if i < 0: break
    rel = struct.unpack('<i', code[i+1:i+5])[0]; t = (cb + i + 5 + rel) & 0xFFFFFFFF
    if t in tg or follow(t) in tg:
        pre = code[max(0, i-48):i]; imms = []; j = 0
        while j < len(pre):
            if pre[j] == 0x68 and j + 5 <= len(pre): imms.append(struct.unpack('<I', pre[j+1:j+5])[0]); j += 5
            else: j += 1
        for v in imms[-2:][::-1]:
            s = cstr(v) if 0x792000 <= v < 0x8a0000 else None
            if s: res[s].append((v, owner(cb + i))); break
    i += 1
for k in sorted(res):
    v = res[k]; fs = sorted({hex(f) for _, f in v})
    print('%s\t%x\t%d\t%s' % (k, v[0][0], len(v), ','.join(fs[:4])))
