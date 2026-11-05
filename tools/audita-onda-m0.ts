// Muestras del recorrido 005F6630 contra los sectores reales de MAPA0000.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseSec } from '../src/formats/sec.ts';
import { SectorMap } from '../src/engine/sectors.ts';
import { navFor } from '../src/engine/path.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entry = parseContainer(dir).find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith('/MAPA0000.SEC'));
if (!entry) throw new Error('Falta MAPA0000.SEC');
const map = new SectorMap(parseSec(entryBytes(dir, entry)));
const nav = navFor(map);
const examples = [
  [{ x: 1840, y: 846, z: 395 }, { x: 1855.6, y: 848.3, z: 460 }],
  [{ x: 1830, y: 946, z: 395 }, { x: 1830.6654, y: 943.4607, z: 460 }],
] as const;
for (const [from, to] of examples) {
  if (!nav.blastPath(from, to)) throw new Error('El recorrido no coincide con la muestra leída');
  console.log('ONDA', from, to, 'ALCANZA');
}
