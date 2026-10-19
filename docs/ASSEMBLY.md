# Portal artifacts and assembly

A product that the portal hosts under one of its paths publishes a **portal
artifact** with every release. The hub pins artifacts in `portal.lock.json`.
`scripts/build.mjs` unpacks them under their paths, after checking their
digests.

## The artifact a product publishes

Attach these files to a GitHub release of the product's repository:

| File | What it is |
|---|---|
| `<product>-<version>-portal.tar.gz` | The built site. `index.html` sits at the top of the archive, not inside a folder. |
| `<product>-<version>-portal.tar.gz.sha256` | The sha256 of the archive, in `sha256sum` format. |
| `<product>-<version>-portal-receipt.json` | The receipt, below. |

The site must be built for its portal path, for example
`/ru/framework/effects/`:

- every URL is relative, or absolute under that path;
- it links nothing outside its path except other portal pages
  (`/ru/...`) and external https sites;
- it loads Simai Framework from a released pair, never from a branch;
- every page has `<html lang>`, a `<title>`, a description and
  `<link rel="canonical">` with its full address on `https://simai.io/`;
- its header links back to the portal home until it adopts the shared
  shell ([SHELL.md](SHELL.md));
- it holds no `CNAME`, `.nojekyll`, `robots.txt` or `sitemap.xml` (the hub
  owns those), and no `404.html`;
- it holds one locale only. The locale prefix belongs to the portal path,
  not to the site, so a Docara site is built with one locale and the
  `default_unprefixed` routing strategy.

Receipt (`schema: simai.io.portal-artifact`, `version: 1`):

```json
{
  "schema": "simai.io.portal-artifact",
  "version": 1,
  "product": "framework-effects",
  "release": "v1.2.0",
  "repository": "simai/ui-effects",
  "commit": "<40-hex source commit>",
  "locale": "ru",
  "base_path": "/ru/framework/effects/",
  "archive": "framework-effects-v1.2.0-portal.tar.gz",
  "sha256": "<64-hex>",
  "files": 42,
  "framework_pair": "ui-<12 hex>"
}
```

The product names its own version scheme. Republishing a release under the
same tag with different bytes is refused, because the lock pins the digest.

## The lock

`portal.lock.json` lists one entry per assembled product:

```json
{
  "schema": "simai.io.portal-lock",
  "version": 1,
  "artifacts": [
    {
      "product": "framework-effects",
      "release": "v1.2.0",
      "url": "https://github.com/simai/ui-effects/releases/download/v1.2.0/framework-effects-v1.2.0-portal.tar.gz",
      "sha256": "<64-hex>",
      "base_path": "/ru/framework/effects/"
    }
  ]
}
```

To take a release, change its entry: `release`, `url` and `sha256`. Take
these from the receipt, then check the receipt's sha256 against the archive.
A product's registry `placement` becomes `assembled` in the same change.

## What the build checks

1. The product is in the registry with `placement.mode: assembled`, and its
   path matches `base_path`.
2. The archive's sha256 equals the lock's.
3. Every entry in the archive is a regular file or a directory inside the
   archive root: no links, no `..`, no absolute paths, no files the hub owns.
4. The path does not collide with a hub page or with another artifact.
5. After unpacking, the page check (`scripts/check.mjs`) covers the artifact's
   pages too: every relative link must resolve.

Downloads are cached in `.cache/artifacts/<sha256>.tar.gz`. Set
`PORTAL_ARTIFACTS_DIR` to a directory of archives to build offline.
