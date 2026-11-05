// Comprueba los textos de los códigos de intendencia que usa el port.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entry = parseContainer(dir).find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith('/GLOBAL.STR'));
if (!entry) throw new Error('Falta GLOBAL.STR');
const lines = new TextDecoder('windows-1252').decode(entryBytes(dir, entry)).split(/\r?\n/);
for (const code of ['AMUC', 'ALOL', 'NOO2']) {
  const line = lines.find((value) => value.startsWith(`${code} `) || value.startsWith(`${code}\t`));
  if (!line) throw new Error(`Falta ${code}`);
  console.log('MENSAJE', line);
}
