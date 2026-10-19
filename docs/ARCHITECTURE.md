# Architecture

## One hub, independent products

The portal is assembled, not written in one place:

- **The hub** (this repository) owns:
  - the registry;
  - the home page;
  - the shell contract;
  - the release lock;
  - the build.
- **Each product** owns its content, its build and its releases, in its own
  repository.

The hub never publishes a product version that the product has not released.

## Addresses

| Kind | Where | Example |
|---|---|---|
| Home: one page, a section per family | apex, language first | `simai.io/ru/#framework` |
| Product sites: docs, catalogues, standards | own flat third-level domain | `ui.simai.io`, `effects.simai.io` |
| Applications | own flat third-level domain | `play.simai.io` |

Owner decision of 2026-10-19: each site keeps its own GitHub Pages and gets
a flat third-level domain (no fourth level); simai.io is the navigator. The
assembly from portal artifacts below stays available but holds nothing.

- Slugs are English. Adding a locale adds a prefix (`/en/`) and never changes
  an existing address.
- Applications that run user code or hold state stay on their own origin.
- `/` is an entry page. It sends readers to the default locale and carries
  the site verification tags.
- A family's `path` is the prefix of its products' portal paths. Its own
  address (`/ru/framework/`) sends the reader to the family's section.

## Registry

`registry/products.json` is the only list of what the portal presents.
Navigation, the home sections, `sitemap.xml` and the published
`registry.json` are generated from it.

A product's `placement` says where it lives now:

| Mode | Meaning |
|---|---|
| `external` | Another site; linked out. `planned` names its future portal path. |
| `assembled` | A release artifact the hub unpacks under `path`. |
| `subdomain` | An application on its own `*.simai.io` origin. |
| `none` | No public address yet (status `soon`). |

`scripts/check.mjs` adds the rules a schema cannot hold:

- unique ids;
- a known family for every product;
- text in every live locale;
- placement that agrees with the status.

## Assembly from releases (phase 3)

1. A docs or catalogue product publishes each release as a GitHub release
   asset. The asset is a tarball built for its portal path, with its sha256
   and a receipt.
2. The hub pins every release in `portal.lock.json` (version, asset URL,
   digest).
3. The build downloads each asset, verifies its digest and unpacks it under
   its path. It then merges the Docara search indexes (`search-index/v1`)
   and publishes one static site.
4. Old addresses (`simai.github.io/<repo>/…`) get static redirect pages,
   generated from a redirect map.

Until then, products are `external` and the portal links to them.

## Hosting

- The portal starts on GitHub Pages. The build output is plain static files:
  nothing in it depends on Pages except the `CNAME` file, which is added at
  the domain switch.
- Moving to the own server means copying `dist/` and changing DNS.
- GitHub Pages limits: one custom domain per repository, no server-side
  redirects or headers, 1 GB per site.

## Localization

- Home page text: `content/<locale>/pages.json`.
- Interface strings: `content/<locale>/strings.json`.
- A locale goes live when its status in the registry is `live`. From then
  on, the check requires every key and every registry text in that locale.
