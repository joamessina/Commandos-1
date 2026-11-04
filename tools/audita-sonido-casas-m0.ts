// Examina declaraciones, no simula el radio calculado por el ejecutable.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, asText, find, parseClave } from '../src/formats/clave.ts';
import { parseVol } from '../src/formats/vol.ts';
import { flatten, loadWorld } from '../src/engine/world.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entries = parseContainer(dir);
const read = (name: string): string | undefined => {
  const entry = entries.find((e) => e.path.replaceAll('\\', '/').toUpperCase().endsWith(`/${name.toUpperCase()}`));
  return entry ? new TextDecoder('windows-1252').decode(entryBytes(dir, entry)) : undefined;
};
const mission = read('MAPA0000.MIS');
if (!mission) throw new Error('Falta MAPA0000.MIS');
const root = asList(find(parseClave(mission), '.MISSION')) ?? [];
const volText = read('MAPA0000.VOL');
if (!volText) throw new Error('Falta MAPA0000.VOL');
const volume = parseVol(volText);
console.log('CASASFUERTES', JSON.stringify(find(root, '.CASASFUERTES') ?? null));
for (const poly of volume.polys.filter((p) => p.name.startsWith('CASA'))) {
  const x = poly.points.reduce((sum, point) => sum + point.x, 0) / poly.points.length;
  const y = poly.points.reduce((sum, point) => sum + point.y, 0) / poly.points.length;
  const radius = poly.points.length === 0 ? poly.radio : Math.max(...poly.points.map((p) => Math.hypot(p.x - x, p.y - y)));
  console.log('CASA', JSON.stringify({ name: poly.name, xyz: poly.header.slice(0, 3),
    vertices: poly.points.length, radioDeclarado: poly.radio, radioEstimado: radius }));
}
for (const entry of asList(find(root, '.AUTOEXPCASAS')) ?? []) {
  const name = asText(find(asList(entry) ?? [], '.MAP'));
  const poly = volume.polys.find((p) => p.name.toUpperCase() === name?.toUpperCase());
  if (!poly || poly.points.length === 0) {
    console.log('AUTO', JSON.stringify({ name, vertices: poly?.points.length ?? null, radio: poly?.radio ?? null }));
    continue;
  }
  const x = poly.points.reduce((sum, point) => sum + point.x, 0) / poly.points.length;
  const y = poly.points.reduce((sum, point) => sum + point.y, 0) / poly.points.length;
  const radio = Math.max(...poly.points.map((point) => Math.hypot(point.x - x, point.y - y)));
  console.log('AUTO', JSON.stringify({ name, vertices: poly.points.length, radio }));
  const base = name?.match(/^.{4}\d*/)?.[0];
  const sufijo = name?.slice(base?.length ?? 0);
  if (base && (sufijo === '' || sufijo === 'A')) {
    const cambios = volume.polys.filter((p) => p.name.startsWith(base) && p.name.slice(base.length) !== 'EXP1');
    const xyz = [0, 1, 2].map((axis) => cambios.reduce((sum, p) => sum + (p.header[axis] ?? 0), 0) / cambios.length);
    console.log('CAMBIOS', JSON.stringify({ name, volumenes: cambios.map((p) => p.name), xyz }));
  }
}
for (const difficulty of ['FACIL', 'DIFICIL'] as const) {
  const elems = flatten(loadWorld(mission, { difficulty, macro: (name) => read(`${name}.MAC`) }));
  for (const el of elems) {
    for (const action of el.actions.filter((a) => a.name.toUpperCase() === 'ACEXPLOTACASA')) {
      console.log(JSON.stringify({ difficulty, token: el.token, macro: el.macro,
        collision: find(el.block, '.VOLCOLISION'), sound: find(action.params, '.SONFIS') ?? null,
        flames: find(action.params, '.VOLTOKENLLAMAS') ?? null }));
    }
  }
}
