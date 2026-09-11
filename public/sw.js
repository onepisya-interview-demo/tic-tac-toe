// Minimal service worker for PWA installability criteria (manifest + SW
// + >=144px icon over HTTPS triggers Chrome / Edge / Android Chrome
// "Install" prompt). Layer-2 of the P3 dual-layer fix (commit 2): after
// the 5-minute Cache-Control header set in next.config.ts (commit 1)
// keeps the browser from revalidating, the SW returns a 0 ms cache hit
// for the static assets listed below — the same files the browser
// itself was re-fetching 56-94 times per PWA session in the HAR.
//
// Lifecycle:
//   install   → skipWaiting so a fresh SW can activate immediately.
//   activate  → claim open clients so the new SW takes control of all
//               tabs without requiring a refresh.
//   fetch     → GET cacheable URLs (see CACHEABLE_RE) are served from
//               the 'tic-tac-toe-v1' cache when present, and the
//               network response is written back to that cache.
//               Non-GET requests (PUT/POST/DELETE) bypass the SW
//               entirely to preserve the B-1 method-gate invariant
//               (commit 971bb41). Non-cacheable GETs (RSC, /api/stats,
//               HMR, etc.) still pass through to the network with no
//               caching — caching the RSC payload would reintroduce B-3
//               (RSC stale data).
//
// If we later add a true offline surface (e.g., game replay playback)
// we'll reach for Workbox or Serwist and gate cache keys per route —
// the cache size and invalidation strategy of Workbox will pay off
// once the asset count or route policy outgrows this hand-rolled
// pattern.
const CACHE_NAME = "tic-tac-toe-v1";
const CACHEABLE_RE = /(\/manifest\.webmanifest|\/icon\.svg|\/icon-|\/apple-icon|\/apple-touch-icon|\/favicon\.ico|\/favicon-|_next\/static\/)/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Method guard (B-1 invariant): only intercept GETs. Without this,
  // PUT/POST/DELETE flow through the SW and Chromium can observe two
  // outbound requests (one to the SW's own respondWith pass-through,
  // one to the network). In practice this double-fires the stats PUT
  // and makes the DB write look like two network entries per action.
  // Non-GET requests bypass the SW entirely and follow the browser's
  // default network path.
  if (event.request.method !== "GET") return;

  // Non-cacheable URLs (RSC, /api/stats, HMR, anything else) still pass
  // through to the network with zero caching. Caching the RSC payload
  // would reintroduce B-3 (RSC stale data — commit fd4a66f doc); caching
  // /api/stats would block live stats writes from ever reaching the DB.
  const url = event.request.url;
  if (!CACHEABLE_RE.test(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for the allow-listed static assets. Hit returns 0 ms
  // from the SW; miss fetches and writes back to the cache before
  // returning. If the network fails on a miss the user gets the
  // browser's default network error (no offline fallback — PWA
  // installability is satisfied without it).
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response && response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    })()
  );
});
