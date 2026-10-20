# simai.io

The portal of SIMAI technologies and products: SIMAI Framework, Docara and
the products that follow. This repository is the **hub**. It holds:

- the product registry;
- the home page: one page per locale, a section per product family;
- the shared shell contract;
- the build that publishes the portal.

It implements no product. Each product keeps its own repository, release
cycle and owner.

- Site: https://simai.io/ (GitHub Pages; https://simai.github.io/simai.io/ redirects there)

## How it is organized

| Path | What it holds |
|---|---|
| `registry/products.json` | Every product family and product, their status and where each one lives. Validated by `schemas/registry.schema.json`. |
| `content/<locale>/` | Home page text (`pages.json`) and interface strings (`strings.json`) per locale. Russian and English are live. |
| `site/` | Page templates, the placeholder shell (header with the SIMAI logo, language menu and theme switch; footer) and assets. |
| `portal.lock.json` | The product releases assembled under portal paths ([assembly](docs/ASSEMBLY.md)). |
| `framework.lock.json` | The SIMAI Framework pair the pages load, and the effects catalogue commit, from jsDelivr by full commit. |
| `scripts/` | `build.mjs` (the site), `check.mjs` (the gate), `check-hygiene.mjs`, `serve.mjs` (a local look). |
| `docs/` | [Architecture](docs/ARCHITECTURE.md), [shell contract](docs/SHELL.md), [adding a product](docs/ADDING-A-PRODUCT.md), [portal artifacts](docs/ASSEMBLY.md), [the simai server](docs/SERVER.md). |

Addresses:

- The portal is one page per locale, `/ru/` and `/en/`; the menu jumps to
  a family's section (`/ru/#framework`). `/ru/framework/` and the other
  family paths of the first build send the reader to that section.
- Every product site keeps its own GitHub Pages and a flat third-level
  domain: `ui.simai.io` (SIMAI Framework docs), `docara.simai.io`,
  `effects.simai.io`, `sitepack.simai.io`; applications such as
  `play.simai.io` too. simai.io links to them.
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
