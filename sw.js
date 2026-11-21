/**
 * NULAR — Service Worker (sw.js)
 * Caches application shell, core data, and provides graceful offline fallback.
 * Adheres strictly to security rules: never caches /api/ endpoints or sensitive credentials.
 */

const CACHE_VERSION = 'nular-shell-v1.1';
const CORE_SHELL = [
  './',
  './index.html',
  './explore.html',
  './map.html',
  './anatomy.html',
  './profile.html',
  './portal.html',
  './offline.html',
  './manifest.webmanifest',
  './css/museum.css',
  './css/tokens.css',
  './css/components.css',
  './css/animations.css',
  './css/design-system.css',
  './css/landing.css',
  './js/museum-data.js',
  './js/museum-store.js',
  './js/museum-shell.js',
  './assets/images/logo.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './data/provinces.json',
  './data/houses.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CORE_SHELL).catch((err) => {
        console.warn('[SW] Pre-caching partial failure, proceeding:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Never cache API calls, auth routes, or non-GET requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. HTML navigation requests: Network-First, fallback to Cache, fallback to offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('./offline.html');
        })
    );
    return;
  }

  // 3. Static assets (CSS, JS, Fonts, Images, JSON): Cache-first with Network update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate for local origin)
        if (url.origin === self.location.origin) {
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
