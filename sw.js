/* =========================================================
   Service Worker – Study Portal PWA (v7)
   Two-Tier Caching: App Shell + Offline Repository Data Cache
   ========================================================= */

const SHELL_CACHE = "studyportal-shell-v7";
const DATA_CACHE = "studyportal-data-v7";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css?v=7",
  "/app.js?v=7",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

const GIT_DATA_HOSTS = [
  "api.github.com",
  "raw.githubusercontent.com",
  "gitlab.com",
  "codeberg.org",
  "gitea.com",
  "api.bitbucket.org",
  "bitbucket.org"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // 1. External Git API trees & raw study files: Network-First -> Offline Data Cache Fallback
  const isGitData = GIT_DATA_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h));
  if (isGitData) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Cache valid responses under 5 MB for offline study access
          const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
          if (res && res.status === 200 && contentLength < 5 * 1024 * 1024) {
            const clone = res.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(e.request);
          if (cached) return cached;
          throw new Error("Offline and not in cache");
        })
    );
    return;
  }

  // 2. App Shell (Same Origin): Network-First -> Cache Fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request) || caches.match("/index.html"))
    );
  }
});
