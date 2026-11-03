// Examina declaraciones, no simula el radio calculado por el ejecutable.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave } from '../src/formats/clave.ts';
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
console.log('AUTOEXPCASAS', JSON.stringify(find(root, '.AUTOEXPCASAS')));
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
