"""Desensambla N bytes del exe en una VA y sigue 'jmp rel32' de stubs. uso: py tools/exedis.py <hex> [n=40]"""
import sys, pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
def rd(va, n): return pe.get_data(va - base, n)
va = int(sys.argv[1], 16); n = int(sys.argv[2]) if len(sys.argv) > 2 else 40
md = Cs(CS_ARCH_X86, CS_MODE_32)
while True:
    b = rd(va, 5)
    if b[0] == 0xE9:
        t = (va + 5 + int.from_bytes(b[1:5], 'little', signed=True)) & 0xFFFFFFFF
        print(f'{va:08x}: jmp {t:08x}'); va = t
    else: break
for i in md.disasm(rd(va, n), va): print(f'{i.address:08x}: {i.mnemonic} {i.op_str}')
