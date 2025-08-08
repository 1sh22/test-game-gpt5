/* Glide Service Worker: in-browser backend for fast, reliable loads */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `glide-cache-${CACHE_VERSION}`;
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/404.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => {
      if (k !== CACHE_NAME && k.startsWith('glide-cache-')) return caches.delete(k);
    }))).then(() => self.clients.claim())
  );
});

function isHTMLRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isStaticAsset(url) {
  return /(\.css|\.js|\.svg|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.ico|\.woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // HTML navigations: network-first with cache fallback
  if (isHTMLRequest(request)) {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/index.html')) || Response.error();
      })
    );
    return;
  }

  // Static assets: cache-first, revalidate in background
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
}); 