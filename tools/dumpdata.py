"""Vuelca palabras u32 del exe. uso: py dumpdata.py <hexVA> <ncount> [stride_words=4]  (muestra strings si el valor apunta a cadena)"""
import sys, struct, pefile
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
def cstr(va):
    try:
        d = pe.get_data(va - base, 64)
    except Exception: return None
    s = d.split(b'\0')[0]
    if len(s) >= 3 and all(32 <= c < 127 for c in s): return s.decode()
    return None
va = int(sys.argv[1], 16); n = int(sys.argv[2]); st = int(sys.argv[3]) if len(sys.argv) > 3 else 4
for r in range(0, n, st):
    ws = struct.unpack('<%dI' % st, pe.get_data(va + r*4 - base, st*4))
    ann = []
    for w in ws:
        s = cstr(w) if 0x400000 <= w < 0x8a0000 else None
        t = struct.pack('<I', w); tt = t.decode('latin1') if all(32 <= c < 127 for c in t) else ''
        ann.append('%08x%s' % (w, ('"%s"' % s if s else ('<%s>' % tt if tt else ''))))
    print('%08x: %s' % (va + r*4, ' '.join(ann)))
