// AhnJi Training Log — service worker
// Caches the app shell on first load so the page itself opens even with
// zero connection. Data reads/writes still go through the existing
// online/offline fallback logic inside training-log.html once it's running.

const CACHE_NAME = 'ahnji-training-log-v1';
const APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests for the app shell itself.
  // Everything else (in particular, calls to the Apps Script API) goes
  // straight to the network untouched — the app's own store adapter
  // already handles those failing gracefully.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      // Serve cached instantly if we have it (fast + works offline);
      // otherwise wait on the network.
      return cached || networkFetch;
    })
  );
});
