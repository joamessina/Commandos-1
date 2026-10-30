"""Emula FUN_006B01D0 (constructor del cono de vision que dibuja ClassVisionVista) y captura cada rebanada (llamada a FUN_006B9580) y su tipo (FUN_006B93A0).
uso: py tools/emu_cono.py  (SIN -I). Solo lectura del exe."""
import struct, sys
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE)
B = pe.OPTIONAL_HEADER.ImageBase
f32 = lambda u: struct.unpack('<f', struct.pack('<I', u & 0xFFFFFFFF))[0]


def run(a, b, c, d, e10=0, heading=0.0, ang=70.0, ac=400.0, a4=800.0, x9=0.0):
    mu = Uc(UC_ARCH_X86, UC_MODE_32)
    mu.mem_map(B, (pe.OPTIONAL_HEADER.SizeOfImage + 0xFFF) & ~0xFFF)
    mu.mem_write(B, pe.header)
    for s in pe.sections:
        mu.mem_write(B + s.VirtualAddress, s.get_data())
    mu.mem_map(0, 0x1000)  # fs:[0] (SEH) con base 0
    mu.mem_map(0x20000000, 0x100000)
    mu.mem_map(0x10000000, 0x100000)
    this, cone, bicho = 0x20000000, 0x20010000, 0x20020000
    # cono (salida de GETOBJVISTAAMPLITUDQUESITOS, FUN_0061C390)
    vals = [1, 100.0, 200.0, 30.0, heading, a, b, c, d, x9, e10]
    for i, v in enumerate(vals):
        mu.mem_write(cone + 4 * i, struct.pack('<I', v) if isinstance(v, int) else struct.pack('<f', v))
    heap = [0x20040000]
    log = []
    sp = 0x10080000 - 16
    ret = 0x10000000
    mu.mem_write(sp, struct.pack('<III', ret, cone, bicho))
    mu.reg_write(UC_X86_REG_ESP, sp)
    mu.reg_write(UC_X86_REG_ECX, this)
    mu.mem_write(ret, b'\xF4')

    def stack(uc, n):
        esp = uc.reg_read(UC_X86_REG_ESP)
        return struct.unpack('<%dI' % n, uc.mem_read(esp + 4, 4 * n))

    def skip(uc, nargs, retval=0, thiscall=True):
        esp = uc.reg_read(UC_X86_REG_ESP)
        r = struct.unpack('<I', uc.mem_read(esp, 4))[0]
        uc.reg_write(UC_X86_REG_EIP, r)
        uc.reg_write(UC_X86_REG_ESP, esp + 4 + 4 * nargs)
        uc.reg_write(UC_X86_REG_EAX, retval)

    def hook(uc, addr, size, ud):
        if addr == 0x70b5a4:  # operator new
            skip(uc, 1, heap[0]); heap[0] += 0x100
        elif addr == 0x403f17 or addr == 0x406ca3:
            skip(uc, 0 if addr == 0x403f17 else 3)
        elif addr == 0x40382d:  # FUN_006B9580 rebanada
            log.append(('rebanada', [f32(x) for x in stack(uc, 8)]))
            skip(uc, 8)
        elif addr == 0x411969:  # FUN_006B93A0 tipo
            ecx = uc.reg_read(UC_X86_REG_ECX)
            log.append(('tipo', stack(uc, 3)[0]))
            skip(uc, 3)
    for ad in (0x70b5a4, 0x403f17, 0x406ca3, 0x40382d, 0x411969):
        mu.hook_add(UC_HOOK_CODE, hook, begin=ad, end=ad)
    try:
        mu.emu_start(0x6B01D0, ret, count=2_000_000)
    except Exception as ex:
        print('emu', ex, hex(mu.reg_read(UC_X86_REG_EIP)))
    return log


if __name__ == '__main__':
    for args in ((800.0, 70.0, 400.0, 800.0, 0), (800.0, 70.0, 400.0, 800.0, 1)):
        print('cono a,b,c,d,flag =', args)
        for e in run(*args)[:80]:
            print('  ', e)
