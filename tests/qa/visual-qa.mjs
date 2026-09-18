// Visual + functional QA via Playwright.
// Runs against the production server on http://localhost:3000.
//
// Two passes per invocation:
//   * Desktop pass (1280×900) — home, play, result, home-after, play-again,
//     solo (board view + stats view after toggle), API stats.
//   * Mobile pass (375×667) — home, play, solo (board + stats), result.
// Every mobile stage asserts scrollWidth === viewport.width (no horizontal
// overflow); the desktop pass keeps the apple-touch-icon + mono-preload
// contract pinned by the existing snapshot() helper.
//
// The /solo stage now drives the view-toggle (board↔stats) introduced by
// the W-UI wave 1 (ulw-ux-mobile-sync T3): SoloStatsPanel renders only
// when the toggle is in the stats position, so visual-qa must click
// [data-testid="view-toggle"] before reading the stats surface.

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
  // page.evaluate runs in the browser context, so top-level `const`s in this file
  // are NOT visible inside the closure. Top-level values (like
  // GEIST_MONO_FONT_HASH) must be passed as the 2nd argument so Playwright
  // serializes them across the CDP boundary.
  // See docs/learnings.md #12 for the full pattern.
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

async function mobileOverflow(page) {
  // The mobile-pass contract: the page must fit inside the viewport with no
  // horizontal overflow. We assert scrollWidth strictly equals the layout
  // viewport (clientWidth); a strict equality is required because the
  // page-shell + globals.css already set body { overflow-x: hidden } so any
  // internal overflow would already be clipped — but the underlying
  // scrollWidth would still exceed clientWidth, which is the contract we
  // pin (matches the existing ux-qa.mjs `assertUXContract` for mobile
  // scenarios).
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
}

async function desktopPass(page, shoot, log) {
  // ---- 1. Home / ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  // Seed a player name so the W3 online entry gate (StartGameButton
  // requireName=true default for online) passes.
  await page.evaluate(() => {
    window.localStorage.setItem("ttt.player.name.v1", "visual-qa-user");
    window.dispatchEvent(new CustomEvent("ttt:player-name-changed"));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="player-name-section"]', { timeout: 4000 });
  await page.waitForSelector('[data-testid="start-online"]');
  await page.waitForTimeout(300); // settle font preload
  const homeShot = await shoot(page, '01-home.png');
  const homeSnap = await snapshot(page);
  log.push({ stage: 'home', shot: homeShot, snapshot: homeSnap });

  // ---- 2. Click 开始游戏 → /play ----
  await Promise.all([
    page.waitForURL(`${BASE}/play`, { timeout: 5000 }),
    page.click('[data-testid="start-online"]'),
  ]);
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(200);
  const playShot = await shoot(page, '02-play-start.png');
  const playSnap = await snapshot(page);
  log.push({ stage: 'play-start', shot: playShot, snapshot: playSnap });

  // ---- 3. Play a winning game: whoever goes first wins the top row ----
  // (First player is randomized; driveTopRowWin adapts to either.)
  await driveTopRowWin(page);
  await page.waitForURL(/\/result\?/, { timeout: 5000 });
  await page.waitForSelector('[data-testid="result-page"]');
  await page.waitForTimeout(300);
  const resultShot = await shoot(page, '03-result.png');
  const resultSnap = await snapshot(page);
  log.push({ stage: 'result', shot: resultShot, snapshot: resultSnap });

  // ---- 4. Reload home to verify stats persisted via DB ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="start-online"]');
  await page.waitForTimeout(300);
  const reloadShot = await shoot(page, '04-home-after-game.png');
  const reloadSnap = await snapshot(page);
  log.push({ stage: 'home-after-game', shot: reloadShot, snapshot: reloadSnap });

  // ---- 5. Verify API stats endpoint (W2 per-name endpoint) ----
  const apiResp = await page.evaluate(async () => {
    const r = await fetch('/api/players/visual-qa-user/stats', { cache: 'no-store' });
    return { status: r.status, body: await r.json() };
  });
  log.push({ stage: 'api-stats', response: apiResp });

  // ---- 6. Play again flow ----
  await Promise.all([
    page.waitForURL(`${BASE}/play`, { timeout: 5000 }),
    page.click('[data-testid="start-online"]'),
  ]);
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(200);
  const replayShot = await shoot(page, '05-play-again.png');
  const replaySnap = await snapshot(page);
  log.push({ stage: 'play-again', shot: replayShot, snapshot: replaySnap });

  // ---- 7. /solo route — board view (default) + stats view (after toggle) ----
  await page.goto(`${BASE}/solo`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(220);
  const soloBoardShot = await shoot(page, '06a-solo-board.png');
  const soloBoardSnap = await snapshot(page);
  log.push({ stage: 'solo-board', shot: soloBoardShot, snapshot: soloBoardSnap });

  // Click view-toggle to swap to stats view (T3 in-page swap).
  await page.click('[data-testid="view-toggle"]');
  await page.waitForSelector('[data-testid="solo-stats"]');
  await page.waitForTimeout(220);
  const soloStatsShot = await shoot(page, '06b-solo-stats.png');
  const soloStatsSnap = await snapshot(page);
  log.push({ stage: 'solo-stats', shot: soloStatsShot, snapshot: soloStatsSnap });
}

async function mobilePass(page, shoot, log) {
  // All four canonical routes at 375×667 (iPhone SE first-gen reference).
  // Per-stage contract: scrollWidth === clientWidth (no horizontal overflow).
  // Each stage opens the same browser tab sequentially (single context) to
  // share localStorage state where useful (e.g. home reset before /solo).
  const stages = [];

  // Home: reset stats first so we capture a clean empty-state home.
  await page.request.delete(`${BASE}/api/stats`);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="start-online"]');
  await page.waitForTimeout(220);
  await shoot(page, 'm1-home.png');
  const homeOverflow = await mobileOverflow(page);
  stages.push({ stage: 'm-home', overflow: homeOverflow });

  // /play
  await Promise.all([
    page.waitForURL(`${BASE}/play`, { timeout: 5000 }),
    page.click('[data-testid="start-online"]'),
  ]);
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(220);
  await shoot(page, 'm2-play.png');
  const playOverflow = await mobileOverflow(page);
  stages.push({ stage: 'm-play', overflow: playOverflow });

  // /solo — capture both views (board default + stats after toggle).
  await page.goto(`${BASE}/solo`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="board"]');
  await page.waitForTimeout(220);
  await shoot(page, 'm3a-solo-board.png');
  const soloBoardOverflow = await mobileOverflow(page);
  stages.push({ stage: 'm-solo-board', overflow: soloBoardOverflow });

  // Click view-toggle → stats view.
  await page.click('[data-testid="view-toggle"]');
  await page.waitForSelector('[data-testid="solo-stats"]');
  await page.waitForTimeout(220);
  await shoot(page, 'm3b-solo-stats.png');
  const soloStatsOverflow = await mobileOverflow(page);
  stages.push({ stage: 'm-solo-stats', overflow: soloStatsOverflow });

  // /result — drive a ranked win on /play then navigate. The previous
  // step left us on /solo (stats view) which has no start-online button,
  // so go via home (carry the store-bound playerName) rather than
  // direct goto (would lose the Zustand hydration).
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-online"]');
  await page.waitForURL(`${BASE}/play`, { timeout: 5000 });
  await page.waitForSelector('[data-testid="board"]');
  await driveTopRowWin(page);
  await page.waitForURL(/\/result\?/, { timeout: 5000 });
  await page.waitForSelector('[data-testid="result-page"]');
  await page.waitForTimeout(300);
  await shoot(page, 'm4-result.png');
  const resultOverflow = await mobileOverflow(page);
  stages.push({ stage: 'm-result', overflow: resultOverflow });

  return stages;
}

async function main() {
  await ensureDir(EVIDENCE_DIR);
  const { browser, ctx, page } = await launchQA();
  const shoot = shootTo(EVIDENCE_DIR);

  const log = [];

  // === Desktop pass (existing 1280×900 viewport from launchQA) ===
  await desktopPass(page, shoot, log);

  // === Mobile pass: switch viewport to 375×667 (iPhone SE) ===
  await page.setViewportSize({ width: 375, height: 667 });
  const mobileStages = await mobilePass(page, shoot, log);
  log.push({ stage: 'mobile-overflow', stages: mobileStages });

  await ctx.close();
  await browser.close();

  await writeQaLog(EVIDENCE_DIR, log);
  console.log('QA complete. Screenshots and qa-log.json written to', EVIDENCE_DIR);

  // Programmatic contract #1: every desktop snapshot must have a non-null
  // appleTouchIconHref and monoPreloadAbsent === true. Guards against
  // silent regressions in commit 1 (apple-icon) and commit 2 (mono preload).
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

  // Programmatic contract #2: every mobile stage must have
  // scrollWidth === clientWidth === viewportWidth (no horizontal overflow).
  const overflowFailures = (log.find((e) => e.stage === 'mobile-overflow')?.stages ?? [])
    .filter((s) => s.overflow.scrollWidth !== s.overflow.clientWidth
                  || s.overflow.scrollWidth !== s.overflow.viewportWidth);
  if (overflowFailures.length > 0) {
    console.error(`Mobile overflow contract failed for ${overflowFailures.length} stage(s):`);
    for (const f of overflowFailures) {
      console.error(`  - ${f.stage}: client=${f.overflow.clientWidth} scroll=${f.overflow.scrollWidth} viewport=${f.overflow.viewportWidth}`);
    }
    process.exit(1);
  }

  console.log(`QA contract verified: ${log.filter((e) => e.snapshot).length} desktop stages pass; ${mobileStages.length} mobile stages no-overflow.`);
}

main().catch((e) => {
  console.error('QA FAILED:', e);
  process.exit(1);
});
