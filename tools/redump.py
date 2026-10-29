"""Vuelve a volcar (compacto, sin serializacion) las funciones de una tanda del registro. uso: py -I tools/redump.py <id_tanda> <salida>"""
import contextlib, importlib.util, io, os, sys

tanda, salida = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('rb', os.path.join(here, 'readbatch.py'))
rb = importlib.util.module_from_spec(spec)
sys.argv = ['rb', 'nada']
spec.loader.exec_module(rb)
rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(here, '..', 'tasks', 'lectura-exe.tsv'), encoding='utf8')][1:]
ids = sorted(int(r[0], 16) for r in rows if len(r) >= 3 and r[2] == tanda)
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    print(f'# redump {tanda}: {len(ids)} funciones')
    for a in ids:
        rb.show(a)
open(salida, 'w', encoding='utf8').write(buf.getvalue())
print(len(ids), 'funciones,', len(buf.getvalue().splitlines()), 'lineas')
