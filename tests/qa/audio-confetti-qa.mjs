import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = '/private/tmp/ulw-demo/.omx/evidence/qa-after';
const findings = [];

async function step(name, fn) {
  process.stdout.write(`STEP: ${name} ... `);
  const t0 = Date.now();
  try {
    await fn();
    console.log(`PASS ${Date.now() - t0}ms`);
    findings.push({ name, status: 'PASS', ms: Date.now() - t0 });
  } catch (e) {
    console.log(`FAIL ${Date.now() - t0}ms -- ${e.message}`);
    findings.push({ name, status: 'FAIL', ms: Date.now() - t0, error: e.message });
    throw e;
  }
}

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [console error]', msg.text());
});

try {
  await step('reset stats via API', async () => {
    const r = await page.request.delete(`${BASE}/api/stats`);
    assert.equal(r.status(), 200);
  });

  await step('home page loads with muted sound toggle', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const btn = await page.waitForSelector('[data-testid="sound-toggle"]');
    assert.equal(await btn.getAttribute('aria-pressed'), 'false');
    assert.equal(await btn.getAttribute('aria-label'), '开启音效');
    await page.screenshot({ path: `${OUT}/01-home-muted.png` });
  });

  await step('click sound toggle flips to unmuted + persists', async () => {
    await page.click('[data-testid="sound-toggle"]');
    const btn = page.locator('[data-testid="sound-toggle"]');
    assert.equal(await btn.getAttribute('aria-pressed'), 'true');
    assert.equal(await btn.getAttribute('aria-label'), '关闭音效');
    const muted = await page.evaluate(() => window.localStorage.getItem('ttt.sound.muted'));
    assert.equal(muted, '0', `expected localStorage '0', got '${muted}'`);
    await page.screenshot({ path: `${OUT}/02-home-unmuted.png` });
  });

  let winningPlayer = null;
  await step('start a game and drive whoever-is-first to a top-row win', async () => {
    await page.click('[data-testid="start-game"]');
    await page.waitForURL('**/play');
    await page.waitForSelector('[data-testid="board"]');
    await page.waitForTimeout(300);

    // Determine which player goes first by inspecting the status bar.
    const firstStatus = await page.locator('[data-testid="status-text"]').textContent();
    const m = firstStatus?.match(/轮到 ([XO])/);
    assert.ok(m, `unexpected status: ${firstStatus}`);
    const firstPlayer = m[1];
    winningPlayer = firstPlayer; // X tops row at 0/1/2, O tops row at 0/1/2 too.

    // Always: first 0, second 3, first 1, second 4, first 2 — first player wins top row.
    await page.click('[data-testid="cell-0"]');
    await page.waitForTimeout(120);
    await page.click('[data-testid="cell-3"]');
    await page.waitForTimeout(120);
    await page.click('[data-testid="cell-1"]');
    await page.waitForTimeout(120);
    await page.click('[data-testid="cell-4"]');
    await page.waitForTimeout(120);
    await page.click('[data-testid="cell-2"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/03-play-win-moment.png` });
  });

  await step('canvas-confetti attaches a fixed-position full-viewport canvas after win', async () => {
    await page.waitForURL('**/result', { timeout: 4000 });
    await page.waitForSelector('[data-testid="result-headline"]');
    // Wait briefly so canvas has had at least one animation frame.
    await page.waitForTimeout(120);
    const canvases = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('canvas')).map((c) => ({
        width: c.width,
        height: c.height,
        position: getComputedStyle(c).position,
        zIndex: getComputedStyle(c).zIndex,
        pointerEvents: getComputedStyle(c).pointerEvents,
      }));
    });
    assert.ok(canvases.length >= 1, `expected ≥1 canvas, got ${canvases.length}`);
    const fixed = canvases.find((c) => c.position === 'fixed' && c.pointerEvents === 'none');
    assert.ok(fixed, `expected fixed-position canvas, got ${JSON.stringify(canvases)}`);
    assert.ok(fixed.width > 800 && fixed.height > 500, `canvas too small: ${fixed.width}x${fixed.height}`);
    findings.push({ name: 'canvas-info', status: 'INFO', canvases });
    await page.screenshot({ path: `${OUT}/04-result-celebration.png` });
  });

  await step('headline shows the correct winning player', async () => {
    const headline = (await page.locator('[data-testid="result-headline"]').textContent()) ?? '';
    assert.ok(
      headline.includes(`${winningPlayer} 获胜`),
      `expected "${winningPlayer} 获胜" in headline, got: ${headline}`,
    );
  });

  await step('stats persist (1 total, 1 win for first player, no draws)', async () => {
    // Allow ample time for the post-win PUT and the post-nav hydrate GET.
    await page.waitForTimeout(1500);
    const stats = await page.evaluate(async () => {
      const r = await fetch('/api/stats', { cache: 'no-store' });
      return r.json();
    });
    findings.push({ name: 'stats-after', status: 'INFO', stats });
    assert.equal(stats.totalGames, 1, `expected totalGames=1, got ${stats.totalGames}`);
    if (winningPlayer === 'X') {
      assert.equal(stats.xWins, 1);
      assert.equal(stats.oWins, 0);
    } else {
      assert.equal(stats.oWins, 1);
      assert.equal(stats.xWins, 0);
    }
    assert.equal(stats.draws, 0);
  });

  await step('audio surface is real — AudioContext constructor available in the page', async () => {
    const probe = await page.evaluate(() => {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      return { audioCtorAvailable: typeof Ctor === 'function' };
    });
    assert.equal(probe.audioCtorAvailable, true);
  });

  await step('full result page screenshot for evidence', async () => {
    await page.screenshot({ path: `${OUT}/05-result-final.png`, fullPage: true });
  });
} catch (e) {
  console.error('QA FAILED:', e.message);
  await page.screenshot({ path: `${OUT}/_failure.png` });
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${OUT}/qa-log.json`, JSON.stringify(findings, null, 2));
  await ctx.close();
  await browser.close();
}

const pass = findings.filter((f) => f.status === 'PASS').length;
const fail = findings.filter((f) => f.status === 'FAIL').length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
