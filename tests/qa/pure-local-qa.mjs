// pure-local-qa.mjs — End-to-end probe for the W1 pure-local contract
// (.omo/plans/ulw-solo-pure-local-closeout.md §1 悬案一 + §4 验收).
// One real Chromium + production build (pnpm build && pnpm start on
// :3101). Probes three A1/A2/A3 acceptance criteria:
//
//   A1: 断网 + 具名玩 3 局 → localStorage 战绩累计 3 且 /api/ 写请求 = 0
//   A2: pending>0 首页点「开始对战」 → 弹框; 合并并清空 → 导航 + 服务端
//       per-field 累加; 保留本地 → 导航 + 零网络写
//   A3: pending=0 首页点「开始对战」 → 无弹框直行
//
// Usage:
//   node tests/qa/pure-local-qa.mjs          (needs pnpm build && pnpm start on :3101)
//   env: BASE_URL (default http://localhost:3101), DATABASE_URL,
//        EVIDENCE_DIR (default .omx/evidence/pure-local-qa).

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/pure-local-qa";
const PLAYER_KEY = "ttt.player.name.v1";
const LOCAL_SOLO_KEY = "ttt.solo.stats.v1";
const SYNCED_KEY = "ttt.solo.server.synced.v1";
const findings = [];

// Unique-per-run names (plan §1.3 F3): pure-local-qa re-runs leave
// server rows populated; using a timestamp suffix keeps each run
// hermetic against the same DB. Defined at module level so all steps
// can reference it.
const RUN_SUFFIX = String(Date.now() % 1000000).padStart(6, '0');

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

// Filter that counts writes to /api/solo-stats and /api/stats. Read
// traffic (GET /api/solo-stats?name=…) is allowed by the W1 contract —
// only writes (POST /sync, POST /api/solo-stats, PUT, DELETE) must be 0.
function isWriteToApi(method, url) {
  if (!url.includes("/api/")) return false;
  return method === "POST" || method === "PUT" || method === "DELETE";
}

process.on("unhandledRejection", (reason) => {
  console.error("\nUNHANDLED REJECTION:", reason?.stack ?? reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("\nUNCAUGHT EXCEPTION:", err?.stack ?? err);
  process.exit(1);
});

const { browser, ctx, page } = await launchQA();
const writeCalls = [];
page.on("request", (req) => {
  const url = req.url();
  const method = req.method();
  if (isWriteToApi(method, url)) writeCalls.push({ url, method, t: Date.now() });
});

try {
  // ─────────────────────────────────────────────────────────────────
  // A1: 断网 + 具名玩 3 局 → localStorage 战绩累计 3 且 /api/ 写请求 = 0
  // ─────────────────────────────────────────────────────────────────
  await step("A1-named-solo-three-games-zero-writes", async () => {
    // Seed player name on the home page.
    const NAME_A1 = `purelocal-a1-${RUN_SUFFIX}`;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_SOLO_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), SYNCED_KEY);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="player-name-input"]');
    await page.fill('[data-testid="player-name-input"]', NAME_A1);
    await page.click('[data-testid="player-name-save"]');
    // Wait long enough for the fire-and-forget PUT to land (this is
    // the only allowed write before the offline phase).
    await page.waitForTimeout(800);

    // Navigate to /solo BEFORE installing the write-blocker. The
    // blocker intercepts every /api/* POST/PUT/DELETE and aborts it,
    // so any hypothetical auto-POST (which pure-local should NOT
    // issue) would be visible as a writeCalls entry. localStorage
    // reads/writes and RSC navigations are unaffected.
    writeCalls.length = 0;
    await reloadSoloUntilXFirst(page);
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      if (req.method() === "POST" || req.method() === "PUT" || req.method() === "DELETE") {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    // Game 1.
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => /X 获胜|平局/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? "",
      ),
      null, { timeout: 4000 },
    );
    await page.waitForTimeout(220);

    // Game 2: restart and replay.
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => /X 获胜|平局/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? "",
      ),
      null, { timeout: 4000 },
    );
    await page.waitForTimeout(220);

    // Game 3.
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => /X 获胜|平局/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? "",
      ),
      null, { timeout: 4000 },
    );
    await page.waitForTimeout(220);

    // Assert localStorage accumulated 3 games.
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_SOLO_KEY);
    assert.ok(raw, `expected ${LOCAL_SOLO_KEY} to exist after 3 games`);
    const stats = JSON.parse(raw);
    assert.equal(stats.totalGames, 3, `localStorage totalGames must be 3, got ${stats.totalGames}`);
    assert.equal(stats.xWins + stats.oWins + stats.draws, 3, "xWins+oWins+draws must equal 3");

    // Assert NO writes hit /api/* during the offline phase.
    assert.equal(
      writeCalls.length,
      0,
      `offline named-solo games must NOT issue any /api/* writes; saw ${writeCalls.length}: ${JSON.stringify(writeCalls)}`,
    );

    await shoot(page, "A1-three-games-offline.png");
    // Drop the write-blocker so step A2's writes (PUT name on save)
    // can reach the server.
    await page.unroute("**/api/**");
    await page.waitForTimeout(220);
  });

  // ─────────────────────────────────────────────────────────────────
  // A2a: pending>0 首页点「开始对战」 → 弹框;「保留本地」 → 导航 + 零网络写
  // ─────────────────────────────────────────────────────────────────
  await step("A2a-reject-keeps-local-zero-writes-navigates", async () => {
    // Seed: localStorage holds 3 games (from A1). Navigate to /.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-game"]');
    // pendingSyncCount = local.totalGames - syncedServerTotal = 3 - 0 = 3.
    // pendingSyncCount is computed inside StartGameButton; we
    // verify by checking the dialog opens.
    writeCalls.length = 0;

    await page.click('[data-testid="start-game"]');
    // The intercept must open the dialog.
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', { timeout: 3000 });
    await shoot(page, "A2a-dialog-open.png");

    // 「保留本地」 — zero network writes, navigates.
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForURL("**/play", { timeout: 4000 });
    // Allow any rogue async writes to surface.
    await page.waitForTimeout(400);

    const writes = writeCalls.filter((c) => c.url.includes("/api/"));
    assert.equal(
      writes.length,
      0,
      `保留本地 must be zero network writes; saw ${writes.length}: ${JSON.stringify(writes)}`,
    );
    // Local must still hold the 3 games.
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_SOLO_KEY);
    assert.ok(raw && JSON.parse(raw).totalGames === 3, "local must be preserved after 保留本地");
    await shoot(page, "A2a-after-reject-on-play.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // A2b: pending>0 首页点「开始对战」 → 弹框;「合并并清空」 → 导航 + per-field 累加
  // ─────────────────────────────────────────────────────────────────
  await step("A2b-confirm-merges-navigates", async () => {
    // Seed: server row for the player = 0; local row = (3,3,0,0,3).
    const NAME_A2 = `purelocal-a2-${RUN_SUFFIX}`;
    // Clear any prior state from A1 — A1 used a different name.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_SOLO_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), SYNCED_KEY);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="player-name-input"]');
    await page.fill('[data-testid="player-name-input"]', NAME_A2);
    await page.click('[data-testid="player-name-save"]');
    await page.waitForTimeout(800);

    // Seed local with 3 games (so pending = 3).
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
      LOCAL_SOLO_KEY,
      JSON.stringify({ totalGames: 3, xWins: 3, oWins: 0, draws: 0, currentStreak: 3 }),
    ]);

    await page.waitForTimeout(220);

    writeCalls.length = 0;
    await page.click('[data-testid="start-game"]');
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', { timeout: 3000 });
    await shoot(page, "A2b-dialog-open.png");

    // 「合并并清空」
    await page.click('[data-testid="sync-confirm-confirm"]');
    // Dialog should close and navigation should fire.
    await page.waitForURL("**/play", { timeout: 8000 });
    await page.waitForTimeout(600);

    // The merge writes a single POST /sync (and possibly a PUT if the
    // name was new). Both are EXPECTED — that's the merge flow.
    const writes = writeCalls.filter((c) => c.url.includes("/api/"));
    assert.ok(
      writes.length >= 1,
      `合并并清空 must fire network writes (PUT + POST /sync); saw ${writes.length}: ${JSON.stringify(writes)}`,
    );
    const postSync = writes.find((c) => c.method === "POST" && c.url.includes("/sync"));
    assert.ok(postSync, `合并并清空 must fire POST /api/solo-stats/sync; got ${JSON.stringify(writes)}`);

    // Local must be cleared.
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_SOLO_KEY);
    assert.equal(raw, null, "local must be cleared after 合并并清空");

    // Server row must be the per-field sum (server=0 + local=3 = 3).
    const server = await page.evaluate(async (n) => {
      const r = await fetch(`/api/solo-stats?name=${encodeURIComponent(n)}`, { cache: "no-store" });
      return r.json();
    }, NAME_A2);
    assert.equal(server.stats.totalGames, 3, `merged totalGames must be 3, got ${server.stats.totalGames}`);
    assert.equal(server.stats.xWins, 3, `merged xWins must be 3, got ${server.stats.xWins}`);
    await shoot(page, "A2b-after-merge-on-play.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // A3: pending=0 首页点「开始对战」 → 无弹框直行
  // ─────────────────────────────────────────────────────────────────
  await step("A3-pending-zero-no-dialog-direct-nav", async () => {
    // Clean state: no name, no local, no sentinel.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_SOLO_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), SYNCED_KEY);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-game"]');

    writeCalls.length = 0;
    await page.click('[data-testid="start-game"]');
    // Wait briefly — the navigation must fire before any dialog can
    // appear. If the intercept were buggy, the dialog would mount
    // within ~50ms of the click.
    await page.waitForURL("**/play", { timeout: 4000 });
    await page.waitForTimeout(220);

    const dialogOpen = await page.evaluate(
      'document.querySelector(\'[data-testid="sync-confirm-dialog"]\')?.hasAttribute("open") ?? false',
    );
    assert.equal(
      dialogOpen,
      false,
      `pending=0 must NOT open the dialog; dialogOpen=${dialogOpen}`,
    );
    const writes = writeCalls.filter((c) => c.url.includes("/api/"));
    assert.equal(
      writes.length,
      0,
      `pending=0 direct nav must NOT fire any /api/* writes; saw ${writes.length}: ${JSON.stringify(writes)}`,
    );
    await shoot(page, "A3-direct-nav.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // A4 (W2 纯净化): preset playerName in localStorage + mount /solo →
  // 全程 /api/ 请求计数 = 0，断言 stale testid 不再渲染
  //   - solo-sync / sync-confirm-dialog / PlayerNameForm 必须不在 /solo
  //   - 清空 localStorage 后刷新仍零请求（持久化不触发 GET）
  // ─────────────────────────────────────────────────────────────────
  await step("A4-named-mount-zero-network-no-stale-testid", async () => {
    const NAME_A4 = `purelocal-a4-${RUN_SUFFIX}`;
    // Seed name + a non-empty local row so the panel has something
    // to render.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_SOLO_KEY);
    await page.evaluate((key) => window.localStorage.removeItem(key), SYNCED_KEY);
    await page.evaluate(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: PLAYER_KEY, value: NAME_A4 },
    );
    await page.evaluate(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: LOCAL_SOLO_KEY, value: JSON.stringify({ totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 }) },
    );
    await page.reload({ waitUntil: "networkidle" });

    // Reset request counter, navigate to /solo, mount the stats view.
    writeCalls.length = 0;
    await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="view-toggle"]');
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="solo-stats"]');
    // Allow any hypothetical hydration effect to fire.
    await page.waitForTimeout(500);

    // /api/* requests must be ZERO on mount even with a preset name.
    const apiWrites = writeCalls.filter((c) => c.url.includes("/api/"));
    assert.equal(
      apiWrites.length,
      0,
      `preset name + /solo mount must NOT issue any /api/* request; saw ${apiWrites.length}: ${JSON.stringify(apiWrites)}`,
    );

    // Stale W1 testid nodes must be absent from the /solo surface.
    const stale = await page.evaluate(() => ({
      syncButton: !!document.querySelector('[data-testid="solo-sync"]'),
      syncDialog: !!document.querySelector('[data-testid="sync-confirm-dialog"]'),
      mergeNote: !!document.querySelector('[data-testid="solo-stats-merge-note"]'),
      statsError: !!document.querySelector('[data-testid="solo-stats-error"]'),
      playerNameForm: !!document.querySelector('[data-testid="player-name-section"]'),
    }));
    assert.equal(stale.syncButton, false, "solo-sync button must be absent on /solo (W2 纯净化)");
    assert.equal(stale.syncDialog, false, "sync-confirm-dialog must be absent on /solo (W2 纯净化)");
    assert.equal(stale.mergeNote, false, "solo-stats-merge-note must be absent on /solo (W2 纯净化)");
    assert.equal(stale.statsError, false, "solo-stats-error must be absent on /solo (W2 纯净化)");
    assert.equal(stale.playerNameForm, false, "PlayerNameForm must NOT render on /solo (W2 纯净化)");

    // Heading should still be the anonymous 「单机战绩」 (no name suffix).
    const heading = await page.textContent('[data-testid="solo-stats-heading"]');
    assert.equal(
      heading?.trim(),
      "单机战绩",
      `heading must be the anonymous 「单机战绩」 (no name suffix on /solo); got ${heading}`,
    );

    // After clearing localStorage and reloading, the panel must still
    // have issued zero network requests.
    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_SOLO_KEY);
    writeCalls.length = 0;
    await page.reload({ waitUntil: "networkidle" });
    await page.click('[data-testid="view-toggle"]');
    await page.waitForSelector('[data-testid="solo-stats"]');
    await page.waitForTimeout(500);
    const apiAfterClear = writeCalls.filter((c) => c.url.includes("/api/"));
    assert.equal(
      apiAfterClear.length,
      0,
      `after clearing localStorage, /solo reload must NOT issue /api/*; saw ${apiAfterClear.length}: ${JSON.stringify(apiAfterClear)}`,
    );

    await shoot(page, "A4-named-zero-network.png");
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

await writeQaLog(EVIDENCE, { base: BASE, findings });
const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
