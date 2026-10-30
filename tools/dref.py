"""Referencias de datos (imm32) a una direccion del exe y funcion que las contiene (usa los .c de ghidra/all). uso: py tools/dref.py <hex> [...]"""
import pefile, re, struct, sys, glob, bisect
pe = pefile.PE(r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe')
B = pe.OPTIONAL_HEADER.ImageBase
funcs = []
for f in glob.glob(r'D:\Joaquin\research-c1\ghidra\all\fn_*.c'):
    for m in re.finditer(r'^//// ([0-9a-f]{8}) (\S+) size (\d+)', open(f, encoding='utf8', errors='replace').read(), re.M):
        funcs.append((int(m.group(1), 16), m.group(2), int(m.group(3))))
funcs.sort()
addrs = [f[0] for f in funcs]
for arg in sys.argv[1:]:
    pat = struct.pack('<I', int(arg, 16))
    for s in pe.sections:
        d = s.get_data(); base = B + s.VirtualAddress
        i = d.find(pat)
        while i >= 0:
            va = base + i
            k = bisect.bisect_right(addrs, va) - 1
            print(arg, s.Name.rstrip(b'\0').decode(), hex(va), funcs[k][1] if k >= 0 and va < funcs[k][0] + funcs[k][2] else '-')
            i = d.find(pat, i + 1)
