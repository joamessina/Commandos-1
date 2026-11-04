"""Resuelve los slots del simulador de peatones contra el ejecutable original."""
from pathlib import Path
import sys
import pefile

exe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
base = exe.OPTIONAL_HEADER.ImageBase
name = sys.argv[1] if len(sys.argv) > 1 else 'SimPeaton'
for line in Path('D:/Joaquin/research-c1/class_methods.tsv').read_text(encoding='utf-8').splitlines():
    row = line.split('\t')
    if row[0] != name or row[1] != '0':
        continue
    address = int(row[3], 16)
    seen = set()
    while address not in seen:
        seen.add(address)
        data = exe.get_data(address - base, 5)
        if len(data) < 5 or data[0] != 0xE9:
            break
        address += 5 + int.from_bytes(data[1:], 'little', signed=True)
    print(f"+0x{int(row[2]) * 4:02X} 0x{address:08X}")
