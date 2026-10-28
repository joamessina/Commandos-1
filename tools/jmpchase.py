"""Sigue stubs jmp rel32 del exe: py tools/jmpchase.py <hex>...  (devuelve destino final)"""
import sys, pefile
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
for a in sys.argv[1:]:
    va = int(a, 16); chain = [va]
    while True:
        b = pe.get_data(va - base, 5)
        if b[0] != 0xE9: break
        va = (va + 5 + int.from_bytes(b[1:5], 'little', signed=True)) & 0xFFFFFFFF; chain.append(va)
    print(' -> '.join(f'{x:08x}' for x in chain))
