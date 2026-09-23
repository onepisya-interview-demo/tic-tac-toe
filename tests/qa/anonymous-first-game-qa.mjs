// anonymous-first-game-qa.mjs — D-5a probe (ulw-result-win-celebration §4 item 5).
//
// The official direct probe for the "true anonymous first game" path that
// V9 flagged as MINOR-W4-探针更新推迟: the older offline probes all preset a
// room name in localStorage before playing. This probe starts from a brand-
// new browser context with ZERO preset identity and walks the W4/W5
// anonymous-first-game contract end to end:
//
//   S1: fresh context (no seeded room name) → direct-nav /offline
//   S2: drive a top-row win with 0,3,1,4,2 (pass-and-play; the coin flip
//       decides whether X or O takes the top row — the probe never assumes
//       the first player, only that SOMEONE wins)
//   S3: the /offline stats panel (auto-switch after the win) shows the
//       local ledger growing 0 → 1 (StatsGrid 总场次 = 1 + localStorage)
//   S4: return home → HomeDialogMount opens sync-confirm-dialog with
//       [open] attribute set (checked explicitly, not mere presence) and
//       the "本机 1 局" snapshot text
//   S5: cumulative /api/* request count since probe start === 0 (measured
//       with page.on('request') across every navigation, AFTER the dialog
//       is open but BEFORE the user commits to any CTA)
//   S6: probe teardown picks 「保留本地」 (keep-local): zero further /api/*
//       requests, dialog closes, sessionStorage declined sentinel written,
//       the local ledger survives. The real merge path is covered by
//       offline-qa A2b / home-return-qa; this probe deliberately does NOT
//       merge.
//
// Usage (production build required — never against a dev server):
//   pnpm build
//   DATABASE_URL=file:/tmp/<dir>/<unique>.db PORT=<port> pnpm start &
//   BASE_URL=http://localhost:<port> node tests/qa/anonymous-first-game-qa.mjs
//
// env: BASE_URL (default http://localhost:3101), EVIDENCE_DIR
//      (default .omx/evidence/anonymous-first-game-qa).

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/anonymous-first-game-qa";
const ROOM_KEY = "ttt.room.name.v1";
const LEGACY_ROOM_KEY = "ttt.player.name.v1";
const LOCAL_OFFLINE_KEY = "ttt.offline.stats.v1";
const DECLINED_KEY = "ttt.offline.sync-declined.v1";
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

// D-5a core assertion: the whole anonymous first-game journey (direct
// /offline nav → win → home return → merge dialog open) must issue ZERO
// /api/* requests. Counted from probe start, every method, GET included.
const { browser, ctx, page } = await launchQA();
const apiCalls = [];
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/api/")) apiCalls.push({ url, method: req.method(), t: Date.now() });
});

try {
  // ─────────────────────────────────────────────────────────────────
  // S1: 全新上下文（零预置名）→ 直达 /offline
  // ─────────────────────────────────────────────────────────────────
  await step("S1-fresh-context-direct-nav-offline", async () => {
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="board"]');
    assert.ok(page.url().endsWith("/offline"), `expected to land on /offline, got ${page.url()}`);
    // Self-evidence that the context is truly anonymous: no room name
    // (current key), no legacy key, no local ledger, no sentinels.
    const seeded = await page.evaluate(
      ({ roomKey, legacyKey, ledgerKey }) => ({
        room: window.localStorage.getItem(roomKey),
        legacy: window.localStorage.getItem(legacyKey),
        ledger: window.localStorage.getItem(ledgerKey),
      }),
      { roomKey: ROOM_KEY, legacyKey: LEGACY_ROOM_KEY, ledgerKey: LOCAL_OFFLINE_KEY },
    );
    assert.equal(seeded.room, null, `fresh context must not carry a room name, got ${JSON.stringify(seeded)}`);
    assert.equal(seeded.legacy, null, `fresh context must not carry a legacy key, got ${JSON.stringify(seeded)}`);
    assert.equal(seeded.ledger, null, `fresh context must not carry a local ledger, got ${JSON.stringify(seeded)}`);
    await shoot(page, "S1-direct-nav-anonymous.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // S2: 0,3,1,4,2 胜局（pass-and-play，先手随机 → 断言「有人获胜」）
  // ─────────────────────────────────────────────────────────────────
  await step("S2-anonymous-first-game-top-row-win", async () => {
    await driveTopRowWin(page);
    // The first-player coin flip is random: whoever wins it takes the
    // top row (0,1,2), so accept either X 获胜 or O 获胜.
    await page.waitForFunction(
      () => /X 获胜|O 获胜/.test(
        document.querySelector('[data-testid="status-text"]')?.textContent ?? "",
      ),
      null,
      { timeout: 4000 },
    );
    const statusText = await page.textContent('[data-testid="status-text"]');
    assert.match(statusText ?? '', /X 获胜|O 获胜/, `expected a win in status, got "${statusText}"`);
    assert.ok(page.url().endsWith("/offline"), `offline win must not navigate, got ${page.url()}`);
    await shoot(page, "S2-anonymous-win.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // S3: 账本增长 0 → 1（胜局后 1200ms 自动切 stats 视图，读 StatsGrid）
  // ─────────────────────────────────────────────────────────────────
  await step("S3-local-ledger-grows-zero-to-one", async () => {
    // W4: offline writes the ledger unconditionally (no room name
    // required). The page auto-switches to the stats view 1200ms after
    // a win (useTransition + timer), so wait for the panel directly.
    await page.waitForSelector('[data-testid="offline-stats"]', { timeout: 8000 });
    await page.waitForTimeout(500);
    // StatsGrid renders five stat-value nodes; the first is 总场次.
    const ledger = await page.evaluate(() => {
      const values = Array.from(document.querySelectorAll('[data-testid="stat-value"]'));
      return {
        count: values.length,
        totalGames: values[0]?.getAttribute("data-value") ?? null,
        totalGamesText: values[0]?.textContent ?? null,
      };
    });
    assert.equal(ledger.totalGames, "1", `StatsGrid 总场次 must be 1 after the first anonymous game, got ${JSON.stringify(ledger)}`);
    // Cross-check the persisted ledger: exactly one game, and it is a
    // win for whichever side took the top row (xWins + oWins = 1).
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_OFFLINE_KEY);
    assert.ok(raw, `expected ${LOCAL_OFFLINE_KEY} after the first anonymous game`);
    const stats = JSON.parse(raw);
    assert.equal(stats.totalGames, 1, `localStorage totalGames must be 1, got ${stats.totalGames}`);
    assert.equal(stats.xWins + stats.oWins, 1, `xWins+oWins must be 1 (random first player), got ${stats.xWins}+${stats.oWins}`);
    assert.equal(stats.draws, 0, `draws must be 0, got ${stats.draws}`);
    await shoot(page, "S3-ledger-one.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // S4: 回首页 → 合并弹框 [open]（显式查 open 属性）
  // ─────────────────────────────────────────────────────────────────
  await step("S4-home-return-dialog-open-attribute", async () => {
    // User-path home return: the stats view's 返回首页 link (soft nav).
    await Promise.all([
      page.waitForURL(`${BASE}/`, { timeout: 6000 }),
      page.click('[data-testid="back-home-offline"]'),
    ]);
    // sync-confirm-dialog stays in the DOM when closed — assert the
    // [open] attribute, not mere presence.
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', { timeout: 6000 });
    const dialogState = await page.evaluate(() => {
      const dlg = document.querySelector('[data-testid="sync-confirm-dialog"]');
      return { present: !!dlg, open: dlg?.hasAttribute("open") ?? false };
    });
    assert.equal(dialogState.open, true, `dialog must be [open] after anonymous home-return, got ${JSON.stringify(dialogState)}`);
    // The dialog snapshot text must reflect the one local game.
    const desc = await page.textContent('[data-testid="sync-confirm-desc"]');
    assert.ok(
      (desc ?? "").includes("本机 1 局"),
      `dialog snapshot must mention 本机 1 局, got "${desc}"`,
    );
    await shoot(page, "S4-dialog-open.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // S5: 弹框打开后、主动提交前：全程 /api/* 请求数 = 0
  // ─────────────────────────────────────────────────────────────────
  await step("S5-zero-api-requests-before-user-commit", async () => {
    // At this point the dialog is open and the user has NOT pressed any
    // CTA. The entire journey so far (direct /offline nav, the win, the
    // stats view, the home return, the dialog open) must have issued
    // zero /api/* requests — counted since probe start, all methods.
    assert.equal(
      apiCalls.length,
      0,
      `anonymous first-game journey must issue zero /api/* requests before any user commit; saw ${apiCalls.length}: ${JSON.stringify(apiCalls)}`,
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // S6: 收尾 = 「保留本地」（零网络写 + 哨兵 + 账本保留；不真合并）
  // ─────────────────────────────────────────────────────────────────
  await step("S6-teardown-keep-local-zero-network", async () => {
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForTimeout(400);
    const closed = await page.evaluate(
      () => document.querySelector('[data-testid="sync-confirm-dialog"]')?.hasAttribute("open") ?? false,
    );
    assert.equal(closed, false, "dialog must close after 保留本地");
    assert.equal(
      apiCalls.length,
      0,
      `保留本地 must issue zero /api/* requests; saw ${apiCalls.length}: ${JSON.stringify(apiCalls)}`,
    );
    const sentinel = await page.evaluate((key) => window.sessionStorage.getItem(key), DECLINED_KEY);
    assert.equal(sentinel, "1", `sessionStorage declined sentinel must be "1", got ${sentinel}`);
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_OFFLINE_KEY);
    assert.ok(raw && JSON.parse(raw).totalGames === 1, "local ledger must survive 保留本地");
    await shoot(page, "S6-keep-local.png");
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
