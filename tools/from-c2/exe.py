"""Utilidades de análisis estático de Comm2.exe (solo lectura, para entender reglas; no se copia código)."""
import re, struct, sys
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

EXE = r"H:\SteamLibrary\steamapps\common\Commandos 2 Men of Courage\Comm2.exe"
pe = pefile.PE(EXE)
BASE = pe.OPTIONAL_HEADER.ImageBase
DATA = open(EXE, "rb").read()
SECS = [(BASE + s.VirtualAddress, s.Misc_VirtualSize, s.PointerToRawData, s.SizeOfRawData, s.Name.rstrip(b"\0").decode()) for s in pe.sections]
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = False


def va2off(va):
    for v, vs, ro, rs, _ in SECS:
        if v <= va < v + max(vs, rs):
            o = va - v
            return ro + o if o < rs else None
    return None


def off2va(off):
    for v, vs, ro, rs, _ in SECS:
        if ro <= off < ro + rs:
            return v + off - ro
    return None


def read(va, n):
    o = va2off(va)
    return DATA[o:o + n] if o is not None else b""


def cstr(va, maxn=200):
    b = read(va, maxn)
    e = b.find(b"\0")
    return b[: e if e >= 0 else maxn].decode("latin1")


def is_text(va):
    return SECS[0][0] <= va < SECS[0][0] + SECS[0][1]


def string_at(va):
    """Devuelve la cadena si `va` apunta a texto imprimible en una sección de datos."""
    if is_text(va) or va2off(va) is None:
        return None
    s = cstr(va, 80)
    if len(s) >= 3 and all(32 <= ord(c) < 127 or c in "\r\n\t" for c in s):
        return s
    return None


def find_string_vas(text):
    pat = text.encode("latin1")
    out = []
    for m in re.finditer(re.escape(pat), DATA):
        v = off2va(m.start())
        if v:
            out.append(v)
    return out


def xrefs_to(va):
    """Offsets VA de instrucciones que contienen `va` como inmediato de 32 bits (push/mov/lea con dirección absoluta)."""
    pat = struct.pack("<I", va)
    res = []
    text_v, text_s, text_o, text_rs, _ = SECS[0]
    seg = DATA[text_o:text_o + text_rs]
    for m in re.finditer(re.escape(pat), seg):
        res.append(text_v + m.start())
    return res


def disasm(va, n=256, annotate=True):
    code = read(va, n)
    out = []
    for ins in md.disasm(code, va):
        note = ""
        if annotate:
            for tok in re.findall(r"0x[0-9a-f]{6,8}", ins.op_str):
                t = int(tok, 16)
                s = string_at(t)
                if s is not None:
                    note += f'   ; "{s[:60]}"'
        out.append(f"{ins.address:08x}  {ins.mnemonic:6s} {ins.op_str}{note}")
    return "\n".join(out)


def func_start(va, back=0x400):
    """Heurística: retrocede hasta un prólogo típico (push ebp; mov ebp, esp o sub esp) tras int3/ret/nop."""
    code = read(va - back, back)
    best = None
    for i in range(len(code) - 3):
        if code[i] == 0x55 and code[i + 1] == 0x8B and code[i + 2] == 0xEC:
            best = va - back + i
        elif code[i - 1:i] in (b"\xcc", b"\xc3") and code[i] in (0x83, 0x81, 0x6A, 0x64, 0x53, 0x56, 0x8B, 0x51, 0x55):
            best = va - back + i
    return best


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "str":
        for v in find_string_vas(sys.argv[2]):
            print(hex(v), cstr(v, 60), [hex(x) for x in xrefs_to(v)][:10])
    elif cmd == "dis":
        print(disasm(int(sys.argv[2], 16), int(sys.argv[3]) if len(sys.argv) > 3 else 256))
