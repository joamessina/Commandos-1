"""Busca slots virtuales que apuntan a funciones del exe, siguiendo saltos."""
from pathlib import Path
import sys
import pefile

exe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
base = exe.OPTIONAL_HEADER.ImageBase
targets = {int(value, 16) for value in sys.argv[1:]}
for line in Path('D:/Joaquin/research-c1/class_methods.tsv').read_text(encoding='utf-8').splitlines():
    row = line.split('\t')
    if len(row) < 4:
        continue
    try:
        address = int(row[3], 16)
        seen = set()
        while address not in seen:
            seen.add(address)
            data = exe.get_data(address - base, 5)
            if len(data) < 5 or data[0] != 0xE9:
                break
            address += 5 + int.from_bytes(data[1:], 'little', signed=True)
        if address in targets:
            print(f'{row[0]} tabla={row[1]} slot={row[2]} destino=0x{address:08X}')
    except ValueError:
        continue
