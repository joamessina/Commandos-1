// Inspección de instancias concretas desde el contenedor original, sin extraer recursos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseClave, type Node } from '../src/formats/clave.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const files = parseContainer(dir);
const read = (name: string): readonly Node[] => {
  const file = files.find((entry) => entry.path.replaceAll('\\', '/').toUpperCase().endsWith(`/${name}`));
  if (!file) throw new Error(`No se encontró ${name}`);
  return parseClave(new TextDecoder('windows-1252').decode(entryBytes(dir, file)));
};
const findBlocks = (nodes: readonly Node[]): void => {
  const data = nodes.indexOf('.DATOSFICHEROSMISION');
  if (data >= 0) console.log('DATOSFICHEROSMISION', JSON.stringify(nodes[data + 1]));
  for (const n of nodes) {
    if (!Array.isArray(n)) continue;
    const macro = n.indexOf('.MACRO');
    if (macro >= 0 && ['ESCALA', 'NIDOMET'].includes(String(n[macro + 1]).toUpperCase())) {
      console.log(JSON.stringify(n));
    } else findBlocks(n);
  }
};
findBlocks(read('MAPA0000.MIS'));
