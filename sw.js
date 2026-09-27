/* Increment this cache name when shipped app files change. */
const CACHE_NAME = 'loomwright-offline-v1';
const CACHE_PREFIX = 'loomwright-offline-';
const ASSET_LIST_URL = new URL('./offline-assets.json', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const listResponse = await fetch(ASSET_LIST_URL, { cache: 'no-store' });
    if (!listResponse.ok) throw new Error('Could not load Loomwright’s offline file list.');
    const paths = await listResponse.json();
    const urls = paths.map(path => new URL(path, self.registration.scope).href);
    if (urls.some(url => new URL(url).origin !== self.location.origin)) {
      throw new Error('Offline install list contains a file from outside Loomwright.');
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (fallback) return fallback;
      }
      return new Response('This Loomwright file is not available offline yet. Open Settings and choose “Prepare offline” while connected once.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
