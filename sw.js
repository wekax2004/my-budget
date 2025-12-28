const CACHE_NAME = 'budget-master-v13';
const ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icon.png"
];

self.addEventListener("install", (e) => {
    self.skipWaiting(); // Force new SW to take over immediately
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(), //  Take control of open clients immediately
            caches.keys().then((keys) => Promise.all(
                keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
            ))
        ])
    );
});

self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
