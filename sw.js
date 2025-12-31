const CACHE_NAME = 'budget-master-v31.9';
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icon.png",
    "https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600&display=swap",
    "https://cdn.jsdelivr.net/npm/chart.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
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
