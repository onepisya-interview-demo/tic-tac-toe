import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  // Source asset: public/social-card.png (mirror of docs/social-card.png;
  // GitHub Social Preview uses the docs/ copy via repository-images host).
  // Plan: .omo/plans/ulw-seo-meta-20260914.md.
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
    images: [
      {
        url: "/social-card.png",
        width: 1280,
        height: 640,
        alt: "井字棋 · tic-tac-toe 分享卡（暗底三帧拼版）",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "井字棋 · 同设备 pass-and-play",
    description: "两人同设备轮流下的井字棋，自动记录战绩。",
    images: ["/social-card.png"],
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
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary">
        {children}
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
