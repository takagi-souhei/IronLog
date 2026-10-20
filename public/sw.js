const CACHE_NAME = "ironlog-pwa-v3";
const APP_SHELL = ["/", "/history", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([
          ...APP_SHELL,
          "/manifest.json",
          "/icon.svg",
          "/icon-192.png",
          "/icon-512.png",
          "/icon-maskable-512.png",
          "/apple-touch-icon.png",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("ironlog-pwa-") && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  if (
    request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    request.headers.has("RSC")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match(request)) ??
          (await cache.match(requestUrl.pathname)) ??
          (await cache.match("/")) ??
          Response.error()
        );
      }
    })());
    return;
  }

  if (
    requestUrl.pathname.startsWith("/_next/static/") ||
    requestUrl.pathname === "/manifest.json" ||
    requestUrl.pathname.startsWith("/icon-") ||
    requestUrl.pathname === "/icon.svg" ||
    requestUrl.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
