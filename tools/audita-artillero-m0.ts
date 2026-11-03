// Contrasta las secuencias del artillero con el recurso original, sin extraer assets.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseAnm } from '../src/formats/anm.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos).filter((e) => e.path.replaceAll('\\', '/').toUpperCase().endsWith('/CABO.ANM'));
if (entradas.length === 0) throw new Error('No se encontró CABO.ANM');
for (const entrada of entradas) {
  console.log('ARCHIVO', entrada.path);
  const anm = parseAnm(entryBytes(datos, entrada));
  for (const nombre of ['CANONERO', 'CANONERODISPARA']) {
    const secuencia = anm.sequences.get(nombre);
    if (!secuencia) { console.log(nombre, 'AUSENTE'); continue; }
    console.log(nombre, 'CICLICA', secuencia.cyclic, 'A', secuencia.a, 'B', secuencia.b, 'PASOS', secuencia.steps.length);
    for (const [indice, paso] of secuencia.steps.entries()) console.log('PASO', indice, JSON.stringify(paso));
  }
}
