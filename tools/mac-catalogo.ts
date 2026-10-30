// Catálogo de los .MAC (plantillas de elementos) y de sus usos en los .MIS. Uso: node --experimental-transform-types tools/mac-catalogo.ts <carpeta de salida>
// (se corre desde la raíz del repo; lee WAR_MP.DIR del juego, solo lectura). Salida: mac-macros.tsv, mac-acciones.tsv, mac-claves.tsv.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave, type Node } from '../src/formats/clave.ts';

const out = process.argv[2];
if (!out) throw new Error('falta la carpeta de salida');
const buf = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const all = parseContainer(buf);
const text = (e: (typeof all)[number]): string => new TextDecoder('latin1').decode(entryBytes(buf, e));
const macs = all.filter((e) => /\.MAC$/i.test(e.path));
const miss = all.filter((e) => /MISIONES[\\/].*\.MIS$/i.test(e.path));
const readAll = (dir: string, ext: string): string =>
  readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(ext) && !String(f).endsWith('.test.ts')).map((f) => readFileSync(`${dir}/${String(f)}`, 'utf8')).join('\n').toUpperCase();
const src = readAll('src', '.ts');
const docs = readAll('docs', '.md');
const short = (e: { path: string }): string => e.path.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const preview = (n: Node | undefined): string => (n === undefined ? '' : typeof n === 'string' ? n : '[' + n.slice(0, 6).map((c) => (typeof c === 'string' ? c : '[…]')).join(' ') + (n.length > 6 ? ' …' : '') + ']').slice(0, 70);

// ---- usos en los MIS: `.MACRO X` por misión ----
const uses = new Map<string, Map<string, number>>();
function scan(l: readonly Node[], file: string): void {
  for (let i = 0; i < l.length; i++) {
    const n = l[i]!;
    if (typeof n === 'string') {
      if (n.toUpperCase() === '.MACRO' && typeof l[i + 1] === 'string') {
        const m = (l[i + 1] as string).toUpperCase();
        const per = uses.get(m) ?? new Map<string, number>();
        per.set(file, (per.get(file) ?? 0) + 1);
        uses.set(m, per);
      }
    } else scan(n, file);
  }
}
for (const e of miss) scan(parseClave(text(e)), short(e));

// ---- catálogo de claves de los MAC ----
interface K { files: Set<string>; n: number; parents: Map<string, number>; kinds: Set<string>; sample: string }
const keys = new Map<string, K>();
function walk(l: readonly Node[], parent: string, file: string): void {
  for (let i = 0; i < l.length; i++) {
    const n = l[i]!;
    if (typeof n === 'string') {
      if (n.startsWith('.') && n.length > 1) {
        const k = n.toUpperCase();
        const e = keys.get(k) ?? { files: new Set(), n: 0, parents: new Map(), kinds: new Set(), sample: '' };
        e.files.add(file);
        e.n++;
        e.parents.set(parent, (e.parents.get(parent) ?? 0) + 1);
        const v = l[i + 1];
        e.kinds.add(v === undefined ? 'vacío' : typeof v === 'string' ? (Number.isFinite(Number(v)) ? 'num' : 'texto') : 'lista');
        if (!e.sample) e.sample = preview(v);
        keys.set(k, e);
      }
    } else {
      const prev = l[i - 1];
      walk(n, typeof prev === 'string' ? prev.toUpperCase() : parent, file);
    }
  }
}

// ---- un registro por MAC + catálogo de acciones ----
const acts = new Map<string, { macros: Set<string>; carisma: Set<string>; sample: string }>();
const rows = ['macro\tbytes\tclase\tbando\tvariables\tacciones(prioridad)\torganos\tgraph\tvolcolision\totras_claves\tinstancias_en_MIS\tmisiones'];
for (const e of macs.sort((a, b) => short(a).localeCompare(short(b)))) {
  const name = short(e);
  const t = text(e);
  const tree = parseClave(t);
  walk(tree, 'RAIZ', name);
  const cls = String(find(tree, '.CLASS') ?? '');
  const bando = String(find(tree, '.BANDO') ?? '');
  const vars = (asList(find(tree, '.VARIABLES')) ?? []).filter((v): v is string => typeof v === 'string').join(' ');
  const actions: string[] = [];
  for (const a of asList(find(tree, '.ACCIONES')) ?? []) {
    const l = asList(a);
    if (!l) continue;
    const an = String(l[0] ?? '');
    const params = asList(l[1]) ?? [];
    const pr = String(find(params, '.CARISMA') ?? '');
    actions.push(`${an}${pr ? '@' + pr : ''}`);
    const k = an.toUpperCase();
    const rec = acts.get(k) ?? { macros: new Set(), carisma: new Set(), sample: '' };
    rec.macros.add(name);
    if (pr) rec.carisma.add(pr);
    if (!rec.sample) rec.sample = preview(l[1]);
    acts.set(k, rec);
  }
  const organs: string[] = [];
  const org = asList(find(tree, '.ORGANOS')) ?? [];
  for (let i = 0; i + 1 < org.length; i++) if (typeof org[i] === 'string' && String(org[i]).startsWith('.')) organs.push(`${String(org[i])}:${String(asList(org[i + 1])?.[0] ?? '')}`);
  const graph = preview(find(tree, '.GRAPH'));
  const vol = preview(find(tree, '.VOLCOLISION'));
  const known = new Set(['.CLASS', '.BANDO', '.VARIABLES', '.ACCIONES', '.ORGANOS', '.GRAPH', '.VOLCOLISION']);
  const others = tree.filter((n, i) => typeof n === 'string' && n.startsWith('.') && !known.has(n.toUpperCase()) && i + 1 < tree.length).map((n) => String(n).toUpperCase());
  const per = uses.get(name.toUpperCase());
  const total = per ? [...per.values()].reduce((a, b) => a + b, 0) : 0;
  rows.push([name, t.length, cls, bando, vars, actions.join(' '), organs.join(' '), graph, vol, [...new Set(others)].join(' '), total, per ? [...per.entries()].map(([f, c]) => `${f}=${c.toString()}`).join(' ') : ''].join('\t'));
}
writeFileSync(`${out}/mac-macros.tsv`, rows.join('\n') + '\n');

const aRows = ['accion\tmacros\tprioridades(CARISMA)\tejemplo_de_parametros\ten_codigo\ten_docs\tlista_de_macros'];
for (const [k, r] of [...acts.entries()].sort((a, b) => b[1].macros.size - a[1].macros.size)) {
  const bare = k.replace(/^\$/, '');
  aRows.push([k, r.macros.size, [...r.carisma].join(','), r.sample.replace(/\t/g, ' '), src.includes(bare) ? 'si' : 'no', docs.includes(bare) ? 'si' : 'no', [...r.macros].join(' ')].join('\t'));
}
writeFileSync(`${out}/mac-acciones.tsv`, aRows.join('\n') + '\n');

const kRows = ['clave\tarchivos\tapariciones\ttipo\tpadres_principales\tejemplo\ten_codigo\ten_docs'];
for (const [k, e] of [...keys.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const parents = [...e.parents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, c]) => `${p}(${c.toString()})`).join(' ');
  kRows.push([k, e.files.size, e.n, [...e.kinds].join('/'), parents, e.sample.replace(/\t/g, ' '), src.includes(k) ? 'si' : 'no', docs.includes(k) ? 'si' : docs.includes(k.slice(1)) ? 'nombre' : 'no'].join('\t'));
}
writeFileSync(`${out}/mac-claves.tsv`, kRows.join('\n') + '\n');
const usedMac = [...uses.keys()].length;
console.log(`${macs.length.toString()} MAC, ${acts.size.toString()} acciones distintas, ${keys.size.toString()} claves; MAC instanciados en algún MIS: ${usedMac.toString()}`);
console.log('acciones nombradas en el código:', [...acts.keys()].filter((k) => src.includes(k.replace(/^\$/, ''))).length, 'en docs:', [...acts.keys()].filter((k) => docs.includes(k.replace(/^\$/, ''))).length);
