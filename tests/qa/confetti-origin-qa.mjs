// Targeted probe for the win-confetti launch origins (AGENTS verification gate).
// Desktop (>=1280px) must launch from inward mid-height origins near 18%/82% width;
// tablet/mobile (<1280px) must keep the legacy mid-edge launch; the central
// result UI must stay visible and clickable while the burst is live.
// Run: node tests/qa/confetti-origin-qa.mjs
import assert from 'node:assert/strict';

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';
import { passRoomGate } from './lib/enter-online.mjs';
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

let roomSeq = 0;
for (const { name, viewport, origin, sampling } of VIEWPORTS) {
 // Unique room per viewport per run (probe-repair ticket 18): the
 // retired global DELETE /api/stats reset is replaced by the current
 // per-room surface (seed POST /api/rooms + reset POST below).
 const ROOM = `coqa-${(roomSeq += 1)}-${Date.now() % 100000}`;
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
    await step(`${name}: seed room + reset stats via API`, async () => {
      // Pre-gate-era probe called DELETE /api/stats (global reset);
      // that route is retired (room migration). Same-strength
      // replacement on the current surface: register the unique room,
      // reset its row, and assert the 200 carries an all-zero stats
      // body (the old step only checked the status code — the body
      // check is added strength, not a relaxation).
      const seed = await page.request.post(`${BASE}/api/rooms`, {
        data: { room: ROOM },
      });
      assert.equal(seed.status(), 200, `seed /api/rooms 200, got ${seed.status()}`);
      const r = await page.request.post(
        `${BASE}/api/rooms/${encodeURIComponent(ROOM)}/stats/reset`,
      );
      assert.equal(r.status(), 200, `reset 200, got ${r.status()}`);
      const body = await r.json();
      assert.equal(body.stats.totalGames, 0, `reset row all-zero, got ${JSON.stringify(body.stats)}`);
    });

    await step(`${name}: drive a win into /result`, async () => {
      // Entry-drift fix (ticket 18): c75cfdf/c9ef27f gated the home
      // start-online CTA behind RoomGateDialog — passRoomGate fills
      // the room name, confirms (room pre-seeded above so this enters
      // the existing room) and lands on the board. Win push goes to
      // `/result?room=<room>` — regex, not the end-anchored
      // `**/result` glob (globs miss query strings); 8s (was 4s)
      // because the push waits for the in-flight outcome POST (W-F).
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await passRoomGate(page, ROOM);
      await page.waitForTimeout(300);
      await driveTopRowWin(page);
      await page.waitForURL(/\/result/, { timeout: 8000 });
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
      // result-headline was retired with the room-era result page;
      // play-again is the current central-UI anchor (and the click
      // target below).
      await page.waitForSelector('[data-testid="play-again"]', { state: 'visible' });
      await page.click('[data-testid="play-again"]', { timeout: 2000 });
      // play-again links to the bare /online (no query) — the glob is
      // fine here.
      await page.waitForURL('**/online', { timeout: 3000 });
      await page.screenshot({ path: `${OUT}/${name}-02-after-ui-click.png` });
    });
  } finally {
    await ctx.close();
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Bug B / V1 (ulw-solo-sync-rebuild W-A) + W3 (ulw-ux-refresh-pass §3):
// on /offline, both the manual view-toggle (board↔stats) AND the W3
// auto-switch (phase→won ⇒ setView('stats') after 1.2s) must keep
// [data-testid="confetti"] mounted exactly once — the burst fires once
// per win, never replayed by view changes.
//
// Run shape: desktop viewport, drive top-row win on /offline, wait for
// the W3 auto-switch to land on stats, then manually toggle back to
// board, assert confetti count == 1 at each observation point. The
// count being 1 throughout (NOT 1→0→1 like the pre-fix behaviour, and
// NOT 1→2 like a stale auto-switch burst) is the load-bearing
// assertion — it proves the hoisted mount target is stable and the
// W3 phase subscription never retriggers burstConfetti().
{
  const { browser: b2, ctx: c2, page: p2 } = await launchQA({
    viewport: { width: 1280, height: 900 },
  });
  await c2.addInitScript(() => {
    try { window.OffscreenCanvasRenderingContext2D = undefined; } catch {}
  });
  try {
    await step('offline-bugb: drive top-row win on /offline, observe confetti', async () => {
      await p2.goto(`${BASE}/offline`, { waitUntil: 'networkidle' });
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
      findings.push({ name: 'offline-bugb-initial', status: 'INFO', ...before });
    });

    await step('offline-bugb: W3 auto-switch lands on stats within ≤2s, confetti stays at 1', async () => {
      // The phase→won trigger in app/solo/page.tsx schedules
      // startTransition(setView('stats')) after WIN_AUTO_SWITCH_MS
      // (1200ms). Wait for the stats view to mount; confetti count must
      // still be 1 (Bug B + W3: stable mount target across auto-switch).
      await p2.waitForSelector('[data-testid="offline-stats"]', { timeout: 2000 });
      await p2.waitForTimeout(150);
      const onStats = await p2.evaluate(() => ({
        count: document.querySelectorAll('[data-testid="confetti"]').length,
      }));
      // Acceptance: count stays at 1. Pre-fix this was 0 (DOM unmounted
      // when view switched to stats) — the visual bug was the new
      // mount on toggle-back firing burstConfetti() again. Post-W3
      // this also proves the auto-switch never replays the burst.
      assert.equal(onStats.count, 1, `expected confetti count 1 on stats (no unmount), got ${onStats.count}`);
      findings.push({ name: 'offline-bugb-onstats', status: 'INFO', ...onStats });
    });

    await step('offline-bugb: toggle stats→board, no replay + F1 stale-reset lands', async () => {
      await p2.click('[data-testid="view-toggle"]');
      await p2.waitForSelector('[data-testid="board"]');
      await p2.waitForTimeout(200);
      // Bug B 面（不重放）：toggle-back 全程 confetti 层最多 1 个——
      // 重挂重放回归会出现第二 burst 周期；hoist 回归则上一步
      // onStats count===1 已红（stats 视图即卸载）。
      const after = await p2.evaluate(() => ({
        count: document.querySelectorAll('[data-testid="confetti"]').length,
      }));
      assert.ok(
        after.count <= 1,
        `no replay burst: confetti count must never exceed 1, got ${after.count}`,
      );
      // F1 面（stale-reset 落定）：6b53402（ulw-result-play-again-loop，
      // 2026-09-19 21:45，晚于本探针末次维护 d07fd07 同日 04:58）把
      // 「PlayController 重挂 + terminal 残留」定义为 stale → restart()
      // → phase 离开 'won' → WinConfetti 按契约卸载（count 0 是设计内
      // 终态）。旧断言 count===1 写于 F1 之前，与 F1 语义冲突，仅在
      // view-swap 动画窗口内 effect 未跑完时偶绿（本票实跑两轮一轮绿
      // 一轮红，竞态实测钉死）。现行断言＝等卸载落定：若 F1 回归
      // （terminal 残留不再被重置），此处 3s 超时红——比旧断言多钉
      // 一个 F1 回归面，检测强度只增不减。
      await p2.waitForFunction(
        () => document.querySelectorAll('[data-testid="confetti"]').length === 0,
        null,
        { timeout: 3000 },
      );
      findings.push({ name: 'offline-bugb-aftertoggle', status: 'INFO', ...after });
    });
  } finally {
    await c2.close();
    await b2.close();
  }
}

await writeQaLog(OUT, findings);
console.log(`evidence: ${OUT}`);
