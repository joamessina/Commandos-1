// Contrasta las secuencias del artillero con el recurso original, sin extraer assets.
import { readFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { parseAnm } from '../src/formats/anm.ts';
import { parseWad } from '../src/formats/wad.ts';
import { Soldier, type SoldierWorld } from '../src/engine/soldier.ts';
import { Unit } from '../src/engine/unit.ts';

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
  const artillero = new Soldier('NIDO', new Unit('NIDO', anm, 0, 0, 0, 0), null, { fixed: true, sweep: 0 });
  const objetivo = new Unit('COMANDO', anm, 100, 0, 0, 0);
  objetivo.invulnerable = true;
  let disparos = 0;
  let impactos = 0;
  const mundo: SoldierWorld = { commandos: [objetivo], sectors: null, rng: () => 0, onShot: () => { disparos++; }, onNestImpact: () => { impactos++; } };
  for (let i = 0; i < 100 && disparos === 0; i++) artillero.tick(mundo);
  if (disparos !== 1 || artillero.unit.anim.name !== 'CANONERO') throw new Error('No se inició el ciclo de disparo');
  for (let i = 0; i < 10; i++) artillero.tick(mundo);
  if (impactos !== 10) throw new Error(`Se esperaban diez impactos, se generaron ${impactos.toString()}`);
  if (artillero.unit.anim.name !== 'CANONERODISPARA') throw new Error('No se activó CANONERODISPARA');
  console.log('SIMULACION', artillero.unit.anim.name, 'PASO', artillero.unit.anim.step, 'DIRECCION', artillero.unit.anim.frame(0).sprite);
  for (let i = 0; i < 10; i++) artillero.tick(mundo);
  if (artillero.unit.anim.name !== 'CANONERO') throw new Error('No volvió a CANONERO');
  console.log('SIMULACION', artillero.unit.anim.name, 'REPOSO');
}
const impactoAnm = parseContainer(datos).find((e) => e.path.toUpperCase().endsWith('/DISPFALL.ANM'));
const impactoWad = parseContainer(datos).find((e) => e.path.toUpperCase().endsWith('/DISPFALL.WAD'));
if (!impactoAnm || !impactoWad) throw new Error('Faltan recursos del impacto');
const secuencia = parseAnm(entryBytes(datos, impactoAnm)).sequences.get('ANDAR');
const sprites = parseWad(entryBytes(datos, impactoWad)).byName;
if (!secuencia || secuencia.b !== 8 || secuencia.steps.length !== 4 || secuencia.steps.some((paso) => paso.some((frame) => !sprites.has(frame.sprite.toUpperCase())))) throw new Error('Secuencia o sprites de impacto inválidos');
console.log('IMPACTOS', 10, 'CUADROS', secuencia.steps.length, 'PERIODO', secuencia.b);
