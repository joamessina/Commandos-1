// Catálogo de claves de los .MIS (todas las misiones). Uso: node --experimental-transform-types tools/mis-catalogo.ts <carpeta de salida> (se corre desde la raíz del repo; lee WAR_MP.DIR del juego, solo lectura).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { entryBytes, parseContainer } from '../src/formats/container.ts';
import { asList, find, parseClave, type Node } from '../src/formats/clave.ts';

const out = process.argv[2]!;
const buf = new Uint8Array(readFileSync('D:/SteamLibrary/steamapps/common/Commandos Beyond the Call of Duty/WAR_MP.DIR'));
const files = parseContainer(buf).filter((e) => /MISIONES[\\/].*\.MIS$/i.test(e.path));
const src = readdirSync('src', { recursive: true }).filter((f) => String(f).endsWith('.ts') && !String(f).endsWith('.test.ts')).map((f) => readFileSync('src/' + String(f), 'utf8')).join('\n').toUpperCase();
const docs = readdirSync('docs', { recursive: true }).filter((f) => String(f).endsWith('.md')).map((f) => readFileSync('docs/' + String(f), 'utf8')).join('\n').toUpperCase();

interface K { files: Set<string>; n: number; parents: Map<string, number>; kinds: Set<string>; sample: string }
const keys = new Map<string, K>();
const preview = (n: Node | undefined): string => (n === undefined ? '' : typeof n === 'string' ? n : '[' + n.slice(0, 6).map((c) => (typeof c === 'string' ? c : '[…]')).join(' ') + (n.length > 6 ? ' …' : '') + ']').slice(0, 70);

function walk(list: readonly Node[], parent: string, file: string): void {
  for (let i = 0; i < list.length; i++) {
    const n = list[i]!;
    if (typeof n === 'string') {
      if (n.startsWith('.') && n.length > 1) {
        const k = n.toUpperCase();
        const e = keys.get(k) ?? { files: new Set(), n: 0, parents: new Map(), kinds: new Set(), sample: '' };
        e.files.add(file); e.n++;
        e.parents.set(parent, (e.parents.get(parent) ?? 0) + 1);
        const v = list[i + 1];
        e.kinds.add(v === undefined ? 'vacío' : typeof v === 'string' ? (Number.isFinite(Number(v)) ? 'num' : 'texto') : 'lista');
        if (!e.sample) e.sample = preview(v);
        keys.set(k, e);
      }
    } else {
      // el padre de una lista es la clave que la antecede (o el nombre del bloque)
      const prev = list[i - 1];
      const p = typeof prev === 'string' ? prev.toUpperCase() : parent;
      walk(n, p, file);
    }
  }
}

const summary: Record<string, unknown>[] = [];
for (const f of files) {
  const name = f.path.replace(/^.*[\\/]/, '');
  const text = new TextDecoder('latin1').decode(entryBytes(buf, f));
  const tree = parseClave(text);
  walk(tree, 'RAIZ', name);
  const mis = asList(find(tree, '.MISSION')) ?? [];
  const top = mis.filter((n, i) => typeof n === 'string' && n.startsWith('.') && i + 1 < mis.length).map((n) => {
    const i = mis.indexOf(n);
    const v = mis[i + 1];
    return `${String(n)}${Array.isArray(v) ? `[${v.length}]` : ''}`;
  });
  const t = text.toUpperCase();
  const cnt = (re: RegExp): number => (t.match(re) ?? []).length;
  summary.push({
    archivo: name, bytes: text.length, top: top.join(' '),
    elementos: cnt(/\.TOKEN\s/g), bandoAleman: cnt(/\.BANDO\s+ALEMAN/g), bandoAliado: cnt(/\.BANDO\s+ALIADO/g),
    enlazar: cnt(/\.ENLAZAR/g), esperaEvento: cnt(/\.ESPERAEVENTO/g), evento: cnt(/\.EVENTO\s/g), casa: cnt(/\.CASA\s/g), acPatrulla: cnt(/\.ACPATRULLA/g),
    regenerate: cnt(/\.REGENERATE\s/g), nivelFacil: cnt(/\.NIVEL\s+FACIL/g), nivelDificil: cnt(/\.NIVEL\s+DIFICIL/g),
  });
}

const rows = [...keys.entries()].sort((a, b) => b[1].n - a[1].n);
const tsv = ['clave\tarchivos\tapariciones\ttipo\tpadres_principales\tejemplo\ten_codigo\ten_docs'];
for (const [k, e] of rows) {
  const parents = [...e.parents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, c]) => `${p}(${c})`).join(' ');
  const bare = k.slice(1);
  tsv.push([k, e.files.size, e.n, [...e.kinds].join('/'), parents, e.sample.replace(/\t/g, ' '), src.includes(k) ? 'si' : 'no', docs.includes(k) ? 'si' : docs.includes(bare) ? 'nombre' : 'no'].join('\t'));
}
writeFileSync(out + '/mis-claves.tsv', tsv.join('\n') + '\n');
writeFileSync(out + '/mis-resumen.json', JSON.stringify(summary, null, 1));
console.log(files.length, 'archivos', keys.size, 'claves');
console.log('en código:', rows.filter(([k]) => src.includes(k)).length, '| en docs:', rows.filter(([k]) => docs.includes(k)).length, '| ni código ni docs:', rows.filter(([k]) => !src.includes(k) && !docs.includes(k)).length);
