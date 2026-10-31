// Resume geometría y flags del SEC real de misión 0 sin copiar recursos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseSec, SectorFlag } from '../src/formats/sec.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos).filter((e) => e.path.toUpperCase().endsWith('/MAPA0000.SEC'));
if (entradas.length !== 1 || !entradas[0]) throw new Error('Se esperaba un solo MAPA0000.SEC');
const sec = parseSec(entryBytes(datos, entradas[0]));
console.log('SECTORES', sec.sectors.length, 'BASE', sec.nA, 'SUPERPUESTOS', sec.sectors.length - sec.nA);
for (const [nombre, bit] of Object.entries(SectorFlag)) {
  console.log('FLAG', nombre, sec.sectors.filter((s) => (s.flags & bit) !== 0).length);
}
for (const group of sec.groups) {
  const indices = new Set<number>();
  let invalidos = 0;
  for (const [lista, indice] of group.items) {
    const longitud = lista < 1 ? sec.nA : sec.sectors.length - sec.nA;
    if (indice < 0 || indice >= longitud) invalidos++;
    else indices.add((lista < 1 ? 0 : sec.nA) + indice);
  }
  console.log('GRUPO', group.name, 'ENTRADAS', group.items.length, 'VALIDAS_UNICAS', indices.size, 'INVALIDAS', invalidos);
  for (const [i, sector] of sec.sectors.entries()) {
    if (!indices.has(i)) console.log('  SECTOR FUERA', i, 'TIPO', sector.type, 'FLAGS', sector.flags.toString(16),
      'LIMITES', sector.minX, sector.minY, sector.maxX, sector.maxY);
  }
}
