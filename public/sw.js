const CACHE_NAME = 'telugu-bible-interlinear-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css'
];

// Install Event: Pre-cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-cache warning (some assets may build dynamically):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate or Cache-First for assets and data
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // We only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Caching strategy: Stale-While-Revalidate for Bible JSONs and Concordance data
  if (requestUrl.pathname.includes('/bibles/') || requestUrl.href.includes('strongs.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // Offline fallback
            return cachedResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Cache-First with Network-Fallback for static assets (React bundle JS/CSS files)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Only cache successful requests
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.error('Fetch failed for asset:', event.request.url, err);
      });
    })
  );
});
