// Geometría SEC cercana a la escalera del mar; no modifica ni extrae el archivo.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseSec } from '../src/formats/sec.ts';
import { groundZ, SectorMap } from '../src/engine/sectors.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entry = parseContainer(dir).find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith('/MAPA0000.SEC'));
if (!entry) throw new Error('No se encontró MAPA0000.SEC');
const sec = parseSec(entryBytes(dir, entry));
const map = new SectorMap(sec);
const p = { x: 2070, y: 1695, z: 65 };
const rows: { sector: number; neighbor: number; edge: number; distance: number; xy: number[]; type: number; flags: number; neighborType: number | null; neighborFlags: number | null; dz: number | null }[] = [];
for (const [index, sector] of sec.sectors.entries()) {
  for (let i = 0; i < sector.verts.length; i++) {
    const a = sec.verts[sector.verts[i] ?? -1];
    const b = sec.verts[sector.verts[(i + 1) % sector.verts.length] ?? -1];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (!len2) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const x = a.x + t * dx, y = a.y + t * dy;
    const distance = Math.hypot(p.x - x, p.y - y);
    if (distance > 35) continue;
    const n = sector.neighbors[i] ?? -1;
    const other = sec.sectors[n];
    rows.push({ sector: index, neighbor: n, edge: i, distance, xy: [x, y], type: sector.type, flags: sector.flags,
      neighborType: other?.type ?? null, neighborFlags: other?.flags ?? null, dz: other ? groundZ(other, x, y) - groundZ(sector, x, y) : null });
  }
}
rows.sort((a, b) => a.distance - b.distance);
const current = map.atZ(p.x, p.y, p.z);
console.log('PUNTO', JSON.stringify(p), 'SECTOR', current ? sec.sectors.indexOf(current) : null);
for (const row of rows) console.log(JSON.stringify(row));
