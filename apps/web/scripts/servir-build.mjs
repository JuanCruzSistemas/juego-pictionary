// Sirve el build de producción (dist/web/browser) como el sitio estático de Render y pasa /api y
// /health a la API local, todo en un mismo origen. Sirve para probar el service worker y los avisos
// por HTTPS con un túnel: cloudflared tunnel --url http://localhost:4300
// Uso: npm run build && npm run servir-build   (API en localhost:3000)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PUERTO = Number(process.env.PUERTO ?? 4300);
const API = { host: '127.0.0.1', port: Number(process.env.PUERTO_API ?? 3000) };
const RAIZ = new URL('../dist/web/browser/', import.meta.url).pathname;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function aLaApi(req, res) {
  const proxy = request({ ...API, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('API local apagada');
  });
  req.pipe(proxy);
}

createServer((req, res) => {
  const ruta = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (ruta.startsWith('/api/') || ruta === '/health') return aLaApi(req, res);

  // Como la reescritura /* → /index.html de Render: si no hay archivo, index.html.
  let archivo = normalize(join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ) || !existsSync(archivo) || statSync(archivo).isDirectory()) {
    archivo = join(RAIZ, 'index.html');
  }
  res.writeHead(200, {
    'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
    'cache-control': 'no-cache', // como render.yaml
  });
  createReadStream(archivo).pipe(res);
}).listen(PUERTO, () => console.log(`Build servido en http://localhost:${PUERTO} (API en :${API.port})`));
