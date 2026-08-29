// Service Worker for Gestione Lago PWA
const CACHE_NAME = 'gestione-lago-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_lago.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png'
];

// Install event - caching basic shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('PWA: Partial cache failure on install', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and http/https schemes
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Let Firestore & API requests bypass service worker cache
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('firebaseio.com') || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for same-origin static assets
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache if offline
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
