/* ΒιβλιοRoll — Service Worker (offline cache) */
const CACHE = "biblioroll-v17";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/page-flip.browser.js",
  "./vendor/mammoth.browser.min.js",
  "./vendor/xlsx.full.min.js",
  "./vendor/jszip.min.js",
  "./vendor/html2canvas.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App shell (page + manifest) = network-first, so updates appear as soon as the
// server is reachable, with cache fallback offline. Static assets (vendor/icons)
// = cache-first for speed. Cross-origin (radio streams, etc.) is never intercepted.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't intercept radio streams etc.
  if (req.headers.get("range")) return;            // let range requests pass through

  const shell = req.mode === "navigate" ||
                url.pathname === "/" ||
                url.pathname.endsWith("/index.html") ||
                url.pathname.endsWith(".webmanifest");

  if (shell) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => { try { c.put(req, copy); } catch (_) {} });
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => { try { c.put(req, copy); } catch (_) {} });
        return res;
      }))
    );
  }
});
