const CACHE_NAME = 'budget-master-v3.2-vite';
const STATIC_ASSETS = [
    "./index.html",
    "./manifest.json",
    "./icon.png"
];

// Install Event: Cache Core Assets
self.addEventListener("install", (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// Activate Event: Clean Old Caches
self.addEventListener("activate", (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) => Promise.all(
                keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
            ))
        ])
    );
});

// Fetch Event: Network First for API, Cache First for Assets, Stale-While-Revalidate for HTML
self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);

    // 1. External CDNs & Static Assets -> Cache First
    if (STATIC_ASSETS.includes(url.href) || STATIC_ASSETS.includes(url.pathname)) {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request))
        );
        return;
    }

    // 2. Default -> Network First (Safe for index.html updates)
    // IMPORTANT: Only cache GET requests!
    if (e.request.method !== 'GET') {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        fetch(e.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
            return res;
        }).catch(() => {
            return caches.match(e.request);
        })
    );
});
