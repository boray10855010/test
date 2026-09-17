const CACHE = "action-piggy-v3";
const PRECACHE = ["./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isOpaqueOrFail(res) {
  return !res || res.status === 0 || !res.ok;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && request.method === "GET") {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  // Always prefer network for app shell, companions, and versioned assets
  const networkPreferred =
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.endsWith("/app.js") ||
    path.endsWith("/styles.css") ||
    path.endsWith("/sw.js") ||
    path.includes("/companions/") ||
    path.includes("/outputs/");

  if (networkPreferred) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetching = fetch(req).then((fresh) => {
        if (fresh && fresh.ok) caches.open(CACHE).then((c) => c.put(req, fresh.clone()));
        return fresh;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
