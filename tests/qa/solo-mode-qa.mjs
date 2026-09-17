// solo-mode-qa.mjs — Integration probe for the solo practice mode
// (ulw-solo-mode-split-view-transitions C4). One real Chromium +
// production build. Proves the solo contract end to end:
//   1. Home renders the dual CTA (start-game + start-solo).
//   2. A full solo game (forced X-first top-row win) issues ZERO write
//      requests (POST /api/stats/outcome, PUT/DELETE /api/stats) and
//      never navigates to /result — the ResultBanner mounts inline.
//   3. The outcome lands in localStorage 'ttt.solo.stats.v1'
//      (xWins=1) and survives a reload via SoloStatsPanel.
//   4. The local clear button empties the localStorage row instantly
//      (panel follows) while the ranked (server) ledger is untouched.
//
// Usage:
//   node tests/qa/solo-mode-qa.mjs          (needs pnpm build && pnpm start)
//
// Note: driveTopRowWin makes the FIRST player win the top row, so the
// probe reloads /solo until the status bar announces 轮到 X — that makes
// the "xWins=1" localStorage assertion deterministic instead of a
// coin flip (the same first-player-randomness rule every probe obeys).

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/solo-mode-qa";
const SOLO_KEY = "ttt.solo.stats.v1";
const findings = [];

async function step(name, fn) {
  process.stdout.write(`STEP: ${name} ... `);
  const t0 = Date.now();
  try {
    await fn();
    const dt = Date.now() - t0;
    console.log(`PASS ${dt}ms`);
    findings.push({ name, status: "PASS", ms: dt });
  } catch (e) {
    const dt = Date.now() - t0;
    console.log(`FAIL ${dt}ms -- ${e.message}`);
    findings.push({ name, status: "FAIL", ms: dt, error: e.message });
    throw e;
  }
}

// Same-origin fetch helpers (page context) — avoids the cross-origin
// preflight hang stats-race-qa documented for Playwright's request
// context on HTTPS.
async function getStats(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/stats", { cache: "no-store" });
    return r.json();
  });
}

async function deleteStats(page) {
  if (!page.url().startsWith(BASE)) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/stats", { method: "DELETE", cache: "no-store" });
    return r.status;
  });
  assert.equal(status, 200, `DELETE expected 200, got ${status}`);
}

async function readSoloStats(page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), SOLO_KEY);
  return raw === null ? null : JSON.parse(raw);
}

async function panelValues(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="solo-stats"]');
    if (!panel) return null;
    return Array.from(panel.querySelectorAll('[data-testid="stat-value"]')).map((n) =>
      n.getAttribute("data-value"),
    );
  });
}

// Reload /solo until the randomized first player is X (max 12 tries;
// P(still O-first after 12) < 0.03%). Status bar reads 轮到 X / 轮到 O.
async function openSoloAsXFirst(page) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="status-text"]');
    const text = await page.textContent('[data-testid="status-text"]');
    if (text.includes("X")) return;
    await page.reload({ waitUntil: "networkidle" });
  }
  throw new Error("could not get an X-first solo game within 12 attempts");
}

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

const { browser, ctx, page } = await launchQA();

// Write-request counter (the solo contract: zero of these during solo).
let soloWriteCount = 0;
page.on("request", (req) => {
  const url = req.url();
  const method = req.method();
  const isWrite =
    (method === "POST" && url.endsWith("/api/stats/outcome")) ||
    (method === "PUT" && url.endsWith("/api/stats")) ||
    (method === "DELETE" && url.endsWith("/api/stats"));
  if (isWrite) soloWriteCount += 1;
});

try {
  await step("01 home dual CTA (start-game + start-solo)", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-game"]');
    await page.waitForSelector('[data-testid="start-solo"]');
    // The testid sits on the <a> (Link) itself; the anchor must
    // carry href=/solo. (Previously sat on a child Button before
    // W1 added the intercept-handler refactor — selector updated.)
    const soloHref = await page.getAttribute('[data-testid="start-solo"]', "href");
    assert.equal(soloHref, "/solo", `expected start-solo link href=/solo, got ${soloHref}`);
    await Promise.all([
      page.waitForURL("**/solo", { timeout: 6000 }),
      page.click('[data-testid="start-solo"]'),
    ]);
    await page.waitForSelector('[data-testid="board"]');
    assert.ok(page.url().endsWith("/solo"), `expected to land on /solo, got ${page.url()}`);
  });

  await step("02 ranked ledger reset (baseline for isolation check)", async () => {
    await deleteStats(page);
    const stats = await getStats(page);
    assert.equal(stats.totalGames, 0, `expected clean ranked ledger, got ${stats.totalGames}`);
  });

  await step("03 solo win: zero write requests, inline banner, localStorage xWins=1", async () => {
    soloWriteCount = 0;
    await openSoloAsXFirst(page);
    await driveTopRowWin(page);

    // Outcome is announced by the header status-bar (no inline result
    // banner any more — T2 dedup removes the duplicate). The URL must
    // NOT change.
    await page.waitForFunction(
      () => /X 获胜/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? '',
      ),
      null,
      { timeout: 4000 },
    );
    const statusText = await page.textContent('[data-testid="status-text"]');
    assert.match(statusText ?? '', /X 获胜/, `expected X 获胜 in status, got "${statusText}"`);
    assert.ok(page.url().endsWith("/solo"), `solo must not navigate, got ${page.url()}`);
    // Confetti celebration still fires on win — SoloConfetti component
    // mounts the testid="confetti" span (no ResultBanner text).
    await page.waitForSelector('[data-testid="confetti"]', { timeout: 2000 });
    await page.waitForTimeout(500); // settle window for any rogue write

    assert.equal(
      soloWriteCount,
      0,
      `solo issued ${soloWriteCount} write request(s); expected 0`,
    );

    const solo = await readSoloStats(page);
    assert.ok(solo, `expected ${SOLO_KEY} to exist after a solo win`);
    assert.equal(solo.xWins, 1, `expected xWins=1 in ${SOLO_KEY}, got ${solo.xWins}`);
    assert.equal(solo.totalGames, 1, `expected totalGames=1, got ${solo.totalGames}`);
    await shoot(page, "solo-win-inline-banner.png");
  });

  await step("04 reload: SoloStatsPanel hydrates the persisted row", async () => {
    await page.reload({ waitUntil: "networkidle" });
    // SoloStatsPanel lives behind the /solo view-toggle (board↔stats).
    // Default mount is board view; switch to stats to read the persisted row.
    await page.waitForSelector('[data-testid="view-toggle"]');
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="solo-stats"]');
    await page.waitForTimeout(220); // settle ViewTransition + post-mount hydration
    // Panel re-reads in a post-mount effect; poll until hydrated.
    await page.waitForFunction(
      () => {
        const panel = document.querySelector('[data-testid="solo-stats"]');
        if (!panel) return false;
        const first = panel.querySelector('[data-testid="stat-value"]');
        return first && first.getAttribute("data-value") === "1";
      },
      null,
      { timeout: 4000 },
    );
    const values = await panelValues(page);
    assert.deepEqual(
      values,
      ["1", "1", "0", "0", "X 连胜 1"],
      `expected persisted solo row after reload, got ${JSON.stringify(values)}`,
    );
    await shoot(page, "solo-reload-panel.png");
  });

  await step("05 local clear: localStorage emptied, panel follows, no reload needed", async () => {
    await page.click('[data-testid="reset-solo-stats"]');
    await page.waitForFunction(
      (key) => window.localStorage.getItem(key) === null,
      SOLO_KEY,
      { timeout: 4000 },
    );
    const solo = await readSoloStats(page);
    assert.equal(solo, null, `expected ${SOLO_KEY} removed, got ${JSON.stringify(solo)}`);
    const values = await panelValues(page);
    assert.deepEqual(
      values,
      ["0", "0", "0", "0", "—"],
      `expected panel to show zeros after local clear, got ${JSON.stringify(values)}`,
    );
    await shoot(page, "solo-cleared.png");
  });

  await step("06 ranked ledger untouched by the solo session", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-game"]');
    const stats = await getStats(page);
    assert.equal(
      stats.totalGames,
      0,
      `ranked ledger changed during solo session: ${JSON.stringify(stats)}`,
    );
    const domTotal = await page
      .locator('[data-testid="stat-value"]')
      .first()
      .getAttribute("data-value");
    assert.equal(domTotal, "0", `expected home DOM total=0, got ${domTotal}`);
    await shoot(page, "home-after-solo.png");
  });

  // === W-A: Bug C width stability (ulw-solo-sync-rebuild W-A, V2) ===
  // Drive a fresh solo win and measure view-toggle button width at
  // each phase transition. Acceptance V2: max-min < 2px (pre-fix: 16px
  // jump when StatusBar pulse dot disappears on win).
  await step("07 view-toggle button width is stable across phase transitions", async () => {
    await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="view-toggle"]');
    const widths = [];
    // playing-empty (StatusBar pulse dot present, text = 轮到 X|O)
    widths.push({ phase: "playing", ...(await page.evaluate(() => {
      const b = document.querySelector('[data-testid="view-toggle"]');
      const r = b?.getBoundingClientRect();
      return { w: r?.width ?? 0, text: b?.textContent ?? "" };
    })) });
    // won (no pulse dot, text = X|O 获胜)
    await driveTopRowWin(page, { clickGapMs: 50 });
    await page.waitForFunction(
      () => /获胜/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? "",
      ),
      null,
      { timeout: 4000 },
    );
    widths.push({ phase: "won", ...(await page.evaluate(() => {
      const b = document.querySelector('[data-testid="view-toggle"]');
      const r = b?.getBoundingClientRect();
      return { w: r?.width ?? 0, text: b?.textContent ?? "" };
    })) });
    const min = Math.min(...widths.map((x) => x.w));
    const max = Math.max(...widths.map((x) => x.w));
    findings.push({ name: "width-stability-evidence", widths, delta: max - min });
    assert.ok(
      max - min < 2,
      `view-toggle button width delta ${(max - min).toFixed(2)}px must be < 2px (V2 acceptance); widths: ${JSON.stringify(widths)}`,
    );
  });

  // === W-A: Bug B stability (ulw-solo-sync-rebuild W-A, V1) ===
  // After the win in step 07, toggle board→stats→board and assert
  // [data-testid="confetti"] stays mounted exactly once (no
  // unmount/remount across toggles).
  await step("08 confetti span stays mounted across view toggles (Bug B)", async () => {
    const before = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="solo-stats"]');
    await page.waitForTimeout(150);
    const onStats = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="board"]');
    await page.waitForTimeout(150);
    const after = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    findings.push({ name: "confetti-mounts", before, onStats, after });
    assert.equal(before, 1, `expected confetti count 1 on board, got ${before}`);
    assert.equal(onStats, 1, `expected confetti count 1 on stats (no unmount), got ${onStats}`);
    assert.equal(after, 1, `expected confetti count 1 back on board, got ${after}`);
  });

  // === W-A: A-T4 restart button conditional (V3) + Bug C height (V2) ===
  // On the stats view, the restart button must NOT be in the DOM.
  // On the board view, it must be present. Plus card height must stay
  // stable across the two views (< 8px delta).
  await step("09 restart button conditional + card height stable (V3 + V2)", async () => {
    await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="view-toggle"]');
    // board view: restart present, height measured
    const boardRestart = await page.locator('[data-testid="restart"]').count();
    const boardH = await page.evaluate(() => {
      const main = document.querySelector("main.page-shell");
      const card = Array.from(main?.children ?? []).find((c) => c.classList.contains("rounded-lg"));
      return card?.getBoundingClientRect().height ?? 0;
    });
    // toggle to stats
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="solo-stats"]');
    await page.waitForTimeout(220);
    const statsRestart = await page.locator('[data-testid="restart"]').count();
    const statsH = await page.evaluate(() => {
      const main = document.querySelector("main.page-shell");
      const card = Array.from(main?.children ?? []).find((c) => c.classList.contains("rounded-lg"));
      return card?.getBoundingClientRect().height ?? 0;
    });
    // toggle back to board
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="board"]');
    const boardRestartAgain = await page.locator('[data-testid="restart"]').count();
    findings.push({ name: "restart-conditional", boardRestart, statsRestart, boardRestartAgain, boardH, statsH });
    assert.equal(boardRestart, 1, `expected restart button on board view, got ${boardRestart}`);
    assert.equal(statsRestart, 0, `expected NO restart button on stats view (V3 acceptance), got ${statsRestart}`);
    assert.equal(boardRestartAgain, 1, `expected restart button back on board, got ${boardRestartAgain}`);
    const heightDelta = Math.abs(boardH - statsH);
    assert.ok(
      heightDelta < 8,
      `card height delta ${heightDelta.toFixed(2)}px must be < 8px (V2 acceptance); board=${boardH} stats=${statsH}`,
    );
  });
} catch (e) {
  console.error("\nQA FAILED:", e.message);
  try {
    await page.screenshot({ path: `${EVIDENCE}/_failure.png`, fullPage: true });
  } catch {
    /* page may already be closed */
  }
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}

await writeQaLog(EVIDENCE, { base: BASE, soloKey: SOLO_KEY, findings });

const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
