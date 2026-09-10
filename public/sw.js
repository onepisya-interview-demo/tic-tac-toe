// Minimal service worker for PWA installability criteria (manifest + SW
// + >=144px icon over HTTPS triggers Chrome / Edge / Android Chrome
// "Install" prompt). Network-first pass-through with zero caching —
// the game has no offline data requirement, so any caching here would
// be premature optimization. If we later add a true offline surface
// (e.g., game replay playback) we'll reach for Workbox or
// serwist and gate cache keys per route.
//
// Lifecycle:
//   install   → skipWaiting so a fresh SW can activate immediately.
//   activate  → clients.claim() so the new SW takes control of all
//               open tabs without requiring a refresh.
//   fetch     → pass through to network. No cache lookup, no offline
//               fallback (PWA install does not require offline support;
//               installability criteria only need a fetch handler).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
