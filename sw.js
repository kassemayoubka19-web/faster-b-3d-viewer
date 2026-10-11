// FASTER B 3D — v6: Always refresh the viewer UI and equipment catalog.
// Cache 3D models and reference images for faster repeat previews only.
const CACHE = 'fasterb-3d-github-v6';
const ASSET_RE = /\.(?:glb|gltf|bin|png|jpe?g|webp|avif)$/i;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('fasterb-3d-github-') && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Dynamic documents are NEVER served from an older service-worker cache.
  if (request.mode === 'navigate' || !ASSET_RE.test(url.pathname)) {
    event.respondWith(fetch(request, {cache: 'no-cache'}));
    return;
  }

  // Preserve repeated 3D downloads; models are immutable until their URL changes.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
