import pefile, sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); B = pe.OPTIONAL_HEADER.ImageBase
a, n = int(sys.argv[1], 16), int(sys.argv[2], 16)
d = pe.get_data(a - B, n)
for i in Cs(CS_ARCH_X86, CS_MODE_32).disasm(d, a):
    print('%x  %-8s %s' % (i.address, i.mnemonic, i.op_str))
