"""Emula FUN_006491E0 (generador del agua, exe de la raiz) con unicorn para recuperar la formula del desplazamiento.
uso: py tools/emu_agua.py   (SIN -I: unicorn/pefile estan en el sitio de usuario). Solo lectura del exe."""
import math, struct, sys
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE)
B = pe.OPTIONAL_HEADER.ImageBase
FN = 0x6491E0


def tablas():
    """Tablas de FUN_006487D0 (amplitud 8.0): angulo float32 acumulado, seno a float32, truncado (verificado por emulacion)."""
    f32 = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]
    ang, s8, s32 = 0.0, [], []
    for _ in range(256):
        v = f32(math.sin(ang)) * 8.0
        s8.append(int(v)); s32.append(int(v * 65536.0))
        ang = f32(ang + 0.02454369328916073)
    return s8, s32


def run(src, phase, offx, offy, typ, dstw=258, dsth=256):
    mu = Uc(UC_ARCH_X86, UC_MODE_32)
    mu.mem_map(B, (pe.OPTIONAL_HEADER.SizeOfImage + 0xFFF) & ~0xFFF)
    mu.mem_write(B, pe.header)
    for s in pe.sections:
        mu.mem_write(B + s.VirtualAddress, s.get_data())
    SC = 0x20000000
    mu.mem_map(SC, 0x400000)
    mu.mem_map(0x10000000, 0x100000)
    # tablas senoidales (FUN_006487D0, amplitud 8.0, paso 2*pi/256, i = 0..255)
    s8, s32 = tablas()
    for i in range(256):
        mu.mem_write(0x8761C8 + i, struct.pack('<b', s8[i]))
        mu.mem_write(0x875DC8 + 4 * i, struct.pack('<i', s32[i]))
    mu.mem_write(0x875DA8, struct.pack('<I', 1))
    # estructuras: ctx -> *ctx = lista {+0xC count, +0x10 array de imagenes}
    lst, arr, ctx = SC, SC + 0x40, SC + 0x80
    img_s, img_d = SC + 0x100, SC + 0x200
    pix_s, pix_d = SC + 0x1000, SC + 0x20000
    mu.mem_write(ctx, struct.pack('<I', lst))
    mu.mem_write(lst + 0xC, struct.pack('<I', 2))
    mu.mem_write(lst + 0x10, struct.pack('<I', arr))
    mu.mem_write(arr, struct.pack('<II', img_s, img_d))
    for img, pix in ((img_s, pix_s), (img_d, pix_d)):
        mu.mem_write(img + 0x20, struct.pack('<I', pix))
        mu.mem_write(img + 0x48, struct.pack('<I', 256))
        mu.mem_write(img + 0x4C, struct.pack('<I', 256))
        mu.mem_write(img + 0x34, struct.pack('<I', 256 * 256))
    mu.mem_write(pix_s, bytes(src))
    mu.mem_write(pix_d, bytes(dstw * dsth))
    offp = SC + 0x300
    mu.mem_write(offp, struct.pack('<ff', offx, offy))
    sp = 0x10080000
    ret = 0x10000000
    # thiscall: ecx = ctx; args (derecha a izquierda): param_6, param_5, param_4, param_3, param_2
    args = [0, 1, struct.unpack('<I', struct.pack('<f', phase))[0], offp, typ]  # param_2=src idx 0, param_3=dst idx 1
    # orden en pila: [ret, p2, p3, p4, p5, p6]
    p2, p3, p4, p5, p6 = 0, 1, struct.unpack('<I', struct.pack('<f', phase))[0], offp, typ
    sp -= 4 * 6
    mu.mem_write(sp, struct.pack('<IIIIII', ret, p2, p3, p4, p5, p6))
    mu.reg_write(UC_X86_REG_ESP, sp)
    mu.reg_write(UC_X86_REG_ECX, ctx)
    mu.mem_write(ret, b'\xF4')  # hlt

    def hook(uc, addr, size, ud):
        if addr == 0x646830:  # FUN_00646830: normaliza la imagen; no hace falta
            esp = uc.reg_read(UC_X86_REG_ESP)
            r = struct.unpack('<I', uc.mem_read(esp, 4))[0]
            uc.reg_write(UC_X86_REG_EIP, r)
            uc.reg_write(UC_X86_REG_ESP, esp + 4)
    mu.hook_add(UC_HOOK_CODE, hook, begin=0x646830, end=0x646831)
    try:
        mu.emu_start(FN, ret, count=5_000_000)
    except Exception as e:
        print('emu', e, hex(mu.reg_read(UC_X86_REG_EIP)))
    return bytes(mu.mem_read(pix_d, dstw * dsth))


if __name__ == '__main__':
    xs = [x for y in range(256) for x in range(256)]
    ys = [y for y in range(256) for x in range(256)]
    typ = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    out_x = run(xs, 0.0, 0.0, 0.0, typ)
    out_y = run(ys, 0.0, 0.0, 0.0, typ)
    print('tipo', typ)
    for Y in (0, 1, 2, 3, 15, 16, 17, 100):
        print('Y', Y, 'sx', [out_x[Y * 258 + X] for X in (0, 1, 2, 3, 15, 16, 17, 100)], 'sy', [out_y[Y * 258 + X] for X in (0, 1, 2, 3, 15, 16, 17, 100)])
