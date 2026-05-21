const CACHE_NAME = 'cartographe-v2';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/geo.js',
  './js/ui.js',
  './js/styles.js',
  './js/layers.js',
  './js/map.js',
  './js/geocoder.js',
  './js/routes.js',
  './js/drawing.js',
  './js/import.js',
  './js/activity.js',
  './js/export.js',
  './js/app.js',
  './manifest.json'
];

/* Install: cache app shell */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* Activate: clean old caches */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch: app shell from cache, tiles from network (IndexedDB handles tile caching) */
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // For tile requests, always go to network (IndexedDB caching is handled in offline.js)
  if (url.includes('tile') || url.includes('wmts') || url.includes('opentopomap') || url.includes('arcgisonline') || url.includes('geopf.fr') || url.includes('cartocdn')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 404 })));
    return;
  }

  // For MapLibre GL JS library
  if (url.includes('maplibre-gl')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // App shell: cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
