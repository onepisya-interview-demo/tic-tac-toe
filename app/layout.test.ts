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
// Plans: .omo/plans/ulw-seo-meta-20260914.md (base) +
//        .omo/plans/ulw-meta-extras-20260914.md (A locale + B raw meta + C variants).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LAYOUT_SRC = readFileSync(
  resolve(process.cwd(), "app/layout.tsx"),
  "utf8",
);

describe("app/layout metadata — share preview contract", () => {
  it("declares openGraph with a 1280x640 social-card image and canonical URL", () => {
    expect(LAYOUT_SRC).toMatch(/openGraph\s*:/);
    expect(LAYOUT_SRC).toMatch(/siteName\s*:\s*"井字棋"/);
    // Canonical absolute URL — explicit so crawlers see the public
    // onepis.net domain instead of the Vercel deployment host.
    expect(LAYOUT_SRC).toMatch(/url\s*:\s*"https:\/\/3t\.onepis\.net\/"/);
    // All three variants carry 1280×640 dims so X / Slack can render the
    // large-image card correctly across desktop + mobile contexts.
    expect(LAYOUT_SRC).toMatch(/width\s*:\s*1280/);
    expect(LAYOUT_SRC).toMatch(/height\s*:\s*640/);
  });

  it("declares twitter card=summary_large_image with creator+site attribution", () => {
    expect(LAYOUT_SRC).toMatch(/twitter\s*:/);
    expect(LAYOUT_SRC).toMatch(/card\s*:\s*"summary_large_image"/);
    // Attribution handles — main公 X: https://x.com/onepisya
    expect(LAYOUT_SRC).toMatch(/creator\s*:\s*"@onepisya"/);
    expect(LAYOUT_SRC).toMatch(/site\s*:\s*"@onepisya"/);
  });

  it("keeps metadataBase pointing at the Vercel canonical host", () => {
    // metadataBase stays at the vercel.app host so Vercel edge follows
    // the onepis.net cname automatically without altering SEO.
    expect(LAYOUT_SRC).toMatch(
      /metadataBase\s*:\s*new URL\("https:\/\/3t-tic-tac-toe\.vercel\.app\/"\)/,
    );
  });

  // Plan: .omo/plans/ulw-meta-extras-20260914.md §A — openGraph locale
  it("declares openGraph locale=zh_CN so Chinese share cards tag correctly", () => {
    expect(LAYOUT_SRC).toMatch(/locale\s*:\s*"zh_CN"/);
  });

  // Plan: §C — three social-card variants under /public/
  it("declares openGraph images with three PNG variants (home/play/result)", () => {
    expect(LAYOUT_SRC).toMatch(/url\s*:\s*"\/social-card-home\.png"/);
    expect(LAYOUT_SRC).toMatch(/url\s*:\s*"\/social-card-play\.png"/);
    expect(LAYOUT_SRC).toMatch(/url\s*:\s*"\/social-card-result\.png"/);
    // Each of the three entries carries the image/png MIME so crawlers
    // don't have to sniff (cURLs hit /social-card-*.png via metadataBase).
    expect(LAYOUT_SRC.match(/type\s*:\s*"image\/png"/g)?.length).toBe(3);
    // Each entry carries an HTTPS secure_url mirror on the public domain —
    // OG spec still recognises this field for crawlers that prefer https.
    expect(
      LAYOUT_SRC.match(
        /secureUrl\s*:\s*"https:\/\/3t\.onepis\.net\/social-card-/g,
      )?.length,
    ).toBe(3);
  });

  // Plan: §C — twitter.images array mirrors the openGraph variants
  it("declares twitter images with the three PNG variants in declaration order", () => {
    expect(LAYOUT_SRC).toMatch(
      /images\s*:\s*\[\s*"\/social-card-home\.png"\s*,\s*"\/social-card-play\.png"\s*,\s*"\/social-card-result\.png"\s*,?\s*\]/,
    );
  });

  // Plan: §B — raw twitter:label1/data1/label2/data2 metadata, injected
  // directly via JSX because the Next.js metadata API has no field for it.
  // React 19 allows <meta> as a direct child of root layout; Next.js 16
  // hoists it into the document head at request time.
  it("injects raw twitter:label1/data1/label2/data2 metadata via JSX <meta> tags", () => {
    expect(LAYOUT_SRC).toMatch(/<meta\s+name="twitter:label1"/);
    expect(LAYOUT_SRC).toMatch(/<meta\s+name="twitter:data1"/);
    expect(LAYOUT_SRC).toMatch(/<meta\s+name="twitter:label2"/);
    expect(LAYOUT_SRC).toMatch(/<meta\s+name="twitter:data2"/);
  });
});
