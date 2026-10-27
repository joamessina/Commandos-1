"""Extrae WAR_MP.DIR a OUT/x y escribe OUT/inventario.tsv (+ resumen por extensión).

uso: py -I tools/inventario.py <carpeta-del-juego-Legacy> <OUT>
Solo lectura sobre el juego. Formato del contenedor: docs/formats/war_mp_dir.md
"""
import collections, os, struct, sys

R = 44  # bytes por registro: nombre[32], flag u8 + pad, u32 tamaño|0, u32 offset|posición de lista


def rec(b, i):
    name = b[i:i + 32].split(b'\0')[0].decode('latin1')
    return name, b[i + 32], *struct.unpack_from('<II', b, i + 36)


def walk(b, pos, path, out, seen):
    if pos in seen or pos + R > len(b):
        raise ValueError(f'tabla corrupta en {pos:#x}')
    seen.add(pos)
    while True:
        name, flag, a, c = rec(b, pos)
        pos += R
        if name == 'DIRECTOR.FIN':
            return
        if flag == 1:
            walk(b, c, f'{path}/{name}', out, seen)
        else:
            out.append((f'{path}/{name}', a, c))  # (ruta, tamaño, offset)


def main(game, dst):
    b = open(os.path.join(game, 'WAR_MP.DIR'), 'rb').read()
    n0, _, _, lista = rec(b, 0)
    files = []
    walk(b, lista, n0, files, set())
    files.sort(key=lambda f: f[2])
    tabla = files[0][2]
    assert tabla + sum(f[1] for f in files) == len(b), 'los datos no cierran con el tamaño del archivo'
    assert all(a[2] + a[1] == c[2] for a, c in zip(files, files[1:])), 'hay huecos o solapes'
    rows, magic = [], collections.defaultdict(collections.Counter)
    for ruta, tam, off in files:
        data = b[off:off + tam]
        p = os.path.join(dst, 'x', *ruta.split('/'))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(data)
        ext = ruta.rsplit('.', 1)[-1].upper()
        h = data[:16]
        magic[ext][h[:4].hex()] += 1
        rows.append((ruta, ext, tam, off, h.hex(), ''.join(chr(x) if 32 <= x < 127 else '.' for x in h)))
    with open(os.path.join(dst, 'inventario.tsv'), 'w', encoding='utf8') as f:
        f.write('ruta\text\ttam\toffset\thead16_hex\thead16_ascii\n')
        f.writelines('\t'.join(map(str, r)) + '\n' for r in rows)
    porext = collections.defaultdict(list)
    for r in rows:
        porext[r[1]].append(r)
    with open(os.path.join(dst, 'resumen_ext.txt'), 'w', encoding='utf8') as f:
        for ext, rs in sorted(porext.items(), key=lambda x: -sum(r[2] for r in x[1])):
            tams = [r[2] for r in rs]
            f.write(f'{ext}  n={len(rs)}  total={sum(tams)}  min={min(tams)}  max={max(tams)}\n')
            f.write(f'   magia(4B) top: {magic[ext].most_common(4)}\n')
            f.write(f'   ejemplos: {[r[0].rsplit("/", 1)[-1] for r in rs[:6]]}\n')
    print(len(files), 'archivos; tabla', tabla, 'B; datos', sum(f[1] for f in files), 'B; cierra con', len(b))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
