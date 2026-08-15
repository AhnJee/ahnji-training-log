// AhnJi Training Log — service worker
// Caches the app shell so the page still opens with zero connection.
// Data reads/writes go through the existing online/offline fallback logic
// inside index.html once it's running.
//
// v2: switched from cache-first to network-first for the app shell.
// Cache-first was serving an old cached copy of index.html on every load
// and only refreshing the cache in the background for *next* time — so a
// fixed/updated version of the app could take two reloads to actually show
// up. Network-first always tries the live file first and only falls back
// to the cache when there's no connection.
const CACHE_NAME = 'ahnji-training-log-v2';
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
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
