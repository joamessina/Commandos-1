"""Lecturas numéricas y referencias del exe instalado (solo lectura).

py tools/audita-datos-exe.py --numeros 795c80 796650
py tools/audita-datos-exe.py --referencias 822768 822fa0
py tools/audita-datos-exe.py --ruidos
"""
import argparse
import re
import struct

import capstone
import pefile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--numeros", nargs="*", default=[])
    parser.add_argument("--referencias", nargs=2)
    parser.add_argument("--ruidos", action="store_true")
    parser.add_argument("--mochila", action="store_true")
    parser.add_argument("--armas", action="store_true")
    args = parser.parse_args()
    pe = pefile.PE("D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/coman_mp.exe")
    base = pe.OPTIONAL_HEADER.ImageBase
    if args.armas:
        for i in range(10):
            va = 0x8143c0 + i * 0xa8
            datos = pe.get_data(va - base, 0xa8)
            identificador = struct.unpack_from("<i", datos)[0]
            nombre = datos[4:0x24].split(b"\0")[0].decode("ascii")
            print(f"{va:08x}: índice={i} id={identificador} nombre={nombre} alcance={struct.unpack_from('<f', datos, 0x24)[0]:g} recarga={struct.unpack_from('<i', datos, 0x2c)[0]} consumo={struct.unpack_from('<i', datos, 0x78)[0]}")
            if identificador == 9:
                break
    if args.mochila:
        motor = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
        motor.detail = True
        registros = {}
        escritos = {}
        for ins in motor.disasm(pe.get_data(0x78b6d0 - base, 0x1000), 0x78b6d0):
            if ins.mnemonic == "ret":
                break
            if ins.mnemonic != "mov":
                raise ValueError(f"Instrucción inesperada: {ins.address:x} {ins.mnemonic}")
            destino, origen = ins.operands
            if origen.type == capstone.x86.X86_OP_IMM:
                valor = origen.imm
            elif origen.type == capstone.x86.X86_OP_REG:
                valor = registros[origen.reg]
            else:
                raise ValueError("Origen no constante")
            if destino.type == capstone.x86.X86_OP_REG:
                registros[destino.reg] = valor
            elif destino.type == capstone.x86.X86_OP_MEM and destino.mem.base == 0 and destino.mem.index == 0:
                escritos[destino.mem.disp] = valor
            else:
                raise ValueError("Destino no absoluto")
        else:
            raise ValueError("No se encontró RET")
        mediciones = {(8, 0): (43, 18), (93, 0): (69, 14), (87, 0): (24, 91), (8, 1): (82, 75), (15, 1): (11, -1), (8, 2): (81, 19), (17, 2): (56, 86), (85, 2): (67, 5)}
        contrastadas = set()
        for i in range(200):
            va = 0x822768 + i * 16
            item, tipo = struct.unpack("<ii", pe.get_data(va - base, 8))
            if item == -1:
                break
            if va + 8 not in escritos or va + 12 not in escritos:
                raise ValueError(f"Coordenadas sin inicializar: {va:x}")
            x, y = escritos[va + 8], escritos[va + 12]
            if (item, tipo) in mediciones:
                if (110 - x, 147 - y) != mediciones[item, tipo]:
                    raise ValueError(f"Difiere de memoria previa: ítem{item}, tipo{tipo}")
                contrastadas.add((item, tipo))
            print(f"{va:08x}: item={item} tipo={tipo} ancla=({x},{y}) offset_mochila112x149=({110-x},{147-y})")
        else:
            raise ValueError("No se encontró terminador de tabla")
        if contrastadas != mediciones.keys():
            raise ValueError("Faltan ítems medidos en memoria previa")
        print(f"Contrastadas {len(contrastadas)} posiciones con hud.md Cierre6 (memoria previa).")
    for numero in args.numeros:
        va = int(numero, 16)
        datos = pe.get_data(va - base, 8)
        print(f"0x{va:08X}: i32={struct.unpack('<i', datos[:4])[0]} f32={struct.unpack('<f', datos[:4])[0]} f64={struct.unpack('<d', datos)[0]}")
    if args.ruidos:
        cantidad = struct.unpack("<I", pe.get_data(0x821f60 - base, 4))[0]
        print(f"Ruidos: {cantidad}")
        for i in range(cantidad):
            codigo, radio = struct.unpack("<If", pe.get_data(0x821de0 + i * 8 - base, 8))
            print(f"{codigo.to_bytes(4, 'big').decode('ascii')}: {radio:g}")
    if args.referencias:
        inicio, fin = (int(x, 16) for x in args.referencias)
        motor = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
        motor.skipdata = True
        for seccion in pe.sections:
            if not seccion.Characteristics & 0x20000000:
                continue
            for va, _, nombre, operandos in motor.disasm_lite(seccion.get_data(), base + seccion.VirtualAddress):
                if any(inicio <= int(n, 16) < fin for n in re.findall(r"0x[0-9a-f]+", operandos)):
                    print(f"{va:08x}: {nombre} {operandos}")


if __name__ == "__main__":
    main()
