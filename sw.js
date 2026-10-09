/* =========================================================
   Service Worker – Study Portal PWA
   Caches the app shell for offline access.
   ========================================================= */

const CACHE_NAME = "studyportal-v2";
const APP_SHELL = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];

// Install – cache app shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch – network-first for API calls and HTML, cache-first for static assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // External Git APIs & raw content: always network
  if (
    url.hostname.includes("github.com") ||
    url.hostname.includes("githubusercontent.com") ||
    url.hostname.includes("gitlab.com") ||
    url.hostname.includes("codeberg.org") ||
    url.hostname.includes("bitbucket.org") ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  // HTML documents: network-first so new releases appear immediately
  if (e.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request) || caches.match("/"))
    );
    return;
  }

  // Other assets (CSS, JS, icons): stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res));
          }
          return res;
        })
        .catch(() => {});
      return cached || fetchPromise;
    })
  );
});
