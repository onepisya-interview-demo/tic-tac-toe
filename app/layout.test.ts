// app/layout.metadata.test.ts
//
// RED-first guard for the Next.js 16 metadata contract that drives share
// previews (X/Twitter card, Open Graph, Slack/IM unfurls).
//
// Why text-source instead of importing `./layout` and asserting on the
// metadata object: `app/layout.tsx` invokes `Geist({...})` at module scope,
// which triggers `next/font/google` font fetching. In a jsdom vitest env
// without a build step that path is unreliable, and the contract we care
// about is the source-level shape anyway — Next.js renders these into the
// <head> at request time.
//
// Plan: .omo/plans/ulw-seo-meta-20260914.md §RED-first.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LAYOUT_SRC = readFileSync(
  resolve(process.cwd(), "app/layout.tsx"),
  "utf8",
);

describe("app/layout metadata — share preview contract", () => {
  it("declares openGraph with a 1280x640 social-card image", () => {
    expect(LAYOUT_SRC).toMatch(/openGraph\s*:/);
    expect(LAYOUT_SRC).toMatch(/siteName\s*:\s*"井字棋"/);
    // Image source must be the public/ copy served at /social-card.png
    expect(LAYOUT_SRC).toMatch(/url\s*:\s*"\/social-card\.png"/);
    expect(LAYOUT_SRC).toMatch(/width\s*:\s*1280/);
    expect(LAYOUT_SRC).toMatch(/height\s*:\s*640/);
  });

  it("declares twitter card=summary_large_image with the social-card image", () => {
    expect(LAYOUT_SRC).toMatch(/twitter\s*:/);
    expect(LAYOUT_SRC).toMatch(/card\s*:\s*"summary_large_image"/);
    expect(LAYOUT_SRC).toMatch(/images\s*:\s*\[\s*"\/social-card\.png"\s*\]/);
  });

  it("keeps metadataBase pointing at the Vercel canonical host", () => {
    // metadataBase stays at the vercel.app host so Vercel edge follows
    // the onepis.net cname automatically without altering SEO.
    expect(LAYOUT_SRC).toMatch(
      /metadataBase\s*:\s*new URL\("https:\/\/3t-tic-tac-toe\.vercel\.app\/"\)/,
    );
  });
});