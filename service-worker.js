```javascript
   const CACHE_NAME = 'jpnote-cache-v9';

   // 核心檔案
   const coreUrls = [
       './',
       './index.html',
       './manifest.json'
   ];

   // 【安裝階段】
   self.addEventListener('install', event => {
       self.skipWaiting();
       event.waitUntil(
           caches.open(CACHE_NAME).then(cache => {
               console.log('✅ 核心檔案快取中 (v3)...');
               return cache.addAll(coreUrls);
           })
       );
   });

   // 【啟動階段】清除舊快取
   self.addEventListener('activate', event => {
       event.waitUntil(self.clients.claim());
       event.waitUntil(
           caches.keys().then(cacheNames => {
               return Promise.all(
                   cacheNames.map(cacheName => {
                       if (cacheName !== CACHE_NAME) {
                           return caches.delete(cacheName);
                       }
                   })
               );
           })
       );
   });

   // 【攔截請求階段】
   self.addEventListener('fetch', event => {
       const url = event.request.url;

       if (url.includes('firestore.googleapis.com') || url.includes('api/translate')) {
           return;
       }

       if (event.request.method !== 'GET') return;

       if (event.request.mode === 'navigate') {
           event.respondWith(
               fetch(event.request).catch(() => {
                   return caches.match('./index.html').then(response => {
                       return response || caches.match('./');
                   });
               })
           );
           return;
       }

       event.respondWith(
           caches.match(event.request).then(cachedResponse => {
               if (cachedResponse) {
                   return cachedResponse;
               }
               return fetch(event.request).then(networkResponse => {
                   if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
                       return networkResponse;
                   }
                   const responseToCache = networkResponse.clone();
                   caches.open(CACHE_NAME).then(cache => {
                       cache.put(event.request, responseToCache);
                   });
                   return networkResponse;
               }).catch(() => {
               });
           })
       );
   });
