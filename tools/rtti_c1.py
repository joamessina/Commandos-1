"""RTTI de MSVC x86 -> clases, bases y vtables con sus métodos, directo del PE (sin Ghidra).
uso: py tools/rtti_c1.py <exe> <salida.json>     (necesita pefile)
TypeDescriptor = {vftable*, spare, nombre '.?AV…@@'}; COL = {sig, offset, cdOffset, pTypeDesc, pCHD};
vtable[-1] = &COL ; CHD = {sig, attrs, nBases, pBaseArray} ; BaseArray[i] -> BCD{pTypeDesc,...}.
"""
import json, re, struct, sys
import pefile

pe = pefile.PE(sys.argv[1]); IB = pe.OPTIONAL_HEADER.ImageBase
secs = [(IB + s.VirtualAddress, s.Misc_VirtualSize, s.get_data(), s.Name.rstrip(b'\0').decode()) for s in pe.sections]
text = secs[0]


def rd(va, n=4):
    for base, sz, d, _ in secs:
        if base <= va < base + len(d): return d[va - base:va - base + n]
    return None


def u32(va):
    b = rd(va); return struct.unpack('<I', b)[0] if b and len(b) == 4 else None


def in_text(v): return text[0] <= v < text[0] + len(text[2])


descs = {}
for base, sz, d, nm in secs:
    if nm not in ('.data', '.rdata'): continue
    for m in re.finditer(rb'\.\?A[VU]([^\x00]{1,200}?)@@\x00', d):
        descs[base + m.start() - 8] = m.group(1).decode('latin1')

# dwords en .rdata/.data que apuntan a cada descriptor
ptrs = {}
want = set(descs)
for base, sz, d, nm in secs:
    if nm not in ('.data', '.rdata'): continue
    for i in range(0, len(d) - 3, 4):
        v = struct.unpack_from('<I', d, i)[0]
        if v in want: ptrs.setdefault(v, []).append(base + i)

col_of = {}  # col va -> clase
for t, name in descs.items():
    for p in ptrs.get(t, []):
        c = p - 12
        if u32(c) == 0 and u32(c + 12) == t: col_of[c] = name
colref = {}
for base, sz, d, nm in secs:
    if nm not in ('.data', '.rdata'): continue
    for i in range(0, len(d) - 3, 4):
        v = struct.unpack_from('<I', d, i)[0]
        if v in col_of: colref.setdefault(v, []).append(base + i + 4)

out = {}
for c, name in col_of.items():
    chd = u32(c + 16); bases = []
    if chd and u32(chd + 8):
        arr = u32(chd + 12)
        for k in range(1, min(u32(chd + 8), 64)):
            bcd = u32(arr + 4 * k); td = u32(bcd) if bcd else None
            if td in descs: bases.append(descs[td])
    for vt in colref.get(c, []):
        ms, i = [], 0
        while i < 400:
            v = u32(vt + 4 * i)
            if v is None or not in_text(v): break
            ms.append(v); i += 1
        e = out.setdefault(name, {'bases': bases, 'vts': []})
        e['vts'].append({'va': vt, 'm': ms})
json.dump(out, open(sys.argv[2], 'w'))
print(len(descs), 'descriptores;', len(out), 'clases con vtable;', sum(len(v['vts']) for v in out.values()), 'vtables;',
      sum(len(set(m for vv in v['vts'] for m in vv['m'])) for v in out.values()), 'métodos virtuales (suma por clase)')
