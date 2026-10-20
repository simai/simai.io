# The simai server

The owner decided on 2026-10-20 that every site the portal links to moves
to the SIMAI server (201.51.24.222, set up with
[simai-env](https://github.com/simai/simai-env)), one site at a time.
GitHub Pages stays as the fallback until each site has run on the server
for a while.

## How simai.io deploys there

- `.github/workflows/deploy-server.yml` builds for `https://simai.io/` after
  Quality passes on main, or on a manual run, and sends the build over SSH
  to the server's deploy gate (`deploy-artifact <sha256>`).
- The gate's key can deploy simai.io and nothing else. It lives in the
  environment `simai-server` as `SIMAI_DEPLOY_KEY`, with
  `SIMAI_DEPLOY_KNOWN_HOSTS`.
- The workflow stays off until the repository variable
  `SIMAI_SERVER_DEPLOY` is `true`.
- The build ships `.simai/app.json` with health path `/ru/`. On the server,
  `/` is a 302 to `/ru/` done by nginx, so the entry page is only there for
  Pages.
- Rollback: `simai-admin.sh site deploy-rollback --domain simai.io` on the
  server, or put DNS back on Pages.
