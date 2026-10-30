"""Lista las llamadas de una funcion del exe de la raiz. uso: py tools/dis_range.py <hex_inicio> <hex_largo>"""
import pefile, sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
pe = pefile.PE(r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe')
B = pe.OPTIONAL_HEADER.ImageBase
a, n = int(sys.argv[1], 16), int(sys.argv[2], 16)
for i in Cs(CS_ARCH_X86, CS_MODE_32).disasm(pe.get_data(a - B, n), a):
    if i.mnemonic in ('call',) or (len(sys.argv) > 3):
        print('%x  %-8s %s' % (i.address, i.mnemonic, i.op_str))
