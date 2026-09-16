// Targeted probe for the win-confetti launch origins (AGENTS verification gate).
// Desktop (>=1280px) must launch from inward mid-height origins near 18%/82% width;
// tablet/mobile (<1280px) must keep the legacy mid-edge launch; the central
// result UI must stay visible and clickable while the burst is live.
// Run: node tests/qa/confetti-origin-qa.mjs
import assert from 'node:assert/strict';

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';
import { ensureDir, writeQaLog } from './lib/evidence.mjs';

const BASE = BASE_URL;
const OUT = process.env.EVIDENCE_DIR ?? '.omx/evidence/confetti-origin-qa';
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

// Given a live confetti canvas, when we scan its pixels, then we can count
// opaque particles inside the bottom-edge and mid-edge bands per side.
async function sampleConfettiBands(page, sampling) {
  return page.evaluate((bounds) => {
    const canvas = Array.from(document.querySelectorAll('canvas')).find(
      (c) => getComputedStyle(c).position === 'fixed',
    );
    if (!canvas) return null;
    const { width, height } = canvas;
    // Headless Chromium drives confetti through an OffscreenCanvas proxy;
    // copy its live bitmap into a readable canvas before sampling.
    let source;
    try {
      source = canvas.getContext('2d');
    } catch {
      source = null;
    }
    let data;
    if (source) {
      data = source.getImageData(0, 0, width, height).data;
    } else {
      const copy = document.createElement('canvas');
      copy.width = width;
      copy.height = height;
      const copyCtx = copy.getContext('2d');
      copyCtx.drawImage(canvas, 0, 0);
      data = copyCtx.getImageData(0, 0, width, height).data;
    }
    const bottomY = Math.floor(height * 0.95);
    const midY0 = Math.floor(height * 0.5);
    const midY1 = Math.floor(height * 0.6);
    const leftX0 = Math.floor(width * bounds.leftX0);
    const leftX1 = Math.floor(width * bounds.leftX1);
    const rightX0 = Math.floor(width * bounds.rightX0);
    const rightX1 = Math.floor(width * bounds.rightX1);
  const counts = {
    bottomLeft: 0,
    bottomRight: 0,
    midLeft: 0,
    midRight: 0,
    leftCorridor: 0,
    rightCorridor: 0,
  };
    for (let y = bottomY; y < height; y += 1) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          if (x >= leftX0 && x <= leftX1) counts.bottomLeft += 1;
          if (x >= rightX0 && x <= rightX1) counts.bottomRight += 1;
        }
      }
    }
    for (let y = midY0; y < midY1; y += 1) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          if (x >= leftX0 && x <= leftX1) counts.midLeft += 1;
          if (x >= rightX0 && x <= rightX1) counts.midRight += 1;
        }
      }
    }
    for (let y = 0; y < height; y += 2) {
      for (let x = leftX0; x <= leftX1; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 0) counts.leftCorridor += 1;
      }
    }
    for (let y = 0; y < height; y += 2) {
      for (let x = rightX0; x <= rightX1; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 0) counts.rightCorridor += 1;
      }
    }
    return { width, height, ...counts };
  }, sampling);
}

async function sampleSeries(page, samples, gapMs, sampling) {
  const series = [];
  for (let i = 0; i < samples; i += 1) {
    const s = await sampleConfettiBands(page, sampling);
    if (s) series.push(s);
    await page.waitForTimeout(gapMs);
  }
  return series;
}

await ensureDir(OUT);

const VIEWPORTS = [
  {
    name: 'desktop-1440x900',
    viewport: { width: 1440, height: 900 },
    origin: 'inward',
    sampling: { leftX0: 0.13, leftX1: 0.23, rightX0: 0.77, rightX1: 0.87 },
  },
  {
    name: 'tablet-820x1180',
    viewport: { width: 820, height: 1180 },
    origin: 'mid',
    sampling: { leftX0: 0, leftX1: 0.05, rightX0: 0.95, rightX1: 1 },
  },
];

for (const { name, viewport, origin, sampling } of VIEWPORTS) {
 const { browser, ctx, page } = await launchQA({ viewport });
 await ctx.addInitScript(() => {
   try {
     window.OffscreenCanvasRenderingContext2D = undefined;
   } catch {}
 });
 page.on('console', (msg) => {
  // Headless confetti renders on an OffscreenCanvas proxy; the init script
  // above forces the equivalent main-thread fallback so pixels are readable.
    if (msg.type() === 'error') console.log('  [console error]', msg.text());
  });

  try {
    await step(`${name}: reset stats via API`, async () => {
      const r = await page.request.delete(`${BASE}/api/stats`);
      assert.equal(r.status(), 200);
    });

    await step(`${name}: drive a win into /result`, async () => {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.click('[data-testid="start-game"]');
      await page.waitForURL('**/play');
      await page.waitForSelector('[data-testid="board"]');
      await page.waitForTimeout(300);
      await driveTopRowWin(page);
      await page.waitForURL('**/result', { timeout: 4000 });
      await page.waitForSelector('[data-testid="confetti"]');
    });

    let series;
    await step(`${name}: confetti launches from the ${origin} origin at both sides`, async () => {
      // Particles rise quickly from the shared mid-height launch band, so
      // sample at frame cadence to catch that origin before dispersal.
      series = await sampleSeries(page, 24, 25, sampling);
      assert.ok(series.length >= 6, `confetti canvas missing in ${series.length}/24 samples`);
      const maxMid = Math.max(...series.map((s) => Math.min(s.midLeft, s.midRight)));
      const maxCorridor = Math.max(
        ...series.map((s) => Math.min(s.leftCorridor, s.rightCorridor)),
      );
      findings.push({ name: `${name}-bands`, status: 'INFO', series });
      if (origin === 'inward') {
        assert.ok(
          maxMid >= 10,
          `expected inward mid-height particles on both sides, max(min(left,right))=${maxMid}`,
        );
        assert.ok(
          maxCorridor >= 10,
          `expected inward particle corridors on both sides, max(min(left,right))=${maxCorridor}`,
        );
      } else {
        assert.ok(
          series.every((s) => s.bottomLeft === 0 && s.bottomRight === 0),
          `expected no bottom-edge particles, got ${JSON.stringify(series)}`,
        );
        assert.ok(maxMid >= 10, `expected mid-edge particles on both sides, max(min(left,right))=${maxMid}`);
      }
    });

    await step(`${name}: central UI stays clickable during the burst`, async () => {
      await page.screenshot({ path: `${OUT}/${name}-01-celebration.png` });
      const headline = page.locator('[data-testid="result-headline"]');
      await headline.waitFor({ state: 'visible' });
      await page.click('[data-testid="play-again"]', { timeout: 2000 });
      await page.waitForURL('**/play', { timeout: 3000 });
      await page.screenshot({ path: `${OUT}/${name}-02-after-ui-click.png` });
    });
  } finally {
    await ctx.close();
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Bug B / V1 (ulw-solo-sync-rebuild W-A): on /solo, the view-toggle
// (board↔stats) must NOT replay the win-confetti burst. Hoisted
// SoloConfetti keeps the burst target stable across toggles; the only
// acceptance is that [data-testid="confetti"] stays mounted exactly
// once and the burst does not fire a second time.
//
// Run shape: desktop viewport, drive top-row win on /solo, toggle to
// stats, then back to board, assert confetti count == 1 at each
// observation point. The count being 1 throughout (NOT 1→0→1 like the
// pre-fix behaviour) is the load-bearing assertion — it proves the
// hoisted mount target is stable.
{
  const { browser: b2, ctx: c2, page: p2 } = await launchQA({
    viewport: { width: 1280, height: 900 },
  });
  await c2.addInitScript(() => {
    try { window.OffscreenCanvasRenderingContext2D = undefined; } catch {}
  });
  try {
    await step('solo-bugb: drive top-row win on /solo, observe confetti', async () => {
      await p2.goto(`${BASE}/solo`, { waitUntil: 'networkidle' });
      await driveTopRowWin(p2);
      await p2.waitForFunction(
        () => /获胜/.test(
          document.querySelector('[data-testid="status-text"]')?.textContent ?? '',
        ),
        null,
        { timeout: 4000 },
      );
      await p2.waitForSelector('[data-testid="confetti"]', { timeout: 2000 });
      await p2.waitForTimeout(200); // let the burst settle
      const before = await p2.evaluate(() => ({
        count: document.querySelectorAll('[data-testid="confetti"]').length,
      }));
      assert.equal(before.count, 1, `expected confetti count 1 after win, got ${before.count}`);
      findings.push({ name: 'solo-bugb-initial', status: 'INFO', ...before });
    });

    await step('solo-bugb: toggle board→stats, confetti stays mounted (no unmount)', async () => {
      await p2.click('[data-testid="view-toggle"]');
      await p2.waitForSelector('[data-testid="solo-stats"]');
      await p2.waitForTimeout(200);
      const onStats = await p2.evaluate(() => ({
        count: document.querySelectorAll('[data-testid="confetti"]').length,
      }));
      // Acceptance: count stays at 1. Pre-fix this was 0 (DOM unmounted
      // when view switched to stats) — the visual bug was the new
      // mount on toggle-back firing burstConfetti() again.
      assert.equal(onStats.count, 1, `expected confetti count 1 on stats (no unmount), got ${onStats.count}`);
      findings.push({ name: 'solo-bugb-onstats', status: 'INFO', ...onStats });
    });

    await step('solo-bugb: toggle stats→board, confetti count stays at 1', async () => {
      await p2.click('[data-testid="view-toggle"]');
      await p2.waitForSelector('[data-testid="board"]');
      await p2.waitForTimeout(200);
      const after = await p2.evaluate(() => ({
        count: document.querySelectorAll('[data-testid="confetti"]').length,
      }));
      assert.equal(after.count, 1, `expected confetti count 1 after toggle-back, got ${after.count}`);
      findings.push({ name: 'solo-bugb-aftertoggle', status: 'INFO', ...after });
    });
  } finally {
    await c2.close();
    await b2.close();
  }
}

await writeQaLog(OUT, findings);
console.log(`evidence: ${OUT}`);
