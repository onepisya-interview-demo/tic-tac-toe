import type { NextConfig } from "next";

// P3 dual-layer fix (commit 1): the Vercel CDN already immutable-caches
// /_next/static/** with max-age=31536000, but app-router generated
// /manifest.webmanifest, /icon.svg, /apple-icon*, /favicon*, and the
// public/ icon PNGs ship with the Next default of
// "Cache-Control: public, max-age=0, must-revalidate". HAR direct read
// shows the browser therefore revalidates every navigation (56-94
// manifest requests per PWA session). This header layer keeps the
// browser from round-tripping for 5 minutes; SW cache-first (commit 2)
// is the second layer that returns 0 ms on cache hit. _next/static/**
// is intentionally NOT listed — Vercel already sets immutable headers
// and adding a second header rule would race the source of truth.
const STATIC_ASSET_CACHE = "public, max-age=300";
const STATIC_ASSET_PATHS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-:size.png",
  "/apple-icon",
  "/apple-icon-:size.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon-:size.png",
];

const nextConfig: NextConfig = {
  headers() {
    return STATIC_ASSET_PATHS.map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE }],
    }));
  },
};

export default nextConfig;
