"""Lector del exe (copia en D:) para volcar tablas de datos. Solo lectura."""
import struct, pefile
EXE = r"D:\Joaquin\research\ghidra\Comm2.exe"
pe = pefile.PE(EXE)
BASE = pe.OPTIONAL_HEADER.ImageBase
DATA = open(EXE, "rb").read()
SECS = [(BASE + s.VirtualAddress, s.Misc_VirtualSize, s.PointerToRawData, s.SizeOfRawData) for s in pe.sections]
def va2off(va):
    for v, vs, ro, rs in SECS:
        if v <= va < v + max(vs, rs):
            o = va - v
            return ro + o if o < rs else None
    return None
def read(va, n):
    o = va2off(va); return DATA[o:o+n] if o is not None else b""
def u32(va): return struct.unpack("<I", read(va,4))[0]
def i32(va):
    b = read(va,4)
    return struct.unpack("<i", b if len(b) == 4 else b"\0\0\0\0")[0]
def f32(va): return struct.unpack("<f", read(va,4))[0]
def cstr(va, n=100):
    b = read(va, n); e = b.find(b"\0"); return b[: e if e>=0 else n].decode("latin1")
def f64(va): return struct.unpack("<d", read(va,8))[0]
def k(a):
    b=read(a,8)
    if len(b)<8: b=b+b'\0'*(8-len(b))
    return f"{a:#x}: f32={struct.unpack('<f',b[:4])[0]:.6g} f64={struct.unpack('<d',b)[0]:.6g} u32={struct.unpack('<I',b[:4])[0]:#x}"
