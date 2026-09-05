// Bump CACHE_VERSION on every deploy. Anything cached under an old
// version name gets deleted automatically on activate, and every open
// client (including a phone's home-screen shortcut) is claimed by the
// new worker right away instead of waiting for every tab/shortcut to be
// fully closed first — that combination is what previously let a
// shortcut keep serving a frozen, months-old copy of index.html even
// while the phone had a perfectly good connection.
const CACHE_VERSION = 'ahnji-shell-v2';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Page navigations (loading index.html itself): NETWORK-FIRST.
  // Always try to fetch the live, current file first. Only fall back to
  // the cached shell if the network request genuinely fails (i.e. you're
  // actually offline). This is the key change — it means "online" always
  // means "you see the latest version," and the cache only exists as a
  // safety net for real offline use, not as a default.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Other static assets (fonts, etc.): cache-first is fine, they rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
