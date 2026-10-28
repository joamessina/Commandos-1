"""Escanea WAVs y resume formato. uso: py -I wavscan.py <dir> [<dir>...]  (recursivo)"""
import sys, os, struct, collections
def scan(p):
    d = open(p, 'rb').read()
    if d[:4] != b'RIFF' or d[8:12] != b'WAVE': return None
    i = 12; fmt = None; datalen = 0; chunks = []
    while i + 8 <= len(d):
        cid = d[i:i+4]; sz = struct.unpack('<I', d[i+4:i+8])[0]; chunks.append(cid.decode('latin1'))
        if cid == b'fmt ': fmt = struct.unpack('<HHIIHH', d[i+8:i+24])
        if cid == b'data': datalen = sz
        i += 8 + sz + (sz & 1)
    return fmt, datalen, chunks
rows = []
for root in sys.argv[1:]:
    for dp, dn, fn in os.walk(root):
        for f in sorted(fn):
            if f.upper().endswith('.WAV'):
                p = os.path.join(dp, f); r = scan(p)
                if r is None: print('NO RIFF', p); continue
                fmt, dl, ch = r
                rows.append((p, fmt, dl, ch))
cnt = collections.Counter()
for p, fmt, dl, ch in rows:
    tag, nch, rate, brate, ba, bits = fmt
    cnt[(tag, nch, rate, bits)] += 1
print(len(rows), 'archivos')
for k, v in sorted(cnt.items(), key=lambda x: -x[1]): print('tag=%d canales=%d rate=%d bits=%d : %d' % (k + (v,)) if False else 'fmt_tag=%d ch=%d rate=%d bits=%d -> %d archivos' % (k[0], k[1], k[2], k[3], v))
ex = collections.Counter(c for p, f, d, ch in rows for c in set(ch))
print('chunks presentes:', dict(ex))
sm = [p for p, f, d, ch in rows if 'smpl' in ch]
print('con smpl:', len(sm), sm[:10])
