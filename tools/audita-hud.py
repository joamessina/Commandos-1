"""Tablas del HUD del exe original (solo lectura; no exporta assets)."""
import struct
import pefile
import capstone

pe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
base = pe.OPTIONAL_HEADER.ImageBase

def read(va, n):
    return pe.get_data(va - base, n)

def string(va):
    return read(va, 128).split(b'\0')[0].decode('ascii', errors='replace')

for va in range(0x837adc, 0x837afc, 4):
    ptr = struct.unpack('<I', read(va, 4))[0]
    if not ptr:
        print(hex(va), 'FIN')
        break
    print(hex(va), string(ptr))

for va in (0x793734, 0x7938dc, 0x794688, 0x796190):
    print(hex(va), 'float', struct.unpack('<f', read(va, 4))[0],
          'double', struct.unpack('<d', read(va, 8))[0])

motor = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
motor.detail = True
reg = {capstone.x86.X86_REG_ESP: 0x100000}
mem = {}

def address(op):
    return reg.get(op.mem.base, 0) + reg.get(op.mem.index, 0) * op.mem.scale + op.mem.disp

def value(op):
    if op.type == capstone.x86.X86_OP_IMM:
        return op.imm
    if op.type == capstone.x86.X86_OP_REG:
        return reg.get(op.reg, 0)
    return mem[address(op)]

count = 0
for ins in motor.disasm(read(0x78c030, 0x2800), 0x78c030):
    ops = ins.operands
    esp = capstone.x86.X86_REG_ESP
    if ins.mnemonic == 'push':
        val = value(ops[0])
        reg[esp] -= 4
        mem[reg[esp]] = val
    elif ins.mnemonic == 'mov':
        val = value(ops[1])
        if ops[0].type == capstone.x86.X86_OP_REG:
            reg[ops[0].reg] = val
        else:
            mem[address(ops[0])] = val
    elif ins.mnemonic == 'xor' and ops[0].reg == ops[1].reg:
        reg[ops[0].reg] = 0
    elif ins.mnemonic in ('sub', 'add'):
        reg[ops[0].reg] += value(ops[1]) * (-1 if ins.mnemonic == 'sub' else 1)
    elif ins.mnemonic == 'call' and value(ops[0]) == 0x4033b9:
        args = [mem[reg[esp] + i * 4] for i in range(26)]
        if not args[0]:
            break
        frames = [(string(args[8 + 4 * i]), args[6 + 4 * i], args[7 + 4 * i], args[9 + 4 * i])
                  for i in range(5) if args[8 + 4 * i]]
        print(hex(ins.address), string(args[0]), 'id', args[1], 'frames(sprite,x,y,tiempo)', frames)
        reg[esp] += 104
        count += 1
    else:
        raise ValueError(f'Instrucción no cubierta: {ins.address:x} {ins.mnemonic} {ins.op_str}')
print('cursores', count)
