"""Resuelve vtable de una clase RTTI siguiendo stubs jmp (E9) del exe.
uso: py vtres.py Clase [Clase...]  -> imprime slot, direccion de la entrada y destino final"""
import json, sys, struct, pefile
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE)
base = pe.OPTIONAL_HEADER.ImageBase
def rd(va, n):
    return pe.get_data(va - base, n)
def follow(va):
    for _ in range(5):
        b = rd(va, 5)
        if b[0] == 0xE9:
            va = (va + 5 + struct.unpack('<i', b[1:])[0]) & 0xFFFFFFFF
        else:
            break
    return va
rt = json.load(open(r'D:\Joaquin\research-c1\rtti.json'))
for c in sys.argv[1:]:
    for v in rt[c]['vts']:
        print(c, 'vtable %08x' % v['va'], 'bases', rt[c]['bases'])
        for i, m in enumerate(v['m']):
            print('  [%2d] %08x -> %08x' % (i, m, follow(m)))
