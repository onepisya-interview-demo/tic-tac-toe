// home-return-qa.mjs — W3 (ulw-name-login-one-truth) end-to-end probe
// for the home-page identity region and the home-return sync dialog.
// One real Chromium + production build (pnpm build && pnpm start on
// :3101). Covers:
//
//   A3 弹框时机全路径:
//      a) solo → 回首页 + pending>0 → 弹框现 (首次回首页)
//      b) 首页直接起战不弹不拦 (pending=0 → 直行)
//      c) 「保留本地」零网络写 + sessionStorage 标记写 (Step 4)
//      d) 同会话 pending 无增量不重弹 (含刷新) (Step 5)
//      e) 再玩 1 局 pending 超记录值 → 回首页再弹 (Step 6)
//   A7 跨设备只读恢复:
//      a) A 设备 sync 3 局 → fresh context (B 设备) 输同 name →
//         线上战绩卡显示 3 局 (Step 7)
//      b) B 的 ttt.solo.* keys 全程为空 (Step 7)
//      c) B 玩 solo 从 0 独立累计 (Step 8)
//
// Usage:
//   node tests/qa/home-return-qa.mjs          (needs pnpm build && pnpm start on :3101)
//   env: BASE_URL (default http://localhost:3101),
//        EVIDENCE_DIR (default .omx/evidence/home-return-qa).

import assert from "node:assert/strict";
import { launchBrowser, launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/home-return-qa";
const PLAYER_KEY = "ttt.player.name.v1";
const LOCAL_SOLO_KEY = "ttt.solo.stats.v1";
const SYNCED_KEY = "ttt.solo.last-merged-local.v1";
const DECLINED_KEY = "ttt.solo.sync-declined.v1";
const RUN_SUFFIX = String(Date.now() % 1000000).padStart(6, "0");
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

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

process.on("unhandledRejection", (reason) => {
  console.error("\nUNHANDLED REJECTION:", reason?.stack ?? reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("\nUNCAUGHT EXCEPTION:", err?.stack ?? err);
  process.exit(1);
});

function isWriteToApi(method, url) {
  if (!url.includes("/api/")) return false;
  return method === "POST" || method === "PUT" || method === "DELETE";
}

function isReadToApi(method, url) {
  if (!url.includes("/api/")) return false;
  return method === "GET";
}

async function captureLocalStorage(page) {
  return await page.evaluate(() => ({ ...window.localStorage }));
}

async function captureSessionStorage(page) {
  return await page.evaluate(() => ({ ...window.sessionStorage }));
}

async function reloadSoloUntilXFirst(page, maxAttempts = 12) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    // status-bar is always rendered; status-text only appears when the
    // active cell is in playing state. Wait for the bar first so we
    // know the client has hydrated.
    await page.waitForSelector('[data-testid="status-bar"]');
    // Then wait for status-text (means phase=playing and currentPlayer
    // is non-null, i.e. startGame ran).
    await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
    const text = await page.textContent('[data-testid="status-text"]');
    if (text && text.includes("X")) return;
    await page.reload({ waitUntil: "networkidle" });
  }
  throw new Error("could not get an X-first solo game within 12 attempts");
}

// Server reset helper.
// W1 retired /api/stats; W2 ships POST /api/sessions with no DELETE
// counterpart. The hermetic test DB lives at /tmp/ulw-og2v/w3.db
// (recreated once per run), so steps that need a clean baseline
// use unique names via seedSoloRowViaApi. This helper is now a
// no-op for symmetry with the rest of the W3 probe surface.
async function resetServer(_page) {
  // intentionally empty — see comment above
}

async function seedSoloRowViaApi(ctx, name, stats) {
  // Register / login first to create the row, then fold via /merge.
  const session = await ctx.request.post(`${BASE}/api/sessions`, {
    data: { name },
  });
  assert.equal(session.status(), 200, `seed sessions 200, got ${session.status()}`);
  const merge = await ctx.request.post(`${BASE}/api/players/${encodeURIComponent(name)}/stats/merge`, {
    data: { stats },
  });
  assert.equal(merge.status(), 200, `seed merge 200, got ${merge.status()}`);
}

await step("step 01 reset server + verify home landing renders", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await resetServer(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // W1 retired empty-state testid; W3 landing renders the dual
    // CTA + identity region instead. Verify the new surface.
    await page.waitForSelector('[data-testid="start-online"]');
    await page.waitForSelector('[data-testid="start-offline"]');
    await page.waitForSelector('[data-testid="home-page"]');
    await shoot(page, "home-landing-empty-warm.png");
    // No dialog on initial load (no pending games).
    assert.equal(
      await page.locator('[data-testid="sync-confirm-dialog"][open]').count(),
      0,
      "no dialog on empty home (no pending games)",
    );
  } finally {
    await browser.close();
  }
});

await step("step 02 solo → 回首页 + pending>0 → 弹框现 (A3 first branch)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await resetServer(page);
    // Seed a name so the W2 pure-local 守卫 (store.ts:makeMove
    // isAnonymous branch) actually writes to localStorage on win.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    // Play 1 solo game via UI on /solo.
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(() => { try { const v = window.localStorage.getItem('ttt.solo.stats.v1'); return v ? JSON.parse(v).totalGames >= 1 : false; } catch { return false; } }, { timeout: 5000 });
    const localBefore = await captureLocalStorage(page);
    assert.equal(localBefore[LOCAL_SOLO_KEY] !== undefined, true, "local solo stats present");
    // Click 返回首页 link.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // The home-return dialog should now be visible.
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await shoot(page, "home-dialog-first-open.png");
    const desc = await page.textContent('[data-testid="sync-confirm-desc"]');
    assert.ok(desc && desc.includes("将上传本机"), "dialog shows pending copy");
  } finally {
    await browser.close();
  }
});

await step("step 03 pending=0 首页直接起战不弹不拦 (A3 second branch)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await resetServer(page);
    // Seed the name via localStorage on the same origin so the
    // page first frame carries the value. PlayerNameForm's mount
    // effect (post-hydration) rehydrates the store from localStorage,
    // which the StartGameButton's requireName gate reads.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
      window.dispatchEvent(new CustomEvent("ttt:player-name-changed"));
    });
    await page.reload({ waitUntil: "networkidle" });
    // Wait for the PlayerNameForm's post-hydration reverse hydration
    // to set the store. The folded testid confirms it landed.
    // Wait for the PlayerNameForm post-hydration reverse hydration
    // to set the store. The folded testid (player-name-readonly)
    // confirms it landed.
    await page.waitForSelector('[data-testid="player-name-section"]', { timeout: 4000 });
    await page.waitForFunction(
      () => !!document.querySelector('[data-testid="player-name-readonly"]'),
      { timeout: 4000 },
    );
    assert.equal(
      await page.locator('[data-testid="sync-confirm-dialog"][open]').count(),
      0,
      "no dialog on clean home",
    );
    await Promise.all([
      page.waitForURL(/\/play$/),
      page.click('[data-testid="start-online"]'),
    ]);
    await page.waitForSelector('[data-testid="status-bar"]');
    await shoot(page, "start-online-direct.png");
  } finally {
    await browser.close();
  }
});

await step("step 04 「保留本地」: 零网络写 + sessionStorage 标记写 (A3 third branch)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await resetServer(page);
    // Seed a name so the W2 pure-local 守卫 actually writes to
    // localStorage on win.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    // Seed 1 pending game.
// Seed player name so W2 pure-local 守卫 writes localStorage.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(() => { try { const v = window.localStorage.getItem('ttt.solo.stats.v1'); return v ? JSON.parse(v).totalGames >= 1 : false; } catch { return false; } }, { timeout: 5000 });
    // Track network writes from this point.
    const writesAfterSeed = [];
    page.on("request", (req) => {
      if (isWriteToApi(req.method(), req.url())) {
        writesAfterSeed.push({ method: req.method(), url: req.url() });
      }
    });
    // Go home → dialog opens.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    // Click 「保留本地」.
    await page.click('[data-testid="sync-confirm-reject"]');
    // Wait briefly for any (non-existent) writes.
    await page.waitForTimeout(300);
    // Dialog closed.
    assert.equal(
      await page.locator('[data-testid="sync-confirm-dialog"][open]').count(),
      0,
      "dialog closed after 保留本地",
    );
    assert.equal(
      writesAfterSeed.length,
      0,
      `no /api/ writes after reject (got ${writesAfterSeed.length}: ${JSON.stringify(writesAfterSeed)})`,
    );
    // sessionStorage sentinel should record the pending count (1).
    const sess = await captureSessionStorage(page);
    assert.equal(
      sess[DECLINED_KEY],
      "1",
      `sessionStorage ${DECLINED_KEY}=1 (got ${sess[DECLINED_KEY]})`,
    );
    // localStorage solo stats unchanged.
    const local = await captureLocalStorage(page);
    assert.equal(local[LOCAL_SOLO_KEY] !== undefined, true, "local stats preserved");
  } finally {
    await browser.close();
  }
});

await step("step 05 同会话 pending 无增量不重弹 (含刷新) (A3 fourth branch)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await resetServer(page);
// Seed player name so W2 pure-local 守卫 writes localStorage.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(() => { try { const v = window.localStorage.getItem('ttt.solo.stats.v1'); return v ? JSON.parse(v).totalGames >= 1 : false; } catch { return false; } }, { timeout: 5000 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('[data-testid="sync-confirm-dialog"][open]').count(),
      0,
      "dialog closed after 保留本地",
    );
    // Hard reload the home page — declined sentinel is in sessionStorage,
    // which survives reloads within the same tab session but is wiped on
    // a NEW context. sessionStorage is preserved across reload.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('[data-testid="sync-confirm-dialog"][open]').count(),
      0,
      "no dialog after hard reload (sessionStorage sentinel still pending=1)",
    );
    await shoot(page, "home-no-redialog-after-reload.png");
  } finally {
    await browser.close();
  }
});

await step("step 06 再玩 1 局 pending 超记录值 → 回首页再弹 (A3 fifth branch)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await resetServer(page);
    // 1 game → declined sentinel = 1.
// Seed player name so W2 pure-local 守卫 writes localStorage.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(() => { try { const v = window.localStorage.getItem('ttt.solo.stats.v1'); return v ? JSON.parse(v).totalGames >= 1 : false; } catch { return false; } }, { timeout: 5000 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForTimeout(200);
    // Play 1 more → pending=2 > declined=1 → re-opens.
// Seed player name so W2 pure-local 守卫 writes localStorage.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForTimeout(200);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    const desc = await page.textContent('[data-testid="sync-confirm-desc"]');
    assert.ok(desc && desc.includes("将上传本机 2 局"), "dialog shows 2 pending");
    await shoot(page, "home-dialog-reopen-2.png");
    await page.click('[data-testid="sync-confirm-reject"]');
  } finally {
    await browser.close();
  }
});

await step("step 07 fresh context (B 设备) 输同 name → 线上战绩卡显示 3 局 + solo key 全程为空 (A7)", async () => {
  // A 设备 seed: register name + sync 3 games.
  const browserA = await launchBrowser();
  try {
    const ctxA = await browserA.newContext();
    const pageA = await ctxA.newPage();
    await resetServer(pageA);
    await seedSoloRowViaApi(ctxA, `hrqa-${RUN_SUFFIX}-b`, {
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 1,
    });
    await ctxA.close();
  } finally {
    await browserA.close();
  }

  // B 设备: fresh context, fresh localStorage. Login with the same name
  // and verify the online card displays 3 games. Critically, B's solo
  // localStorage keys MUST remain empty (A2 red-line: 线上永不进本地).
  const browserB = await launchBrowser();
  try {
    const ctxB = await browserB.newContext();
    const pageB = await ctxB.newPage();
    // Navigate to / first so window.localStorage is accessible
    // (about:blank throws SecurityError). Then sanity-check the fresh
    // context has no name / solo keys before any UI interaction.
    await pageB.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const localStart = await captureLocalStorage(pageB);
    assert.equal(localStart[LOCAL_SOLO_KEY], undefined, "no local solo key on fresh context");
    assert.equal(localStart[PLAYER_KEY], undefined, "no name key on fresh context");
    // Type + save the name via the PlayerNameForm. The form posts to
    // /api/sessions which returns existed:true (登录).
    await pageB.fill('[data-testid="player-name-input"]', `hrqa-${RUN_SUFFIX}-b`);
    await pageB.click('[data-testid="player-name-save"]');
    // Wait for the login feedback.
    await pageB.waitForSelector(
      '[data-testid="player-name-feedback"][data-feedback-kind="login"]',
      { timeout: 4000 },
    );
    // Wait for the online card to fetch and render the merged row.
    await pageB.waitForSelector('[data-testid="online-stats-grid"]', {
      timeout: 4000,
    });
    await shoot(pageB, "home-online-card-b-device.png");
    // Verify the rendered numbers (the server returned totalGames=3).
    const valueEls = await pageB.$$eval(
      '[data-testid="online-stats-grid"] [data-testid="stat-value"]',
      (els) => els.map((e) => e.textContent?.trim() ?? ""),
    );
    assert.ok(valueEls[0] === "3", `first stat value = 3 (got ${valueEls[0]})`);
    // A2 red-line assertion: localStorage solo stats key STILL undefined
    // even after viewing the online card.
    const localAfter = await captureLocalStorage(pageB);
    assert.equal(
      localAfter[LOCAL_SOLO_KEY],
      undefined,
      `A2: localStorage ${LOCAL_SOLO_KEY} must remain undefined after viewing online card (got ${localAfter[LOCAL_SOLO_KEY]})`,
    );
    // And no solo-sentinel either.
    assert.equal(
      localAfter[SYNCED_KEY],
      undefined,
      `A2: localStorage ${SYNCED_KEY} must remain undefined (got ${localAfter[SYNCED_KEY]})`,
    );
    // name key WAS written (this is the identity region contract).
    assert.equal(
      localAfter[PLAYER_KEY],
      `hrqa-${RUN_SUFFIX}-b`,
      "name key written on login",
    );
    await ctxB.close();
  } finally {
    await browserB.close();
  }
});

await step("step 08 fresh context B 玩 solo 从 0 独立累计 (A7 continuation)", async () => {
  const browser = await launchBrowser();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // Login first (carries the B-device name from step 07 forward).
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="player-name-input"]', `hrqa-${RUN_SUFFIX}-b`);
    await page.click('[data-testid="player-name-save"]');
    await page.waitForSelector('[data-testid="online-stats-grid"]', {
      timeout: 4000,
    });
    // Play 1 solo game — local starts at 0. PlayerNameForm's
    // submit handler wrote `hrqa-${RUN_SUFFIX}-b` to localStorage
    // above; nothing else needed.
    await reloadSoloUntilXFirst(page);
    const localBefore = await captureLocalStorage(page);
    const before = localBefore[LOCAL_SOLO_KEY] ? JSON.parse(localBefore[LOCAL_SOLO_KEY]) : null;
    assert.ok(!before || before.totalGames === 0, `local starts at 0 (got ${JSON.stringify(before)})`);
    await driveTopRowWin(page);
    await page.waitForTimeout(200);
    const localAfter = await captureLocalStorage(page);
    const after = JSON.parse(localAfter[LOCAL_SOLO_KEY]);
    assert.equal(after.totalGames, 1, "B solo accumulates locally from 0");
    // Online card still says 3 (server untouched by local-only play).
    // Wait for the dialog to open first (it WILL open — pending=1).
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 8000,
    });
    // PlayerNameForm re-hydrates from localStorage on mount, so the
    // online card renders the same 3-game row even after the /solo
    // round-trip. Wait for the grid to attach (top-layer modal does
    // not remove it from the DOM).
    await page.waitForSelector('[data-testid="online-stats-grid"]', {
      timeout: 8000,
      state: "attached",
    });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    const valueEls = await page.$$eval(
      '[data-testid="online-stats-grid"] [data-testid="stat-value"]',
      (els) => els.map((e) => e.textContent?.trim() ?? ""),
    );
    assert.ok(valueEls[0] === "3", `online card still 3 (got ${valueEls[0]})`);
    await ctx.close();
  } finally {
    await browser.close();
  }
});


await step("step 09 (W2) logged-in user merge → online card updates ≤2s via event", async () => {
  const browser = await launchBrowser();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await resetServer(page);
    const name = `w2-${RUN_SUFFIX}-loggedin`;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="player-name-input"]', name);
    await page.click('[data-testid="player-name-save"]');
    await page.waitForSelector('[data-testid="online-stats-grid"]', {
      timeout: 4000,
    });
    const initialOnline = await page.getAttribute(
      '[data-testid="online-stats-grid"] [data-testid="stat-value"]',
      "data-value",
    );
    assert.equal(initialOnline, "0", `online card initial = 0 (got ${initialOnline})`);
    // Play 1 solo game locally.
// Seed player name so W2 pure-local 守卫 writes localStorage.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ttt.player.name.v1", "home-return-qa-user");
    });
    await reloadSoloUntilXFirst(page);
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => {
        try {
          const v = window.localStorage.getItem("ttt.solo.stats.v1");
          return v ? JSON.parse(v).totalGames >= 1 : false;
        } catch {
          return false;
        }
      },
      { timeout: 5000 },
    );
    // Go home → dialog opens with pending=1.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await shoot(page, "home-dialog-step09-pre-confirm.png");
    // Click 合并并清空 — already-registered name, dialog pre-fills it.
    await page.click('[data-testid="sync-confirm-confirm"]');
    // ≤2s for online-stats-grid to update from 0 to 1 (server merged).
    let updated = null;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try {
        updated = await page
          .locator('[data-testid="online-stats-grid"] [data-testid="stat-value"]')
          .first()
          .getAttribute("data-value");
        if (updated === "1") break;
      } catch {
        // selector transient — keep polling
      }
      await page.waitForTimeout(100);
    }
    await shoot(page, "home-online-card-step09-after-merge.png");
    assert.equal(
      updated,
      "1",
      `online card data-value updated to 1 within 2s after merge (got ${updated})`,
    );
    // A2 red-line: merge cleared local; no localStorage pollution.
    const localAfter = await captureLocalStorage(page);
    assert.equal(
      localAfter[LOCAL_SOLO_KEY],
      undefined,
      `A2: ${LOCAL_SOLO_KEY} cleared after merge (got ${localAfter[LOCAL_SOLO_KEY]})`,
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
});

await step("step 10 (W2) window focus triggers online card refetch", async () => {
  const browser = await launchBrowser();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await resetServer(page);
    const name = `w2-${RUN_SUFFIX}-focus`;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="player-name-input"]', name);
    await page.click('[data-testid="player-name-save"]');
    await page.waitForSelector('[data-testid="online-stats-grid"]', {
      timeout: 4000,
    });
    const beforeFocus = await page.getAttribute(
      '[data-testid="online-stats-grid"] [data-testid="stat-value"]',
      "data-value",
    );
    assert.equal(beforeFocus, "0", `online card before focus = 0 (got ${beforeFocus})`);
    // Simulate an external mutation: another device syncs a 5-game row
    // under the same name. Use the same context's APIRequestContext so
    // we don't need a second browser.
    const sync = await ctx.request.post(`${BASE}/api/players/${encodeURIComponent(name)}/stats/merge`, {
      data: {
        stats: { totalGames: 5, xWins: 5, oWins: 0, draws: 0, currentStreak: 5 },
      },
    });
    assert.equal(sync.status(), 200, `external sync 200 (got ${sync.status()})`);
    // Card is still 0 (no signal). Dispatch focus on the page window.
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    // ≤2s for card to update to 5.
    let afterFocus = null;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try {
        afterFocus = await page
          .locator('[data-testid="online-stats-grid"] [data-testid="stat-value"]')
          .first()
          .getAttribute("data-value");
        if (afterFocus === "5") break;
      } catch {
        // keep polling
      }
      await page.waitForTimeout(100);
    }
    await shoot(page, "home-online-card-step10-after-focus.png");
    assert.equal(
      afterFocus,
      "5",
      `online card data-value updated to 5 within 2s after focus (got ${afterFocus})`,
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
});

await step("step 11 (W3) reset button + public ledger retired — verify clean home", async () => {
  const browser = await launchBrowser();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // W1 retired /api/stats; W4 moved ResetStatsButton to /solo
    // (scope='local'). The home page therefore carries neither.
    // Pin the W3 contract: the reset button testid is NOT on /.
    const resetCount = await page.locator('[data-testid="reset-stats"]').count();
    assert.equal(resetCount, 0, `reset-stats testid absent on / (got ${resetCount})`);
    // Public ledger endpoints are 404.
    const put = await page.request.put(`${BASE}/api/stats`, { data: {} });
    assert.equal(put.status(), 404, `legacy /api/stats PUT 404 (got ${put.status()})`);
    await shoot(page, "home-no-reset-no-public.png");
  } finally {
    await browser.close();
  }
});


await writeQaLog(EVIDENCE, {
  test: "home-return-qa",
  status: "PASS",
  findings,
  runSuffix: RUN_SUFFIX,
});
console.log("\nALL STEPS PASSED");
process.exit(0);
