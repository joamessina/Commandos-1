"""Verifica la tabla de sonidos del exe (soundtab) contra los WAV extraidos y contra el uso en MAC/MIS.
uso: py -I verify_sound.py   (rutas fijas de la investigacion)"""
import os, re, struct, glob, collections
WAVE = r'D:\Joaquin\research-c1\x\DATOS\RECURSOS\SONIDO\WAVE'
MIS = r'D:\Joaquin\research-c1\x\DATOS\MISIONES'
tab = [l.rstrip('\n').split('\t') for l in open(r'D:\Joaquin\research-c1\sound_table.tsv', encoding='latin1')][1:]
tags = {t[1]: t for t in tab}
files = {f.upper() for f in os.listdir(WAVE) if f.upper().endswith('.WAV')}
print('entradas tabla:', len(tab), '| tags unicos:', len(tags))
miss = sorted({t[3] for t in tab if t[3].upper() not in files})
print('WAV de la tabla que NO existen en WAVE\:', miss)
used = {t[3].upper() for t in tab}
print('WAV de WAVE\ que la tabla NO usa:', sorted(files - used))
# smpl
def smpl(p):
    d = open(p, 'rb').read(); i = 12
    while i + 8 <= len(d):
        cid = d[i:i+4]; sz = struct.unpack('<I', d[i+4:i+8])[0]
        if cid == b'smpl' and sz >= 0x1c:
            w = struct.unpack('<%dI' % ((sz) // 4), d[i+8:i+8+sz//4*4])
            return w[7], w[8], w[10] if len(w) > 10 else None, w[13 - 2] if len(w) > 11 else None
        i += 8 + sz + (sz & 1)
loops = {}
for f in sorted(files):
    r = smpl(os.path.join(WAVE, f))
    if r: loops[f] = r
print('WAV con smpl:', len(loops))
for f, r in loops.items(): print('  ', f, 'numLoops=%d samplerData=%d tipo/inicio=%s' % (r[0], r[1], r[2:]))
# uso en MAC/MIS
pat = re.compile(r'\.(WAV|SONFIS|SONIDO\w*|SONIDOS)\s+(\[[^\]]*\]|\S+)', re.I)
use = collections.Counter(); bad = collections.Counter()
for p in glob.glob(MIS + r'\*.MAC') + glob.glob(MIS + r'\*.MIS'):
    s = open(p, encoding='latin1').read()
    for m in pat.finditer(s):
        for w in re.findall(r'\.SONIDO\w*\s+(\w+)|(?<![\w.])([A-Z][A-Z0-9]{3})(?![\w])', m.group(2)):
            pass
        val = m.group(2)
        toks = re.findall(r'(?:\.\w+\s+)?([A-Za-z0-9$]+)', val.strip('[] ')) if val.startswith('[') else [val]
        for t in toks:
            if t.startswith('.') or t.startswith('$'): continue
            if val.startswith('['):
                pass
            use[(m.group(1).upper(), t)] += 1
            if t not in tags: bad[(os.path.basename(p), m.group(1).upper(), t)] += 1
print('usos distintos (clave, valor):', len(use))
print('valores usados que NO son tag de la tabla:')
for k, v in sorted(bad.items()): print('  ', k, v)
