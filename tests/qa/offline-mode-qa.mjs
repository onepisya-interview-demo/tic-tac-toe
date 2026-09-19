// offline-mode-qa.mjs — Integration probe for the solo practice mode
// (ulw-solo-mode-split-view-transitions C4). One real Chromium +
// production build. Proves the solo contract end to end:
//   1. Home renders the dual CTA (start-online + start-offline).
//   2. A full offline game (forced X-first top-row win) issues ZERO write
//      requests (POST /api/stats/outcome, PUT/DELETE /api/stats) and
//      never navigates to /result — ResultNavigator was never installed on
//      /offline (it only pushes /result from /online); the inline
//      WinConfetti + StatusBar carry the win announcement on /offline.
//   3. The outcome lands in localStorage 'ttt.offline.stats.v1'
//      (xWins=1) and survives a reload via OfflineStatsPanel.
//   4. The local clear button empties the localStorage row instantly
//      (panel follows) while the ranked (server) ledger is untouched.
//   5. After the win, the page auto-switches from board to stats view
//      within ≤2s (Ulw W3 result-paginated; view-toggle aria-pressed
//      flips to true, [data-testid="offline-stats"] appears). The
//      confetti mount target stays stable across the transition
//      (Bug B). The stats view exposes 「再来一局」
//      (data-testid="play-again-offline") which returns to the board
//      with phase=idle for a new game (V3 supersedes the original
//      "stats view has no restart button" assertion — the new
//      affordance replaces it, see plan .omo/plans/ulw-ux-refresh-pass
//      §3 W3).
//
// Usage:
//   node tests/qa/offline-mode-qa.mjs          (needs pnpm build && pnpm start)
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
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/offline-mode-qa";
const OFFLINE_KEY = "ttt.offline.stats.v1";
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

async function readOfflineStats(page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), OFFLINE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

async function panelValues(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="offline-stats"]');
    if (!panel) return null;
    return Array.from(panel.querySelectorAll('[data-testid="stat-value"]')).map((n) =>
      n.getAttribute("data-value"),
    );
  });
}

// Reload /solo until the randomized first player is X (max 12 tries;
// P(still O-first after 12) < 0.03%). Status bar reads 轮到 X / 轮到 O.
async function openOfflineAsXFirst(page) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="status-text"]');
    const text = await page.textContent('[data-testid="status-text"]');
    if (text.includes("X")) return;
    await page.reload({ waitUntil: "networkidle" });
  }
  throw new Error("could not get an X-first offline game within 12 attempts");
}

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

const { browser, ctx, page } = await launchQA();

// Write-request counter (the solo contract: zero of these during solo).
let offlineWriteCount = 0;
page.on("request", (req) => {
  const url = req.url();
  const method = req.method();
  const isWrite =
    (method === "POST" && url.endsWith("/api/stats/outcome")) ||
    (method === "PUT" && url.endsWith("/api/stats")) ||
    (method === "DELETE" && url.endsWith("/api/stats"));
  if (isWrite) offlineWriteCount += 1;
});

try {
  await step("01 home dual CTA (start-online + start-offline)", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-online"]');
    await page.waitForSelector('[data-testid="start-offline"]');
    // The testid sits on the <a> (Link) itself; the anchor must
    // carry href=/offline. (Previously sat on a child Button before
    // W1 added the intercept-handler refactor — selector updated.)
    const offlineHref = await page.getAttribute('[data-testid="start-offline"]', "href");
    assert.equal(offlineHref, "/offline", `expected start-offline link href=/offline, got ${offlineHref}`);
    await Promise.all([
      page.waitForURL("**/offline", { timeout: 6000 }),
      page.click('[data-testid="start-offline"]'),
    ]);
    await page.waitForSelector('[data-testid="board"]');
    assert.ok(page.url().endsWith("/offline"), `expected to land on /offline, got ${page.url()}`);
  });

  await step("02 baseline: server reachable (no per-name row expected)", async () => {
    // W1 retired /api/stats; W3 has no per-name DELETE so the
    // isolation baseline is the empty per-name table (this probe
    // uses /tmp/ulw-og2v/w3.db, recreated fresh per run). A bare
    // GET on /api/sessions returning a list-shape 200 confirms
    // the server is reachable; the rank / no-row assertion is
    // implicit in the DB being unused.
    const r = await page.evaluate(async (base) => {
      const x = await fetch(`${base}/api/rooms`, { method: "GET", cache: "no-store" });
      return x.status;
    }, BASE);
    // /api/rooms is POST-only in W3; GET returns 405 (Method Not Allowed)
    // or 404 (no GET route). Either way the server is up. Accept anything
    // in 2xx-4xx except 5xx (which would mean DB unreachable).
    assert.ok(r < 500, `expected non-5xx server response, got ${r}`);
  });

  await step("03 offline win: zero write requests, inline banner, localStorage xWins=1", async () => {
    // Seed the player name before driving the offline win — the W2
    // pure-local contract (`store.ts:makeMove` isAnonymous guard)
    // skips localStorage writes for anonymous offline play, so a
    // name is required to exercise the offline accumulation path.
    // Use localStorage (not the form) so the probe stays focused
    // on the offline-mode contract; the form POST /api/sessions
    // roundtrip is covered by home-return-qa.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.room.name.v1", "offline-mode-qa-user");
    });
    offlineWriteCount = 0;
    await openOfflineAsXFirst(page);
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
    assert.ok(page.url().endsWith("/offline"), `offline must not navigate, got ${page.url()}`);
    // Confetti celebration still fires on win — WinConfetti component
    // mounts the testid="confetti" span (no ResultBanner text).
    await page.waitForSelector('[data-testid="confetti"]', { timeout: 2000 });
    await page.waitForTimeout(500); // settle window for any rogue write

    assert.equal(
      offlineWriteCount,
      0,
      `offline issued ${offlineWriteCount} write request(s); expected 0`,
    );

    const offline = await readOfflineStats(page);
    assert.ok(offline, `expected ${OFFLINE_KEY} to exist after a offline win`);
    assert.equal(offline.xWins, 1, `expected xWins=1 in ${OFFLINE_KEY}, got ${offline.xWins}`);
    assert.equal(offline.totalGames, 1, `expected totalGames=1, got ${offline.totalGames}`);
    await shoot(page, "offline-win-inline-banner.png");
  });

  await step("04 reload: OfflineStatsPanel hydrates the persisted row", async () => {
    await page.reload({ waitUntil: "networkidle" });
    // OfflineStatsPanel lives behind the /offline view-toggle (board↔stats).
    // Default mount is board view; switch to stats to read the persisted row.
    await page.waitForSelector('[data-testid="view-toggle"]');
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="offline-stats"]');
    await page.waitForTimeout(220); // settle ViewTransition + post-mount hydration
    // Panel re-reads in a post-mount effect; poll until hydrated.
    await page.waitForFunction(
      () => {
        const panel = document.querySelector('[data-testid="offline-stats"]');
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
      `expected persisted offline row after reload, got ${JSON.stringify(values)}`,
    );
    await shoot(page, "offline-reload-panel.png");
  });

  await step("05 local clear: localStorage emptied, panel follows, no reload needed", async () => {
    await page.click('[data-testid="reset-offline-stats"]');
    await page.waitForFunction(
      (key) => window.localStorage.getItem(key) === null,
      OFFLINE_KEY,
      { timeout: 4000 },
    );
    const offline = await readOfflineStats(page);
    assert.equal(offline, null, `expected ${OFFLINE_KEY} removed, got ${JSON.stringify(offline)}`);
    const values = await panelValues(page);
    assert.deepEqual(
      values,
      ["0", "0", "0", "0", "—"],
      `expected panel to show zeros after local clear, got ${JSON.stringify(values)}`,
    );
    await shoot(page, "offline-cleared.png");
  });

  await step("06 no per-name row mutated by the offline session", async () => {
    // W1 retired the /api/stats chain. The offline session only
    // wrote to localStorage (assertion above). This step pins the
    // inverse: the server-side per-name row for the seeded name
    // either does not exist (404 → stats: null) or is unchanged
    // from the pre-session baseline. Either branch satisfies the
    // "solo did not touch server-side state" contract.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-online"]');
    const stats = await page.evaluate(async (base) => {
      const r = await fetch(`${base}/api/rooms/offline-mode-qa-user/stats`, { cache: "no-store" });
      if (r.status === 404) return null;
      return await r.json();
    }, BASE);
    if (stats !== null) {
      assert.equal(
        stats.stats.totalGames,
        0,
        `per-room row changed during offline session: ${JSON.stringify(stats)}`,
      );
    }
    await shoot(page, "home-after-offline.png");
  });


  // === W-A: Bug C width stability (ulw-solo-sync-rebuild W-A, V2) ===
  // Drive a fresh offline win and measure view-toggle button width at
  // each phase transition. Acceptance V2: max-min < 2px (pre-fix: 16px
  // jump when StatusBar pulse dot disappears on win).
  await step("07 view-toggle button width is stable across phase transitions", async () => {
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
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

  // === W3: auto-switch + Bug B stability (ulw-ux-refresh-pass §3 W3 + §5 A6/A7)
  // After the win in step 07, the page itself (app/solo/page.tsx phase
  // subscription) flips view from board→stats within ≤2s. The confetti
  // span must stay mounted exactly once across the transition (Bug B:
  // the celebration fires once per win, not once per view-toggle).
  await step("08 auto-switch board→stats after win + confetti恒 1 (Bug B + W3 A6)", async () => {
    // We're still on the board view right after step 07's win. The
    // auto-switch timer (1200ms) should have either already fired or
    // be in-flight; wait for offline-stats to appear within the A6 budget.
    await page.waitForSelector('[data-testid="offline-stats"]', { timeout: 2000 });
    // view-toggle aria-pressed must be true on the stats view (the
    // toggle button drives the aria state in GameShell).
    const pressed = await page.getAttribute('[data-testid="view-toggle"]', "aria-pressed");
    assert.equal(pressed, "true", `expected view-toggle aria-pressed=true after auto-switch, got ${pressed}`);
    // URL must NOT change — offline never navigates to /result.
    assert.ok(page.url().endsWith("/offline"), `URL must stay on /offline after auto-switch, got ${page.url()}`);
    // Confetti span still mounted exactly once on the stats view (Bug
    // B stability — no remount, no second burst).
    const onStats = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    assert.equal(onStats, 1, `expected confetti count 1 on auto-switched stats, got ${onStats}`);
    // Now manually toggle back to board to prove the confetti count
    // still stays at 1 — toggling must not retrigger the burst.
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="board"]');
    await page.waitForTimeout(150);
    const onBoard = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="confetti"]').length,
    );
    findings.push({ name: "auto-switch+confetti", onStats, onBoard });
    assert.equal(onBoard, 1, `expected confetti count 1 after manual toggle-back, got ${onBoard}`);
  });

  // === W3: A7 dual-view entry (replaces V3 statsRestart===0) + Bug C height (V2) ===
  // The board view keeps its 重新开局 button (data-testid="restart"); the
  // stats view exposes 再来一局 (data-testid="play-again-offline") which
  // restarts the game (phase=idle) AND switches back to the board view.
  // The legacy V3 assertion 「stats view has NO restart button」 is
  // SUPERSEDED — the new affordance replaces it (see plan
  // .omo/plans/ulw-ux-refresh-pass.md §3 W3 + §5 A7). The card-height
  // stability (V2) assertion still holds across the larger stats-view
  // action row (the Card itself pins minH="28rem" in app/solo/page.tsx).
  await step("09 dual-view entry + card height stable (W3 A7 + V2)", async () => {
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="view-toggle"]');
    // board view: restart present, no play-again-offline (no win yet).
    const boardRestart = await page.locator('[data-testid="restart"]').count();
    const boardPlayAgain = await page.locator('[data-testid="play-again-offline"]').count();
    const boardH = await page.evaluate(() => {
      const main = document.querySelector("main.page-shell");
      const card = Array.from(main?.children ?? []).find((c) => c.classList.contains("rounded-lg"));
      return card?.getBoundingClientRect().height ?? 0;
    });
    assert.equal(boardRestart, 1, `expected 重新开局 on board view, got ${boardRestart}`);
    assert.equal(boardPlayAgain, 0, `expected NO play-again-offline on idle board, got ${boardPlayAgain}`);
    // Drive a top-row win so the page auto-switches to stats, then
    // assert the play-again affordance exists in the result surface.
    await driveTopRowWin(page, { clickGapMs: 50 });
    await page.waitForSelector('[data-testid="offline-stats"]', { timeout: 2000 });
    await page.waitForSelector('[data-testid="play-again-offline"]', { timeout: 1500 });
    const statsRestart = await page.locator('[data-testid="restart"]').count();
    const statsPlayAgain = await page.locator('[data-testid="play-again-offline"]').count();
    const statsBackHome = await page.locator('[data-testid="back-home-offline"]').count();
    const statsH = await page.evaluate(() => {
      const main = document.querySelector("main.page-shell");
      const card = Array.from(main?.children ?? []).find((c) => c.classList.contains("rounded-lg"));
      return card?.getBoundingClientRect().height ?? 0;
    });
    assert.equal(statsRestart, 0, `expected NO 重新开局 on stats view (W3 A7), got ${statsRestart}`);
    assert.equal(statsPlayAgain, 1, `expected play-again-offline on stats view (W3 A7), got ${statsPlayAgain}`);
    assert.equal(statsBackHome, 1, `expected back-home-offline on stats view, got ${statsBackHome}`);
    // Click 再来一局 — must return to board view with a fresh game
    // (board testid present, status text is 轮到 / 准备开始).
    await page.click('[data-testid="play-again-offline"]');
    await page.waitForSelector('[data-testid="board"]', { timeout: 2000 });
    const statusText = await page.textContent('[data-testid="status-text"]');
    assert.match(
      statusText ?? "",
      /轮到|准备开始/,
      `expected fresh-game status text after play-again, got "${statusText}"`,
    );
    const boardRestartAgain = await page.locator('[data-testid="restart"]').count();
    assert.equal(boardRestartAgain, 1, `expected 重新开局 back on board after play-again, got ${boardRestartAgain}`);
    findings.push({
      name: "dual-view-entry+A7",
      boardRestart, boardPlayAgain, boardH,
      statsRestart, statsPlayAgain, statsBackHome, statsH,
      boardRestartAgain,
    });
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

await writeQaLog(EVIDENCE, { base: BASE, offlineKey: OFFLINE_KEY, findings });

const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
