"""Consulta decompilado local con líneas originales, sin modificar el juego.

py tools/consulta-exe.py 0042b2c0 0046e760
py tools/consulta-exe.py --clase ClassAcPilotaje
py tools/consulta-exe.py --buscar MSGA_PEDRADA --max-lineas 100
"""
import argparse
import csv
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("direcciones", nargs="*")
    parser.add_argument("--clase")
    parser.add_argument("--buscar")
    parser.add_argument("--asm", action="store_true")
    parser.add_argument("--desde", type=int, default=0)
    parser.add_argument("--max-lineas", type=int, default=1200)
    parser.add_argument("--raiz", type=Path, default=Path("D:/Joaquin/research-c1"))
    args = parser.parse_args()
    if args.clase:
        with (args.raiz / "class_methods.tsv").open(encoding="utf-8") as archivo:
            for fila in csv.DictReader(archivo, delimiter="\t"):
                if args.clase.lower() in fila["clase"].lower():
                    print(" ".join(f"{k}={v}" for k, v in fila.items()))
        return
    direcciones = {int(d, 16) for d in args.direcciones}
    encontrados = set()
    cuenta = 0
    for archivo in sorted((args.raiz / "ghidra/all2").glob("fn_*.c")):
        lineas = archivo.read_text(encoding="utf-8", errors="replace").splitlines()
        marcas = [(i, re.match(r"//// ([0-9a-f]{8}) (\S+) size (\d+)", l)) for i, l in enumerate(lineas)]
        marcas = [(i, m) for i, m in marcas if m]
        for j, (inicio, marca) in enumerate(marcas):
            direccion = int(marca[1], 16)
            fin = marcas[j + 1][0] if j + 1 < len(marcas) else len(lineas)
            if args.buscar:
                if marca[2].startswith("thunk_"):
                    continue
                for i in range(inicio, fin):
                    if args.buscar.lower() in lineas[i].lower():
                        print(f"{archivo.name}:{i + 1} [{marca[1]}] {lineas[i]}")
                        cuenta += 1
                        if cuenta >= args.max_lineas:
                            return
            elif direccion in direcciones:
                encontrados.add(direccion)
                print(f"\n### {archivo.as_posix()}:{inicio + 1} ({fin - inicio} líneas)")
                if args.asm:
                    import capstone
                    import pefile
                    pe = pefile.PE("D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe")
                    datos = pe.get_data(direccion - pe.OPTIONAL_HEADER.ImageBase, int(marca[3]))
                    instrucciones = list(capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32).disasm(datos, direccion))
                    for instruccion in instrucciones[args.desde:args.desde + args.max_lineas]:
                        anotacion = ""
                        for numero in re.findall(r"0x[0-9a-f]+", instruccion.op_str):
                            va = int(numero, 16)
                            if 0x790000 <= va < 0x840000:
                                valor = pe.get_data(va - pe.OPTIONAL_HEADER.ImageBase, 100).split(b"\0")[0]
                                if len(valor) >= 3 and all(32 <= b < 127 for b in valor):
                                    anotacion += " " + repr(valor.decode("ascii"))
                        print(f"{instruccion.address:08x}: {instruccion.mnemonic} {instruccion.op_str}{anotacion}")
                    continue
                for i in range(inicio + args.desde, min(fin, inicio + args.desde + args.max_lineas)):
                    print(f"{i + 1}: {lineas[i]}")
                if fin - inicio > args.desde + args.max_lineas:
                    print("[RECORTADO: ampliar --max-lineas]")
    if not args.buscar and encontrados != direcciones:
        raise ValueError(f"Direcciones ausentes: {direcciones - encontrados}")


if __name__ == "__main__":
    main()
