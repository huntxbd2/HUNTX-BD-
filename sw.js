/* HuntX BD — service worker (GitHub Pages / subdirectory safe) */
const CACHE = 'huntx-shell-v31';
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
  const h = url.hostname;

  // Live data / auth — always network, never cached
  if (
    h.includes('firestore') || h.includes('firebaseio') || h.includes('identitytoolkit') ||
    h.includes('securetoken') || h.includes('firebaseinstallations') || h.includes('firebasestorage') ||
    (h.includes('googleapis') && !h.startsWith('fonts.'))
  ) {
    return;
  }

  // Stale-while-revalidate: show instantly from cache, refresh in background.
  // Great on slow networks; updates appear on the next open.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || net;
      })
    )
  );
});

/* ---- Push (add-on) ---- */
// Firebase Cloud Messaging: shows notifications even when the app is closed.
let HAS_FCM = false;
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyCmBNCZ7T3VUkerNH7xwuhJxNWRIOxQAy0',
    projectId: 'huntx-bd-app',
    messagingSenderId: '684817560300',
    appId: '1:684817560300:web:ec6c4e6debf8a49d782bc9'
  });
  firebase.messaging(); // registers its own push handler (auto-displays "notification" payloads)
  HAS_FCM = true;
} catch (e) {}

// Fallback only if FCM could not load
if (!HAS_FCM) {
  self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
    const n = data.notification || data;
    event.waitUntil(self.registration.showNotification(n.title || 'HuntX BD', { body: n.body || '', icon: './logo.png', badge: './logo.png' }));
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
