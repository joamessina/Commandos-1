import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * SOLO DESARROLLO (apply: 'serve'): sirve la carpeta del juego indicada en GAME_DIR (.env.local) bajo /__game/
 * para probar sin el diálogo de carpetas. El build NO incluye este plugin ni hace fetch de archivos del juego.
 */
function devGameDir(dir: string | undefined): Plugin {
  return {
    name: 'dev-game-dir',
    apply: 'serve',
    configureServer(server) {
      if (!dir) return;
      const root = resolve(dir);
      server.middlewares.use('/__game', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/').replace(/^\/+/, '');
        if (rel === '__list') {
          const mapDir = join(root, 'DATOS', 'recursos', 'bmps', 'map_mp');
          const wads = existsSync(mapDir) ? readdirSync(mapDir).filter((f) => /^fase\d{4}\.wad$/i.test(f)) : [];
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(wads));
          return;
        }
        const file = resolve(root, rel);
        if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end('no encontrado');
          return;
        }
        res.setHeader('content-type', 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [devGameDir(env['GAME_DIR'])] };
});
