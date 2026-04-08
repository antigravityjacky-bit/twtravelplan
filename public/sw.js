// Minimal service worker — enables PWA installability and Web Share Target
// No caching: always fetch fresh from network
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
