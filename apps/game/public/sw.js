/* Floodlight Football service worker.
 * Navigation (the app shell) is network-first so new deploys reach players
 * on the next visit; hashed assets are immutable and stay cache-first.
 * Match traffic is unaffected (local-first sim, P2P netcode). */
const VERSION = 'floodlight-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // App shell: fresh deploy wins, cached copy is the offline fallback.
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      }).catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html'))),
    );
    return;
  }
  e.respondWith(
    caches.match(request).then(
      (hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      }),
    ),
  );
});
