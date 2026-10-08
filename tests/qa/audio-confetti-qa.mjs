import assert from 'node:assert/strict';

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';
import { passRoomGate } from './lib/enter-online.mjs';
import { ensureDir, writeQaLog } from './lib/evidence.mjs';

const BASE = BASE_URL;
const OUT = process.env.EVIDENCE_DIR ?? '.omx/evidence/qa-after';
// Unique room per run (probe-repair ticket 18). The retired
// `DELETE /api/stats` global reset is replaced by the current
// per-room surface: seed POST /api/rooms, then POST
// /api/rooms/<room>/stats/reset.
const ROOM = `acq-${Date.now() % 1000000}`;
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

await ensureDir(OUT);

const { browser, ctx, page } = await launchQA();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [console error]', msg.text());
});

try {
  await step('seed room + reset stats via API', async () => {
    // Pre-gate-era probe called DELETE /api/stats (global reset); that
    // route is retired (room migration). Same-strength replacement on
    // the current surface: register the unique room, then reset its
    // row and assert the 200 carries an all-zero stats body (the old
    // step only checked the status code — the body check is added
    // strength, not a relaxation).
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
    // Entry-drift fix (ticket 18): c75cfdf/c9ef27f gated the home
    // start-online CTA behind RoomGateDialog — passRoomGate fills the
    // room name, confirms (POST /api/rooms; room pre-seeded above so
    // this enters the existing room) and lands on the board.
    await passRoomGate(page, ROOM);
    await page.waitForTimeout(300);

    // Determine which player goes first by inspecting the status bar.
    const firstStatus = await page.locator('[data-testid="status-text"]').textContent();
    const m = firstStatus?.match(/轮到 ([XO])/);
    assert.ok(m, `unexpected status: ${firstStatus}`);
    const firstPlayer = m[1];
    winningPlayer = firstPlayer; // X tops row at 0/1/2, O tops row at 0/1/2 too.

    // First player always wins the top row (see driveTopRowWin).
    await driveTopRowWin(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/03-play-win-moment.png` });
  });

  await step('canvas-confetti attaches a fixed-position full-viewport canvas after win', async () => {
    // Regex + 8s (was glob + 4s): the online win push goes to
    // `/result?room=<room>` (end-anchored globs miss query strings)
    // and the push waits for the in-flight outcome POST (W-F).
    await page.waitForURL(/\/result/, { timeout: 8000 });
    // result-headline ("X 获胜") was retired with the room-era result
    // page; result-name is the current arrival anchor on branches 2/3.
    await page.waitForSelector('[data-testid="result-name"]');
    // canvas-confetti attaches the canvas via a useEffect on <Confetti>,
    // which mounts as a sibling of the headline. After the
    // ulw-mobile-one-line-ux pass the headline is the page h1, so its
    // first paint happens ~150-300ms after navigation; the previous
    // 120ms waitForTimeout was racing that paint. Poll the DOM until
    // the canvas arrives instead — the canvas itself is the contract.
    await page.waitForFunction(
      () => document.querySelectorAll('canvas').length >= 1,
      null,
      { timeout: 4000 },
    );
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

  await step('result page shows this run\'s room + the winning player\'s row', async () => {
    // Entry-drift fix (ticket 18): /result no longer renders a
    // 「X 获胜」 headline (retired surface). Same-strength replacement:
    // the ledger we landed on belongs to THIS run's room, and the
    // page-rendered stats grid shows the winning player at 1 (the
    // server-row equivalent is asserted in the stats persist step
    // below). StatsGrid card order is stable: 总场次/X 胜/O 胜/平局/
    // 当前连胜 (components/ui/StatsGrid.tsx).
    const name = (await page.locator('[data-testid="result-name"]').textContent()) ?? '';
    assert.ok(
      name.includes(ROOM),
      `expected room "${ROOM}" in result-name, got: ${name}`,
    );
    const values = await page
      .locator('[data-testid="result-stats"] [data-testid="stat-value"]')
      .allTextContents();
    const [total, xWins, oWins, draws] = values;
    assert.equal(total, '1', `expected totalGames 1 on page, got ${total}`);
    if (winningPlayer === 'X') {
      assert.equal(xWins, '1', `expected X wins 1 on page, got ${xWins}`);
      assert.equal(oWins, '0', `expected O wins 0 on page, got ${oWins}`);
    } else {
      assert.equal(oWins, '1', `expected O wins 1 on page, got ${oWins}`);
      assert.equal(xWins, '0', `expected X wins 0 on page, got ${xWins}`);
    }
    assert.equal(draws, '0', `expected draws 0 on page, got ${draws}`);
  });

  await step('stats persist (1 total, 1 win for first player, no draws)', async () => {
    // Entry-drift fix (ticket 18): the retired global GET /api/stats is
    // replaced by the current per-room row GET /api/rooms/<room>/stats
    // (same assertions — totalGames / xWins / oWins / draws — carried
    // over verbatim, only the endpoint moved with the room migration).
    // Allow ample time for the post-win outcome POST and the post-nav
    // RSC read.
    await page.waitForTimeout(1500);
    const payload = await page.evaluate(async (room) => {
      const r = await fetch(`/api/rooms/${encodeURIComponent(room)}/stats`, {
        cache: 'no-store',
      });
      return r.json();
    }, ROOM);
    const stats = payload.stats;
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
  await writeQaLog(OUT, findings);
  await ctx.close();
  await browser.close();
}

const pass = findings.filter((f) => f.status === 'PASS').length;
const fail = findings.filter((f) => f.status === 'FAIL').length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
