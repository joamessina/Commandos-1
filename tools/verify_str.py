"""Integridad referencial de codigos STR: .TIP (MAC/MIS), archivos .TIP, .HTIT (DAT) contra GLOBAL.STR + MAPAnnnn.STR + MBnn.STR.
uso: py -I verify_str.py"""
import glob, re, os, collections
D = r'D:\Joaquin\research-c1\x\DATOS\MISIONES'
codes = {}
for f in glob.glob(D + r'\*.STR'):
    for l in open(f, encoding='latin1'):
        l = l.rstrip('\r\n')
        if len(l) >= 4: codes.setdefault(l[:4], set()).add(os.path.basename(f))
g = {c for c, fs in codes.items() if 'GLOBAL.STR' in fs}
print('codigos totales', len(codes), '| en GLOBAL', len(g))
used = collections.defaultdict(set)
for p in glob.glob(D + r'\*.MAC') + glob.glob(D + r'\*.MIS'):
    for m in re.finditer(r'\.TIP\s+(\S+)', open(p, encoding='latin1').read()): used['.TIP(MAC/MIS)'].add(m.group(1))
for p in glob.glob(D + r'\*.TIP'):
    for l in open(p, encoding='latin1'):
        t = l.split()
        if len(t) == 5: used['TIP(archivo)'].add(t[4])
for p in glob.glob(D + r'\*.DAT'):
    for m in re.finditer(r'\.HTIT\s+(\S+)', open(p, encoding='latin1').read()): used['.HTIT'].add(m.group(1))
for k, v in used.items():
    miss = sorted(c for c in v if c not in codes)
    print(k, 'distintos', len(v), '| ausentes en todos los STR:', miss)
