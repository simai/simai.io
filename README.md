# simai.io

The portal of SIMAI technologies and products: Simai Framework, Docara and
the products that follow. This repository is the **hub**. It holds:

- the product registry;
- the home page and the product family pages;
- the shared shell contract;
- the build that publishes the portal.

It implements no product. Each product keeps its own repository, release
cycle and owner.

- Preview: https://simai.github.io/simai.io/ (not indexed)
- Production: https://simai.io/ (after the domain switch)

## How it is organized

| Path | What it holds |
|---|---|
| `registry/products.json` | Every product family and product, their status and where each one lives. Validated by `schemas/registry.schema.json`. |
| `content/<locale>/` | Page text (`pages.json`) and interface strings (`strings.json`) per locale. Russian is live; English is planned. |
| `site/` | Page templates, the placeholder shell (header and footer) and assets. |
| `framework.lock.json` | The Simai Framework pair the pages load, from jsDelivr by full commit. |
| `scripts/` | `build.mjs` (the site), `check.mjs` (the gate), `check-hygiene.mjs`, `serve.mjs` (a local look). |
| `docs/` | [Architecture](docs/ARCHITECTURE.md), [shell contract](docs/SHELL.md), [adding a product](docs/ADDING-A-PRODUCT.md). |

Addresses:

- Reading content lives on language-first paths: `/ru/`, `/ru/framework/`,
  `/ru/docara/`; English will use `/en/…` with the same slugs.
- Interactive applications live on their own subdomains, for example
  `play.simai.io`.

## Working on the repository

Requires Node.js 20.19 or newer.

```sh
npm ci
npm run check                     # registry, content, a fresh build, every page, hygiene
node scripts/check.mjs --online   # also requests every external link (CI does this)
SITE_URL=https://simai.github.io/simai.io/ npm run build
npm run serve -- --base /simai.io/
```

`SITE_URL` is the address the build is served at. Only `https://simai.io/`
is indexed; any other address gets `noindex`.

CI runs the gate on every push and pull request. Pages deploys `main` after
the gate passes.

## Licence

Apache License 2.0, see [LICENSE](LICENSE). Product names and the SIMAI
logo are not covered by the licence.
