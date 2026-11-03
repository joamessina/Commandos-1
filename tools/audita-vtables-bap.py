"""Compara los slots virtuales de los cuatro cerebros de guardias de M0."""
from pathlib import Path
import pefile

exe = pefile.PE('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe')
base = exe.OPTIONAL_HEADER.ImageBase
names = ['ClassAcBap', 'ClassAcBap1', 'ClassAcBanpe1', 'ClassAcBap2', 'ClassAcBanpe2']
tables = {name: {} for name in names}


def resolve(addr):
    seen = set()
    while addr not in seen:
        seen.add(addr)
        raw = exe.get_data(addr - base, 5)
        if len(raw) < 5 or raw[0] != 0xE9:
            break
        addr += 5 + int.from_bytes(raw[1:5], 'little', signed=True)
    return addr


for line in Path('D:/Joaquin/research-c1/class_methods.tsv').read_text(encoding='utf-8').splitlines():
    fields = line.split('\t')
    if len(fields) < 4 or fields[0] not in tables or fields[1] != '0':
        continue
    tables[fields[0]][int(fields[2])] = resolve(int(fields[3], 16))

for name in names[1:]:
    print(name, 'SLOTS', len(tables[name]))
    for slot in sorted(set(tables['ClassAcBap']) | set(tables[name])):
        baseline = tables['ClassAcBap'].get(slot)
        current = tables[name].get(slot)
        if baseline != current:
            a = 'ausente' if baseline is None else f'0x{baseline:08X}'
            b = 'ausente' if current is None else f'0x{current:08X}'
            print(f'  +0x{slot * 4:02X}: base={a} clase={b}')
