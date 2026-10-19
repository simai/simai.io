#!/usr/bin/env node
// Serves dist/ for a local look, under a base path like GitHub Pages does.
//
//   node scripts/serve.mjs [--port 4173] [--base /simai.io/]
//
// Build first for the same base path, e.g. build with
// SITE_URL=https://simai.github.io/simai.io/ and serve with --base /simai.io/.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {ROOT} from './lib/registry.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const port = Number(option('--port', process.env.PORT || '4173'));
const base = option('--base', '/');
const dist = join(ROOT, 'dist');
const TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8'};

createServer((request, response) => {
  const url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let path = url.startsWith(base) ? normalize(join(dist, url.slice(base.length))) : null;
  if (path && existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!path || !path.startsWith(dist) || !existsSync(path)) {
    response.writeHead(404, {'content-type': TYPES['.html']});
    response.end(readFileSync(join(dist, '404.html')));
    return;
  }
  response.writeHead(200, {'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store'});
  response.end(readFileSync(path));
}).listen(port, () => console.log(`serve: http://localhost:${port}${base}`));
