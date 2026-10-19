// Loads the registry, the content and the Framework lock, and checks them:
// the JSON Schema first, then the rules a schema cannot hold (references,
// uniqueness, every live locale present, placement against status).
import {readFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const registry = () => readJson(join(ROOT, 'registry', 'products.json'));
export const lock = () => readJson(join(ROOT, 'framework.lock.json'));
export const frameworkBase = (framework = lock()) => framework.cdn.replace('{commit}', framework.ui.commit);
export const liveLocales = (data) => data.locales.filter((locale) => locale.status === 'live').map((locale) => locale.id);
export const strings = (locale) => readJson(join(ROOT, 'content', locale, 'strings.json'));
export const pages = (locale) => readJson(join(ROOT, 'content', locale, 'pages.json'));

// Returns a list of problems; empty means the registry and content agree.
export function checkRegistry(data = registry()) {
  const problems = [];
  const ajv = new Ajv2020({allErrors: true, strict: true});
  const validate = ajv.compile(readJson(join(ROOT, 'schemas', 'registry.schema.json')));
  if (!validate(data)) {
    for (const error of validate.errors) problems.push(`registry${error.instancePath || ''}: ${error.message}`);
    return problems;
  }

  const locales = data.locales.map((locale) => locale.id);
  const live = liveLocales(data);
  if (new Set(locales).size !== locales.length) problems.push('registry: a locale is listed twice');
  if (!live.includes(data.default_locale)) problems.push(`registry: the default locale ${data.default_locale} is not live`);

  const text = (where, value) => {
    for (const locale of live) if (!value[locale]) problems.push(`${where}: no ${locale} text`);
    for (const locale of Object.keys(value)) if (!locales.includes(locale)) problems.push(`${where}: ${locale} is not a registry locale`);
  };

  const families = new Map();
  for (const family of data.families) {
    if (families.has(family.id)) problems.push(`family ${family.id}: listed twice`);
    families.set(family.id, family);
    text(`family ${family.id}.title`, family.title);
    text(`family ${family.id}.summary`, family.summary);
  }
  const paths = data.families.map((family) => family.path);
  if (new Set(paths).size !== paths.length) problems.push('registry: two families share a path');

  const ids = new Set();
  for (const product of data.products) {
    const where = `product ${product.id}`;
    if (ids.has(product.id)) problems.push(`${where}: listed twice`);
    ids.add(product.id);
    if (!families.has(product.family)) problems.push(`${where}: unknown family ${product.family}`);
    else if (families.get(product.family).status === 'soon' && product.status !== 'soon') problems.push(`${where}: released in a family that is still "soon"`);
    text(`${where}.title`, product.title);
    text(`${where}.summary`, product.summary);
    const {mode} = product.placement;
    if (product.status === 'soon' && mode !== 'none') problems.push(`${where}: "soon" but has a public address`);
    if (product.status !== 'soon' && mode === 'none') problems.push(`${where}: ${product.status} but has no public address`);
    if (product.kind === 'repository' && !product.repository) problems.push(`${where}: a repository entry without a public repository`);
  }

  for (const locale of live) {
    const dir = join(ROOT, 'content', locale);
    if (!existsSync(join(dir, 'strings.json')) || !existsSync(join(dir, 'pages.json'))) {
      problems.push(`content/${locale}: strings.json and pages.json are required for a live locale`);
      continue;
    }
    const base = Object.keys(strings(data.default_locale)).sort();
    const own = Object.keys(strings(locale)).sort();
    for (const key of base) if (!own.includes(key)) problems.push(`content/${locale}/strings.json: no ${key}`);
    for (const key of own) if (!base.includes(key)) problems.push(`content/${locale}/strings.json: ${key} is not in ${data.default_locale}`);
    const content = pages(locale);
    for (const family of data.families) if (!content.families?.[family.id]) problems.push(`content/${locale}/pages.json: no page for family ${family.id}`);
    for (const id of Object.keys(content.families ?? {})) if (!families.has(id)) problems.push(`content/${locale}/pages.json: ${id} is not a registry family`);
  }
  return problems;
}
