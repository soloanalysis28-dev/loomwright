/* Development stub, served only by the Base44 dev proxy (.base44/nginx.conf)
   in place of sw.js on the preview origin. The repo's real sw.js is untouched.
   It unregisters any previously installed offline worker and clears its
   caches, so sandbox edits are always served fresh from the network. */
const CACHE_PREFIX = 'loomwright-offline-';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith(CACHE_PREFIX)).map(n => caches.delete(n)));
    await self.registration.unregister();
  })());
});
