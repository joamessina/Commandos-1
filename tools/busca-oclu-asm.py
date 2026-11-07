"""Lista escrituras asm al desplazamiento 0x23c que pueden alterar el bit 2.

El offset aparece en otras clases: cada resultado debe atribuirse a su tipo real.
No detecta escrituras por alias con desplazamiento cero ni cambios mediante registros.
"""
import capstone
import pefile

pe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
motor = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
motor.detail = True
motor.skipdata = True
for seccion in pe.sections:
    if not seccion.Characteristics & 0x20000000:
        continue
    for ins in motor.disasm(seccion.get_data(), pe.OPTIONAL_HEADER.ImageBase + seccion.VirtualAddress):
        if not ins.id or len(ins.operands) < 2:
            continue
        destino, origen = ins.operands[:2]
        if destino.type != capstone.x86.X86_OP_MEM or destino.mem.disp != 0x23c:
            continue
        if ins.mnemonic in ('or', 'and', 'xor') and origen.type == capstone.x86.X86_OP_IMM:
            valor = origen.imm & 0xffffffff
            if (ins.mnemonic in ('or', 'xor') and valor & 2) or (ins.mnemonic == 'and' and not valor & 2):
                print(f'{ins.address:08x} {ins.mnemonic} {ins.op_str}')
        elif ins.mnemonic == 'mov':
            print(f'{ins.address:08x} {ins.mnemonic} {ins.op_str}')
