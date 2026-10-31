// Inspecciona las animaciones de efectos de M0 directamente en el DIR instalado.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseAnm } from '../src/formats/anm.ts';

const datos = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const entradas = parseContainer(datos);
for (const nombre of ['EXPLOS1.ANM', 'BOQUETET.ANM']) {
  const coincidencias = entradas.filter((e) => e.path.toUpperCase().endsWith('/' + nombre));
  console.log('ARCHIVO', nombre, 'COINCIDENCIAS', coincidencias.length);
  for (const entrada of coincidencias) {
    const anm = parseAnm(entryBytes(datos, entrada));
    for (const secuencia of anm.sequences.values()) {
      console.log('SECUENCIA', secuencia.name, 'CICLICA', secuencia.cyclic, 'A', secuencia.a, 'B', secuencia.b,
        'PASOS', secuencia.steps.length, 'ENLACES', secuencia.link1, secuencia.link2);
      for (const paso of secuencia.steps) console.log('  FOTOGRAMAS', JSON.stringify(paso));
    }
  }
}
