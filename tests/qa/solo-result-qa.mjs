// solo-result-qa.mjs — W3 result-paginated experience probe
// (ulw-ux-refresh-pass §3 W3 + §5 A6/A7). One real Chromium + production
// build (BASE_URL=http://localhost:3101). Probes the full solo-result
// flow end to end:
//
//   A6 win → auto-switch from board→stats within ≤2s; URL stays
//      /solo; view-toggle aria-pressed=true; solo-stats visible;
//      confetti still present across the transition; 再来一局 returns
//      to board view with phase=idle (fresh game).
//   A6 draw → same auto-switch path after the 0.6s delay.
//   A7 dual-view entry — board has 重新开局; stats has play-again-solo.
//   URL invariant — never leaves /solo.
//
// Usage:
//   node tests/qa/solo-result-qa.mjs          (needs pnpm build && pnpm start on :3101)
//   env: BASE_URL (default http://localhost:3000), EVIDENCE_DIR,
//        QA_VIDEO=1 enables Playwright recordVideo (.omo/evidence/ulw/...).

import assert from 'node:assert/strict';

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { driveTopRowWin, driveDraw } from './lib/win-drive.mjs';
import { ensureDir, shootTo, writeQaLog } from './lib/evidence.mjs';

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? '.omx/evidence/solo-result-qa';
const SOLO_KEY = 'ttt.solo.stats.v1';
const findings = [];

async function step(name, fn) {
  process.stdout.write(`STEP: ${name} ... `);
  const t0 = Date.now();
  try {
    await fn();
    const dt = Date.now() - t0;
    console.log(`PASS ${dt}ms`);
    findings.push({ name, status: 'PASS', ms: dt });
  } catch (e) {
    const dt = Date.now() - t0;
    console.log(`FAIL ${dt}ms -- ${e.message}`);
    findings.push({ name, status: 'FAIL', ms: dt, error: e.message });
    throw e;
  }
}

async function getStats(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/stats', { cache: 'no-store' });
    return r.json();
  });
}

async function deleteStats(page) {
  if (!page.url().startsWith(BASE)) {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  }
  const status = await page.evaluate(async () => {
    const r = await fetch('/api/stats', { method: 'DELETE', cache: 'no-store' });
    return r.status;
  });
  assert.equal(status, 200, `DELETE expected 200, got ${status}`);
}

async function readSoloStats(page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), SOLO_KEY);
  return raw === null ? null : JSON.parse(raw);
}

async function reloadSoloUntilXFirst(page, maxAttempts = 12) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(`${BASE}/solo`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="status-text"]');
    const text = await page.textContent('[data-testid="status-text"]');
    if (text.includes('X')) return;
    await page.reload({ waitUntil: 'networkidle' });
  }
  throw new Error('could not get an X-first solo game within 12 attempts');
}

async function clearSoloLocal(page) {
  await page.evaluate((key) => window.localStorage.removeItem(key), SOLO_KEY);
}

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

const { browser, ctx, page } = await launchQA({ probeName: 'solo-result-qa' });

// Write-request counter (the W2 pure-local contract: zero during solo).
let soloWriteCount = 0;
page.on('request', (req) => {
  const url = req.url();
  const method = req.method();
  const isWrite =
    (method === 'POST' && url.endsWith('/api/stats/outcome')) ||
    (method === 'PUT' && url.endsWith('/api/stats')) ||
    (method === 'DELETE' && url.endsWith('/api/stats')) ||
    (method === 'POST' && url.endsWith('/api/sessions')) ||
    (method === 'POST' && /\/api\/players\/[^/]+\/stats\/outcomes/.test(url)) ||
    (method === 'POST' && /\/api\/players\/[^/]+\/stats\/merge/.test(url));
  if (isWrite) soloWriteCount += 1;
});

try {
  await step('00 baseline: ranked ledger reset + localStorage cleared', async () => {
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await clearSoloLocal(page);
    await page.reload({ waitUntil: 'networkidle' });
    const ranked = await getStats(page);
    assert.equal(ranked.totalGames, 0, `expected clean ranked ledger, got ${ranked.totalGames}`);
  });

  // ────────────────────────────────────────────────────────────────
  // A6 win → auto-switch + confetti恒 1 + URL=/solo invariant
  // ────────────────────────────────────────────────────────────────
  await step('01 A6 win: auto-switch to stats view within ≤2s', async () => {
    soloWriteCount = 0;
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    // Wait for auto-switch (1.2s timer in app/solo/page.tsx). A6 budget
    // is 2s; we poll on solo-stats testid which only exists on the
    // stats view (board view has [data-testid="board"]).
    const t0 = Date.now();
    await page.waitForSelector('[data-testid="solo-stats"]', { timeout: 2000 });
    const dt = Date.now() - t0;
    findings.push({ name: 'auto-switch-latency-ms', ms: dt });
    // URL invariant: must stay on /solo (A6 — solo never navigates to /result).
    assert.ok(page.url().endsWith('/solo'), `URL must stay /solo after auto-switch, got ${page.url()}`);
    // view-toggle aria-pressed must be true (stats view active).
    const pressed = await page.getAttribute('[data-testid="view-toggle"]', 'aria-pressed');
    assert.equal(pressed, 'true', `expected view-toggle aria-pressed=true, got ${pressed}`);
    // Confetti mount target stable (Bug B + W3): exactly 1 span on the
    // stats view, no second burst fired.
    const confettiCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    assert.equal(confettiCount, 1, `expected confetti count 1 on stats, got ${confettiCount}`);
    // Result actions exposed inside the panel (A7).
    await page.waitForSelector('[data-testid="play-again-solo"]', { timeout: 1000 });
    await page.waitForSelector('[data-testid="back-home-solo"]', { timeout: 1000 });
    // Zero write requests during the win (W2 pure-local contract).
    assert.equal(soloWriteCount, 0, `expected zero write requests during solo win, got ${soloWriteCount}`);
    // localStorage accumulated correctly.
    const solo = await readSoloStats(page);
    assert.ok(solo, `expected ${SOLO_KEY} to exist after solo win`);
    assert.equal(solo.xWins, 1, `expected xWins=1, got ${solo?.xWins}`);
    // ViewTransition crossfade (~260ms) settle so the screenshot
    // captures the stats view fully rendered, not the mid-fade board.
    await page.waitForTimeout(400);
    await shoot(page, '01-auto-switch-stats.png');
  });

  // ────────────────────────────────────────────────────────────────
  // A6 click play-again → board view phase=idle (fresh game)
  // ────────────────────────────────────────────────────────────────
  await step('02 A6 play-again: returns to board view with phase=idle', async () => {
    await page.click('[data-testid="play-again-solo"]');
    await page.waitForSelector('[data-testid="board"]', { timeout: 2000 });
    // view-toggle aria-pressed must flip back to false (board active).
    const pressed = await page.getAttribute('[data-testid="view-toggle"]', 'aria-pressed');
    assert.equal(pressed, 'false', `expected view-toggle aria-pressed=false, got ${pressed}`);
    // Status text should be a fresh-game prompt (轮到 / 准备开始).
    const statusText = await page.textContent('[data-testid="status-text"]');
    assert.match(
      statusText ?? '',
      /轮到|准备开始/,
      `expected fresh-game status text, got "${statusText}"`,
    );
    // play-again-solo disappears (only renders when phase triggers
    // auto-switch); restart button reappears on board view.
    const playAgain = await page.locator('[data-testid="play-again-solo"]').count();
    const restart = await page.locator('[data-testid="restart"]').count();
    assert.equal(playAgain, 0, `expected NO play-again on idle board, got ${playAgain}`);
    assert.equal(restart, 1, `expected 重新开局 back on board, got ${restart}`);
    // URL still /solo.
    assert.ok(page.url().endsWith('/solo'), `URL must stay /solo after play-again, got ${page.url()}`);
    await page.waitForTimeout(400); // settle crossfade into board view
    await shoot(page, '02-board-after-play-again.png');
  });

  // ────────────────────────────────────────────────────────────────
  // A6 reproducibility — drive a SECOND win and assert auto-switch
  // works again (the timer must not get stuck after restart).
  // ────────────────────────────────────────────────────────────────
  await step('03 A6 repeatability: second win auto-switches again', async () => {
    soloWriteCount = 0;
    // Force X-first so the assertion on xWins is deterministic. After
    // the first game's random first-player draw we already know X won;
    // reloadSoloUntilXFirst collapses the second game's randomization
    // to the same X-first state, so driveTopRowWin deterministically
    // adds another X win to localStorage.
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForSelector('[data-testid="solo-stats"]', { timeout: 2000 });
    assert.ok(page.url().endsWith('/solo'), `URL must stay /solo after second win, got ${page.url()}`);
    const confettiCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    // Confetti still mounted exactly once (Bug B: hoist target stable;
    // the celebratedRef reset on phase→idle means the new win fires a
    // fresh burst but the testid span is still singular because we are
    // on the stats view, same DOM tree as before).
    assert.equal(confettiCount, 1, `expected confetti count 1 on second win, got ${confettiCount}`);
    assert.equal(soloWriteCount, 0, `expected zero writes during second solo win, got ${soloWriteCount}`);
    const solo = await readSoloStats(page);
    assert.equal(solo?.xWins, 2, `expected xWins=2 after second win, got ${solo?.xWins}`);
    await page.waitForTimeout(400); // settle crossfade into stats view
    await shoot(page, '03-second-win-stats.png');
  });

  // ────────────────────────────────────────────────────────────────
  // A6 draw path — drive a draw (X 0,1,2 / O 3,4,5 / X 6 / O 7 / X 8
  // is one of many draw sequences; driveDraw from lib/win-drive.mjs
  // picks a known one). After draw, auto-switch must fire within
  // DRAW_AUTO_SWITCH_MS + slack (≤ 1.5s).
  // ────────────────────────────────────────────────────────────────
  await step('04 A6 draw: auto-switch to stats view after shake settle', async () => {
    // Restart back to board first.
    await page.click('[data-testid="play-again-solo"]');
    await page.waitForSelector('[data-testid="board"]', { timeout: 2000 });
    // Drive a draw — driveDraw is a known draw sequence that plays all
    // 9 cells without producing a win (each row/col/diag stays split).
    await driveDraw(page);
    await page.waitForFunction(
      () => /平局/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? '',
      ),
      null,
      { timeout: 4000 },
    );
    // Auto-switch after DRAW_AUTO_SWITCH_MS (600ms). Budget 1.5s.
    const t0 = Date.now();
    await page.waitForSelector('[data-testid="solo-stats"]', { timeout: 1500 });
    const dt = Date.now() - t0;
    findings.push({ name: 'draw-auto-switch-latency-ms', ms: dt });
    assert.ok(page.url().endsWith('/solo'), `URL must stay /solo after draw, got ${page.url()}`);
    // Confetti must NOT be present on a draw — burst is win-only.
    const confettiCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    assert.equal(confettiCount, 0, `expected NO confetti on draw, got ${confettiCount}`);
    // Stats view still exposes the play-again affordance.
    await page.waitForSelector('[data-testid="play-again-solo"]', { timeout: 1000 });
    // localStorage records the draw.
    const solo = await readSoloStats(page);
    assert.ok(solo, `expected ${SOLO_KEY} to exist after draw`);
    assert.ok((solo?.draws ?? 0) >= 1, `expected draws>=1, got ${solo?.draws}`);
    await page.waitForTimeout(400); // settle crossfade into stats view
    await shoot(page, '04-draw-stats.png');
  });

  // ────────────────────────────────────────────────────────────────
  // A6 ranked ledger untouched after the whole solo session (W2).
  // ────────────────────────────────────────────────────────────────
  await step('05 ranked ledger untouched by solo session (W2 contract)', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="start-online"]');
    const stats = await getStats(page);
    assert.equal(stats.totalGames, 0, `ranked ledger changed during solo: ${JSON.stringify(stats)}`);
  });

  // ────────────────────────────────────────────────────────────────
  // Cleanup localStorage before exit so the next probe starts clean.
  // ────────────────────────────────────────────────────────────────
  await step('06 cleanup: remove solo localStorage key', async () => {
    await clearSoloLocal(page);
    const solo = await readSoloStats(page);
    assert.equal(solo, null, `expected ${SOLO_KEY} cleared, got ${JSON.stringify(solo)}`);
  });
} catch (e) {
  console.error('\nQA FAILED:', e.message);
  try {
    await page.screenshot({ path: `${EVIDENCE}/_failure.png`, fullPage: true });
  } catch {
    /* page may already closed */
  }
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}

await writeQaLog(EVIDENCE, { base: BASE, soloKey: SOLO_KEY, findings });

const pass = findings.filter((f) => f.status === 'PASS').length;
const fail = findings.filter((f) => f.status === 'FAIL').length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
