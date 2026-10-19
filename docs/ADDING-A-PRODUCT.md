# Adding a product or a family

1. Add an entry to `registry/products.json`:
   - `id`, `family` and `kind` (`docs`, `catalogue`, `app` or `repository`);
   - `status`: `soon` until there is a public address;
   - `title` and `summary` in every live locale;
   - `repository`: `owner/name` when the repository is public, else `null`;
   - `placement`: see [Architecture → Registry](ARCHITECTURE.md#registry).
2. A new family also needs a `path` (`<slug>/`): its section of the home
   page is `#<id>`, and its products' portal paths start with the path.
3. Run `npm run check`. Open a pull request. The home section, the
   menu and the sitemap pick the product up by themselves.
4. A product that will be assembled into the portal publishes release
   artifacts first (see [Architecture → Assembly](ARCHITECTURE.md#assembly-from-releases-phase-3)).
   Only after that does its placement move from `external` to `assembled`.
