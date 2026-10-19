// Unpacks the portal artifacts of portal.lock.json into the built site
// (docs/ASSEMBLY.md). Every archive is checked against its pinned sha256, and
// every entry is checked before anything is written.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, join, posix} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {ROOT, readJson} from './registry.mjs';

// Files the hub owns at the top of an artifact.
const HUB_OWNED = new Set(['CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', '404.html', 'registry.json', 'registry.schema.json']);

export const portalLock = () => {
  const path = join(ROOT, 'portal.lock.json');
  return existsSync(path) ? readJson(path) : {schema: 'simai.io.portal-lock', version: 1, artifacts: []};
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Reads a tar archive: regular files and directories only, with POSIX pax
// and GNU long names. Anything else (links, devices) is refused.
export function readTar(bytes) {
  const entries = [];
  let offset = 0;
  let longName = null;
  const text = (start, length) => {
    const raw = bytes.subarray(start, start + length);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
  };
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = parseInt(text(offset + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = text(offset + 345, 155);
    let name = text(offset, 100);
    if (prefix) name = `${prefix}/${name}`;
    const body = bytes.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      for (const record of body.toString('utf8').split('\n')) {
        const match = record.match(/^\d+ path=(.*)$/u);
        if (match) longName = match[1];
      }
      continue;
    }
    if (type === 'g') continue;
    if (type === 'L') {
      longName = body.toString('utf8').replace(/\0+$/u, '');
      continue;
    }
    if (longName) {
      name = longName;
      longName = null;
    }
    if (type !== '0' && type !== '5') throw new Error(`${name}: tar entry type ${type} is not a file or a directory`);
    entries.push({name, directory: type === '5', body});
  }
  return entries;
}

function normalized(name, where) {
  const clean = posix.normalize(name.replace(/^\.\//u, ''));
  if (clean === '.' || clean === './') return null;
  if (clean.startsWith('/') || clean.startsWith('../') || clean === '..') throw new Error(`${where}: ${name} leaves the archive root`);
  return clean.replace(/\/$/u, '');
}

async function fetchArchive(artifact) {
  const local = process.env.PORTAL_ARTIFACTS_DIR;
  if (local) {
    const path = join(local, posix.basename(new URL(artifact.url).pathname));
    if (!existsSync(path)) throw new Error(`${artifact.product}: ${path} is missing (PORTAL_ARTIFACTS_DIR)`);
    return readFileSync(path);
  }
  const cache = join(ROOT, '.cache', 'artifacts', `${artifact.sha256}.tar.gz`);
  if (existsSync(cache)) return readFileSync(cache);
  let error;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(artifact.url, {redirect: 'follow', signal: AbortSignal.timeout(60000)});
      if (!response.ok) throw new Error(`${artifact.url} answers ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      mkdirSync(dirname(cache), {recursive: true});
      writeFileSync(`${cache}.part`, bytes);
      renameSync(`${cache}.part`, cache);
      return bytes;
    } catch (caught) {
      error = caught;
    }
  }
  throw new Error(`${artifact.product}: download failed: ${error.message}`);
}

// Returns a list of {product, base_path, files} for what was unpacked.
export async function assemble(out, data, lock = portalLock()) {
  if (lock.schema !== 'simai.io.portal-lock' || lock.version !== 1) throw new Error('portal.lock.json: unknown schema or version');
  const products = new Map(data.products.map((product) => [product.id, product]));
  const paths = [];
  const done = [];
  for (const artifact of lock.artifacts) {
    const where = `portal.lock.json ${artifact.product}`;
    for (const key of ['product', 'release', 'url', 'sha256', 'base_path']) if (!artifact[key]) throw new Error(`${where}: no ${key}`);
    if (!/^[0-9a-f]{64}$/u.test(artifact.sha256)) throw new Error(`${where}: sha256 is not 64 hex`);
    if (!/^https:\/\//u.test(artifact.url)) throw new Error(`${where}: url is not https`);
    const product = products.get(artifact.product);
    if (!product) throw new Error(`${where}: not a registry product`);
    if (product.placement.mode !== 'assembled') throw new Error(`${where}: the registry placement is ${product.placement.mode}, not assembled`);
    const live = data.locales.filter((locale) => locale.status === 'live').map((locale) => locale.id);
    const expected = live.map((locale) => `/${product.placement.path.replace('{locale}', locale)}`);
    if (!expected.includes(artifact.base_path)) throw new Error(`${where}: base_path ${artifact.base_path} is not the registry path (${expected.join(', ')})`);
    for (const other of paths) {
      if (other.startsWith(artifact.base_path) || artifact.base_path.startsWith(other)) throw new Error(`${where}: ${artifact.base_path} overlaps ${other}`);
    }
    const familyPaths = data.families.flatMap((family) => live.map((locale) => `/${locale}/${family.path}`));
    if ([...live.map((locale) => `/${locale}/`), ...familyPaths].includes(artifact.base_path)) throw new Error(`${where}: ${artifact.base_path} is a hub page`);
    paths.push(artifact.base_path);

    const archive = await fetchArchive(artifact);
    const digest = sha256(archive);
    if (digest !== artifact.sha256) throw new Error(`${where}: sha256 ${digest} differs from the lock`);
    const entries = readTar(gunzipSync(archive));
    const files = [];
    for (const entry of entries) {
      const name = normalized(entry.name, where);
      if (name === null) continue;
      if (!entry.directory && !name.includes('/') && HUB_OWNED.has(name)) throw new Error(`${where}: ${name} belongs to the hub`);
      if (!entry.directory) files.push({name, body: entry.body});
    }
    if (!files.some((file) => file.name === 'index.html')) throw new Error(`${where}: no index.html at the archive root`);
    const target = join(out, artifact.base_path);
    if (existsSync(target)) throw new Error(`${where}: ${artifact.base_path} already exists in the build`);
    for (const file of files) {
      const path = join(target, file.name);
      mkdirSync(dirname(path), {recursive: true});
      writeFileSync(path, file.body);
    }
    done.push({product: artifact.product, release: artifact.release, base_path: artifact.base_path, files: files.length});
  }
  return done;
}
