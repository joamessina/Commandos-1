// Contrasta la prueba del exe y círculo-polígono en agua somera cerca del muelle.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseSec, type Sector } from '../src/formats/sec.ts';
import { SectorMap } from '../src/engine/sectors.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entry = parseContainer(dir).find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith('/MAPA0000.SEC'));
if (!entry) throw new Error('No se encontró MAPA0000.SEC');
const sec = parseSec(entryBytes(dir, entry));
const map = new SectorMap(sec);
const radius = 10;
function compare(s: Sector, x: number, y: number): { exe: boolean; circle: boolean } {
  if (x + radius < s.minX || x - radius > s.maxX || y + radius < s.minY || y - radius > s.maxY) return { exe: false, circle: false };
  let exe = true, inside = true, nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < s.verts.length; i++) {
    const a = sec.verts[s.verts[i] ?? -1], b = sec.verts[s.verts[(i + 1) % s.verts.length] ?? -1];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const side = (dx * (y - a.y) - dy * (x - a.x)) / Math.sqrt(len2);
    if (side < -radius) exe = false;
    if (side < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    nearest = Math.min(nearest, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return { exe, circle: inside || nearest <= radius };
}
let count = 0;
for (let y = 1600; y <= 1800; y += 2) for (let x = 1950; x <= 2200; x += 2) {
  if (map.at(x, y)?.type !== 1) continue;
  for (const [index, sector] of sec.sectors.entries()) {
    if (sector.type !== 0) continue;
    const result = compare(sector, x, y);
    if (result.exe && !result.circle) {
      if (count < 5) console.log('ESQUINA', x, y, 'SECTOR_TIERRA', index);
      count++;
    }
  }
}
console.log('CASOS_DE_MUESTRA', count);
