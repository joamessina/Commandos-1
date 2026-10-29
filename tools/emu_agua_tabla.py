"""Emula FUN_006487D0 (tablas senoidales del agua, amplitud 8.0) y compara con la formula en float32 + truncado.
uso: py tools/emu_agua_tabla.py (SIN -I)"""
import math, struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import *

EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE)
B = pe.OPTIONAL_HEADER.ImageBase
mu = Uc(UC_ARCH_X86, UC_MODE_32)
mu.mem_map(B, (pe.OPTIONAL_HEADER.SizeOfImage + 0xFFF) & ~0xFFF)
mu.mem_write(B, pe.header)
for s in pe.sections:
    mu.mem_write(B + s.VirtualAddress, s.get_data())
mu.mem_map(0x10000000, 0x100000)
mu.mem_map(0x20000000, 0x10000)
# sin del CRT (0x70B780) usa SSE2 si [0x8857e4] != 0; lo dejamos como esta en el exe
sp = 0x10080000 - 8
mu.mem_write(sp, struct.pack('<If', 0x10000000, 8.0))
mu.mem_write(0x10000000, b'\xF4')
mu.reg_write(UC_X86_REG_ESP, sp)
mu.reg_write(UC_X86_REG_ECX, 0x20000000)
# cr4/mxcsr: habilitar SSE si el exe lo usa
try:
    mu.emu_start(0x6487D0, 0x10000000, count=2_000_000)
except Exception as e:
    print('emu', e, hex(mu.reg_read(UC_X86_REG_EIP)))
s8 = [struct.unpack('<b', mu.mem_read(0x8761C8 + i, 1))[0] for i in range(256)]
s32 = [struct.unpack('<i', mu.mem_read(0x875DC8 + 4 * i, 4))[0] for i in range(256)]

f32 = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]
ang, c8, c32 = 0.0, [], []
for i in range(256):
    v = f32(math.sin(ang)) * 8.0
    c8.append(int(v)); c32.append(int(v * 65536.0))
    ang = f32(ang + 0.02454369328916073)
print('S8 dif', sum(a != b for a, b in zip(s8, c8)), 'S32 dif', sum(a != b for a, b in zip(s32, c32)))
print(s8[:8], s8[60:68], s8[250:])
print([ (i, s8[i], c8[i]) for i in range(256) if s8[i] != c8[i]][:5])
print([ (i, s32[i], c32[i]) for i in range(256) if s32[i] != c32[i]][:5])
