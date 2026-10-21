/* HuntX BD — service worker (GitHub Pages / subdirectory safe) */
const CACHE = 'huntx-shell-v18';
// Relative paths — resolve from SW location (works on /huntxbd/ and root)
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './logo.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Firebase / Google APIs — always network
  if (
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cloudflare')
  ) {
    return;
  }

  // app.js + styles.css + index.html — NETWORK FIRST so updates show immediately
  if (
    url.pathname.endsWith('app.js') ||
    url.pathname.endsWith('styles.css') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/huntxbd/') ||
    url.pathname.endsWith('/huntxbd')
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Other shell assets — cache first, then network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
