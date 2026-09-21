#!/usr/bin/env node
// result-celebration-qa.mjs — W-A probes (ulw-result-win-celebration).
//
// Production build probe (hermetic tmp DB + PORT, e.g. :3111).
// Covers plan §5 W-A acceptance:
//   F1 正规路径（首页 → 门 → /online → 0,3,1,4,2 胜局）→ /result confetti
//      层恰一次 + sessionStorage 哨兵读后即清
//   F2 reload /result → 不重放
//   F3 书签直达 /result?room=<有行>（无哨兵）→ 无庆祝
//   F4 online 平局（0,4,1,2,7,3,5,8,6 满盘无胜）→ 无哨兵无庆祝，仍推 /result
//   F5 reducedMotion:'reduce' → 无动画路径（confetti 层 DOM 语义不变，
//      canvas-confetti 不发射 → 页面无 fixed canvas），其余语义不变
//
// Usage:
//   node tests/qa/result-celebration-qa.mjs
//   env: BASE_URL (default http://localhost:3111),
//        EVIDENCE_DIR (default .omx/evidence/result-celebration-qa).

import assert from "node:assert/strict";
import { launchBrowser, launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin, driveDraw } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/result-celebration-qa";
const ROOM_KEY = "ttt.room.name.v1";
const SENTINEL_KEY = "ttt.result.just-won.v1";
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

function captureSessionStorage(page) {
  return page.evaluate(() => ({ ...window.sessionStorage }));
}

// 正规路径共用：匿名进入首页 →「在线房间」CTA → RoomGateDialog 收名 → /online。
async function enterOnlineViaGate(page, name) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click('[data-testid="start-online"]');
  await page.waitForSelector('[data-testid="room-gate-dialog"][open]', {
    timeout: 4000,
  });
  await page.fill('[data-testid="room-gate-name"]', name);
  await page.click('[data-testid="room-gate-confirm"]');
  await page.waitForURL(/\/online/, { timeout: 8000 });
  await page.waitForSelector('[data-testid="status-bar"]');
}

// 平局/胜局到达 /result 后，等 RSC 主体渲染完成（stats 或 empty 任一，
// outcome POST 与 push 存在既有竞态，两者都是合法落点）。
async function waitForResultBody(page) {
  await page.waitForSelector(
    '[data-testid="result-stats"], [data-testid="result-empty"]',
    { timeout: 8000 },
  );
  // play-again 可见 = 导航完成（探针坑：胜局断言先等它）
  await page.waitForSelector('[data-testid="play-again"]', { timeout: 4000 });
}

// F1 — 正规路径：首页 → 门 → /online → 0,3,1,4,2 胜局 → /result 庆祝恰一次 + 哨兵读后即清
await step("F1 normal win path: gate → /online → top-row win → confetti once + sentinel cleared", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `rcqa-f1-${RUN_SUFFIX}`;
    await enterOnlineViaGate(page, name);
    // 0,3,1,4,2：pass-and-play 序列，先手随机，任一方先手都赢上排
    await driveTopRowWin(page);
    await page.waitForURL(/\/result/, { timeout: 8000 });
    await waitForResultBody(page);
    // confetti 层出现恰一次（WinConfetti 既有 testid + 本波包装层）
    await page.waitForSelector('[data-testid="confetti"]', { timeout: 4000 });
    const confettiCount = await page.locator('[data-testid="confetti"]').count();
    const celebrationCount = await page.locator('[data-testid="result-celebration"]').count();
    assert.equal(confettiCount, 1, `confetti 层恰 1；got ${confettiCount}`);
    assert.equal(celebrationCount, 1, `result-celebration 层恰 1；got ${celebrationCount}`);
    // 非 reduced-motion：canvas-confetti 已发射（body 上有 fixed canvas）
    const canvasCount = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("canvas")).filter(
          (c) => getComputedStyle(c).position === "fixed",
        ).length,
    );
    assert.ok(canvasCount >= 1, `非 reduced-motion 应有 confetti canvas；got ${canvasCount}`);
    // 读后即清：哨兵为 null
    const sess = await captureSessionStorage(page);
    assert.equal(
      sess[SENTINEL_KEY],
      undefined,
      `哨兵读后即清；got ${sess[SENTINEL_KEY]}`,
    );
    await shoot(page, "f1-win-arrival-confetti.png");
  } finally {
    await browser.close();
  }
});

// F2 — 在 /result 上 reload → 不重放（哨兵已清）
await step("F2 reload /result → no replay", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `rcqa-f2-${RUN_SUFFIX}`;
    await enterOnlineViaGate(page, name);
    await driveTopRowWin(page);
    await page.waitForURL(/\/result/, { timeout: 8000 });
    await waitForResultBody(page);
    await page.waitForSelector('[data-testid="confetti"]', { timeout: 4000 });
    // reload → 全新加载，哨兵已被首次 mount 消费
    await page.reload({ waitUntil: "networkidle" });
    await waitForResultBody(page);
    await page.waitForTimeout(1000); // 留足 hydration + effect 窗口
    const confettiCount = await page.locator('[data-testid="confetti"]').count();
    assert.equal(confettiCount, 0, `reload 不重放；got confetti=${confettiCount}`);
    const sess = await captureSessionStorage(page);
    assert.equal(sess[SENTINEL_KEY], undefined, `reload 后哨兵仍为空`);
    await shoot(page, "f2-reload-no-replay.png");
  } finally {
    await browser.close();
  }
});

// F3 — 书签/直达 /result?room=<有行>（无哨兵）→ 无庆祝
await step("F3 bookmark /result?room= with existing row → no celebration", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `rcqa-f3-${RUN_SUFFIX}`;
    // 服务端种子：建房 + 灌战绩（书签语义：房间有历史战绩）
    const sessRes = await ctx.request.post(`${BASE}/api/rooms`, {
      data: { room: name },
    });
    assert.equal(sessRes.status(), 200, `seed /api/rooms 200`);
    const merge = await ctx.request.post(
      `${BASE}/api/rooms/${encodeURIComponent(name)}/stats/merge`,
      { data: { stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 } } },
    );
    assert.equal(merge.status(), 200, `seed merge 200`);
    // fresh context：无 sessionStorage 哨兵
    await page.goto(`${BASE}/result?room=${encodeURIComponent(name)}`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector('[data-testid="result-stats"]', { timeout: 8000 });
    await page.waitForTimeout(1000); // hydration + effect 窗口
    const confettiCount = await page.locator('[data-testid="confetti"]').count();
    const celebrationCount = await page.locator('[data-testid="result-celebration"]').count();
    assert.equal(confettiCount, 0, `书签直达无 confetti；got ${confettiCount}`);
    assert.equal(celebrationCount, 0, `书签直达无庆祝层；got ${celebrationCount}`);
    await shoot(page, "f3-bookmark-no-celebration.png");
  } finally {
    await browser.close();
  }
});

// F4 — online 平局（0,4,1,2,7,3,5,8,6 满盘无胜，先手无关）→ 无哨兵无庆祝，仍推 /result
await step("F4 online draw → no sentinel, no celebration, still pushes /result", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `rcqa-f4-${RUN_SUFFIX}`;
    await enterOnlineViaGate(page, name);
    // 满盘无胜序列（win-drive.mjs driveDraw 注释逐格验证）：
    //   X 0,1,7,5,6 / O 4,2,3,8（或先手互换的补集）→ 每行每列每斜线均无三连
    await driveDraw(page);
    await page.waitForURL(/\/result/, { timeout: 8000 });
    await waitForResultBody(page);
    await page.waitForTimeout(1000);
    const confettiCount = await page.locator('[data-testid="confetti"]').count();
    assert.equal(confettiCount, 0, `平局无 confetti；got ${confettiCount}`);
    const sess = await captureSessionStorage(page);
    assert.equal(sess[SENTINEL_KEY], undefined, `平局无哨兵（从未写入）`);
    // 行为同现状：确实到达 /result 且房间名在 URL 上
    assert.ok(page.url().includes("room="), `平局仍推 /result?room=；got ${page.url()}`);
    await shoot(page, "f4-draw-no-celebration.png");
  } finally {
    await browser.close();
  }
});

// F5 — reducedMotion:'reduce' → 无动画路径（confetti 层 DOM 在，canvas 不发射），其余语义不变
await step("F5 reduced-motion → confetti layer DOM present, no canvas burst, sentinel still cleared", async () => {
  const browser = await launchBrowser();
  // launchQA 不透传 reducedMotion；仓内既有模式是 browser.newContext(...) 直建
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  try {
    const name = `rcqa-f5-${RUN_SUFFIX}`;
    await enterOnlineViaGate(page, name);
    await driveTopRowWin(page);
    await page.waitForURL(/\/result/, { timeout: 8000 });
    await waitForResultBody(page);
    // WinConfetti 既有 reduced-motion 语义：层 DOM 照常渲染（aria-hidden span），
    // burstConfetti() 内部 no-op → canvas-confetti 从未调用 → 无 fixed canvas
    await page.waitForSelector('[data-testid="confetti"]', { timeout: 4000 });
    const confettiCount = await page.locator('[data-testid="confetti"]').count();
    assert.equal(confettiCount, 1, `庆祝层 DOM 语义不变；got ${confettiCount}`);
    const canvasCount = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("canvas")).filter(
          (c) => getComputedStyle(c).position === "fixed",
        ).length,
    );
    assert.equal(canvasCount, 0, `reduced-motion 无动画（无 confetti canvas）；got ${canvasCount}`);
    const sess = await captureSessionStorage(page);
    assert.equal(sess[SENTINEL_KEY], undefined, `哨兵读后即清语义不变`);
    await shoot(page, "f5-reduced-motion-layer-only.png");
  } finally {
    await ctx.close().catch(() => {});
    await browser.close();
  }
});

await writeQaLog(EVIDENCE, {
  test: "result-celebration-qa",
  status: findings.every((f) => f.status === "PASS") ? "PASS" : "FAIL",
  findings,
  runSuffix: RUN_SUFFIX,
});
const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
