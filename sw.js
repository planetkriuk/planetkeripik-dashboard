
const CACHE_NAME = 'planet-keripik-v2';
// Gunakan path absolut '/' agar cocok dengan manifest.json
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa SW baru untuk segera aktif
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Ambil alih kontrol klien segera
  );
});

// Fetch Assets (Network First, Fallback to Cache if Offline OR 404)
self.addEventListener('fetch', (event) => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Jika response valid, return response
        // Jika response 404 (Not Found) dari server, kita coba cari di cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
            // Coba cek cache jika server mengembalikan error/404
            return caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || response;
            });
        }
        return response;
      })
      .catch(() => {
        // Jika offline (network error), ambil dari cache
        return caches.match(event.request);
      })
  );
});
