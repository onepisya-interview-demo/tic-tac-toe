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

  // Verify the server now has xWins=1 for NAME_C.
  const before = await getServerStats(pageB, NAME_C);
  assert.equal(before.body.stats.xWins, 1);

  // Toggle to the stats view so the panel (and its sync button) mounts.
  // Without this, the sync button is unmounted and clicking it is a
  // no-op — the probe would falsely report a missing sync affordance.
  await pageB.click('[data-testid="view-toggle"]');
  await pageB.waitForSelector('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(500);

  // Click the manual sync button — it should issue at least one
  // request (GET to refresh, or POST if pending).
  apiCalls.length = 0;
  await pageB.click('[data-testid="solo-sync"]');
  await pageB.waitForTimeout(500);

  const calls = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.ok(
    calls.length >= 1,
    `sync button should hit /api/solo-stats at least once, saw ${calls.length}`,
  );

  // After clicking sync, the server row must still be xWins=1 (the
  // button is a no-op when nothing is pending — defensive contract:
  // sync must not double-count a settled game).
  const after = await getServerStats(pageB, NAME_C);
  assert.equal(after.body.stats.xWins, 1, `sync must not double-count: xWins ${before.body.stats.xWins} → ${after.body.stats.xWins}`);

  await shoot(pageB, "05-after-manual-sync.png");
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
