"""Mide el Commandos 1 original (coman_mp.exe de la raiz) leyendo su memoria. SOLO LECTURA (ReadProcessMemory).
Layout del bicho leido en el exe (docs/research/q1-movimiento.md): +0x08/+0x0C/+0x10 posicion (float), +0x14 token (cadena),
+0xE4 sector actual (ptr), +0x220 motor, +0x23C flags (0x40 agachado), +0x7D0 velocidad de correr.
Uso:
  py tools/sample_c1.py find [TOKEN...]            -> busca los bichos en memoria (por token + posicion plausible) e imprime sus datos
  py tools/sample_c1.py log SALIDA.csv TOKEN SEG    -> registra cada cambio de posicion (t, x, y, z, sector, flags) durante SEG segundos
"""
import csv, ctypes, struct, sys, time
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.OpenProcess.restype = wintypes.HANDLE
k32.ReadProcessMemory.argtypes = [wintypes.HANDLE, wintypes.LPCVOID, wintypes.LPVOID, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
k32.VirtualQueryEx.argtypes = [wintypes.HANDLE, wintypes.LPCVOID, ctypes.c_void_p, ctypes.c_size_t]


class MBI(ctypes.Structure):
    _fields_ = [('Base', ctypes.c_void_p), ('AllocBase', ctypes.c_void_p), ('AllocProt', wintypes.DWORD), ('Region', ctypes.c_size_t),
                ('State', wintypes.DWORD), ('Prot', wintypes.DWORD), ('Type', wintypes.DWORD)]


def find_pid(name='coman_mp.exe'):
    class PE(ctypes.Structure):
        _fields_ = [('dwSize', wintypes.DWORD), ('cntUsage', wintypes.DWORD), ('th32ProcessID', wintypes.DWORD), ('th32DefaultHeapID', ctypes.c_void_p),
                    ('th32ModuleID', wintypes.DWORD), ('cntThreads', wintypes.DWORD), ('th32ParentProcessID', wintypes.DWORD), ('pcPriClassBase', wintypes.LONG),
                    ('dwFlags', wintypes.DWORD), ('szExeFile', ctypes.c_char * 260)]
    snap = k32.CreateToolhelp32Snapshot(2, 0)
    pe = PE(); pe.dwSize = ctypes.sizeof(PE)
    ok = k32.Process32First(snap, ctypes.byref(pe))
    while ok:
        if pe.szExeFile.decode('latin1').lower() == name.lower():
            k32.CloseHandle(snap); return pe.th32ProcessID
        ok = k32.Process32Next(snap, ctypes.byref(pe))
    k32.CloseHandle(snap)
    return None


class Mem:
    def __init__(self, pid):
        self.h = k32.OpenProcess(0x0010 | 0x0400, False, pid)  # VM_READ | QUERY_INFORMATION
        if not self.h: raise OSError('OpenProcess fallo: %d' % ctypes.get_last_error())

    def read(self, addr, n):
        buf = ctypes.create_string_buffer(n); got = ctypes.c_size_t(0)
        if not k32.ReadProcessMemory(self.h, addr, buf, n, ctypes.byref(got)) or got.value != n: return None
        return buf.raw

    def regions(self):
        a, mbi = 0x10000, MBI()
        while a < 0x7FFF0000 and k32.VirtualQueryEx(self.h, a, ctypes.byref(mbi), ctypes.sizeof(mbi)):
            if mbi.State == 0x1000 and mbi.Prot in (0x04, 0x40, 0x08, 0x80) and mbi.Type == 0x20000:  # commit, RW, privada
                yield mbi.Base, mbi.Region
            a = mbi.Base + mbi.Region


def find_bichos(m, tokens):
    out = []
    pats = [t.encode() + b'\0' for t in tokens]
    for base, size in m.regions():
        for off in range(0, size, 0x100000):
            n = min(0x100000 + 64, size - off)
            blk = m.read(base + off, n)
            if not blk: continue
            for p in pats:
                i = blk.find(p)
                while i >= 0:
                    tok_addr = base + off + i
                    b = tok_addr - 0x14
                    x, y, z = struct.unpack_from('<fff', m.read(b + 8, 12) or b'\0' * 12)
                    if 1 < x < 20000 and 1 < y < 20000 and -2000 < z < 2000:
                        out.append((b, p[:-1].decode(), x, y, z))
                    i = blk.find(p, i + 1)
    return out


def row(m, b):
    raw = m.read(b, 0x240)
    if not raw: return None
    x, y, z = struct.unpack_from('<fff', raw, 8)
    sector, motor, flags = struct.unpack_from('<III', raw, 0xE4)[0], struct.unpack_from('<I', raw, 0x220)[0], struct.unpack_from('<I', raw, 0x23C)[0]
    return x, y, z, sector, motor, flags


if __name__ == '__main__':
    pid = find_pid()
    if not pid: sys.exit('coman_mp.exe no esta corriendo')
    m = Mem(pid)
    if sys.argv[1] == 'find':
        toks = sys.argv[2:] or ['COMANDO', 'FRANCOT', 'LANCHERO', 'ARTIFIC']
        for b, t, x, y, z in find_bichos(m, toks):
            r = row(m, b)
            print('%08x %-9s x=%.1f y=%.1f z=%.1f sector=%08x motor=%08x flags=%08x' % ((b, t) + r[:3] + r[3:]) if r else hex(b))
    elif sys.argv[1] == 'log':
        out, tok, secs = sys.argv[2], sys.argv[3], float(sys.argv[4])
        cand = [c for c in find_bichos(m, [tok])]
        if not cand: sys.exit('no encontre %s' % tok)
        b = cand[0][0]
        print('bicho en %08x' % b)
        t0, last, rows = time.perf_counter(), None, []
        while time.perf_counter() - t0 < secs:
            r = row(m, b)
            if r and r != last:
                rows.append((time.perf_counter() - t0,) + r); last = r
        with open(out, 'w', newline='') as f:
            w = csv.writer(f); w.writerow(['t', 'x', 'y', 'z', 'sector', 'motor', 'flags']); w.writerows(rows)
        print(len(rows), 'cambios ->', out)
