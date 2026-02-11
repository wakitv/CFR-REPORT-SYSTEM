const CACHE_NAME = 'wackybuds-cfr-v3.7.6';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(['./', './index.html']);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET') return;
    if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) return;
    
    if (e.request.mode === 'navigate') {
        e.respondWith(
            caches.match('./index.html').then(cached => {
                if (cached) return cached;
                return fetch('./index.html').then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
                    return res;
                });
            }).catch(() => caches.match('./index.html'))
        );
        return;
    }
    
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return res;
            });
        }).catch(() => caches.match('./index.html'))
    );
});
