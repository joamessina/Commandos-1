"""Vuelca la tabla de sonidos del exe (0x820f28..0x8218a8, 16 B/entrada): tag, WAV, u32 extra, descripcion.
uso: py soundtab.py   (salida TSV a stdout)"""
import struct, pefile
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
def cstr(va):
    if not (0x400000 <= va < 0x8a0000): return ''
    return pe.get_data(va - base, 80).split(b'\0')[0].decode('latin1')
lo, hi = 0x820f28, 0x8218a8
print('idx\ttag\tbytes_hex\twav\textra\tdesc')
for i, a in enumerate(range(lo, hi, 16)):
    t, w, x, d = struct.unpack('<IIII', pe.get_data(a - base, 16))
    tag = struct.pack('>I', t).decode('latin1')
    print('%d\t%s\t%08x\t%s\t%d\t%s' % (i, tag, t, cstr(w), x, cstr(d)))
