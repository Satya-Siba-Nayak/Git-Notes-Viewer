/* =========================================================
   Service Worker – Study Portal PWA
   Caches the app shell for offline access.
   ========================================================= */

const CACHE_NAME = "studyportal-v1";
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

// Fetch – network-first for API calls, cache-first for app shell
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // GitHub API: always network, never cache in SW (app uses sessionStorage)
  if (url.hostname === "api.github.com") {
    return;
  }

  // App shell & static assets: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        // Return cache, refresh in background
        fetch(e.request)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(e.request);
    })
  );
});
