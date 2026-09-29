# Agent notes — Loomwright

- Pure static PWA: `index.html` + `app.js` (ES module) + vendored libs in `vendor/`. No package manager, no build, no backend, no secrets. All data lives in browser storage.
- Dev server: `docker compose -f docker-compose.base44.yml up -d` → nginx serves the bind-mounted repo on port 3000 with no-cache headers (config in `.base44/nginx.conf`). Edits apply on browser reload; there is no live reload.
- nginx workers run as `user root` because the sandbox checkout is mode 0700; the stock `nginx` user gets "Permission denied" → 404 everywhere.
- Strict CSP in `index.html` (`script-src 'self'`, `connect-src 'self'`): no inline scripts, no external hosts. Tools that inject scripts (e.g. live-server) break under it.
- `app.js` registers a cache-first service worker (`sw.js`) on HTTPS origins, including the preview. If edits seem stale in a browser, bump `CACHE_NAME` in `sw.js` (the repo's own convention, see `OFFLINE_SECURITY.md`) and rebuild `offline-assets.json` with `tools/build-offline-assets.py`, or unregister the SW.
- Quick syntax check (the repo's own): `node --input-type=module --check < app.js` (run in a `node` container).
