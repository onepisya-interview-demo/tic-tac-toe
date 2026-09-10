import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      </body>
    </html>
  );
}
