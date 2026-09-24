const CACHE = 'little-bounce-v2';
const ROOT = new URL(self.registration.scope).pathname;
const asset = (name) => new URL(name, self.registration.scope).toString();
const CORE = [ROOT, asset('manifest.webmanifest'), asset('icon-192.png'), asset('icon-512.png'), asset('apple-touch-icon.png')];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    const html = await (await cache.match(ROOT)).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)]
      .map((match) => match[1])
      .filter((url) => !url.startsWith('//') && !url.includes('/__'));
    await Promise.allSettled(assets.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(CACHE)).put(ROOT, response.clone());
      return response;
    }).catch(() => caches.match(ROOT)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  })));
});
