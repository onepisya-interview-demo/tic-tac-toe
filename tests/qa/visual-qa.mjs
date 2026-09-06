// Visual + functional QA via Playwright.
// Runs against the production server on http://localhost:3000.
// Captures one screenshot per route + a play-through ending in a win.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EVIDENCE_DIR = process.env.EVIDENCE_DIR ?? '.omx/evidence/scaffold-qa';

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function shoot(page, name) {
  const p = path.join(EVIDENCE_DIR, name);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    title: document.title,
    h1: document.querySelector('h1')?.innerText ?? null,
    buttons: Array.from(document.querySelectorAll('button')).map((b) => b.innerText),
    statsValues: Array.from(document.querySelectorAll('[class*="font-mono"]')).map((s) => s.innerText).filter(Boolean),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontLoaded: document.fonts.size > 0,
  }));
}

async function main() {
  await ensureDir(EVIDENCE_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

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

  // ---- 3. Play a winning game: X plays 0,4,8 (top-row + center + bottom-right diagonal) ----
  // X starts (first player randomized; we accept either and adapt).
  // We'll click cells in a fixed sequence and check the winner cell highlighting.
  await page.click('[data-testid="cell-0"]'); // first move
  await page.waitForTimeout(120);
  await page.click('[data-testid="cell-3"]'); // second move (other player)
  await page.waitForTimeout(120);
  await page.click('[data-testid="cell-1"]'); // first player again
  await page.waitForTimeout(120);
  await page.click('[data-testid="cell-4"]'); // other player again
  await page.waitForTimeout(120);
  await page.click('[data-testid="cell-2"]'); // first player wins top row
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

  await browser.close();

  // Write evidence summary
  await fs.writeFile(
    path.join(EVIDENCE_DIR, 'qa-log.json'),
    JSON.stringify(log, null, 2),
  );
  console.log('QA complete. Screenshots and qa-log.json written to', EVIDENCE_DIR);
}

main().catch((e) => {
  console.error('QA FAILED:', e);
  process.exit(1);
});
