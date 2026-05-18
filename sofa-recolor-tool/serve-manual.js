import { createReadStream, existsSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3457;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/manual-recolor.html';

  const file = join(ROOT, path.replace(/^\//, '').replace(/\.\./g, ''));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  if (ext === '.html' || ext === '.json' || ext === '.js') {
    res.end(readFileSync(file));
  } else {
    createReadStream(file).pipe(res);
  }
}).listen(PORT, () => {
  console.log(`Manual recolor tool: http://127.0.0.1:${PORT}/manual-recolor.html`);
  console.log('Loads input/sofa.png automatically when available.');
});
