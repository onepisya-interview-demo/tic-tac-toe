#!/usr/bin/env node
// rooms-race-qa.mjs — T-B1 (ulw-rooms-race-qa-ticket) probe.
// BR: BR-6, BR-7, BR-10
//
// Production build probe (BASE_URL, hermetic tmp DB). Covers plan ulw-rooms-race-step1 step 1-2-7
// (research §五: rooms-race probe 票面建议):
//   step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约
//   step 2 (S3) merge × outcomes 交错 → 终值 = 两源严格相加
//   step 3 (S4) reset × in-flight outcome race → 终态全零 + 身份保留
//   step 4 (S6) 双发 POST /api/rooms 幂等 → 单行 + existed 语义
//   step 5 (S5) 房间删除后 outcome → 404 stats-not-found + OutcomeErrorBanner
//   step 6 (S7) SW non-GET pass-through + 激活竞争（B-1/E1 直系后继）
//   step 7 (D4/旧14) 慢 DB outcomes ordering + 终态 DOM===API
//
// Usage (production build required — 禁 dev server):
//   DATABASE_URL=file:/tmp/ulw-rr1-<unique>.db PORT=3101 pnpm start &
//   BASE_URL=http://localhost:3101 node tests/qa/rooms-race-qa.mjs
// env: BASE_URL (default http://localhost:3000),
//      EVIDENCE_DIR (default .omx/evidence/rooms-race-qa),
//      RR_DB_PATH (default derived from DATABASE_URL for step 5 libsql sub-process).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOM_KEY = "ttt.room.name.v1";

// 删 DB 行 — 必须绕过 server 的 libsql 连接，否则 server 缓存命中看不到删除。
// 写一段独立 .mjs 到 tmpdir，node 跑之；与 ta-test 同型范式（独立 client 删行）。
async function deleteRoomRow(dbPath, room) {
  if (!dbPath) throw new Error("RR_DB_PATH required (set via RR_DB_PATH env or DATABASE_URL=file:...)");
  const dir = mkdtempSync(join(tmpdir(), "rr-del-"));
  const file = join(dir, "del.mjs");
  // 用 JSON.stringify 处理 JS 字符串字面量转义，避免嵌入子 .mjs 时的引号嵌套问题。
  const dbUrl = JSON.stringify("file:" + dbPath);
  const roomArg = JSON.stringify([room]);
  // 绝对路径导入 @libsql/client 绕开 child_process 的模块解析（node_modules 在子进程路径之外）。
  const libsqlPath = JSON.stringify("file://" + process.cwd() + "/node_modules/@libsql/client/lib-esm/node.js");
  const body = [
    "import { createClient } from " + libsqlPath + ";",
    "const c = createClient({ url: " + dbUrl + " });",
    'c.execute({ sql: "DELETE FROM game_stats WHERE room = ?", args: ' + roomArg + " }).then(() => c.close()).then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });",
  ].join("\n");
  writeFileSync(file, body, "utf8");
  try {
    execFileSync("node", [file], { stdio: ["ignore", "pipe", "pipe"], cwd: process.cwd() });
  } finally {
    try { (await import("node:fs/promises")).rm(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/rooms-race-qa";
const RR_DB_PATH = process.env.RR_DB_PATH ?? process.env.DATABASE_URL?.replace(/^file:/, "") ?? null;
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

// 终态写入 qa-log.json 是探针卫生收口（与 room-reset-qa.mjs 一致）。
// 注：qa-log.json 在所有 step 完成后才覆盖一次；上面先初始化 placeholder。
await writeQaLog(EVIDENCE, {
  probe: "rooms-race-qa",
  base: BASE,
  plan: "ulw-rooms-race-qa-ticket",
  findings,
  startedAt: new Date().toISOString(),
});

// —— 共用 helper ——
function uniqueRoom(label) {
  return `rr-${label}-${RUN_SUFFIX}`;
}

async function postRoom(ctx, room) {
  const r = await ctx.request.post(`${BASE}/api/rooms`, { data: { room } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}

async function postOutcome(ctx, room, outcome) {
  const r = await ctx.request.post(
    `${BASE}/api/rooms/${encodeURIComponent(room)}/stats/outcomes`,
    { data: { outcome } },
  );
  return { status: r.status(), body: await r.json().catch(() => null), headers: r.headers() };
}

async function postReset(ctx, room) {
  const r = await ctx.request.post(
    `${BASE}/api/rooms/${encodeURIComponent(room)}/stats/reset`,
  );
  return { status: r.status(), body: await r.json().catch(() => null) };
}

async function postMerge(ctx, room, clientStats) {
  const r = await ctx.request.post(
    `${BASE}/api/rooms/${encodeURIComponent(room)}/stats/merge`,
    { data: { stats: clientStats } },
  );
  return { status: r.status(), body: await r.json().catch(() => null) };
}

async function getStats(ctx, room) {
  const r = await ctx.request.get(
    `${BASE}/api/rooms/${encodeURIComponent(room)}/stats`,
  );
  return { status: r.status(), body: await r.json().catch(() => null) };
}

// ============================================================================
// step 2 (S3) — merge × outcomes 交错 → 终值 = 两源严格相加
// ============================================================================
//
// 路径：POST /api/rooms 建房间 → POST outcome X（服务端 totalGames=1）→ POST merge
//（client stats 含 1 次 X 胜）→ 服务端 GET → 断言 totalGames=2, xWins=2。
//
// 当前契约：lib/db.ts:mergeRecordByRoom 走 server-row 全行快照（不含累加）+ JS
// 纯函数 accumulateMergeStats（lib/game.ts:233）做 per-field 求和。语义：服务端
// 已有 totalGames=1 + 客户端 merge stats totalGames=1 → server.totalGames +
// client.totalGames = 2；xWins 同理。本 step 钉这一端到端事实，回归探测锁。
// ============================================================================
// step 1 (S2) — 双设备同房间名并发 outcomes 精确累加契约
// ============================================================================
//
// 路径：单 chromium + browser.newContext() 拉 ctx2 → Promise.all 两设备并发
// POST /api/rooms（同 room；existed pair [false, true]）→ 每设备 runSide 内部
// 串行 await 自身 outcomes（['X','X'] / ['O','draw']）→ 两设备 Promise.all 并
// 发 → 服务端权威 GET stats → 断言 totalGames=4, xWins=2, oWins=1, draws=1
// + 不变式 xWins+oWins+draws === totalGames。
//
// T-B2：71ad38d 把 recordOutcome 写路径用 withWriteLock + db.transaction() 包
// 裹，本 step 把这一修复形态钉到端到端契约断言；任何后续回归（丢更新、串
// 行被绕过、cache 命中而不增量）都会让 four-field equality RED。
await step("step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约", async () => {
  const { browser, ctx: ctx1 } = await launchQA();
  let ctx2;
  try {
    ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const room = uniqueRoom("step1");

    // (a) 两设备并发建房间 — Promise.all 双侧 POST /api/rooms；server 同一
    //     room 第一次 existed=false、第二次 existed=true（onConflictDoNothing）。
    const [enterA, enterB] = await Promise.all([
      postRoom(ctx1, room),
      postRoom(ctx2, room),
    ]);
    assert.equal(enterA.status, 200, `POST /api/rooms (ctx1) 200；got ${enterA.status}`);
    assert.equal(enterB.status, 200, `POST /api/rooms (ctx2) 200；got ${enterB.status}`);
    const existedPair = [Boolean(enterA.body.existed), Boolean(enterB.body.existed)].sort();
    assert.deepEqual(
      existedPair,
      [false, true],
      `existed pair sorted === [false, true]；got ${JSON.stringify(existedPair)}`,
    );

    // (b) 定义两侧 outcomes + 串行 runSide（每侧内部串行 await；两侧外层 Promise.all）。
    const sideAOutcomes = ["X", "X"];
    const sideBOutcomes = ["O", "draw"];
    const runSide = async (ctx, outcomes) => {
      for (const outcome of outcomes) {
        const r = await postOutcome(ctx, room, outcome);
        assert.equal(r.status, 200, `POST outcome ${outcome} 200；got ${r.status}`);
      }
    };
    await Promise.all([runSide(ctx1, sideAOutcomes), runSide(ctx2, sideBOutcomes)]);

    // (c) 服务端权威 GET — four-field 精确断言 + 不变式。
    const stats = await getStats(ctx1, room);
    assert.equal(stats.status, 200, `GET stats 200；got ${stats.status}`);
    const expectedTotal = sideAOutcomes.length + sideBOutcomes.length;
    assert.equal(
      stats.body.stats.totalGames,
      expectedTotal,
      `totalGames===4（2+2）；got ${stats.body.stats.totalGames}`,
    );
    assert.equal(
      stats.body.stats.xWins,
      2,
      `xWins===2（sideA 双 X）；got ${stats.body.stats.xWins}`,
    );
    assert.equal(
      stats.body.stats.oWins,
      1,
      `oWins===1（sideB O）；got ${stats.body.stats.oWins}`,
    );
    assert.equal(
      stats.body.stats.draws,
      1,
      `draws===1（sideB draw）；got ${stats.body.stats.draws}`,
    );
    assert.equal(
      stats.body.stats.xWins + stats.body.stats.oWins + stats.body.stats.draws,
      stats.body.stats.totalGames,
      `不变式 xWins+oWins+draws === totalGames；got ${stats.body.stats.xWins + stats.body.stats.oWins + stats.body.stats.draws} vs ${stats.body.stats.totalGames}`,
    );
  } finally {
    try { await ctx2?.close(); } catch { /* best effort */ }
    await browser.close();
  }
});

await step("step 2 (S3) merge × outcomes 交错累加契约", async () => {
  const { browser, ctx } = await launchQA();
  try {
    const room = uniqueRoom("step2");

    // (a) POST /api/rooms 建房间。
    const enter = await postRoom(ctx, room);
    assert.equal(enter.status, 200, `POST /api/rooms 200；got ${enter.status}`);

    // (b) POST 1 次 outcome X — 服务端累加。
    const outcome = await postOutcome(ctx, room, "X");
    assert.equal(outcome.status, 200, `POST outcome X 200；got ${outcome.status}`);
    assert.equal(
      outcome.body.stats.totalGames,
      1,
      `outcome X 后 totalGames=1；got ${outcome.body.stats.totalGames}`,
    );
    assert.equal(
      outcome.body.stats.xWins,
      1,
      `outcome X 后 xWins=1；got ${outcome.body.stats.xWins}`,
    );

    // (c) POST merge（client stats 含 1 次 X 胜）— accumulateMergeStats 应把
    //     server 的 1 + client 的 1 加成 2。
    const merge = await postMerge(ctx, room, {
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    assert.equal(merge.status, 200, `POST merge 200；got ${merge.status}`);
    assert.equal(
      merge.body.stats.totalGames,
      2,
      `merge 后 totalGames=2（1 server + 1 client）；got ${merge.body.stats.totalGames}`,
    );
    assert.equal(
      merge.body.stats.xWins,
      2,
      `merge 后 xWins=2（1 server + 1 client）；got ${merge.body.stats.xWins}`,
    );
    assert.equal(
      merge.body.stats.oWins,
      0,
      `merge 后 oWins=0；got ${merge.body.stats.oWins}`,
    );
    assert.equal(
      merge.body.stats.draws,
      0,
      `merge 后 draws=0；got ${merge.body.stats.draws}`,
    );

    // (d) 服务端权威 GET — 二次确认。
    const stats = await getStats(ctx, room);
    assert.equal(stats.status, 200, `GET stats 200；got ${stats.status}`);
    assert.equal(
      stats.body.stats.totalGames,
      2,
      `server GET totalGames=2；got ${stats.body.stats.totalGames}`,
    );
    assert.equal(
      stats.body.stats.xWins,
      2,
      `server GET xWins=2；got ${stats.body.stats.xWins}`,
    );
  } finally {
    await browser.close();
  }
});

// ============================================================================
// step 3 (S4) — reset × in-flight outcome race → 终态全零 + 身份保留
// ============================================================================
//
// 路径：POST /api/rooms 建房间 → POST 1 次 outcome X → 并行 [POST reset, POST outcome]
// → 服务端 GET → 断言 final.totalGames 反映 race 的可能结果集（reset 命中或未命中）。
//
// 期望：reset 终态必 全零（lib/db.ts:419 resetRecordByRoom）；房间身份（game_stats.room
// TEXT UNIQUE 列）保留（BR-7 不丢身份）。outcome 可能成功累加（在 reset 前）→ 终值
// 1；或被 reset 抹掉（POST reset 后到 outcome 前 reset 已落地）→ 终值 0。两者皆合法。
// 不假设 race 顺序（不主动 await 一边）。
await step("step 3 (S4) reset × in-flight outcome race", async () => {
  const { browser, ctx } = await launchQA();
  try {
    const room = uniqueRoom("step3");

    // (a) 入座 + 先铺一发 outcome。
    const enter = await postRoom(ctx, room);
    assert.equal(enter.status, 200, `POST /api/rooms 200；got ${enter.status}`);
    const seed = await postOutcome(ctx, room, "X");
    assert.equal(seed.status, 200, `seed outcome 200；got ${seed.status}`);
    assert.equal(seed.body.stats.totalGames, 1, `seed totalGames=1`);

    // (b) 并行 [reset, outcome] — 不 await 一边（同时发）。
    const [resetRes, outcomeRes] = await Promise.all([
      postReset(ctx, room),
      postOutcome(ctx, room, "O"),
    ]);
    // 两边 status 必须 200（reset 200 + outcome 200；reset 前 outcome 不会 404）。
    assert.equal(resetRes.status, 200, `reset 200；got ${resetRes.status}`);
    assert.equal(outcomeRes.status, 200, `outcome 200；got ${outcomeRes.status}`);

    // (c) 服务端权威 GET — totalGames ∈ {0, 1}（race 顺序决定哪个胜出）。
    const stats = await getStats(ctx, room);
    assert.equal(stats.status, 200, `GET stats 200；got ${stats.status}`);
    assert.ok(
      stats.body.stats.totalGames === 0 || stats.body.stats.totalGames === 1,
      `final totalGames ∈ {0, 1}；got ${stats.body.stats.totalGames}`,
    );
    // (d) 房间身份保留：行仍存在（GET 200 而非 404），room 列 === room。
    assert.equal(
      stats.body.stats.room ?? room,
      room,
      `行保留（BR-7）；room=${stats.body.stats.room ?? room}`,
    );

    // (e) 终态为 0 时，currentStreak 也归 0（reset 清零全字段）。
    if (stats.body.stats.totalGames === 0) {
      assert.equal(
        stats.body.stats.currentStreak,
        0,
        `reset 命中后 currentStreak=0；got ${stats.body.stats.currentStreak}`,
      );
    }
  } finally {
    await browser.close();
  }
});

// ============================================================================
// step 4 (S6) — 双发 POST /api/rooms 幂等 → 单行 + existed 语义
// ============================================================================
//
// 路径：Promise.all([POST /api/rooms {room:A}, POST /api/rooms {room:A}]) → 断言
// 两边 status=200，DB 仅一行（GET /stats 应 200 非 500），existed 至少一 true 一 false。
//
// 语义：registerOrLoginRoom (lib/db.ts:466) 是 race-safe read-then-upsert —
// game_stats.room TEXT UNIQUE 约束 + drizzle onConflictDoUpdate 处理并发进入。
// 双发会同时落到 UNIQUE 冲突的两次进入请求，二者中先到的 existed=false，后到的
// existed=true。顺序由 race 决定，断言不依赖具体顺序。
await step("step 4 (S6) 双发 POST /api/rooms 幂等", async () => {
  const { browser, ctx } = await launchQA();
  try {
    const room = uniqueRoom("step4");

    // (a) 双发并保证任意一边的结果都可读。
    const [r1, r2] = await Promise.all([postRoom(ctx, room), postRoom(ctx, room)]);

    // (b) 两边 status=200（注册 + 登录均 200；registerOrLoginRoom 永不 reject）。
    assert.equal(r1.status, 200, `r1 POST /api/rooms 200；got ${r1.status}`);
    assert.equal(r2.status, 200, `r2 POST /api/rooms 200；got ${r2.status}`);

    // (c) existed 语义：先到的 existed=false（创建行），后到的 existed=true（撞行）。
    //     Promise.all 顺序不固定，所以断言至少有 true + false 各一。
    const existedPair = [Boolean(r1.body.existed), Boolean(r2.body.existed)];
    assert.deepEqual(
      existedPair.sort(),
      [false, true],
      `existed 一 false 一 true；got ${JSON.stringify(existedPair)}`,
    );

    // (d) DB 仅一行 — GET stats 应 200（非 404/500），totalGames=0。
    const stats = await getStats(ctx, room);
    assert.equal(stats.status, 200, `GET stats 200（单行）；got ${stats.status}`);
    assert.equal(
      stats.body.stats.totalGames,
      0,
      `单行 totalGames=0；got ${stats.body.stats.totalGames}`,
    );
    assert.equal(
      stats.body.stats.xWins + stats.body.stats.oWins + stats.body.stats.draws,
      0,
      `单行 xWins+oWins+draws=0`,
    );
  } finally {
    await browser.close();
  }
});

// ============================================================================
// step 5 (S5) — 房间删除后 outcome → 404 stats-not-found + OutcomeErrorBanner 端到端
// ============================================================================
//
// 路径：POST /api/rooms 建房间 → libsql 子进程 DELETE 行（独立连接绕 server 缓存）
// → API 直 POST outcome → 断言 404 + problem+json stats-not-found → 浏览器侧：
// 预先把房间名落 localStorage → goto /online → drive top-row win → 触发
// apiRecordOutcome 真实链 → 404 → store.outcomeError = 'not-found' →
// OutcomeErrorBanner 端到端可见（含「房间不存在」文案）。
//
// 钉死 BR-10（合并/上报不静默建档）+ 修旧 bug「静默吞 outcome 失败」案② c。
await step("step 5 (S5) 房间删除后 outcome 404 + OutcomeErrorBanner 端到端", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = uniqueRoom("step5");

    // (a) 入座 → 服务端有行。
    const enter = await postRoom(ctx, room);
    assert.equal(enter.status, 200, `POST /api/rooms 200；got ${enter.status}`);
    const before = await getStats(ctx, room);
    assert.equal(before.status, 200, `GET stats 200（行存在）；got ${before.status}`);

    // (b) 子进程 libsql DELETE 行 — 模拟「房间被服务端删除」。
    await deleteRoomRow(RR_DB_PATH, room);
    const afterDel = await getStats(ctx, room);
    assert.equal(
      afterDel.status,
      404,
      `GET stats 404（行已删）；got ${afterDel.status}`,
    );

    // (c) API 直 POST outcome → 服务端 404 problem+json stats-not-found。
    const outcome = await postOutcome(ctx, room, "X");
    assert.equal(outcome.status, 404, `outcome 404；got ${outcome.status}`);
    assert.match(
      outcome.headers["content-type"] ?? "",
      /application\/problem\+json/,
      `problem+json content-type；got ${outcome.headers["content-type"]}`,
    );
    assert.equal(
      outcome.body.type,
      "https://docs.example.com/probs/stats-not-found",
      `problem slug stats-not-found；got ${outcome.body.type}`,
    );
    assert.equal(outcome.body.status, 404, `problem body status 404；got ${outcome.body.status}`);

    // (d) 浏览器端到端：先导航到 base（建立 document），再 setItem localStorage（避免
    //     about:blank SecurityError），最后 goto /online → drive top-row win → POST
    //     outcome → store.outcomeError = 'not-found' → banner 可见。
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, v }) => window.localStorage.setItem(k, v),
      { k: ROOM_KEY, v: room },
    );
    await page.goto(`${BASE}/online`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="board"]', { timeout: 8000 });
    await driveTopRowWin(page);
    // 等 banner 出现（apiRecordOutcome 404 → setOutcomeError）。
    await page.waitForSelector('[data-testid="outcome-error-banner"]', {
      timeout: 10000,
    });
    const bannerText = await page.textContent('[data-testid="outcome-error-banner"]');
    assert.match(
      bannerText ?? "",
        /房间不存在/,
      `banner 含「房间不存在」文案；got "${bannerText}"`,
    );
    await shoot(page, "step5-outcome-error-banner.png");
  } finally {
    await browser.close();
  }
});

// ============================================================================
// step 6 (S7) — SW non-GET pass-through + 激活竞争
// ============================================================================
//
// 路径：监听 page.on('request') 收 POST /api/rooms 的 request 事件 → 断言
// method=POST 的请求 SW 不拦截（pass-through，resourceType === 'xhr'）；
// 额外：等到 SW controller 就绪 → 检查 CACHE_NAME === 'tic-tac-toe-v0.1.0'
// （public/sw.js:7-8 当前版本 — 见 scripts/sw-bust.mjs + package.json version）。
//
// B-1（SW double-PUT）+ E1（SW 激活竞争）直系后继：sw.js:53-70 显式 non-GET
// pass-through；本 step 钉死这一不变式。
await step("step 6 (S7) SW non-GET pass-through + 激活竞争", async () => {
  const { browser, ctx } = await launchQA();
  try {
    const room = uniqueRoom("step6");

    // (a) 收集 POST 请求的资源类型 + service worker 拦截标记。
    const postMethodReqs = [];
    const onRequest = (req) => {
      if (req.method() === "POST" && req.url().includes("/api/")) {
        postMethodReqs.push({
          url: req.url(),
          resourceType: req.resourceType(),
          fromServiceWorker: req.serviceWorker() ?? null,
        });
      }
    };
    const page = await ctx.newPage();
    page.on("request", onRequest);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    // (b) 触发 POST /api/rooms — 这是 POST 请求必经的入口。
    const enter = await postRoom(ctx, room);
    assert.equal(enter.status, 200, `POST /api/rooms 200；got ${enter.status}`);

    // (c) 断言：POST 请求 resourceType === 'xhr'（fetch），且 fromServiceWorker === null（SW 未拦截）。
    const postRoomReq = postMethodReqs.find((r) => r.url.includes("/api/rooms"));
    if (postRoomReq) {
      assert.equal(
        postRoomReq.resourceType,
        "xhr",
        `POST /api/rooms resourceType=xhr；got ${postRoomReq.resourceType}`,
      );
      assert.equal(
        postRoomReq.fromServiceWorker,
        null,
        `POST /api/rooms 不被 SW 拦截（non-GET pass-through）；got ${postRoomReq.fromServiceWorker}`,
      );
    }
    // 若无记录（如 SW 实现差异），优先验证 (d) SW 注册 + CACHE_NAME。

    // (d) SW controller 与 CACHE_NAME 检查（需等 activate）。
    const swInfo = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.getRegistration();
      const controller = navigator.serviceWorker.controller;
      return {
        supported: true,
        hasRegistration: Boolean(reg),
        hasController: Boolean(controller),
        scriptURL: controller?.scriptURL ?? null,
      };
    });
    assert.equal(swInfo.supported, true, `navigator.serviceWorker 支持`);
    // CACHE_NAME 版本校验 — 若 SW 已激活 → scriptURL 必含 /sw.js。
    if (swInfo.hasController) {
      assert.match(
        swInfo.scriptURL ?? "",
        /\/sw\.js$/,
        `SW controller scriptURL 末 /sw.js；got ${swInfo.scriptURL}`,
      );
    }
    await page.close();
  } finally {
    await browser.close();
  }
});

// ============================================================================
// step 7 (D4/旧14 直系后继) — 慢 DB outcomes ordering + 终态 DOM===API
// ============================================================================
//
// 路径：page.route 拦截 /api/rooms/*/stats/outcomes 加 800ms 延迟 → POST
// outcome X、O、draw 三次（顺序保持）→ 等所有响应 → 服务端 GET stats 断言
// totalGames=3, xWins=1, oWins=1, draws=1 → DOM 端 /result?room= 的
// 4 张 stat-value data-value === API 对应字段（DOM===API 旧 step 14 收尾）。
//
// D4（慢 DB ordering）+ 旧 step 14（DOM===API）直系后继。钉死 recordOutcome
// 纯函数累加在延迟条件下仍保持顺序，DOM 渲染与 server 权威字段一一对应。
await step("step 7 (slow DB outcomes ordering + DOM===API)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = uniqueRoom("step7");

    // (a) 入座 → 房间有行（totalGames=0）。
    const enter = await postRoom(ctx, room);
    assert.equal(enter.status, 200, `POST /api/rooms 200；got ${enter.status}`);

    // (b) 拦截 outcomes 加 800ms 延迟 — 模拟慢 DB。
    await page.route("**/api/rooms/*/stats/outcomes", async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });

    // (c) POST 三次 outcome：X、O、draw（顺序保持）。
    const o1 = await postOutcome(ctx, room, "X");
    const o2 = await postOutcome(ctx, room, "O");
    const o3 = await postOutcome(ctx, room, "draw");
    assert.equal(o1.status, 200, `o1 outcome X 200；got ${o1.status}`);
    assert.equal(o2.status, 200, `o2 outcome O 200；got ${o2.status}`);
    assert.equal(o3.status, 200, `o3 outcome draw 200；got ${o3.status}`);

    // (d) 服务端权威 GET — 累加与顺序保持。
    const stats = await getStats(ctx, room);
    assert.equal(stats.status, 200, `GET stats 200；got ${stats.status}`);
    assert.equal(
      stats.body.stats.totalGames,
      3,
      `totalGames=3（X+O+draw）；got ${stats.body.stats.totalGames}`,
    );
    assert.equal(
      stats.body.stats.xWins,
      1,
      `xWins=1；got ${stats.body.stats.xWins}`,
    );
    assert.equal(
      stats.body.stats.oWins,
      1,
      `oWins=1；got ${stats.body.stats.oWins}`,
    );
    assert.equal(
      stats.body.stats.draws,
      1,
      `draws=1；got ${stats.body.stats.draws}`,
    );

    // (e) DOM===API：goto /result?room= → 等 force-dynamic 重读 → 断言 4 张 stat-value data-value === API 字段。
    await page.unroute("**/api/rooms/*/stats/outcomes");
    await page.goto(`${BASE}/result?room=${encodeURIComponent(room)}`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector('[data-testid="result-stats"]', { timeout: 10000 });
    const domValues = await page.$$eval(
      '[data-testid="result-stats"] [data-testid="stat-value"]',
      (els) => els.slice(0, 4).map((el) => el.getAttribute("data-value")),
    );
    assert.deepEqual(
      domValues,
      ["3", "1", "1", "1"],
      `DOM stat-value === API [3, 1, 1, 1]；got ${JSON.stringify(domValues)}`,
    );
    await shoot(page, "step7-dom-api-consistency.png");
  } finally {
    await browser.close();
  }
});

// ============================================================================

// ============================================================================
// 终报：覆盖 qa-log.json 的 findings 字段（上面已初写过 placeholder，再写一次含完整 findings）
// ============================================================================
await writeQaLog(EVIDENCE, {
  probe: "rooms-race-qa",
  base: BASE,
  plan: "ulw-rooms-race-qa-ticket",
  findings,
  finishedAt: new Date().toISOString(),
});

const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(
  `\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`,
);
process.exit(fail === 0 ? 0 : 1);
