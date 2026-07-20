const CACHE_NAME = "i9treino-pwa-v4-20260720-sync7";

self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, {cache:"no-store"}).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
