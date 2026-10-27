"""Extrae DATA.PCK y DATA2.PCK a D:/Joaquin/research/x (solo para análisis local; NO va al repo ni a la web)."""
import os, struct, sys

GAME = r"H:\SteamLibrary\steamapps\common\Commandos 2 Men of Courage"
OUT = r"D:\Joaquin\research\x"


def extract(name):
    path = os.path.join(GAME, name)
    f = open(path, "rb")
    f.seek(0)
    head = f.read(0x40000)
    stack, n = [], 0
    pos = 0
    first_data = min(struct.unpack_from("<I", head, i + 44)[0] for i in range(0, len(head) - 48, 48) if head[i] != 0 and struct.unpack_from("<I", head, i + 36)[0] == 0 and struct.unpack_from("<I", head, i + 44)[0] > 0) if False else None
    depth = 0
    while pos + 48 <= len(head):
        rec = head[pos:pos + 48]
        pos += 48
        nm = rec[:32].split(b"\0")[0].decode("latin1")
        b, c, d = struct.unpack_from("<III", rec, 36)
        if b == 255:
            stack.pop()
            if not stack:
                break
            continue
        if not nm:
            continue
        if b == 1:
            stack.append(nm)
            continue
        rel = "/".join(stack[1:] + [nm]) if stack and stack[0] in ("DATA", "") else "/".join(stack + [nm])
        dest = os.path.join(OUT, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        f.seek(d)
        with open(dest, "wb") as o:
            left = c
            while left:
                chunk = f.read(min(left, 1 << 22))
                o.write(chunk)
                left -= len(chunk)
        n += 1
    print(name, n)


for p in ("DATA.PCK", "DATA2.PCK"):
    extract(p)
