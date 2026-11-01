// Cruza los eventos de puntos de ruta con los MIS del jugador, sin extraer recursos.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { find, parseClave, type Node } from '../src/formats/clave.ts';
import { parseRoutes } from '../src/engine/patrol.ts';

const bytes = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
for (const entry of parseContainer(bytes).filter((e) => /MISIONES[\\/].*\.MIS$/i.test(e.path))) {
  const data = new TextDecoder('windows-1252').decode(entryBytes(bytes, entry));
  const events: string[] = [];
  const walk = (nodes: readonly Node[]): void => {
    if (Array.isArray(find(nodes, '.RUTA'))) {
      for (const route of parseRoutes(['.PATRULLA', [[...nodes]]], 'DIFICIL')) for (const point of route.points) if (point.event) events.push(point.event);
    }
    for (const node of nodes) if (Array.isArray(node)) walk(node);
  };
  walk(parseClave(data));
  if (events.length) console.log(entry.path, events.join(','));
}
