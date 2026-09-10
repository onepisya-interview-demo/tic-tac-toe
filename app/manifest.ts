import type { MetadataRoute } from "next";

// PWA install manifest surfaced at /manifest.webmanifest via Next.js 16's
// typed manifest route handler (see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/01-metadata/manifest.md).
//
// Source of truth for these strings:
//   - name/short_name/description mirror app/layout.tsx metadata so the
//     installed app name matches what users see in the browser tab.
//   - theme_color/background_color use #0A0A0A — the same literal that
//     app/layout.tsx defines as THEME_COLOR and that app/globals.css
//     mirrors as `--color-bg-base`. This is the browser chrome / status
//     bar surface, NOT the icon background (the icon canvas uses #0b0f17
//     from app/apple-icon.tsx ICON_COLORS.background).
//   - icons covers every PNG/SVG the project actually serves. Each entry
//     uses the URL Next.js serves at, not the on-disk path — favicon.ico
//     and icon.svg live under app/ as file conventions, the rest live
//     under public/ as static assets.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "井字棋 · 同设备 pass-and-play",
    short_name: "井字棋",
    description: "两人同设备轮流下的井字棋，自动记录战绩。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0A0A0A",
    background_color: "#0A0A0A",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
