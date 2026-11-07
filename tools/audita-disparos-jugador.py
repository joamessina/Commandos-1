"""Desensambla las rutas de las armas de M0 desde el ejecutable original, sin modificarlo."""
import capstone
import pefile

EXE = 'D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe'
FUNCIONES = {
    'PISTOLA_ELEMENTO': (0x67A1F0, 429),
    'PISTOLA_PUNTO': (0x67A410, 402),
    'MIRILLA_ELEMENTO': (0x67AA30, 469),
    'MIRILLA_PUNTO': (0x67AC80, 442),
    'ARPON_ELEMENTO': (0x67AEB0, 411),
    'ARPON_PUNTO': (0x67B0C0, 384),
}

pe = pefile.PE(EXE)
motor = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
for nombre, (direccion, longitud) in FUNCIONES.items():
    print(f'\n{nombre} {direccion:08X}')
    for ins in motor.disasm(pe.get_data(direccion - pe.OPTIONAL_HEADER.ImageBase, longitud), direccion):
        print(f'{ins.address:08X} {ins.mnemonic:8} {ins.op_str}')
