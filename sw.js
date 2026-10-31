/* =========================================
   Service Worker：オフライン対応（電波の弱いゲレンデでもマップを開けるようにする）
   ファイルを大きく変えたときは CACHE_VERSION を上げると、古いキャッシュが削除される
   ========================================= */
const CACHE_VERSION = 'v2';
const CACHE_NAME = `kokusai-map-${CACHE_VERSION}`;

// 最初にまとめてキャッシュしておくファイル
const PRECACHE_URLS = [
    './map.html',
    './stylesheet.css',
    './script.js',
    './manifest.webmanifest',
    './images/Sapporo_KOKUSAI_Ski_Area_Map_ver3.svg',
    './images/Kokusai_1.jpg',
    './images/icons/icon-192.png',
    './images/icons/favicon-32.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key.startsWith('kokusai-map-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// キャッシュがあればすぐ返し、裏でネットワークから最新版を取ってキャッシュを更新する
// （更新は次に開いたときに反映される）
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isGoogleFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (!isSameOrigin && !isGoogleFonts) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: isSameOrigin });

        const network = fetch(request)
            .then(response => {
                if (response.ok || response.type === 'opaque') {
                    cache.put(request, response.clone());
                }
                return response;
            })
            .catch(() => undefined);

        if (cached) {
            event.waitUntil(network);
            return cached;
        }
        return (await network) || Response.error();
    })());
});
