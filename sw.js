const CACHE_NAME = 'vhhub-v3';
const ASSETS = [
  './',
  'index.php',
  'player.php',
  'assets/style.css',
  'assets/app.js',
  'assets/loader.js',
  'assets/favicon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // NEVER cache API or Stream calls in Service Worker
  if (url.pathname.includes('api.php') || e.request.url.includes('action=')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((fetchRes) => {
        if (e.request.method === 'GET' && fetchRes.status === 200) {
            const clone = fetchRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return fetchRes;
      });
    }).catch(() => fetch(e.request)) // Fallback to network on any error
  );
});
