// Visual + functional QA via Playwright.
// Runs against the production server on http://localhost:3000.
// Captures one screenshot per route + a play-through ending in a win.

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { ensureDir, shootTo, writeQaLog } from './lib/evidence.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';

const BASE = BASE_URL;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR ?? '.omx/evidence/scaffold-qa';

async function snapshot(page) {
  return page.evaluate(() => {
    // Read the @vercel/analytics injected script tag (production HTML only).
    // The component injects a <script> that loads /_vercel/insights/script.js
    // and registers window.va. We accept either presence as the
    // machine-readable contract that Analytics is wired up.
    const analyticsScript = (() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const vercelInsight = scripts.find((s) => /vercel.*insights|vercel-insights|_vercel\/insights/.test(s.getAttribute('src') ?? ''));
      if (vercelInsight) return 'present';
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
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
      analyticsScript,
    };
  });
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
}

main().catch((e) => {
  console.error('QA FAILED:', e);
  process.exit(1);
});
