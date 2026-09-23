#!/usr/bin/env node
// offline-result-qa.mjs — W3-probes (ulw-room-migration-home-landing) Q4.
//
// Production build probe (BASE_URL=http://localhost:3199, hermetic tmp DB).
// Covers plan §3.5 Q4 + AC A8:
//   - /result?room= 三分支（无名 fallback / 有名无行 → 404 译空态 / 有名有行 SSR 战绩）
//   - 旧 ?name= 走 fallback（不 301）
//
// 本探针不再驱动 /offline 棋局——Q4 只验 SSR 结果页的三分支。/offline 棋局行为
// 由 offline-mode-qa 覆盖。
//
// Usage:
//   node tests/qa/offline-result-qa.mjs
//   env: BASE_URL (default http://localhost:3199),
//        EVIDENCE_DIR (default .omx/evidence/offline-result-qa).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/offline-result-qa";
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

const { browser, ctx, page } = await launchQA();

try {
  // 分支 1：无名访问 /result → fallback 文案含「房间」术语
  await step("01 fallback: no room → create-room guidance", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto(`${BASE}/result`, { waitUntil: "networkidle" });
    const fbVisible = await page.isVisible('[data-testid="result-fallback"]');
    assert.ok(fbVisible, `无名 /result 走 fallback；got visible=${fbVisible}`);
    const html = await page.content();
    // fallback 文案：plan §2.6 提到「在首页点「在线对战」创建房间后再来查看战绩」
    assert.ok(/创建房间|在线对战|房间/.test(html), `fallback 文案含「房间」术语`);
    // 不渲染 result-stats
    const statsCount = await page.locator('[data-testid="result-stats"]').count();
    assert.equal(statsCount, 0, `fallback 不渲染 result-stats；got count=${statsCount}`);
    // result-back-home 按钮可用
    const backHome = await page.locator('[data-testid="result-back-home"]').count();
    assert.equal(backHome, 1, `fallback 含返回首页按钮`);
    await shoot(page, "01-fallback-no-room.png");
  });

  // 分支 2：有名但 server 无行 → 404 → 客户端译空态（result-empty）
  await step("02 empty: named but no server row → empty state", async () => {
    const ghost = `ghost-${RUN_SUFFIX}`;
    await page.goto(`${BASE}/result?room=${ghost}`, { waitUntil: "networkidle" });
    const emptyVisible = await page.isVisible('[data-testid="result-empty"]');
    assert.ok(emptyVisible, `有名无行 → 译空态；got visible=${emptyVisible}`);
    // 不渲染 result-stats
    const statsCount = await page.locator('[data-testid="result-stats"]').count();
    assert.equal(statsCount, 0, `空态不渲染 result-stats；got count=${statsCount}`);
    await shoot(page, "02-named-no-row-empty.png");
  });

  // 分支 3：有名 + server 有行 → SSR 战绩
  await step("03 stats: named + server row → SSR with values", async () => {
    const name = `result-real-${RUN_SUFFIX}`;
    // 预注册 + 灌战绩
    const sess = await ctx.request.post(`${BASE}/api/rooms`, {
      data: { room: name },
    });
    assert.equal(sess.status(), 200, `预注册 200；got ${sess.status()}`);
    const merge = await ctx.request.post(
      `${BASE}/api/rooms/${encodeURIComponent(name)}/stats/merge`,
      {
        data: {
          stats: { totalGames: 7, xWins: 4, oWins: 2, draws: 1, currentStreak: 3 },
        },
      },
    );
    assert.equal(merge.status(), 200);
    await page.goto(`${BASE}/result?room=${name}`, { waitUntil: "networkidle" });
    const statsVisible = await page.isVisible('[data-testid="result-stats"]');
    assert.ok(statsVisible, `有名有行 → SSR 战绩；got visible=${statsVisible}`);
    const html = await page.content();
    // SSR HTML 包含战绩数字
    assert.ok(/data-value="7"/.test(html), `SSR 含 totalGames=7`);
    assert.ok(/data-value="4"/.test(html), `SSR 含 xWins=4`);
    assert.ok(/data-value="2"/.test(html), `SSR 含 oWins=2`);
    assert.ok(/data-value="1"/.test(html), `SSR 含 draws=1`);
    // result-actions 渲染（play-again + back-home）
    const playAgainCount = await page.locator('[data-testid="play-again"]').count();
    const backHomeCount = await page.locator('[data-testid="back-home"]').count();
    assert.equal(playAgainCount, 1, `result-actions 含 play-again`);
    assert.equal(backHomeCount, 1, `result-actions 含 back-home`);
    await shoot(page, "03-stats-named-with-row.png");
  });

  // 分支 4：旧 ?name= → 优雅 fallback（不 301）
  await step("04 legacy ?name= → fallback (no 301 redirect)", async () => {
    const realName = `result-real-${RUN_SUFFIX}`;
    // 用同一个有行的 room 配 ?name= → 仍走 fallback（不 301，因为计划 §2.6 明确「不做 301」）
    const resp = await page.goto(`${BASE}/result?name=${realName}`, { waitUntil: "networkidle" });
    assert.equal(resp.status(), 200, `?name= 返回 200；got ${resp.status()}`);
    const fbVisible = await page.isVisible('[data-testid="result-fallback"]');
    assert.ok(fbVisible, `?name= 走 fallback；got visible=${fbVisible}`);
    // 不渲染 result-stats（即使 server 有 row）
    const statsCount = await page.locator('[data-testid="result-stats"]').count();
    assert.equal(statsCount, 0, `?name= 不渲染 result-stats；got count=${statsCount}`);
    await shoot(page, "04-legacy-name-fallback.png");
  });

  // 分支 5：URL 编码房间名 → SSR 仍命中（HomeStatsEntry 的 href 用 encodeURIComponent）
  await step("05 URL-encoded room name → SSR renders", async () => {
    // 用 "ok-room"（ascii 即可；中文房间名测试由 HomeStatsEntry E3 单测覆盖）
    const name = `enc-${RUN_SUFFIX}-ok`;
    const sess = await ctx.request.post(`${BASE}/api/rooms`, {
      data: { room: name },
    });
    assert.equal(sess.status(), 200);
    const merge = await ctx.request.post(
      `${BASE}/api/rooms/${encodeURIComponent(name)}/stats/merge`,
      {
        data: {
          stats: { totalGames: 3, xWins: 3, oWins: 0, draws: 0, currentStreak: 3 },
        },
      },
    );
    assert.equal(merge.status(), 200);
    await page.goto(`${BASE}/result?room=${encodeURIComponent(name)}`, {
      waitUntil: "networkidle",
    });
    const statsVisible = await page.isVisible('[data-testid="result-stats"]');
    assert.ok(statsVisible, `URL-encoded room → SSR 战绩；got visible=${statsVisible}`);
    await shoot(page, "05-url-encoded-room.png");
  });

  console.log("\nAll Q4 /result three-branch assertions PASSED.");
} catch (err) {
  console.error("\nProbe failed:", err?.message ?? err);
  console.error(err?.stack);
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}

await writeQaLog(EVIDENCE, {
  base: BASE,
  runSuffix: RUN_SUFFIX,
  findings,
});
const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
