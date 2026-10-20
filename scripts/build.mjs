#!/usr/bin/env node
// Builds the portal from the registry, content/ and site/ into dist/.
//
//   node scripts/build.mjs [--out dist]
//
// SITE_URL is the address the site is served at, ending in "/" (default
// https://simai.io/; the Pages preview is https://simai.github.io/simai.io/).
// Only https://simai.io/ is indexed; every other address gets noindex.
// PORTAL_COMMIT, else GITHUB_SHA, else HEAD, names the build in the footer.
// Pages link each other relatively, so the site works under any base path;
// only 404.html, which is served at any depth, uses the base path.
import {execFileSync} from 'node:child_process';
import {copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {ROOT, checkRegistry, effectsBase, frameworkBase, liveLocales, lock, pages, registry, strings} from './lib/registry.mjs';
import {assemble, portalLock} from './lib/assemble.mjs';

const PRODUCTION = 'https://simai.io/';
const YANDEX_VERIFICATION = 'f30b3d3c78686437';

const args = process.argv.slice(2);
const out = resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist');
const siteUrl = process.env.SITE_URL || PRODUCTION;
if (!/^https:\/\/[^/]+(\/[^?#]*)?\/$/u.test(siteUrl)) throw new Error(`build: SITE_URL must be an https address ending in "/": ${siteUrl}`);
const basePath = new URL(siteUrl).pathname;
const indexed = siteUrl === PRODUCTION;

const data = registry();
const problems = checkRegistry(data);
if (problems.length) throw new Error(`build: the registry does not check:\n${problems.join('\n')}`);
const framework = lock();
const commit = process.env.PORTAL_COMMIT || process.env.GITHUB_SHA
  || execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error(`build: not a full commit: ${commit}`);

const escape = (value) => String(value).replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const template = (name) => readFileSync(join(ROOT, 'site', `${name}.html`), 'utf8');
const partial = (name) => readFileSync(join(ROOT, 'site', 'partials', `${name}.html`), 'utf8');

function render(source, values, dictionary) {
  let page = source.replace('{{HEAD}}', partial('head')).replace('{{HEADER}}', partial('header')).replace('{{FOOTER}}', partial('footer'));
  for (const [key, value] of Object.entries(values)) page = page.replaceAll(`{{${key}}}`, value);
  page = page.replace(/\{\{S:([a-z.]+)\}\}/gu, (match, key) => {
    if (!(key in dictionary)) throw new Error(`build: no string ${key}`);
    return escape(dictionary[key]);
  });
  const left = page.match(/\{\{[A-Z_:a-z.]+\}\}/u);
  if (left) throw new Error(`build: ${left[0]} left in a page`);
  return page;
}

// The address a card shows: the host and path, but on GitHub only
// owner/repository, not the file inside it.
const host = (url) => {
  const {host: name, pathname} = new URL(url);
  const path = name === 'github.com' ? pathname.split('/').slice(0, 3).join('/') : pathname;
  return name + (path === '/' ? '' : path.replace(/\/$/u, ''));
};
const live = liveLocales(data);
const robots = indexed ? '' : '<meta name="robots" content="noindex">\n';
const logo = readFileSync(join(ROOT, 'site', 'partials', 'logo.svg'), 'utf8');

// Which locales each assembled product has an artifact for. A reader of a
// locale without one is sent to the default locale's artifact.
const assembledLocales = new Map();
for (const artifact of portalLock().artifacts) {
  const locale = artifact.base_path.split('/')[1];
  if (!assembledLocales.has(artifact.product)) assembledLocales.set(artifact.product, new Set());
  assembledLocales.get(artifact.product).add(locale);
}

// The address of a product for a reader on a page whose root prefix is root,
// and the locale it is in when that differs from the reader's.
function productHref(product, locale, root) {
  const {placement} = product;
  if (placement.mode === 'external' || placement.mode === 'subdomain') return {href: placement.url};
  if (placement.mode === 'assembled') {
    const locales = assembledLocales.get(product.id) ?? new Set();
    const target = locales.has(locale) ? locale : data.default_locale;
    if (!locales.has(target)) throw new Error(`build: ${product.id} is assembled but has no artifact for ${target}`);
    return {href: root + placement.path.replace('{locale}', target), language: target === locale ? null : target};
  }
  return {href: null};
}

function card(product, locale, root, dictionary) {
  const {href, language} = productHref(product, locale, root);
  const title = escape(product.title[locale]);
  const status = dictionary[`status.${product.status}`];
  const meta = [`<span>${escape(dictionary[`kind.${product.kind}`])}</span>`];
  if (product.version) meta.push(`<span class="badge badge--plain">${escape(product.version)}</span>`);
  if (status) meta.push(`<span class="badge">${escape(status)}</span>`);
  if (language) meta.push(`<span class="badge badge--plain" lang="${locale}">${escape(dictionary['product.in_language'])}</span>`);
  const external = href && /^https:/u.test(href);
  const lines = [
    `      <li class="card${href ? '' : ' card--soon'}" data-product="${product.id}">`,
    `        <p class="card__meta">${meta.join('')}</p>`,
    href
      ? `        <h3><a class="card__link" href="${escape(href)}"${language ? ` hreflang="${language}"` : ''}>${title}</a></h3>`
      : `        <h3>${title}</h3>`,
    `        <p class="card__summary">${escape(product.summary[locale])}</p>`,
  ];
  if (external) lines.push(`        <p class="card__host">${escape(host(href))}</p>`);
  if (!href) lines.push(`        <p class="card__host">${escape(dictionary['product.unavailable'])}</p>`);
  lines.push('      </li>');
  return lines.join('\n');
}

function cards(family, locale, root, dictionary) {
  const products = data.products.filter((product) => product.family === family.id);
  if (!products.length) return `    <p class="family__empty">${escape(dictionary['family.empty'])}</p>`;
  return `    <ul class="cards">\n${products.map((product) => card(product, locale, root, dictionary)).join('\n')}\n    </ul>`;
}

// The portal is one page per locale: the menu jumps to a family's section.
// page is the prefix from the current page to that locale's home ("" on it).
function nav(locale, page) {
  return data.families.map((family) => `      <a href="${escape(`${page}#${family.id}`)}">${escape(family.title[locale])}</a>`).join('\n');
}

// The language menu, shaped like Docara's: a globe button and the list.
function langs(locale, root, dictionary) {
  const locales = data.locales.filter((item) => item.status === 'live');
  if (locales.length < 2) return '';
  const check = '<sf-icon icon="check" aria-hidden="true"></sf-icon>';
  const options = locales.map((item) => `            <li><a class="lang__option" href="${escape(`${root}${item.id}/`)}" lang="${item.id}" hreflang="${item.id}"${item.id === locale ? ' aria-current="page"' : ''}><span>${escape(item.label)}</span>${item.id === locale ? check : ''}</a></li>`);
  return [
    '      <details class="lang" data-lang-menu>',
    `        <summary class="lang__trigger sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1/2 radius-default cursor-pointer" aria-label="${escape(dictionary['lang.label'])}" aria-expanded="false"><sf-icon icon="language" aria-hidden="true"></sf-icon></summary>`,
    `        <nav class="lang__popup" aria-label="${escape(dictionary['lang.label'])}">`,
    '          <ul>',
    ...options,
    '          </ul>',
    '        </nav>',
    '      </details>',
  ].join('\n');
}

const alternates = (path) => [...live.map((locale) => `<link rel="alternate" hreflang="${locale}" href="${escape(`${siteUrl}${locale}/${path}`)}">`), `<link rel="alternate" hreflang="x-default" href="${escape(`${siteUrl}${data.default_locale}/${path}`)}">`].join('\n');

const common = (locale, root, home, page, dictionary, canonicalPath) => ({
  LANG: locale,
  ROOT: root,
  HOME: home,
  LOGO: logo.trim(),
  NAV: nav(locale, page),
  LANGS: langs(locale, root, dictionary),
  ROBOTS: robots,
  CANONICAL: escape(siteUrl + canonicalPath),
  ALTERNATES: alternates(''),
  FRAMEWORK_BASE: frameworkBase(framework),
  EFFECTS_BASE: effectsBase(framework),
  PAIR: framework.pair,
  COMMIT_SHORT: commit.slice(0, 12),
});

rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
const sitemap = [];
const write = (path, html) => {
  mkdirSync(join(out, path), {recursive: true});
  writeFileSync(join(out, path, 'index.html'), html);
};

for (const locale of live) {
  const dictionary = strings(locale);
  const content = pages(locale);

  const families = data.families.map((family) => [
    `  <section class="wrap family" id="${family.id}" aria-labelledby="family-${family.id}" data-family="${family.id}">`,
    '    <div class="family__head">',
    `      <h2 id="family-${family.id}">${escape(family.title[locale])}${family.status === 'stable' ? '' : ` <span class="badge">${escape(dictionary[`status.${family.status}`])}</span>`}</h2>`,
    `      <p class="family__summary">${escape(family.summary[locale])}</p>`,
    '    </div>',
    cards(family, locale, '../', dictionary),
    '  </section>',
  ].join('\n')).join('\n');
  write(locale, render(template('home'), {
    ...common(locale, '../', './', '', dictionary, `${locale}/`),
    TITLE: escape(content.home.title),
    DESCRIPTION: escape(content.home.description),
    HEADING: escape(content.home.heading),
    LEAD: escape(content.home.lead),
    EFFECT: escape(content.home.effect),
    FAMILIES: families,
  }, dictionary));
  sitemap.push(`${locale}/`);

  // The family pages of the first portal build moved to sections of the
  // home page; their addresses stay and send the reader there.
  for (const family of data.families) {
    write(join(locale, family.path), render(template('redirect'), {
      LANG: locale,
      TITLE: escape(`${family.title[locale]} — SIMAI`),
      TARGET: `../#${family.id}`,
      CANONICAL: escape(`${siteUrl}${locale}/`),
    }, dictionary));
  }
}

// The entry page: the Yandex verification tag lives here, at the apex.
const entryLocale = data.default_locale;
const entryStrings = strings(entryLocale);
writeFileSync(join(out, 'index.html'), render(template('entry'), {
  LANG: entryLocale,
  YANDEX_VERIFICATION,
  ROBOTS: robots,
  TARGET: `${entryLocale}/`,
  CANONICAL: escape(`${siteUrl}${entryLocale}/`),
  ALTERNATES: alternates(''),
}, entryStrings));

// 404.html is served at any depth, so its links take the base path.
writeFileSync(join(out, '404.html'), render(template('notfound'), {
  ...common(entryLocale, basePath, `${basePath}${entryLocale}/`, `${basePath}${entryLocale}/`, entryStrings, `${entryLocale}/`),
  TITLE: escape(`${entryStrings['notfound.title']} — SIMAI`),
  DESCRIPTION: escape(entryStrings['notfound.lead']),
}, entryStrings));

cpSync(join(ROOT, 'site', 'assets'), join(out, 'assets'), {recursive: true});

// Products assembled from their portal artifacts (docs/ASSEMBLY.md).
const assembled = await assemble(out, data);
for (const item of assembled) {
  sitemap.push(item.base_path.slice(1));
  console.log(`build: ${item.product} ${item.release} -> ${item.base_path} (${item.files} files)`);
}
const published = {...data};
delete published.$schema;
writeFileSync(join(out, 'registry.json'), `${JSON.stringify(published, null, 2)}\n`);
copyFileSync(join(ROOT, 'schemas', 'registry.schema.json'), join(out, 'registry.schema.json'));
writeFileSync(join(out, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemap.map((path) => `  <url><loc>${escape(siteUrl + path)}</loc></url>`),
  '</urlset>',
  '',
].join('\n'));
writeFileSync(join(out, 'robots.txt'), indexed ? `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, '.nojekyll'), '');
console.log(`build: ${sitemap.length} pages for ${siteUrl}${indexed ? '' : ' (noindex)'}, build ${commit.slice(0, 12)}, Framework ${framework.pair} -> ${out}`);
