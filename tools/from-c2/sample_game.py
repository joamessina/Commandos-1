"""Mide el Commandos 2 original en ejecución leyendo la memoria del proceso (SOLO LECTURA: ReadProcessMemory).
Uso:
  py sample_game.py list                       -> lista las entidades de la misión abierta (para comprobar que las direcciones sirven)
  py sample_game.py log SALIDA.csv [filtro] [segundos]
                                                -> registra cada tick las entidades cuyo token contiene `filtro` (p. ej. COMANDO, ALE, JAPO)
Direcciones (Comm2.exe, base 0x400000 fija, ver docs/engine/motor-peaton.md y bucle-principal.md):
  mundo = u32(0xbcee6c); lista = u32(mundo+0x798); base = u32(lista); cantidad = u32(lista+4); entidad i = base + i*0x234
  entidad: +0x10 token, +0xa4 estado físico, +0xe0 escena, +0xe4/e8/ec posición (float), +0x104 rumbo (u32, 0x80000000 = 180°),
           +0x13c motor, +0x14c animador; motor: +0xb8 estado, +0x450/0x454 velocidad (float), +0x460 velocidad pedida;
           animador: +0x160 modo, +0x174 base, +0x17c giro, +0x184 locomoción, +0x188 quieto.
"""
import csv, ctypes, struct, sys, time
from ctypes import wintypes

PROCESS_VM_READ, PROCESS_QUERY_INFORMATION = 0x0010, 0x0400
k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.OpenProcess.restype = wintypes.HANDLE
k32.ReadProcessMemory.argtypes = [wintypes.HANDLE, wintypes.LPCVOID, wintypes.LPVOID, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]


def find_pid(name='Comm2.exe'):
    TH32CS_SNAPPROCESS = 2
    class PE(ctypes.Structure):
        _fields_ = [('dwSize', wintypes.DWORD), ('cntUsage', wintypes.DWORD), ('th32ProcessID', wintypes.DWORD), ('th32DefaultHeapID', ctypes.c_void_p),
                    ('th32ModuleID', wintypes.DWORD), ('cntThreads', wintypes.DWORD), ('th32ParentProcessID', wintypes.DWORD), ('pcPriClassBase', wintypes.LONG),
                    ('dwFlags', wintypes.DWORD), ('szExeFile', ctypes.c_char * 260)]
    snap = k32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
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
        self.h = k32.OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, False, pid)
        if not self.h: raise OSError('OpenProcess falló: %d' % ctypes.get_last_error())

    def read(self, addr, n):
        buf = ctypes.create_string_buffer(n); got = ctypes.c_size_t(0)
        if not k32.ReadProcessMemory(self.h, addr, buf, n, ctypes.byref(got)) or got.value != n: return None
        return buf.raw

    def u32(self, a):
        b = self.read(a, 4); return struct.unpack('<I', b)[0] if b else 0

    def f32(self, a):
        b = self.read(a, 4); return struct.unpack('<f', b)[0] if b else float('nan')


def entities(m):
    world = m.u32(0xbcee6c)
    lst = m.u32(world + 0x798) if world else 0
    base, count = (m.u32(lst), m.u32(lst + 4)) if lst else (0, 0)
    return world, base, count


def snapshot(m, base, i):
    e = base + i * 0x234
    raw = m.read(e, 0x234)
    if not raw: return None
    tok = raw[0x10:0x30].split(b'\0')[0].decode('latin1')
    u = lambda o: struct.unpack_from('<I', raw, o)[0]
    f = lambda o: struct.unpack_from('<f', raw, o)[0]
    row = dict(i=i, token=tok, fst=u(0xa4), scene=u(0xe0), x=f(0xe4), y=f(0xe8), z=f(0xec), heading=u(0x104), flags=u(0x9c))
    motor = u(0x13c); anim = u(0x14c)
    if motor:
        mr = m.read(motor, 0x470)
        if mr:
            row.update(mstate=struct.unpack_from('<I', mr, 0xb8)[0], vx=struct.unpack_from('<f', mr, 0x450)[0], vy=struct.unpack_from('<f', mr, 0x454)[0],
                       want=struct.unpack_from('<f', mr, 0x460)[0], run=mr[0x176], turn=struct.unpack_from('<I', mr, 0x3fc)[0], cls=struct.unpack_from('<I', mr, 0x11c)[0])
    if anim:
        ar = m.read(anim, 0x1b0)
        if ar:
            g = lambda o: struct.unpack_from('<i', ar, o)[0]
            row.update(amode=g(0x160), abase=g(0x174), aturn=g(0x17c), aloco=g(0x184), aidle=g(0x188))
    return row


def main():
    if len(sys.argv) < 2: print(__doc__); return
    pid = find_pid()
    if not pid: print('Comm2.exe no está en ejecución.'); return
    m = Mem(pid)
    world, base, count = entities(m)
    print('pid', pid, 'mundo', hex(world), 'base', hex(base), 'entidades', count)
    if not (0 < count < 20000): print('Las direcciones no cuadran (¿no hay misión abierta?).'); return
    if sys.argv[1] == 'list':
        for i in range(count):
            r = snapshot(m, base, i)
            if r and r['token'] and (r['fst'] < 64): print(r)
        return
    out, flt, secs = sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else ''), float(sys.argv[4]) if len(sys.argv) > 4 else 60
    ids = [i for i in range(count) if (s := snapshot(m, base, i)) and flt.lower() in s['token'].lower() and s['x'] == s['x']]
    print('siguiendo', len(ids), 'entidades con filtro', repr(flt), 'durante', secs, 's →', out)
    tick_addr = m.u32(0xbcee6c) + 0x5a4
    t0 = time.perf_counter(); last = None; rows = 0
    with open(out, 'w', newline='') as fh:
        w = None
        while time.perf_counter() - t0 < secs:
            tick = m.u32(tick_addr)
            if tick != last:
                last = tick
                for i in ids:
                    r = snapshot(m, base, i)
                    if not r: continue
                    r['t'] = round(time.perf_counter() - t0, 4); r['tick'] = tick
                    if w is None:
                        w = csv.DictWriter(fh, fieldnames=['t', 'tick'] + [k for k in r if k not in ('t', 'tick')], extrasaction='ignore'); w.writeheader()
                    w.writerow(r); rows += 1
            time.sleep(0.002)
    print('filas', rows)


main()
