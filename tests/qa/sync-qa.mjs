// sync-qa.mjs — End-to-end probe for the W-SYNC wave-2 player-name
// network sync vertical slice (ulw-ux-mobile-sync plan §A5).
// One real Chromium + production build. Proves the contract end-to-end:
//
//   1. With NO player name, a full solo game issues ZERO writes to
//      /api/solo-stats (GET / POST). Confirms the "未命名零网络" A5
//      acceptance rule — solo continues to be a purely local experience
//      until the user opts in.
//
//   2. After setting a player name on the home page, a full solo game
//      issues a GET /api/solo-stats (mount hydration) AND a POST
//      /api/solo-stats (game end), with the server's authoritative
//      stats row reflecting the new game (xWins=1 or oWins=1 or
//      draws=1 depending on the settled outcome).
//
//   3. A second browser context ("different device") with the same
//      name hydrates its solo panel from the server's row on mount,
//      proving the cross-device "同名同历史" contract.
//
//   4. The manual "sync" button (testid solo-sync) re-pulls the server
//      state when invoked, refreshing the panel without a hard nav.
//
// Usage:
//   node tests/qa/sync-qa.mjs          (needs pnpm build && pnpm start)

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/sync-qa";
const PLAYER_KEY = "ttt.player.name.v1";
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
async function getServerStats(page, name) {
  return page.evaluate(async (n) => {
    const r = await fetch(`/api/solo-stats?name=${encodeURIComponent(n)}`, {
      cache: "no-store",
    });
    return { status: r.status, body: await r.json() };
  }, name);
}

async function deleteServerStats(page) {
  // No DELETE endpoint for solo-stats; cleanup happens at the row level
  // when the test ends. The next-test run uses a fresh player name.
}

async function seedPlayerName(page, name) {
  // Clear any previous state first to make the test deterministic.
  await page.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: PLAYER_KEY, value: name },
  );
}

async function readPlayerName(page) {
  return page.evaluate((key) => window.localStorage.getItem(key), PLAYER_KEY);
}

async function panelValues(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="solo-stats"]');
    if (!panel) return null;
    return Array.from(panel.querySelectorAll('[data-testid="stat-value"]')).map(
      (n) => n.getAttribute("data-value"),
    );
  });
}

async function panelHeading(page) {
  return page.evaluate(() => {
    const h = document.querySelector('[data-testid="solo-stats-heading"]');
    return h ? h.textContent : null;
  });
}

async function reloadSoloUntilXFirst(page, maxAttempts = 12) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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

// Per-step request log. Keyed by URL substring so we can assert on
// the per-step call inventory without leaking bodies into the log.
const apiCalls = [];
function recordApiCall(url, method) {
  if (url.includes("/api/solo-stats")) {
    apiCalls.push({ url, method, t: Date.now() });
  }
}

process.on("unhandledRejection", (reason) => {
  console.error(
    "\nUNHANDLED REJECTION:",
    reason && reason.stack ? reason.stack : reason,
  );
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error(
    "\nUNCAUGHT EXCEPTION:",
    err && err.stack ? err.stack : err,
  );
  process.exit(1);
});

const { browser, ctx: ctxA, page: pageA } = await launchQA();

// Track /api/solo-stats calls on this context.
pageA.on("request", (req) => recordApiCall(req.url(), req.method()));

// ─────────────────────────────────────────────────────────────────────
// STEP 1: Unnamed solo issues ZERO /api/solo-stats calls.
// ─────────────────────────────────────────────────────────────────────
await step("01-unnamed-solo-zero-network", async () => {
  // Reset player name to null and ensure fresh server row for an
  // arbitrary name (we don't even use a name — the localStorage key
  // is absent).
  await pageA.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pageA.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
  await pageA.evaluate(() => window.localStorage.removeItem("ttt.solo.stats.v1"));
  apiCalls.length = 0;

  await reloadSoloUntilXFirst(pageA);
  await driveTopRowWin(pageA);
  // Wait for the post-game panel re-render.
  await pageA.waitForFunction(() => {
    const text = document.querySelector('[data-testid="status-text"]')?.textContent ?? "";
    return text.includes("X 获胜") || text.includes("平局");
  });
  await pageA.waitForTimeout(220);

  // Assert NO /api/solo-stats requests happened.
  const soloApiCalls = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.equal(
    soloApiCalls.length,
    0,
    `unnamed solo must not call /api/solo-stats; saw ${soloApiCalls.length}: ${JSON.stringify(soloApiCalls)}`,
  );

  await shoot(pageA, "01-unnamed-after-win.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 2: Set a player name on the home page.
// ─────────────────────────────────────────────────────────────────────
const NAME_A = "syncprobe-A";
await step("02-home-save-player-name", async () => {
  await pageA.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pageA.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
  await pageA.reload({ waitUntil: "networkidle" });

  // The form is mounted under [data-testid="player-name-section"].
  await pageA.waitForSelector('[data-testid="player-name-input"]');
  await pageA.fill('[data-testid="player-name-input"]', NAME_A);
  await pageA.click('[data-testid="player-name-save"]');

  // Verify localStorage now has the name.
  const stored = await readPlayerName(pageA);
  assert.equal(stored, NAME_A, `expected localStorage to hold ${NAME_A}, got ${stored}`);

  // Verify the "current name" caption rendered.
  await pageA.waitForSelector('[data-testid="player-name-current"]');
  const caption = await pageA.textContent('[data-testid="player-name-current"]');
  assert.ok(
    caption && caption.includes(NAME_A),
    `caption should include ${NAME_A}, got ${caption}`,
  );

  await shoot(pageA, "02-home-with-name.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 2.5 (B-T1): save a name and within 1s the server row exists
// (idempotent PUT /api/solo-stats — ulw-solo-sync-rebuild.md V5).
// Step 02 only proved localStorage + caption; this step closes the
// “save name → server row exists immediately” loop the wave-1 probe
// missed (diag.md §关键差异 1).
// ─────────────────────────────────────────────────────────────────────
await step("02.5-save-only-immediate-server-row", async () => {
  const NAME_SAVE_ONLY = "syncprobe-saveonly";
  await pageA.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pageA.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
  await pageA.reload({ waitUntil: "networkidle" });
  await pageA.waitForSelector('[data-testid="player-name-input"]');
  await pageA.fill('[data-testid="player-name-input"]', NAME_SAVE_ONLY);
  await pageA.click('[data-testid="player-name-save"]');

  // Within 1s the PUT round-trip should have landed; the server
  // should now return a non-null row (all zeros).
  const before = Date.now();
  let lastError = null;
  let body = null;
  while (Date.now() - before < 1000) {
    try {
      const r = await getServerStats(pageA, NAME_SAVE_ONLY);
      if (r.status === 200 && r.body.stats !== null) {
        body = r.body;
        break;
      }
      lastError = `status=${r.status} stats=${JSON.stringify(r.body.stats)}`;
    } catch (e) {
      lastError = e.message;
    }
    await pageA.waitForTimeout(60);
  }
  assert.ok(
    body !== null,
    `server row for ${NAME_SAVE_ONLY} never appeared within 1s: ${lastError}`,
  );
  assert.equal(body.stats.totalGames, 0);
  assert.equal(body.stats.xWins, 0);
  assert.equal(body.stats.oWins, 0);
  assert.equal(body.stats.draws, 0);
  assert.equal(body.stats.currentStreak, 0);

  await shoot(pageA, "02.5-save-only-server-row.png");
  // Restore NAME_A in localStorage so subsequent steps (03/05) keep
  // their existing name assumption. Step 02.5 is a sibling that only
  // proves the save-only path; it must not perturb later steps.
  await pageA.evaluate((key) => window.localStorage.setItem(key, "syncprobe-A"), PLAYER_KEY);
});

// ─────────────────────────────────────────────────────────────────────
// STEP 3: Named solo → POST on settle (auto, from store) + GET on
// panel mount, server row updates.
// ─────────────────────────────────────────────────────────────────────
await step("03-named-solo-game-roundtrip", async () => {
  apiCalls.length = 0;
  await reloadSoloUntilXFirst(pageA);
  await driveTopRowWin(pageA);
  await pageA.waitForFunction(() => {
    const text = document.querySelector('[data-testid="status-text"]')?.textContent ?? "";
    return text.includes("X 获胜") || text.includes("平局");
  });
  // Wait for the store's auto-POST to settle.
  await pageA.waitForTimeout(800);

  // The store's solo branch fires the POST regardless of which view
  // the user is on. We should see at least one POST here, even though
  // the panel isn't mounted yet.
  const posts = apiCalls.filter((c) => c.method === "POST" && c.url.includes("/api/solo-stats"));
  assert.ok(posts.length >= 1, `expected at least 1 POST /api/solo-stats, saw ${posts.length}`);

  // Verify the server now holds the result of this game. The probe
  // drives X-first, so the server's xWins should be 1.
  const serverResp = await getServerStats(pageA, NAME_A);
  assert.equal(serverResp.status, 200, `GET server returned ${serverResp.status}`);
  assert.equal(serverResp.body.stats.xWins, 1, `expected server xWins=1, got ${serverResp.body.stats.xWins}`);
  assert.equal(serverResp.body.stats.totalGames, 1, `expected server totalGames=1, got ${serverResp.body.stats.totalGames}`);

  // Toggle to stats view so the panel mounts. The mount effect fires
  // a GET against /api/solo-stats to pull the canonical row.
  apiCalls.length = 0;
  await pageA.click('[data-testid="view-toggle"]');
  await pageA.waitForSelector('[data-testid="solo-stats"]');
  await pageA.waitForTimeout(500);

  const gets = apiCalls.filter((c) => c.method === "GET" && c.url.includes("/api/solo-stats"));
  assert.ok(gets.length >= 1, `expected at least 1 GET /api/solo-stats on panel mount, saw ${gets.length}`);

  // The panel should show server values.
  const values = await panelValues(pageA);
  assert.ok(values, "panel should have stat values");
  // First value is totalGames, second is xWins.
  assert.equal(values[0], "1", `expected panel totalGames=1, got ${values[0]}`);
  assert.equal(values[1], "1", `expected panel xWins=1, got ${values[1]}`);

  // Heading should include the player name.
  const heading = await panelHeading(pageA);
  assert.ok(
    heading && heading.includes(NAME_A),
    `heading should include ${NAME_A}, got ${heading}`,
  );

  await shoot(pageA, "03-named-after-win.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 4: New browser context (different device) hydrates from server.
// ─────────────────────────────────────────────────────────────────────
const { ctx: ctxB, page: pageB } = await launchQA();
pageB.on("request", (req) => recordApiCall(req.url(), req.method()));

await step("04-different-device-pulls-same-row", async () => {
  // Seed the player name on this context's localStorage BEFORE
  // navigating to /solo, so the panel mounts in "named" mode and
  // pulls the canonical row from the server.
  await pageB.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await seedPlayerName(pageB, NAME_A);

  apiCalls.length = 0;
  await pageB.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
  // /solo default view is the board; click view-toggle to mount the
  // panel which is the only surface that GETs /api/solo-stats.
  await pageB.click('[data-testid="view-toggle"]');
  await pageB.waitForSelector('[data-testid="solo-stats"]');
  // Allow the mount-time GET to settle.
  await pageB.waitForTimeout(500);

  // The mount must have issued a GET against /api/solo-stats.
  const gets = apiCalls.filter((c) => c.method === "GET" && c.url.includes("/api/solo-stats"));
  assert.ok(gets.length >= 1, `expected mount GET, saw ${gets.length}`);

  // The panel should render the same values that the server holds.
  await pageB.waitForTimeout(220);
  const values = await panelValues(pageB);
  assert.ok(values, "panel should have stat values");
  assert.equal(values[0], "1", `expected panel totalGames=1 on second device, got ${values[0]}`);
  assert.equal(values[1], "1", `expected panel xWins=1 on second device, got ${values[1]}`);

  const heading = await panelHeading(pageB);
  assert.ok(
    heading && heading.includes(NAME_A),
    `heading should include ${NAME_A}, got ${heading}`,
  );

  // The localStorage on this context should NOT have been auto-seeded
  // (server is the source of truth); the ttt.solo.stats.v1 key is the
  // legacy localStorage key and must remain absent after the named
  // hydration.
  const localSolo = await pageB.evaluate(() =>
    window.localStorage.getItem("ttt.solo.stats.v1"),
  );
  assert.equal(localSolo, null, `expected no solo localStorage after named hydration, got ${localSolo}`);

  await shoot(pageB, "04-different-device.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 04b (B-T1): save on device A without playing, then open
// /solo on device B with the same name → server row should be visible
// immediately (zero games but the name row exists). Mirrors the
// user-visible “保存即可跨设备看到战绩” contract that wave-1’s
// step04 missed because step04 seeded the row by playing first.
// ─────────────────────────────────────────────────────────────────────
await step("04b-save-only-cross-device-pull", async () => {
  const NAME_CROSS = "syncprobe-cross";
  const { ctx: ctxC, page: pageC } = await launchQA();
  try {
    // Device A: save the name only (no games).
    await pageA.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await pageA.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
    await pageA.reload({ waitUntil: "networkidle" });
    await pageA.waitForSelector('[data-testid="player-name-input"]');
    await pageA.fill('[data-testid="player-name-input"]', NAME_CROSS);
    await pageA.click('[data-testid="player-name-save"]');
    // Wait long enough for the fire-and-forget PUT to land.
    await pageA.waitForTimeout(800);

    // Device C: seed the same name via localStorage (simulates the
    // “user opens the app on a new device with the same identity”).
    await pageC.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await seedPlayerName(pageC, NAME_CROSS);
    await pageC.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    await pageC.click('[data-testid="view-toggle"]');
    await pageC.waitForSelector('[data-testid="solo-stats"]');
    await pageC.waitForTimeout(500);

    // Heading should include the name, panel should show zero stats
    // (because device A never played — the row exists but is empty).
    const heading = await panelHeading(pageC);
    assert.ok(
      heading && heading.includes(NAME_CROSS),
      `heading should include ${NAME_CROSS}, got ${heading}`,
    );
    const values = await panelValues(pageC);
    assert.ok(values, "panel should have stat values");
    assert.equal(values[0], "0", `expected panel totalGames=0 on cross-device, got ${values[0]}`);
    assert.equal(values[1], "0", `expected panel xWins=0 on cross-device, got ${values[1]}`);

    await shoot(pageC, "04b-cross-device-save-only.png");
  } finally {
    await ctxC.close();
  }
});

// ─────────────────────────────────────────────────────────────────────
// STEP 5: Manual sync button works even after a game settles.
// ─────────────────────────────────────────────────────────────────────
const NAME_C = "syncprobe-C";
await step("05-manual-sync-button", async () => {
  await pageB.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await seedPlayerName(pageB, NAME_C);

  apiCalls.length = 0;
  await reloadSoloUntilXFirst(pageB);
  await driveTopRowWin(pageB);
  await pageB.waitForFunction(() => {
    const text = document.querySelector('[data-testid="status-text"]')?.textContent ?? "";
    return text.includes("X 获胜") || text.includes("平局");
  });
  await pageB.waitForTimeout(800);

  // Verify the server now has xWins=1 for NAME_C (auto-POST landed).
  const before = await getServerStats(pageB, NAME_C);
  assert.equal(before.body.stats.xWins, 1);

  // Toggle to the stats view so the panel (and its sync button) mounts.
  await pageB.click('[data-testid="view-toggle"]');
  await pageB.waitForSelector('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(500);

  // (a) After a successful auto-POST, local matches server, so the
  // sync button must DEGRADE to a pure GET refresh (wave-2 §A5):
  // no dialog opens, no POST fires.
  apiCalls.length = 0;
  await pageB.click('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(300);
  const dialogAfterPureGet = await pageB.evaluate(
    'document.querySelector(\'[data-testid="sync-confirm-dialog"]\').hasAttribute("open")'
  );
  assert.equal(dialogAfterPureGet, false, "sync button must NOT open the dialog when nothing is pending");
  const callsAfterPureGet = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.equal(
    callsAfterPureGet.length,
    1,
    `sync button (no-pending) must fire exactly 1 GET; saw ${callsAfterPureGet.length}: ${JSON.stringify(callsAfterPureGet)}`,
  );
  assert.equal(callsAfterPureGet[0].method, "GET", "no-pending sync must be a GET, not POST");

  // Server row still xWins=1 (no double-count from a refresh).
  const afterPureGet = await getServerStats(pageB, NAME_C);
  assert.equal(afterPureGet.body.stats.xWins, 1, `refresh must not double-count: xWins ${before.body.stats.xWins} → ${afterPureGet.body.stats.xWins}`);
  await shoot(pageB, "05a-sync-no-pending-get-only.png");

  // (b) Simulate "local ahead of server" by writing extra local stats
  // while keeping the server sentinel at 1. The pendingSyncCount()
  // diff then becomes 2-1=1 → clicking sync opens the dialog.
  await pageB.evaluate(() => {
    window.localStorage.setItem(
      "ttt.solo.stats.v1",
      JSON.stringify({
        totalGames: 2,
        xWins: 2,
        oWins: 0,
        draws: 0,
        currentStreak: 2,
      }),
    );
  });
  // Re-render the panel by toggling view → board → back.
  await pageB.click('[data-testid="view-toggle"]');
  await pageB.waitForTimeout(150);
  await pageB.click('[data-testid="view-toggle"]');
  await pageB.waitForSelector('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(300);

  apiCalls.length = 0;
  await pageB.click('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(300);
  const dialogAfterPending = await pageB.evaluate(
    'document.querySelector(\'[data-testid="sync-confirm-dialog"]\').hasAttribute("open")'
  );
  assert.equal(dialogAfterPending, true, "sync button must open the dialog when local has unsynced games");
  const descText = await pageB.textContent('[data-testid="sync-confirm-desc"]');
  assert.ok(descText && descText.includes("将上传本机 1 局"), `dialog desc should expose 「本机 1 局」; got ${descText}`);
  const callsBeforeConfirm = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.equal(
    callsBeforeConfirm.length,
    0,
    `opening the dialog must not fire network calls; saw ${callsBeforeConfirm.length}: ${JSON.stringify(callsBeforeConfirm)}`,
  );
  await shoot(pageB, "05b-sync-dialog-open.png");

  // (c) 保留本地 = zero network writes.
  apiCalls.length = 0;
  await pageB.click('[data-testid="sync-confirm-reject"]');
  await pageB.waitForTimeout(300);
  const callsAfterReject = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.equal(
    callsAfterReject.length,
    0,
    `保留本地 must be zero network writes; saw ${callsAfterReject.length}: ${JSON.stringify(callsAfterReject)}`,
  );
  const afterReject = await getServerStats(pageB, NAME_C);
  assert.equal(
    afterReject.body.stats.xWins,
    1,
    `保留本地 must leave server row unchanged; xWins ${before.body.stats.xWins} → ${afterReject.body.stats.xWins}`,
  );
  // Local still has the 2-game row (preserve).
  const localAfterReject = await pageB.evaluate(() => {
    const raw = window.localStorage.getItem("ttt.solo.stats.v1");
    return raw ? JSON.parse(raw) : null;
  });
  assert.equal(localAfterReject && localAfterReject.totalGames, 2, "保留本地 must preserve local stats");
  await shoot(pageB, "05c-after-reject.png");

  // (d) 合并并清空 = POST /sync + local cleared + server still 1 (no
  // double-count of the auto-POSTed game; only the +1 simulated local
  // adds to the server row → xWins goes 1→2 — that's the merge math).
  await pageB.click('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(300);
  apiCalls.length = 0;
  await pageB.click('[data-testid="sync-confirm-confirm"]');
  await pageB.waitForTimeout(800);
  const callsAfterConfirm = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.ok(
    callsAfterConfirm.length >= 1,
    `合并并清空 must fire network calls; saw ${callsAfterConfirm.length}`,
  );
  const postSync = callsAfterConfirm.find((c) => c.method === "POST" && c.url.includes("/sync"));
  assert.ok(postSync, `合并并清空 must fire POST /sync; got ${JSON.stringify(callsAfterConfirm)}`);

  // Merge math: server(1,1,0,0,1) + client(2,2,0,0,2) = (3,3,0,0,3).
  const afterMerge = await getServerStats(pageB, NAME_C);
  assert.equal(afterMerge.body.stats.xWins, 3, `merge per-field math: xWins → 3, got ${afterMerge.body.stats.xWins}`);
  assert.equal(afterMerge.body.stats.totalGames, 3, `merge per-field math: totalGames → 3, got ${afterMerge.body.stats.totalGames}`);

  // Local cleared (防重复).
  const localAfter = await pageB.evaluate(() =>
    window.localStorage.getItem("ttt.solo.stats.v1"),
  );
  assert.equal(
    localAfter,
    null,
    `local solo stats must be cleared after successful merge; got ${localAfter}`,
  );

  // Merge-note disclosure (rux 决议 8) appears on the panel.
  const noteText = await pageB.textContent('[data-testid="solo-stats-merge-note"]').catch(() => null);
  assert.ok(noteText && noteText.includes("已合并"), `merge note should disclose the breakdown; got ${noteText}`);
  await shoot(pageB, "05d-after-merge.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 6: Cleanup — close both contexts.
// ─────────────────────────────────────────────────────────────────────
await step("99-cleanup", async () => {
  await ctxA.close();
  await ctxB.close();
});

// ─────────────────────────────────────────────────────────────────────
// QA SUMMARY
// ─────────────────────────────────────────────────────────────────────
await writeQaLog(EVIDENCE, {
  test: "sync-qa",
  base: BASE,
  findings,
  apiCallsSummary: apiCalls.length,
});
console.log(`\nQA SUMMARY: ${findings.filter((f) => f.status === "PASS").length}/${findings.length} PASS`);

await browser.close();
