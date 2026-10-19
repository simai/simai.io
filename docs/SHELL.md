# Shared shell contract

Every site on the portal shows the same header and footer, so that readers
can move between products without noticing that the sites come from
different repositories. This covers the hub, the docs sites and the
applications.

## Status

The header and footer in `site/partials/` are a **placeholder**. The shell
will be a Simai Framework component, shipped in a released Core/Smart pair.
The Framework owner names and builds it. When it ships, the hub and every
product site replace their own header and footer with it.

## What the shell shows

- **Brand:** the SIMAI mark, linking to the home page of the reader's locale.
- **Product switcher:** home plus every family of the registry, with the
  current family marked (`aria-current="page"`).
- **Language switch:** shown only when more than one locale is live. Each
  link keeps the current path under the other locale prefix.
- **Theme switch:** system, light or dark. These are Framework
  `.sf-theme-button` controls with `data-theme`, and the Loader owns the
  preference (`SF.Loader.setTheme`) and keeps it per reader. The look
  becomes the segmented `<sf-button-group>` (simai/ui-source#4) once it
  ships in a pair.
- **Background:** the home hero places a catalogue effect with
  `data-sf-effect` (`content/<locale>/pages.json` → `home.effect`). The
  catalogue commit is pinned in `framework.lock.json`.
- **Search:** comes in phase 3 with the merged index.
- **Footer:** the families, a link to the portal source, the build and the
  Framework pair.

## What the shell takes

- The registry, from `https://simai.io/registry.json` or a copy pinned at
  build time. The shell holds no product list of its own.
- The locale, the current family id and the site root.
- Strings from the locale's `strings.json` keys `nav.*`, `theme.*`,
  `lang.*` and `skip`.

## Rules for a product site

- It loads the Framework from a released pair, never from a branch.
- It marks its header and footer `data-portal-shell="header"` and
  `data-portal-shell="footer"`, so the switch to the component can be
  checked.
- It uses Framework colour roles only, so both themes work.
