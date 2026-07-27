self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Nunca interceptar chamadas de API externas (Firestore, Auth, Google APIs etc).
  // O Firestore usa conexoes de streaming (WebChannel) para Listen/Write; se o
  // Service Worker reencaminhar essas requisicoes via fetch(), o streaming quebra
  // e as gravacoes falham silenciosamente (e' o que estava causando a perda de
  // protocolos). Deixando essas requisicoes passarem direto (sem respondWith),
  // o navegador lida com elas normalmente.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Requisicoes do proprio site continuam passando direto para a rede,
  // igual ao comportamento atual (sem cache).
  event.respondWith(fetch(event.request));
});
