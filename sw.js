const CACHE_NAME = 'wackybuds-cfr-v3.3';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-152.png',
    '/icons/icon-192.png',
    '/icons/icon-384.png',
    '/icons/icon-512.png'
];

// Install - cache assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => 
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch - network first for API, cache first for assets
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    
    // Skip non-GET requests
    if (e.request.method !== 'GET') return;
    
    // API calls - network only
    if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
        e.respondWith(fetch(e.request).catch(() => new Response('{"success":false}', { headers: { 'Content-Type': 'application/json' } })));
        return;
    }
    
    // Fonts - cache first
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return res;
                });
            })
        );
        return;
    }
    
    // App assets - stale while revalidate
    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetchPromise = fetch(e.request).then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            }).catch(() => cached);
            
            return cached || fetchPromise;
        })
    );
});
