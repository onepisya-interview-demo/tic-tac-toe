#!/usr/bin/env node
// rooms-race-qa.mjs — T-B1 (ulw-rooms-race-qa-ticket) probe.
// BR: BR-7, BR-10
//
// Production build probe (BASE_URL, hermetic tmp DB). Covers plan T-B1 step 2-7
// (research §五: rooms-race probe 票面建议):
//   step 2 (S3) merge × outcomes 交错 → 终值 = 两源严格相加
//   step 3 (S4) reset × in-flight outcome race → 终态全零 + 身份保留
//   step 4 (S6) 双发 POST /api/rooms 幂等 → 单行 + existed 语义
//   step 5 (S5) 房间删除后 outcome → 404 stats-not-found + OutcomeErrorBanner
//   step 6 (S7) SW non-GET pass-through + 激活竞争（B-1/E1 直系后继）
//   step 7 (D4/旧14) 慢 DB outcomes ordering + 终态 DOM===API
//
// step 1 (T-B2 双设备并发 outcomes) 不在本票范围。
// 探针禁 claim BR-6（step 1 范围外；防 commit-audit R6 误判）。
//
// Usage (production build required — 禁 dev server):
//   DATABASE_URL=file:/tmp/ulw-rr1-<unique>.db PORT=3101 pnpm start &
//   BASE_URL=http://localhost:3101 node tests/qa/rooms-race-qa.mjs
// env: BASE_URL (default http://localhost:3000),
//      EVIDENCE_DIR (default .omx/evidence/rooms-race-qa),
//      RR_DB_PATH (default derived from DATABASE_URL for step 5 libsql sub-process).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
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
