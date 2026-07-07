const CACHE_NAME = "engram-shell-v1";
const APP_SHELL = ["/", "/dashboard", "/cards", "/cards/session", "/manifest.webmanifest", "/icons/icon.svg"];
const CACHEABLE_DESTINATIONS = new Set(["document", "script", "style", "image", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!shouldHandle(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (shouldCache(event.request, response)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || navigationFallback(event.request))),
  );
});

function shouldHandle(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return request.mode === "navigate" || CACHEABLE_DESTINATIONS.has(request.destination);
}

function shouldCache(request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return false;
  return request.mode === "navigate" || CACHEABLE_DESTINATIONS.has(request.destination);
}

function navigationFallback(request) {
  return request.mode === "navigate" ? caches.match("/") : undefined;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      const targetUrl = new URL(event.notification.data?.url || "/cards", self.location.origin).href;
      const existing = clients.find((client) => client.url === targetUrl);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
