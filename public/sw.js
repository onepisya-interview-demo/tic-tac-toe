// Minimal service worker for PWA installability criteria (manifest + SW
// + >=144px icon over HTTPS triggers Chrome / Edge / Android Chrome
// "Install" prompt). Layer-2 of the P3 dual-layer fix (commit 2): after
// the 5-minute Cache-Control header set in next.config.ts (commit 1)
// keeps the browser from revalidating, the SW returns a 0 ms cache hit
// for the static assets listed below — the same files the browser
// itself was re-fetching 56-94 times per PWA session in the HAR.
//
// Why /_next/static/** is NOT in CACHEABLE_RE: Vercel's edge immutable-
// caches every /_next/static/** response with max-age=31536000, which is
// already a 0 ms cache hit from the browser's HTTP cache. Routing those
// requests through the SW adds zero benefit, so /_next/static/** flows
// untouched through the SW to the edge cache / browser HTTP cache.
//
// Font preload history (D-1): the SW used to be blamed for stranding the
// next/font preload entry (SW hijacking the @font-face request →
// "preloaded using link preload but not used"). Fix fa76a39 returned
// /_next/static/** to the network, and the residual sporadic warnings
// (Chromium's 304-Not-Modified preload false positive, Bug 517439604 +
// stale Vercel Early Hints across deploys) were rooted out entirely by
// removing the font preload itself at the layout layer — Geist and
// Geist_Mono now use `preload: false` in app/layout.tsx. Fonts load
// through the normal CSS @font-face path with font-display: swap and
// the auto-generated size-adjusted fallback; no preload entry exists
// for the SW to interact with anymore.
// Plan: .omo/plans/ulw-font-preload-residual-20260922.md §2.4/§三.
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
//               HMR, etc.) also bypass the SW entirely — see FetchEvent
//               pass-through notes below. Caching the RSC payload would
//               reintroduce B-3 (RSC stale data).
//
// FetchEvent pass-through:
//   The previous implementation wrapped every non-cacheable GET in
//   `event.respondWith(fetch(event.request))`. On a network error the
//   returned promise rejected inside the SW global scope where no
//   caller could attach a .catch() — Chromium surfaced this as
//   "Uncaught (in promise) TypeError: Failed to fetch" /
//   "FetchEvent resulted in a network error response". We now drop the
//   respondWith wrapper entirely: the browser handles the request via
//   its default network path, no SW promise is created, no unhandled
//   rejection can fire. The cache-miss branch wraps its network fetch
//   in try/catch and returns Response.error() so the same hard-error
//   semantics still hold for the assets we DO intercept.
//
// If we later add a true offline surface (e.g., game replay playback)
// we'll reach for Workbox or Serwist and gate cache keys per route —
// the cache size and invalidation strategy of Workbox will pay off
// once the asset count or route policy outgrows this hand-rolled
// pattern.
const CACHE_NAME = "tic-tac-toe-v1";
const CACHEABLE_RE = /(\/manifest\.webmanifest|\/icon\.svg|\/icon-|\/apple-icon|\/apple-touch-icon|\/favicon\.ico|\/favicon-)/;

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

  // Non-cacheable URLs (RSC, /api/stats, HMR, /_next/static/**, anything
  // else) bypass the SW entirely. Caching the RSC payload would
  // reintroduce B-3 (RSC stale data — commit fd4a66f doc); caching
  // /api/stats would block live stats writes from ever reaching the DB;
  // /_next/static/** is already edge-immutable-cached (see file header —
  // and since D-1 there is no next/font preload entry at all). Letting
  // the browser handle the request via its
  // default network path also removes the SW-scope promise that was
  // generating "Uncaught (in promise) TypeError: Failed to fetch" noise
  // when the network failed mid-flight.
  const url = event.request.url;
  if (!CACHEABLE_RE.test(url)) return;

  // Cache-first for the allow-listed static assets. Hit returns 0 ms
  // from the SW; miss fetches and writes back to the cache before
  // returning. If the network fails on a miss the catch returns
  // Response.error() so callers receive the same network-error shape
  // they would have seen without the SW. We do not silently swallow
  // the failure with a stale cached body — that would mask real
  // outages for assets the SW is willing to serve.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })()
  );
});
