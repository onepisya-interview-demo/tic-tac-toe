#!/usr/bin/env node
// online-direct-qa.mjs — W-A2 (ulw-result-win-celebration D-4) probes.
//
// Production build probe (BASE_URL, hermetic tmp DB). Covers plan §5:
//   F7  直达 /online 有名 — mount 期 identity bootstrap（localStorage →
//       store，与首页 RoomGateMount 同源）→ 无弹框直接可玩 → 0,3,1,4,2
//       胜局 → POST /api/rooms/<room>/stats/outcomes 观察到 → 自动推
//       /result?room=<room>（URL + 成绩单可见）。
//   F8  直达 /online 无名 — 页内 RoomGateDialog 收名（[open] 断言）→
//       提交前零 /api/* 请求 → modal 阻断棋盘（force click 落不进子）→
//       提交房名 → 弹框关 → 可玩 → 胜局 → 记录 + 导航全流程。
//       （F9 首页回归 = home-return-qa.mjs + one-identity-qa.mjs，单独跑。）
//
// /result 断言刻意保持轻量（URL room 参数 + 成绩单可见 + result-name），
// 不做页面结构强断言 —— 并行 W-A 波会给 /result 加庆祝层。
//
// Usage:
//   BASE_URL=http://localhost:3112 node tests/qa/online-direct-qa.mjs
//   env: BASE_URL (default http://localhost:3000),
//        EVIDENCE_DIR (default .omx/evidence/online-direct-qa).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/online-direct-qa";
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

function isApi(url) {
  return url.includes("/api/");
}

// Shared: wait for the /result arrival with the right room + the ledger
// visible. Deliberately weak structural assertions (W-A adds a
// celebration layer to /result in parallel — do not over-constrain).
async function assertArrivedAtResult(page, ctx, room) {
  await page.waitForURL(`**/result?room=${encodeURIComponent(room)}`, {
    timeout: 10000,
  });
  // 等 /result 首屏可见（play-again 出现 = 导航完成）。
  await page.waitForSelector('[data-testid="play-again"]', { timeout: 10000 });
  assert.ok(
    page.url().endsWith(`/result?room=${encodeURIComponent(room)}`),
    `URL room 参数正确；got ${page.url()}`,
  );
  const name = await page.textContent('[data-testid="result-name"]');
  assert.ok(
    name && name.includes(room),
    `成绩单可见且房间名正确；got "${name}"`,
  );
  // 服务端权威行已累加（outcome POST 命中后的 row）。
  const r = await ctx.request.get(
    `${BASE}/api/rooms/${encodeURIComponent(room)}/stats`,
  );
  assert.equal(r.status(), 200, `GET /api/rooms/<room>/stats 200；got ${r.status()}`);
  const body = await r.json();
  assert.equal(
    body.stats.totalGames,
    1,
    `server totalGames = 1；got ${body.stats.totalGames}`,
  );
}

// F7 — 直达 /online 有名。
await step("F7 direct /online named: bootstrap → playable (no gate) → win → outcome POST → /result", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = `wa2f7-${RUN_SUFFIX}`;
    // Seed：预注册 room（hermetic 空库上 localStorage 有名 ≠ 服务端有
    // row；与 home-return-qa step07 的 seed 先例同源。服务端无 row 时
    // outcomes 404 零记录是既有边缘，见报告「偏差与未决」）。
    const seed = await ctx.request.post(`${BASE}/api/rooms`, {
      data: { room },
    });
    assert.equal(seed.status(), 200, `seed /api/rooms 200；got ${seed.status()}`);
    // 有名预置：addInitScript 在任何页面脚本前写入 localStorage。
    await ctx.addInitScript(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: room },
    );
    const outcomePosts = [];
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        req.url().includes("/stats/outcomes")
      ) {
        outcomePosts.push(req.url());
      }
    });
    // 直达 /online（绕过首页门）。
    await page.goto(`${BASE}/online`, { waitUntil: "networkidle" });
    // bootstrap 生效：无收名弹框。
    const gateOpen = await page
      .locator('[data-testid="room-gate-dialog"][open]')
      .count();
    assert.equal(gateOpen, 0, `有名直达无弹框；got open=${gateOpen}`);
    // 直接可玩：落第一子成功（cell-N-mark 只在有子时渲染 —— QA 契约）。
    await page.waitForSelector('[data-testid="status-bar"]', { timeout: 6000 });
    await page.click('[data-testid="cell-0"]');
    await page.waitForSelector('[data-testid="cell-0-mark"]', { timeout: 4000 });
    await shoot(page, "f7-named-playable.png");
    // waitForRequest 必须先建 promise 再触发动作——胜局 POST 在最后一手
    // click 的微任务里就发出，事后注册永远等不到（首跑实测）。
    const outcomeRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes(`/api/rooms/${encodeURIComponent(room)}/stats/outcomes`),
      { timeout: 10000 },
    );
    // 0,3,1,4,2 胜局（cell-0 已落是第一手，补 3,1,4,2；先手随机但
    // 先手必拿 0,1,2 上排三连）。
    await page.click('[data-testid="cell-3"]');
    await page.click('[data-testid="cell-1"]');
    await page.click('[data-testid="cell-4"]');
    await page.click('[data-testid="cell-2"]');
    await outcomeRequest;
    assert.equal(outcomePosts.length, 1, `outcomes POST 恰 1；got ${outcomePosts.length}`);
    await assertArrivedAtResult(page, ctx, room);
    await shoot(page, "f7-arrived-result.png");
  } finally {
    await browser.close();
  }
});

// F8 — 直达 /online 无名：页内收名 → 进入房间 → 可玩 → 胜局全流程。
await step("F8 direct /online anonymous: gate dialog [open] → zero api pre-submit → modal blocks board → submit → playable → win → full flow", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = `wa2f8-${RUN_SUFFIX}`;
    const apiRequests = [];
    page.on("request", (req) => {
      if (isApi(req.url())) {
        apiRequests.push({ method: req.method(), url: req.url() });
      }
    });
    // 全新 context（launchQA 默认零预置）直达 /online。
    await page.goto(`${BASE}/online`, { waitUntil: "networkidle" });
    // 收名弹框出现（[open] 属性，不是仅查存在）。
    await page.waitForSelector('[data-testid="room-gate-dialog"][open]', {
      timeout: 6000,
    });
    await shoot(page, "f8-anon-gate-open.png");
    // 提交前零 /api/* 请求（anti-silent-create：无名零网络行为）。
    assert.equal(
      apiRequests.length,
      0,
      `提交前零 /api/*；got ${JSON.stringify(apiRequests)}`,
    );
    // modal 阻断棋盘：force click 穿透不过 top layer，棋子落不进
    // （cell-0-mark 只在有子时渲染 —— QA 契约）。
    await page.click('[data-testid="cell-0"]', { force: true });
    await page.waitForTimeout(300);
    const markCount = await page.locator('[data-testid="cell-0-mark"]').count();
    assert.equal(markCount, 0, `modal 阻断下 cell-0 无棋子；got marks=${markCount}`);
    const stillOpen = await page
      .locator('[data-testid="room-gate-dialog"][open]')
      .count();
    assert.equal(stillOpen, 1, `弹框仍 [open]；got ${stillOpen}`);
    // 提交房名。postRoomSession 的 POST 同样先建 promise 再触发。
    const sessionRequest = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/rooms"),
      { timeout: 8000 },
    );
    await page.fill('[data-testid="room-gate-name"]', room);
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[data-testid="room-gate-confirm"]')
          ?.hasAttribute("disabled"),
      { timeout: 4000 },
    );
    await page.click('[data-testid="room-gate-confirm"]');
    await sessionRequest; // postRoomSession 恰 1 次 POST /api/rooms
    // 弹框关。
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[data-testid="room-gate-dialog"]')
          ?.hasAttribute("open"),
      { timeout: 8000 },
    );
    // 可玩：开局新鲜（提交内 startGame('online')），落子即进。
    await page.waitForSelector('[data-testid="status-bar"]', { timeout: 6000 });
    await page.click('[data-testid="cell-0"]');
    await page.waitForSelector('[data-testid="cell-0-mark"]', { timeout: 4000 });
    await shoot(page, "f8-named-playable.png");
    // 0,3,1,4,2 胜局（cell-0 已落，补 3,1,4,2）。
    const outcomeRequest = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes(`/api/rooms/${encodeURIComponent(room)}/stats/outcomes`),
      { timeout: 10000 },
    );
    await page.click('[data-testid="cell-3"]');
    await page.click('[data-testid="cell-1"]');
    await page.click('[data-testid="cell-4"]');
    await page.click('[data-testid="cell-2"]');
    await outcomeRequest;
    await assertArrivedAtResult(page, ctx, room);
    await shoot(page, "f8-arrived-result.png");
  } finally {
    await browser.close();
  }
});

await writeQaLog(EVIDENCE, {
  test: "online-direct-qa",
  status: "PASS",
  findings,
  runSuffix: RUN_SUFFIX,
});
console.log("\nALL ONLINE-DIRECT STEPS PASSED");
process.exit(0);
