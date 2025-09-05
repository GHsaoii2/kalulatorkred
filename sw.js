const APP_VERSION = 'v3.5.2'; // pamiętaj, żeby zawsze podbić wersję przy deployu

const CACHE = 'raport-cache-' + APP_VERSION;
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install
self.addEventListener('install', (event) => {
  console.log('[SW] install', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        console.log('[SW] caching assets', ASSETS);
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] skipWaiting');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] install error', err);
        throw err;
      })
  );
});

// Activate
self.addEventListener('activate', (event) => {
  console.log('[SW] activate', APP_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => {
        console.log('[SW] existing caches', keys);
        return Promise.all(
          keys.filter(k => k !== CACHE).map(k => {
            console.log('[SW] deleting old cache', k);
            return caches.delete(k);
          })
        );
      })
      .then(() => {
        console.log('[SW] clients.claim()');
        return self.clients.claim();
      })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // nie obsługujemy POST/PUT
  const url = new URL(event.request.url);
  const isAsset = ASSETS.some(a => url.pathname.endsWith(a.replace('./','/')));

  console.log('[SW] fetch', url.href, 'asset?', isAsset);

  if (isAsset) {
    // cache-first dla assetów
    event.respondWith(
      caches.match(event.request).then(r => {
        if (r) {
          console.log('[SW] serving from cache', url.href);
          return r;
        }
        console.log('[SW] fetching asset from network', url.href);
        return fetch(event.request);
      })
    );
  } else {
    // network-first dla API i reszty
    event.respondWith(
      fetch(event.request)
        .then(res => {
          console.log('[SW] network fetch success', url.href);
          return res;
        })
        .catch(err => {
          console.warn('[SW] network fetch failed, fallback to cache', url.href, err);
          return caches.match(event.request);
        })
    );
  }
});

// Message
self.addEventListener('message', (event) => {
  console.log('[SW] message', event.data);
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting requested');
    self.skipWaiting();
  }
});
