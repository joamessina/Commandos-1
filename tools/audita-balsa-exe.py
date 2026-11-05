"""Desensambla el recorte de sprites usado por la balsa, leyendo el exe sin modificarlo."""
import capstone
import pefile

pe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
dis = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
for address, length in ((0x590F20, 123), (0x4C2430, 123), (0x4C1F00, 86)):
    print(f'FUN_{address:08X}')
    for instruction in dis.disasm(pe.get_data(address - pe.OPTIONAL_HEADER.ImageBase, length), address):
        print(f'{instruction.address:08X} {instruction.mnemonic} {instruction.op_str}')
