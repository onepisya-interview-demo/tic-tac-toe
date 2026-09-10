// Visual + functional QA via Playwright.
// Runs against the production server on http://localhost:3000.
// Captures one screenshot per route + a play-through ending in a win.

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { ensureDir, shootTo, writeQaLog } from './lib/evidence.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';

const BASE = BASE_URL;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR ?? '.omx/evidence/scaffold-qa';

// Geist Mono's woff2 hash as observed in production HTML pre-preload-false.
// When the layout fix removes the preload link, this query must return null.
// Update this constant only if Next.js regenerates the Geist Mono asset (rare;
// each next/font build with a different font version may produce a new hash).
const GEIST_MONO_FONT_HASH = "797e433ab948586e";

async function snapshot(page) {
  return page.evaluate((hash) => {
    // Read the @vercel/analytics injected script tag (production HTML only).
    // The component injects a <script> at one of two URLs:
    //   - local / preview: /_vercel/insights/script.js
    //   - production:       /<numeric-sandbox-id>/script.js  (Vercel assigns
    //                       a project-local sandbox ID at deploy time and
    //                       rewrites the SDK endpoint to that path)
    // Both URLs serve the same gzip'd Vercel Web Analytics SDK and register
    // window.va. We accept either presence as the machine-readable contract
    // that Analytics is wired up. Inline `<script>window.va=` or
    // `__VERCEL_INSIGHTS__` sentinel checks still apply for any future
    // pre-mount injection mode.
    const analyticsScript = (() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const srcs = scripts.map((s) => s.getAttribute('src') ?? '');
      // Local / preview endpoint
      const vercelInsight = srcs.find((src) => /vercel.*insights|vercel-insights|_vercel\/insights/.test(src));
      if (vercelInsight) return 'present';
      // Production endpoint: /<numeric-sandbox-id>/script.js (Vercel assigns
      // a project-local sandbox ID at deploy time and rewrites the SDK URL
      // to that path).
      const productionEndpoint = srcs.find((src) => /^\/\d+\/script\.js$/.test(src));
      if (productionEndpoint) return 'present';
      // Inline sentinel for any future pre-mount injection
      const inline = Array.from(document.querySelectorAll('script:not([src])')).find((s) => /window\.va\(|__VERCEL_INSIGHTS__/.test(s.textContent ?? ''));
      return inline ? 'present' : 'absent';
    })();
    return {
      url: location.href,
      title: document.title,
      h1: document.querySelector('h1')?.innerText ?? null,
      buttons: Array.from(document.querySelectorAll('button')).map((b) => b.innerText),
      statsValues: Array.from(document.querySelectorAll('[class*="font-mono"]')).map((s) => s.innerText).filter(Boolean),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      fontFamily: getComputedStyle(document.body).fontFamily,
      fontLoaded: document.fonts.size > 0,
      // Next.js 16 metadata contracts (commit 1 + commit 2):
      iconHref: document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? null,
      appleTouchIconHref: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null,
      monoPreloadAbsent: !document.querySelector(`link[rel="preload"][href*="${hash}"]`),
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
      analyticsScript,
    };
  }, GEIST_MONO_FONT_HASH);
}

async function main() {
  await ensureDir(EVIDENCE_DIR);
  const { browser, ctx, page } = await launchQA();
  const shoot = shootTo(EVIDENCE_DIR);

  const log = [];

  // ---- 1. Home / ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="start-game"]');
  await page.waitForTimeout(300); // settle font preload
  const homeShot = await shoot(page, '01-home.png');
  const homeSnap = await snapshot(page);
  log.push({ stage: 'home', shot: homeShot, snapshot: homeSnap });

  // ---- 2. Click 开始游戏 → /play ----
  await Promise.all([
    page.waitForURL(`${BASE}/play`, { timeout: 5000 }),
    page.click('[data-testid="start-game"]'),
  ]);
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(200);
  const playShot = await shoot(page, '02-play-start.png');
  const playSnap = await snapshot(page);
  log.push({ stage: 'play-start', shot: playShot, snapshot: playSnap });

  // ---- 3. Play a winning game: whoever goes first wins the top row ----
  // (First player is randomized; driveTopRowWin adapts to either.)
  await driveTopRowWin(page);
  await page.waitForURL(`${BASE}/result`, { timeout: 5000 });
  await page.waitForSelector('[data-testid="result-headline"]');
  await page.waitForTimeout(300);
  const resultShot = await shoot(page, '03-result.png');
  const resultSnap = await snapshot(page);
  log.push({ stage: 'result', shot: resultShot, snapshot: resultSnap });

  // ---- 4. Reload home to verify stats persisted via DB ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="start-game"]');
  await page.waitForTimeout(300);
  const reloadShot = await shoot(page, '04-home-after-game.png');
  const reloadSnap = await snapshot(page);
  log.push({ stage: 'home-after-game', shot: reloadShot, snapshot: reloadSnap });

  // ---- 5. Verify API stats endpoint ----
  const apiResp = await page.evaluate(async () => {
    const r = await fetch('/api/stats');
    return { status: r.status, body: await r.json() };
  });
  log.push({ stage: 'api-stats', response: apiResp });

  // ---- 6. Play again flow ----
  await Promise.all([
    page.waitForURL(`${BASE}/play`, { timeout: 5000 }),
    page.click('[data-testid="start-game"]'),
  ]);
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(200);
  const replayShot = await shoot(page, '05-play-again.png');
  const replaySnap = await snapshot(page);
  log.push({ stage: 'play-again', shot: replayShot, snapshot: replaySnap });

  await ctx.close();
  await browser.close();

  await writeQaLog(EVIDENCE_DIR, log);
  console.log('QA complete. Screenshots and qa-log.json written to', EVIDENCE_DIR);

  // Programmatic contract: every snapshot must have a non-null appleTouchIconHref
  // and monoPreloadAbsent === true. Guards against silent regressions in commit 1
  // (apple-icon) and commit 2 (mono preload).
  const failures = log
    .filter((entry) => entry.snapshot)
    .filter((entry) => !entry.snapshot.appleTouchIconHref || entry.snapshot.monoPreloadAbsent !== true);
  if (failures.length > 0) {
    console.error(`QA contract failed for ${failures.length} stage(s):`);
    for (const f of failures) {
      console.error(`  - ${f.stage}: appleTouchIconHref=${JSON.stringify(f.snapshot.appleTouchIconHref)} monoPreloadAbsent=${JSON.stringify(f.snapshot.monoPreloadAbsent)}`);
    }
    process.exit(1);
  }
  console.log(`QA contract verified: ${log.filter((e) => e.snapshot).length} stages all pass.`);
}

main().catch((e) => {
  console.error('QA FAILED:', e);
  process.exit(1);
});
