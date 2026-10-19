#!/usr/bin/env node
// The portal gate: registry and content, a fresh build, then every page.
//
//   node scripts/check.mjs [--online]
//
// Every page must have lang, a title, a description and a canonical link;
// every relative href/src must resolve to a built file; no placeholder may be
// left. --online also requests every external link (CI runs it).
import {mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT, checkRegistry} from './lib/registry.mjs';

const online = process.argv.includes('--online');
const problems = checkRegistry();
if (problems.length) {
  console.error(problems.map((problem) => `FAIL ${problem}`).join('\n'));
  process.exit(1);
}
console.log('registry: ok');

const out = mkdtempSync(join(tmpdir(), 'simai-io-check-'));
const siteUrl = process.env.SITE_URL || 'https://simai.io/';
try {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs'), '--out', out], {stdio: 'inherit', env: {...process.env, SITE_URL: siteUrl}});
  const basePath = new URL(siteUrl).pathname;

  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(out);

  const external = new Map();
  const resolveLocal = (from, target) => {
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) return true;
    let path;
    if (clean.startsWith('/')) {
      if (!clean.startsWith(basePath)) return false;
      path = join(out, clean.slice(basePath.length));
    } else {
      path = resolve(dirname(from), clean);
    }
    if (!path.startsWith(out)) return false;
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    return existsSync(path);
  };

  for (const file of files.filter((path) => path.endsWith('.html'))) {
    const name = relative(out, file);
    const html = readFileSync(file, 'utf8');
    if (/\{\{[^}]+\}\}/u.test(html)) problems.push(`${name}: a placeholder is left`);
    if (!/<html lang="[a-z]{2}"/u.test(html)) problems.push(`${name}: no lang`);
    if (!/<title>[^<]+<\/title>/u.test(html)) problems.push(`${name}: no title`);
    if (!/<link rel="canonical" href="https:\/\/[^"]+">/u.test(html)) problems.push(`${name}: no canonical link`);
    if (name !== 'index.html' && !/<meta name="description" content="[^"]+">/u.test(html)) problems.push(`${name}: no description`);
    for (const [, attribute, target] of html.matchAll(/\b(href|src)="([^"]*)"/gu)) {
      const value = target.replaceAll('&amp;', '&');
      if (/^https?:\/\//u.test(value)) {
        if (!value.startsWith('https://')) problems.push(`${name}: ${attribute} over http: ${value}`);
        if (value.startsWith(siteUrl) && !resolveLocal(join(out, 'index.html'), value.slice(siteUrl.length) || './')) problems.push(`${name}: ${value} is not a built page`);
        if (!external.has(value)) external.set(value, name);
        continue;
      }
      if (/^(data|mailto):/u.test(value) || value.startsWith('#')) continue;
      if (!resolveLocal(file, value)) problems.push(`${name}: ${attribute}="${value}" does not resolve`);
    }
    const url = html.match(/http-equiv="refresh" content="0; url=([^"]+)"/u);
    if (url && !resolveLocal(file, url[1])) problems.push(`${name}: the refresh target ${url[1]} does not resolve`);
  }

  if (online) {
    for (const [url, page] of external) {
      // The Framework CDN base is a directory; check the files the pages load instead.
      if (url.endsWith('/distr/')) continue;
      // Addresses of this build (canonical, alternates) are checked as files above.
      if (url.startsWith(siteUrl)) continue;
      let status = 0;
      for (let attempt = 0; attempt < 3 && !(status >= 200 && status < 400); attempt += 1) {
        try {
          const response = await fetch(url, {method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000)});
          status = response.status;
        } catch (error) {
          status = 0;
        }
      }
      if (!(status >= 200 && status < 400)) problems.push(`${page}: ${url} answers ${status || 'nothing'}`);
    }
    console.log(`external links: ${external.size} requested`);
  } else {
    console.log(`external links: ${external.size} found, not requested (pass --online)`);
  }

  if (problems.length) {
    console.error(problems.map((problem) => `FAIL ${problem}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`pages: ok, ${files.filter((path) => path.endsWith('.html')).length} pages, every relative link resolves`);
  }
} finally {
  rmSync(out, {recursive: true, force: true});
}
