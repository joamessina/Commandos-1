"""Para cada llamada (E8) al destino dado (siguiendo stubs jmp), muestra los 'push imm' previos.
uso: py callargs.py <hexVA> [nprev=3]"""
import sys, struct, pefile, collections
EXE = r'D:\SteamLibrary\steamapps\common\Commandos Beyond the Call of Duty\coman_mp.exe'
pe = pefile.PE(EXE); base = pe.OPTIONAL_HEADER.ImageBase
sec = pe.sections[0]; code = pe.get_data(sec.VirtualAddress, sec.Misc_VirtualSize); cb = base + sec.VirtualAddress
def follow(va):
    for _ in range(4):
        o = va - cb
        if 0 <= o < len(code) and code[o] == 0xE9:
            va = (va + 5 + struct.unpack('<i', code[o+1:o+5])[0]) & 0xFFFFFFFF
        else: break
    return va
tgt = follow(int(sys.argv[1], 16)); n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
out = []
i = 0
while True:
    i = code.find(b'\xE8', i)
    if i < 0: break
    rel = struct.unpack('<i', code[i+1:i+5])[0] if i + 5 <= len(code) else 0
    t = (cb + i + 5 + rel) & 0xFFFFFFFF
    if t == tgt or follow(t) == tgt:
        # buscar push imm32 (68) o push imm8 (6A) hacia atrás ~ 40 bytes
        pre = code[max(0, i-40):i]
        imms = []
        j = 0
        while j < len(pre):
            if pre[j] == 0x68 and j + 5 <= len(pre): imms.append('%x' % struct.unpack('<I', pre[j+1:j+5])[0]); j += 5
            elif pre[j] == 0x6A and j + 2 <= len(pre): imms.append('%d' % struct.unpack('<b', pre[j+1:j+2])[0]); j += 2
            else: j += 1
        out.append((cb + i, imms[-n:]))
    i += 1
for a, im in out: print('%08x  %s' % (a, im))
print(len(out), 'llamadas', file=sys.stderr)
