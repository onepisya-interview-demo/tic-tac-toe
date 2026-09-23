import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { NavPrevTracker } from "@/components/NavPrevTracker";
import "./globals.css";

// Both fonts opt out of next/font's `preload` (D-1). Both sporadic
// "preloaded using link preload but not used" warning sources —
// Chromium's 304-Not-Modified preload false positive (Bug 517439604,
// fixed ~Chrome 141) and stale Vercel Early Hints entries across
// deploys — root in the preload entry's existence itself, so the entry
// is removed here rather than worked around. Latin glyphs still render
// via font-display: swap + the auto-generated size-adjusted Geist
// Fallback (no CLS regression); geistMono led the way in 95c57e1.
// Plan: .omo/plans/ulw-font-preload-residual-20260922.md §2.4/§三.
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

// Next.js 16 `viewport` field must be a literal CSS color value at the type
// level — Server Component module scope has no access to CSS custom
// properties. This literal mirrors `app/globals.css` `--color-bg-base`
// (`#0A0A0A`). When the design token changes, update both this literal
// and `app/globals.css`.
const THEME_COLOR = "#0A0A0A" as const;

// Four social-card variants under /public/ are inlined into the
// openGraph.images array below (and mirrored at the canonical
// https://3t.onepis.net/ domain). X / Slack pick the first one as the
// large-image preview and let users cycle the rest in the in-app
// carousel. The fourth is a 1:1 brand mark used as a fallback for
// small-icon / IM-avatar / favicon-needs contexts that don't render
// the 1280×640 large-image card. The literals are inlined (not
// generated via map) so the contract is auditable in the source text
// and the layout.test.ts regex contract holds.
// Sources: docs/social-card-{home,play,result,brandmark}.png.

export const metadata: Metadata = {
  metadataBase: new URL("https://3t-tic-tac-toe.vercel.app/"),
  title: "井字棋 · 同设备 pass-and-play",
  description: "两人同设备轮流下的井字棋，自动记录战绩。",
  // PWA install metadata — Next.js auto-injects the <link rel="manifest">
  // from `manifest` and the apple-mobile-web-app-* <meta> tags from
  // `appleWebApp`. Plan: .omo/plans/pwa-install-experience.md.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "井字棋", statusBarStyle: "black" },
  // Open Graph + Twitter card — share previews for X / IM / Slack.
  // Source assets: public/social-card-{home,play,result}.png (mirror of
  // docs/social-card-{home,play,result}.png; the single docs/social-card.png
  // stays in place as the GitHub Social Preview upload target).
  // Plans: .omo/plans/ulw-seo-meta-20260914.md (base) +
  //         .omo/plans/ulw-meta-extras-20260914.md (A locale + B raw meta + C variants).
  openGraph: {
    type: "website",
    siteName: "井字棋",
    // Canonical: explicit absolute so crawlers see the public onepis.net
    // domain (metadataBase stays at the vercel.app host so Vercel edge
    // follows the cname automatically). All three routes share this
    // canonical — the share-card is intentionally a single product URL.
    url: "https://3t.onepis.net/",
    title: "井字棋 · 同设备 pass-and-play",
    description: "两人同设备轮流下的井字棋，自动记录战绩。",
    // Locale tag — content language is Chinese so og:locale=zh_CN tags
    // the share card correctly for crawler-side filtering.
    locale: "zh_CN",
    images: [
      {
        url: "/social-card-home.png",
        secureUrl: "https://3t.onepis.net/social-card-home.png",
        width: 1280,
        height: 640,
        type: "image/png",
        alt: "井字棋 · 战绩仪表板",
      },
      {
        url: "/social-card-play.png",
        secureUrl: "https://3t.onepis.net/social-card-play.png",
        width: 1280,
        height: 640,
        type: "image/png",
        alt: "井字棋 · 棋局对战中",
      },
      {
        url: "/social-card-result.png",
        secureUrl: "https://3t.onepis.net/social-card-result.png",
        width: 1280,
        height: 640,
        type: "image/png",
        alt: "井字棋 · 胜局彩纸",
      },
      // 1:1 brand mark — fallback for small-icon / IM-avatar / favicon
      // contexts that don't render the 1280×640 large-image preview.
      // X still uses card="summary_large_image" with the first 1280×640
      // entry; the brand mark is the carousel's last pick and the only
      // share artifact that renders cleanly as an avatar.
      // Plan: .omo/plans/ulw-meta-brand-mark-20260914.md
      {
        url: "/social-card-brandmark.png",
        secureUrl: "https://3t.onepis.net/social-card-brandmark.png",
        width: 512,
        height: 512,
        type: "image/png",
        alt: "井字棋 · brand mark",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "井字棋 · 同设备 pass-and-play",
    description: "两人同设备轮流下的井字棋，自动记录战绩。",
    images: [
      "/social-card-home.png",
      "/social-card-play.png",
      "/social-card-result.png",
      "/social-card-brandmark.png",
    ],
    creator: "@onepisya",
    site: "@onepisya",
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Plan: .omo/plans/ulw-meta-extras-20260914.md §B — raw
            twitter:label1/data1/label2/data2 metadata, injected via JSX
            because the Next.js 16 metadata API has no field for it.
            React 19 hoists <meta> elements into the document <head> at
            request time so X renders the dual-line strip below the card. */}
        <meta name="twitter:label1" content="Built with" />
        <meta name="twitter:data1" content="Next.js 16 · React 19" />
        <meta name="twitter:label2" content="Type" />
        <meta name="twitter:data2" content="Open source · MIT" />
      </head>
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary">
        <NavPrevTracker />
        {children}
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
