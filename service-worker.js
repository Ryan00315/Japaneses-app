const CACHE_NAME = 'jpnote-cache-v24'; // 升級為 v24

// 📂 1. 只放本地絕對不會報錯的檔案，確保安裝 100% 成功！
const coreUrls = [
    './',
    './index.html',
    './manifest.json',
    './21.png',
    './exampleData.js'
];

// 【安裝階段】
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('✅ 核心檔案快取中 (v24)...');
            // 因為只存本地檔案，這裡絕對不會再報錯中斷了
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
                        console.log('🗑️ 清除舊快取:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 【攔截請求階段】 (動態快取 CDN 資源)
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 🛑 排除資料庫與 API 連線，絕對不快取這些
    if (url.includes('firestore.googleapis.com') || url.includes('api/translate')) {
        return;
    }

    if (event.request.method !== 'GET') return;

    // 📄 HTML 頁面導航請求 (離線時導向 index.html)
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

    // 📦 其他資源 (包含 Tailwind CDN, Firebase 模組, FontAwesome 圖示等)
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 1. 如果快取有，馬上回傳 (離線時就會走這裡)
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // 2. 如果快取沒有，去網路抓，並偷偷存進快取裡備用
            return fetch(event.request).then(networkResponse => {
                // 確認取得正常的 response 才存入快取 (opaque 是給跨域 CDN 資源的)
                if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // 網路斷線且快取沒有時的防呆處理
            });
        })
    );
});
