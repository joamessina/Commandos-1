"""Vuelca la tabla de ids de mensajes del exe (0x81A5B8: {id, nombre}); filtra por palabras clave. uso: py tools/msgtab.py"""
import pefile, struct
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
def rd(va, n): return pe.get_data(va - base, n)
def cstr(va):
    b = b''
    while True:
        c = rd(va + len(b), 1)
        if c == b'\0' or len(b) > 80: break
        b += c
    return b.decode('latin1')
T = 0x81a5b8
for i in range(0x29f):
    id_, p = struct.unpack('<iI', rd(T + i * 8, 8))
    n = cstr(p)
    if any(k in n for k in ('BOTON', 'MOUSE', 'KEY', 'ACTUASOBRE', 'SELECCIONAALIADO')):
        print(i, id_, hex(id_ & 0xffffffff), n)
