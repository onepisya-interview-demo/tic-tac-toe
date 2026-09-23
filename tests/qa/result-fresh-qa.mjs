#!/usr/bin/env node
// result-fresh-qa.mjs — W-F (ulw-online-reset-and-result-fresh D-7/D-8) probes.
//
// Production build probe (BASE_URL, hermetic tmp DB). Covers:
//   W-F1 胜局新鲜度——进入房间（POST /api/rooms）→ /online → 0,3,1,4,2
//        胜局步法 → **自动导航到达的 /result 首帧** StatsGrid 总局数 = 1
//        （零手动 reload——探针全程无 page.reload()，到达即读）；对照
//        GET /api/rooms/{room}/stats 服务端值 = 1。
//   W-F2 平局新鲜度——第二房间 → driveDraw → 到达 /result 首帧总局数 = 1
//        且平局 = 1；服务端对照 draws = 1。
//
// 已知边界（D-8 拍板）：本地 sqlite 下无 seam 时竞态窗口毫秒级——本探针
// 在无修复实现上可能偶发通过；ordering 契约的**确定性**验证归 vitest
// （D-6/D-7 单测：写未落定不 push / 落定后 push / 失败仍 push / 哨兵写入
// 在 await 后）。本探针验 E2E 全链路不回归：自动导航发生 + 首帧即新账。
//
// Usage:
//   pnpm build
//   DATABASE_URL=file:/tmp/ulw-wr2/probe.db PORT=3112 pnpm start
//   BASE_URL=http://localhost:3112 node tests/qa/result-fresh-qa.mjs
//   env: BASE_URL (default http://localhost:3000),
//        EVIDENCE_DIR (default .omx/evidence/result-fresh-qa).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin, driveDraw } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/result-fresh-qa";
const ROOM_KEY = "ttt.room.name.v1";
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

// 进入房间（POST /api/rooms，幂等建档）+ 预置有名 localStorage，
// 直达 /online 绕过首页门（与 online-direct-qa F7 seed 先例同源）。
async function enterRoom(ctx, room) {
  const seed = await ctx.request.post(`${BASE}/api/rooms`, {
    data: { room },
  });
  assert.equal(seed.status(), 200, `seed /api/rooms 200；got ${seed.status()}`);
  await ctx.addInitScript(
    ({ k, n }) => window.localStorage.setItem(k, n),
    { k: ROOM_KEY, n: room },
  );
}

async function openOnlinePlayable(page) {
  await page.goto(`${BASE}/online`, { waitUntil: "networkidle" });
  const gateOpen = await page
    .locator('[data-testid="room-gate-dialog"][open]')
    .count();
  assert.equal(gateOpen, 0, `有名直达无弹框；got open=${gateOpen}`);
  await page.waitForSelector('[data-testid="status-bar"]', { timeout: 6000 });
}

// 自动导航到达 /result 首帧：等待 URL（导航由 ResultNavigator 发起），
// 等 StatsGrid 渲染后立即读值——全程零手动 reload，读到的就是自动
// 导航第一帧的服务端渲染账。
async function assertFreshFirstFrame(page, ctx, room, expected) {
  await page.waitForURL(`**/result?room=${encodeURIComponent(room)}`, {
    timeout: 10000,
  });
  assert.ok(
    page.url().endsWith(`/result?room=${encodeURIComponent(room)}`),
    `自动导航 URL room 参数正确；got ${page.url()}`,
  );
  await page.waitForSelector('[data-testid="result-stats"]', {
    timeout: 10000,
  });
  const values = await page
    .locator('[data-testid="result-stats"] [data-testid="stat-value"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-value")));
  for (const [idx, want] of Object.entries(expected)) {
    assert.equal(
      values[Number(idx)],
      want,
      `/result 首帧 stat-value[${idx}] = ${want}（零手动 reload）；got ${values[Number(idx)]}（all: ${JSON.stringify(values)}）`,
    );
  }
  const name = await page.textContent('[data-testid="result-name"]');
  assert.ok(
    name && name.includes(room),
    `成绩单可见且房间名正确；got "${name}"`,
  );
  // 服务端权威对照：UPSERT 确已落库。
  const r = await ctx.request.get(
    `${BASE}/api/rooms/${encodeURIComponent(room)}/stats`,
  );
  assert.equal(
    r.status(),
    200,
    `GET /api/rooms/<room>/stats 200；got ${r.status()}`,
  );
  const body = await r.json();
  return body.stats;
}

// W-F1 — 胜局：自动导航首帧即见 totalGames = 1（零手动 reload）。
await step("W-F1 win freshness: seed room → /online → 0,3,1,4,2 win → auto-nav /result first frame totalGames=1 (zero reload)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = `wff1-${RUN_SUFFIX}`;
    await enterRoom(ctx, room);
    await openOnlinePlayable(page);
    const outcomePosts = [];
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        req.url().includes("/stats/outcomes")
      ) {
        outcomePosts.push(req.url());
      }
    });
    // waitForRequest 先建 promise 再触发动作（胜局 POST 在最后一手
    // click 的微任务里发出——首跑实证，事后注册永远等不到）。
    const outcomeRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes(`/api/rooms/${encodeURIComponent(room)}/stats/outcomes`),
      { timeout: 10000 },
    );
    await driveTopRowWin(page);
    await outcomeRequest;
    assert.equal(outcomePosts.length, 1, `outcomes POST 恰 1；got ${outcomePosts.length}`);
    const stats = await assertFreshFirstFrame(page, ctx, room, {
      0: "1", // 总场次
    });
    assert.equal(stats.totalGames, 1, `server totalGames = 1；got ${stats.totalGames}`);
    await shoot(page, "wf1-fresh-first-frame.png");
  } finally {
    await browser.close();
  }
});

// W-F2 — 平局：自动导航首帧 totalGames = 1 且 draws = 1（零手动 reload）。
await step("W-F2 draw freshness: seed room → /online → driveDraw → auto-nav /result first frame draws=1 (zero reload)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = `wff2-${RUN_SUFFIX}`;
    await enterRoom(ctx, room);
    await openOnlinePlayable(page);
    const outcomeRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes(`/api/rooms/${encodeURIComponent(room)}/stats/outcomes`),
      { timeout: 15000 },
    );
    await driveDraw(page);
    await outcomeRequest;
    const stats = await assertFreshFirstFrame(page, ctx, room, {
      0: "1", // 总场次
      3: "1", // 平局
    });
    assert.equal(stats.draws, 1, `server draws = 1；got ${stats.draws}`);
    assert.equal(stats.totalGames, 1, `server totalGames = 1；got ${stats.totalGames}`);
    await shoot(page, "wf2-draw-first-frame.png");
  } finally {
    await browser.close();
  }
});

await writeQaLog(EVIDENCE, {
  probe: "result-fresh-qa",
  base: BASE,
  runSuffix: RUN_SUFFIX,
  findings,
});
console.log("\nALL RESULT-FRESH STEPS PASSED");
process.exit(0);
