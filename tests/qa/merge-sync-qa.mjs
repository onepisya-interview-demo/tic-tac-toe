// merge-sync-qa.mjs — focused browser probe for the W-SYNC wave-2
// cross-device merge vertical slice (ulw-solo-sync-rebuild.md B-T6).
// Complements sync-qa.mjs with scenarios that exercise the merge
// API + dialog flow end-to-end and pin the B-T4 contract:
//
//   1. The merge math: local (3,2,1,0) + online (2,1,0,1) → (5,3,1,1)
//      when the same name exists on both sides.
//
//   2. After successful merge the local row is cleared (防重复) so a
//      repeat 同步 click is a no-op (no second POST /sync).
//
//   3. 「保留本地」 preserves the local row verbatim and fires ZERO
//      /api/solo-stats writes (panel state unchanged).
//
//   4. The server rejects invalid inputs with 422 (control character
//      in name, NaN/Infinity in stats).
//
// Usage:
//   node tests/qa/merge-sync-qa.mjs   (needs pnpm build && pnpm start)
//   env: BASE_URL (default http://localhost:3000),
//        DATABASE_URL (file:sqlite per-test), EVIDENCE_DIR.

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/merge-sync-qa";
const PLAYER_KEY = "ttt.player.name.v1";
const LOCAL_SOLO_KEY = "ttt.solo.stats.v1";
const SYNCED_KEY = "ttt.solo.server.synced.v1";
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

async function getServerStats(page, name) {
  return page.evaluate(async (n) => {
    const r = await fetch(`/api/solo-stats?name=${encodeURIComponent(n)}`, {
      cache: "no-store",
    });
    return { status: r.status, body: await r.json() };
  }, name);
}

async function postSync(page, name, stats) {
  return page.evaluate(async ({ n, s }) => {
    const r = await fetch("/api/solo-stats/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: n, stats: s }),
    });
    return { status: r.status, body: await r.json() };
  }, { n: name, s: stats });
}

async function seedSoloStats(page, row) {
  await page.evaluate(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: LOCAL_SOLO_KEY, value: JSON.stringify(row) });
}

async function panelHeading(page) {
  return page.evaluate(() => {
    const h = document.querySelector('[data-testid="solo-stats-heading"]');
    return h ? h.textContent : null;
  });
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

process.on("unhandledRejection", (reason) => {
  console.error("\nUNHANDLED REJECTION:", reason?.stack ?? reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("\nUNCAUGHT EXCEPTION:", err?.stack ?? err);
  process.exit(1);
});

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

// Per-step request log for the panel.
const apiCalls = [];
function recordApiCall(url, method) {
  if (url.includes("/api/solo-stats")) {
    apiCalls.push({ url, method, t: Date.now() });
  }
}

const { browser, ctx, page } = await launchQA();
page.on("request", (req) => recordApiCall(req.url(), req.method()));

const NAME = "merge-sync-probe";

// ─────────────────────────────────────────────────────────────────────
// STEP 1: Seed server row directly via PUT, then seed local with
// (3,2,1,0), click 同步, expect the merge dialog with "本机 3 局".
// ─────────────────────────────────────────────────────────────────────
await step("01-open-merge-dialog-with-local-ahead", async () => {
  // Seed server row = (2,1,0,1) via PUT then two POST outcomes.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate((k) => window.localStorage.removeItem(k), PLAYER_KEY);
  await page.evaluate((k) => window.localStorage.removeItem(k), LOCAL_SOLO_KEY);
  await page.evaluate((k) => window.localStorage.removeItem(k), SYNCED_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="player-name-input"]');
  await page.fill('[data-testid="player-name-input"]', NAME);
  await page.click('[data-testid="player-name-save"]');
  await page.waitForTimeout(400);
  // Add 2X + 1O via the POST endpoint so server holds (3,2,0,-1)
  // (xWins=3, oWins=2 → after 2 Xs and 1 O, currentStreak ends at -1).
  await page.evaluate(async (n) => {
    for (const o of ["X", "X", "O"]) {
      await fetch("/api/solo-stats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n, outcome: o }),
      });
    }
  }, NAME);
  // Seed local with (3,2,1,0) — one extra draw beyond what server has.
  await seedSoloStats(page, {
    totalGames: 6, xWins: 3, oWins: 2, draws: 1, currentStreak: 0,
  });
  // Sync the panel first so the sentinel picks up the server's totalGames.
  await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
  await page.click('[data-testid="view-toggle"]');
  await page.waitForSelector('[data-testid="solo-sync"]');
  await page.waitForTimeout(500);

  apiCalls.length = 0;
  await page.click('[data-testid="solo-sync"]');
  await page.waitForTimeout(300);
  const dialogOpen = await page.evaluate(
    'document.querySelector(\'[data-testid="sync-confirm-dialog"]\').hasAttribute("open")'
  );
  assert.equal(dialogOpen, true, "merge dialog must open when local is ahead of server");
  const desc = await page.textContent('[data-testid="sync-confirm-desc"]');
  assert.ok(desc && desc.includes("将上传本机"), `dialog desc must say 「将上传本机」; got ${desc}`);
  await shoot(page, "01-merge-dialog-open.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 2: 「保留本地」 → zero network writes, local preserved.
// ─────────────────────────────────────────────────────────────────────
await step("02-reject-keeps-local-zero-network", async () => {
  apiCalls.length = 0;
  await page.click('[data-testid="sync-confirm-reject"]');
  await page.waitForTimeout(300);
  const calls = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.equal(calls.length, 0, `保留本地 must be zero network writes; saw ${calls.length}`);
  const localRaw = await page.evaluate((k) => window.localStorage.getItem(k), LOCAL_SOLO_KEY);
  assert.ok(localRaw && JSON.parse(localRaw).totalGames === 6, `local must be preserved; got ${localRaw}`);
  await shoot(page, "02-after-reject.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 3: Click sync again, then 「合并并清空」 → POST /sync + local
// cleared. The merge math is per-field addition:
//   server (3,2,0,-1) + client (6,3,2,1,0) = (9,5,2,1,-1)
// ─────────────────────────────────────────────────────────────────────
await step("03-confirm-merges-and-clears-local", async () => {
  await page.click('[data-testid="solo-sync"]');
  await page.waitForTimeout(300);
  apiCalls.length = 0;
  await page.click('[data-testid="sync-confirm-confirm"]');
  await page.waitForTimeout(800);
  const postSync = apiCalls.find((c) => c.method === "POST" && c.url.includes("/sync"));
  assert.ok(postSync, `must fire POST /sync; saw ${JSON.stringify(apiCalls)}`);
  const serverResp = await getServerStats(page, NAME);
  // server (3,2,0,-1) + client (6,3,2,1,0) = (9,5,2,1,-1)
  assert.equal(serverResp.body.stats.totalGames, 9, `merged totalGames=${serverResp.body.stats.totalGames}`);
  assert.equal(serverResp.body.stats.xWins, 5, `merged xWins=${serverResp.body.stats.xWins}`);
  assert.equal(serverResp.body.stats.oWins, 3, `merged oWins=${serverResp.body.stats.oWins}`);
  assert.equal(serverResp.body.stats.draws, 1, `merged draws=${serverResp.body.stats.draws}`);
  assert.equal(serverResp.body.stats.currentStreak, -1, `merged streak=${serverResp.body.stats.currentStreak}`);
  const localRaw = await page.evaluate((k) => window.localStorage.getItem(k), LOCAL_SOLO_KEY);
  assert.equal(localRaw, null, `local must be cleared after merge; got ${localRaw}`);
  await shoot(page, "03-after-merge.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 4: Repeat the sync click — should be a pure GET (no POST),
// because local matches server now. wave-2 §A5 contract.
// ─────────────────────────────────────────────────────────────────────
await step("04-repeat-sync-is-pure-get", async () => {
  apiCalls.length = 0;
  await page.click('[data-testid="solo-sync"]');
  await page.waitForTimeout(400);
  const calls = apiCalls.filter((c) => c.url.includes("/api/solo-stats"));
  assert.equal(calls.length, 1, `repeat sync must fire exactly 1 GET; saw ${calls.length}`);
  assert.equal(calls[0].method, "GET", `repeat sync must be GET, not POST`);
  await shoot(page, "04-pure-get-after-merge.png");
});

// ─────────────────────────────────────────────────────────────────────
// STEP 5: 422 contract — invalid name (control char) and invalid
// stats shape (NaN, missing fields) must reject before reaching the DB.
// ─────────────────────────────────────────────────────────────────────
await step("05-422-on-invalid-input", async () => {
  const badName = await postSync(page, "bad\u0007name", {
    totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
  });
  assert.equal(badName.status, 422, `control-char name must 422; got ${badName.status}`);

  const nanStats = await postSync(page, NAME, {
    totalGames: 1, xWins: Number.NaN, oWins: 0, draws: 0, currentStreak: 0,
  });
  assert.ok(
    nanStats.status === 400 || nanStats.status === 422,
    `NaN stats must 4xx; got ${nanStats.status}`,
  );

  const missingStats = await postSync(page, NAME, undefined);
  assert.equal(missingStats.status, 422, `missing stats must 422; got ${missingStats.status}`);

  const extraKey = await postSync(page, NAME, {
    totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
    polluted: true,
  });
  assert.equal(extraKey.status, 422, `extra stats key must 422; got ${extraKey.status}`);

  // Confirm server row is unchanged after the 422 attempts.
  const after = await getServerStats(page, NAME);
  assert.equal(after.body.stats.totalGames, 9, `422 attempts must not touch server row`);
});

// ─────────────────────────────────────────────────────────────────────
// STEP 6: Cleanup.
// ─────────────────────────────────────────────────────────────────────
await step("99-cleanup", async () => {
  await ctx.close();
});

await writeQaLog(EVIDENCE, {
  test: "merge-sync-qa",
  base: BASE,
  findings,
  apiCallsSummary: apiCalls.length,
});
console.log(`\nQA SUMMARY: ${findings.filter((f) => f.status === "PASS").length}/${findings.length} PASS`);

await browser.close();
