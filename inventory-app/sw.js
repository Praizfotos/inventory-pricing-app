const CACHE = "stockflow-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/firebase.js",
  "/js/auth.js",
  "/js/cart.js",
  "/js/app.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  // Network-first for Firestore (always needs live data)
  if (e.request.url.includes("firestore.googleapis.com")) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
