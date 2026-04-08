// Minimal service worker — enables PWA installability and Web Share Target.
// The fetch handler (passthrough) is required for iOS to register the share target.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
