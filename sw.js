const CACHE_NAME = 'wackybuds-cfr-v3.4';
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

// Install - cache all assets
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
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Fetch - cache first for assets, network for API
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    
    const url = new URL(e.request.url);
    
    // API calls - network only, don't cache
    if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
        e.respondWith(
            fetch(e.request).catch(() => new Response('{"success":false,"offline":true}', { 
                headers: { 'Content-Type': 'application/json' } 
            }))
        );
        return;
    }
    
    // Google Fonts - cache first
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return res;
                }).catch(() => cached);
            })
        );
        return;
    }
    
    // App assets - cache first, then network
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

// Background sync for pending entries
self.addEventListener('sync', e => {
    if (e.tag === 'sync-entries') {
        e.waitUntil(syncPendingEntries());
    }
});

async function syncPendingEntries() {
    // This will be handled by the main app when it comes online
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: 'SYNC_PENDING' }));
}
