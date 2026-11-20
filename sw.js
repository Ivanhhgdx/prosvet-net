const CACHE = "prosvet-shell-v3";
const base = self.registration.scope;
const assets = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./engine.js",
  "./radar.png",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
].map((p) => new URL(p, base).href);
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(
        assets.map(
          (url) => new Request(url, { cache: "reload", redirect: "error" }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((k) => k.startsWith("prosvet-shell-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";
  const entry = url.href;
  const shell =
    request.mode === "navigate" && (entry === base || entry === assets[0]);
  if (!shell && !assets.includes(entry)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(shell ? assets[0] : entry)) || fetch(request);
    })(),
  );
});
