const CACHE='wackybuds-cfr-v3.8.1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html'])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
    if(e.request.method!=='GET')return;
    const u=new URL(e.request.url);
    if(u.hostname.includes('script.google.com')||u.hostname.includes('googleapis.com'))return;
    if(e.request.mode==='navigate'){e.respondWith(caches.match('./index.html').then(c=>c||fetch('./index.html')).catch(()=>caches.match('./index.html')));return;}
    e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(r.ok){const cl=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,cl));}return r;})).catch(()=>caches.match('./index.html')));
});
