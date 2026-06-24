// Service worker for Weather Now (PWA)
// Caches the app shell so it loads offline. Live weather data is always
// fetched from the network (it's never cached, so it stays current).

const CACHE = "weather-now-v5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - API calls (weather / geocoding) -> always go to the network (live data)
//  - everything else (app shell)     -> cache first, fall back to network
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isApi =
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("bigdatacloud.net") ||
    url.hostname.includes("ipwho.is");

  if (isApi) {
    event.respondWith(fetch(event.request).catch(() => Response.error()));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((res) => {
          // cache same-origin GET responses for next time
          if (event.request.method === "GET" && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
      );
    })
  );
});
