/* =========================================================
   Service Worker – Study Portal PWA
   Caches the app shell for offline access with network-first
   for instantaneous updates on deployment.
   ========================================================= */

const CACHE_NAME = "studyportal-v3";
const APP_SHELL = ["/", "/index.html", "/style.css?v=3", "/app.js?v=3", "/manifest.json"];

// Install – cache app shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate – clean all old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch – network-first for pages and app logic, cache fallback
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

  // Network-first strategy for app shell assets so new releases apply immediately
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
});
