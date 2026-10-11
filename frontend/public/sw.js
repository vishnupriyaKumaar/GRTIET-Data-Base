// Minimal service worker so the app can be installed on Android / Pixel / desktop.
// It never caches anything - student data is always read live from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
