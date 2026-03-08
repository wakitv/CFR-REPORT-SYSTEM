const CACHE = 'wackybuds-cfr-v5.9.0';
const FILES = ['./', './index.html', './styles.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  
  // Don't cache API calls
  if (url.hostname.includes('script.google.com')) return;
  
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) return cached;
        
        return fetch(e.request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then(cache => cache.put(e.request, clone));
            }
            return response;
          })
          .catch(() => caches.match('./index.html'));
      })
  );
});
