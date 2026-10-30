"""Busca pruebas de flags en el exe raíz; solo imprime direcciones y contexto asm."""
from collections import deque
from bisect import bisect_right
from pathlib import Path
import re
import capstone
import pefile


pe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
motor = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
motor.detail = True
motor.skipdata = True
previas = deque(maxlen=5)
funciones = []
for archivo in Path('D:/Joaquin/research-c1/ghidra/all2').glob('fn_*.c'):
    for numero, linea in enumerate(archivo.read_text(encoding='utf-8', errors='replace').splitlines(), 1):
        marca = re.match(r'//// ([0-9a-f]{8}) (\S+) size (\d+)', linea)
        if marca:
            funciones.append((int(marca[1], 16), archivo.name, numero, marca[2]))
funciones.sort()
direcciones = [f[0] for f in funciones]
for seccion in pe.sections:
    if not seccion.Characteristics & 0x20000000:
        continue
    for ins in motor.disasm(seccion.get_data(), pe.OPTIONAL_HEADER.ImageBase + seccion.VirtualAddress):
        if ins.id:
            for op in ins.operands:
                if op.type == capstone.x86.X86_OP_IMM and ins.mnemonic in ('test', 'bt'):
                    valor = op.imm & 0xffffffff
                    memoria_flags = any(o.type == capstone.x86.X86_OP_MEM and o.mem.disp == 0x23c for o in ins.operands)
                    if memoria_flags and ((ins.mnemonic == 'test' and valor & 0x1000000 and valor.bit_count() <= 5)
                                          or (ins.mnemonic == 'bt' and valor == 24)):
                        indice = bisect_right(direcciones, ins.address) - 1
                        if indice >= 0:
                            _, archivo, linea, nombre = funciones[indice]
                            print(f'{archivo}:{linea} {nombre}')
                        print('\n'.join(previas))
                        print(f'{ins.address:08x}: {ins.mnemonic} {ins.op_str}\n')
        previas.append(f'{ins.address:08x}: {ins.mnemonic} {ins.op_str}')
