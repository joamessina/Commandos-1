// Comprueba que el sonido de pasos en agua esté presente en el contenedor original.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { SOUND_WAV } from '../src/engine/sound-table.ts';

const dir = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const name = SOUND_WAV.PASW;
const entry = parseContainer(dir).find((item) => item.path.replaceAll('\\', '/').toUpperCase().endsWith(`/${name}`));
if (!entry) throw new Error('Falta el WAV de PASW');
const wav = entryBytes(dir, entry);
if (new TextDecoder().decode(wav.subarray(0, 4)) !== 'RIFF') throw new Error('PASW no es un WAV RIFF');
console.log('PASW', name, 'bytes', wav.length);
