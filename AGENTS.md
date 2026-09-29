# Agent notes — Loomwright

- Pure static PWA: `index.html` + `app.js` (ES module) + vendored libs in `vendor/`. No package manager, no build, no backend, no secrets. All data lives in browser storage.
- Dev server: `docker compose -f docker-compose.base44.yml up -d` → nginx serves the bind-mounted repo on port 3000 with no-cache headers (config in `.base44/nginx.conf`). Edits apply on browser reload; there is no live reload.
- nginx workers run as `user root` because the sandbox checkout is mode 0700; the stock `nginx` user gets "Permission denied" → 404 everywhere.
- Strict CSP in `index.html` (`script-src 'self'`, `connect-src 'self'`): no inline scripts, no external hosts. Tools that inject scripts (e.g. live-server) break under it — and so does the Base44 preview bridge (`app.base44.com/builder-bridge.js`). The dev proxy therefore rewrites the CSP meta tag via nginx `sub_filter` (dev-only, repo files untouched). `sub_filter` does not work on statically served files, so the outer server proxies to an inner static server on 8080.
- `app.js` registers a cache-first service worker (`sw.js`) on HTTPS origins, including the preview — it would serve stale app files and the old CSP. On the preview origin the dev proxy serves `.base44/dev-sw.js` instead: a stub that unregisters itself and clears `loomwright-offline-*` caches. The real `sw.js` is untouched; offline installation can only be tested outside the preview.
- Quick syntax check (the repo's own): `node --input-type=module --check < app.js` (run in a `node` container).
