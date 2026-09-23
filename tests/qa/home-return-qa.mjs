#!/usr/bin/env node
// home-return-qa.mjs — W3-probes (ulw-room-migration-home-landing) Q5.
// BR: BR-1, BR-2, BR-3, BR-5 (step 02c: 案① 错峰开启回归钉)
//
// Production build probe (BASE_URL=http://localhost:3199, hermetic tmp DB).
// Covers plan §3.5 Q5:
//   - 合并弹框房间术语文案
//   - 合并并清空全路径（postRoomSession + postMerge + 客户端清）
//   - 首页全程 /api/* = 0 强断言（替代 W2 step07 的 OnlineStatsCard 快照）
//
// W2 retired PlayerNameForm / OnlineStatsCard; W3 rewrites the probe
// to the RoomGateDialog + HomeDialogMount surface. Pure-local /offline
// contract is unchanged.
//
// Usage:
//   node tests/qa/home-return-qa.mjs
//   env: BASE_URL (default http://localhost:3199),
//        EVIDENCE_DIR (default .omx/evidence/home-return-qa).

import assert from "node:assert/strict";
import { launchBrowser, launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/home-return-qa";
const ROOM_KEY = "ttt.room.name.v1";
const LEGACY_KEY = "ttt.player.name.v1";
const OFFLINE_KEY = "ttt.offline.stats.v1";
const DECLINED_KEY = "ttt.offline.sync-declined.v1";
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

function captureLocalStorage(page) {
  return page.evaluate(() => ({ ...window.localStorage }));
}

function captureSessionStorage(page) {
  return page.evaluate(() => ({ ...window.sessionStorage }));
}

// BR-1 helper (2026-09-22 decree): return home the way a real user does —
// the in-app「返回首页」Link (client-side navigation). page.goto would be a
// hard reload = direct entry, which must NOT open the dialog (反面场景);
// the NavPrevTracker marker only exists on soft navigations.
async function softNavHome(page) {
  await Promise.all([
    page.waitForURL(/\/$/, { timeout: 8000 }),
    page.locator('a[href="/"]').first().click(),
  ]);
  await page.waitForLoadState("networkidle");
}

// W3 helper: seed a name + offline stats to prime the home-return dialog.
// Uses fresh context (B-device equivalent) so we don't pollute the top-level ctx.
async function seedOfflineGameOnDeviceA(browser, base, runSuffix, games = 1, name) {
  const ctxA = await browser.newContext();
  try {
    const pageA = await ctxA.newPage();
    await pageA.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await pageA.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await pageA.reload({ waitUntil: "networkidle" });
    // Drive N offline games to populate local stats.
    for (let i = 0; i < games; i += 1) {
      await pageA.goto(`${base}/offline`, { waitUntil: "networkidle" });
      await pageA.waitForSelector('[data-testid="status-bar"]');
      // Loop until X-first
      let xFirst = false;
      for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
        await pageA.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
        const text = await pageA.textContent('[data-testid="status-text"]');
        if (text && text.includes("X")) {
          xFirst = true;
          break;
        }
        await pageA.reload({ waitUntil: "networkidle" });
      }
      if (!xFirst) throw new Error("could not get X-first offline game");
      await driveTopRowWin(pageA);
      await pageA.waitForTimeout(1400); // wait for auto-switch to settle
    }
    await ctxA.close();
  } catch (e) {
    await ctxA.close().catch(() => {});
    throw e;
  }
}

// Server-side seed for the cross-device step: pre-register a room with a stats row.
async function seedRoomRowViaApi(ctx, base, name, stats) {
  const session = await ctx.request.post(`${base}/api/rooms`, {
    data: { room: name },
  });
  assert.equal(session.status(), 200, `seed /api/rooms 200；got ${session.status()}`);
  const merge = await ctx.request.post(
    `${base}/api/rooms/${encodeURIComponent(name)}/stats/merge`,
    {
      data: { stats },
    },
  );
  assert.equal(merge.status(), 200, `seed merge 200；got ${merge.status()}`);
}

// W3 step 01 — 首页落地三件套：home-page + start-online + start-offline
await step("step 01 home landing renders dual CTA + home stats entry (when named)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-online"]');
    await page.waitForSelector('[data-testid="start-offline"]');
    await page.waitForSelector('[data-testid="home-page"]');
    // 无名时 home-stats-entry 不渲染
    const entryCount = await page.locator('[data-testid="home-stats-entry"]').count();
    assert.equal(entryCount, 0, `无名首页 home-stats-entry 不渲染；got count=${entryCount}`);
    // 弹框未开
    const syncOpen = await page.locator('[data-testid="sync-confirm-dialog"][open]').count();
    assert.equal(syncOpen, 0, `无 pending 首页无弹框`);
    await shoot(page, "home-landing-empty-warm.png");
  } finally {
    await browser.close();
  }
});

// W3 step 02 — offline 1 局 → 回首页 → 弹框现 + 文案含房间术语
await step("step 02 offline game → home return → dialog with room copy (A3 first branch)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa02-${RUN_SUFFIX}`;
    // 种子：A 设备先设 room key 后玩 1 局 offline，让本地 stats = 1
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    // 玩 1 局
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("X")) {
        xFirst = true;
        break;
      }
      await page.reload({ waitUntil: "networkidle" });
    }
    assert.ok(xFirst, "未取到 X-first offline");
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => {
        try {
          const v = window.localStorage.getItem("ttt.offline.stats.v1");
          return v ? JSON.parse(v).totalGames >= 1 : false;
        } catch {
          return false;
        }
      },
      { timeout: 5000 },
    );
    const localBefore = await captureLocalStorage(page);
    assert.ok(localBefore[OFFLINE_KEY] !== undefined, "local offline stats 存在");
    // 回首页（BR-1：软导航经 in-app「返回首页」Link；goto = 硬刷新不弹）
    await softNavHome(page);
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await shoot(page, "home-dialog-first-open.png");
    // 弹框文案含房间术语
    const desc = await page.textContent('[data-testid="sync-confirm-desc"]');
    assert.ok(desc && desc.includes("将上传本机"), `弹框文案含「将上传本机」`);
    // 弹框 title 应是「合并战绩」（W3 仍保留）
    const title = await page.textContent('[data-testid="sync-confirm-title"]');
    assert.ok(title && title.includes("合并"), `弹框标题含「合并」`);
  } finally {
    await browser.close();
  }
});

// BR-1 step 02b (NEW, 2026-09-22 decree) — 直接进入首页（硬加载）不弹。
// 反面场景探针：本地已有 3 局未合并，直接 goto '/'（等价冷开/硬刷新），
// NavPrevTracker 无软导航标记 → 弹框必须不开。这是 learnings §32 事件的
// 回归钉——此前 467 测试全绿但该业务规定被破坏，因为没有任何探针钉它。
await step("step 02b BR-1 反面: direct entry with pending>0 does NOT open dialog", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k }) =>
        window.localStorage.setItem(
          k,
          JSON.stringify({ totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 2 }),
        ),
      { k: OFFLINE_KEY },
    );
    // 硬刷新 = 直接进入：无软导航标记
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="home-page"]');
    await page.waitForTimeout(400);
    const openCount = await page
      .locator('[data-testid="sync-confirm-dialog"][open]')
      .count();
    assert.equal(
      openCount,
      0,
      `直接进入首页（本地 3 局未合并）不弹框；got open=${openCount}`,
    );
    await shoot(page, "home-direct-entry-no-dialog.png");
  } finally {
    await browser.close();
  }
});

// W-M (ulw-modal-collision-and-error-alerts 案① a) — 错峰开启回归钉。
// BR-1 触发条件保持: 仍仅 /offline→/ 软导航 + pending>declined>0。
// 修复后 setOpen(true) 推迟到 afterViewTransition (lib/view-transition.ts)
// 回调里, 避免 SyncConfirmDialog 在 150ms + 250ms VT 窗口内被烘进 root
// 快照。本探针断言: 软导航后 100ms 内 dialog 不应 [open]; 350ms 后
// [open] — 钉住'错峰', 防止后人把 setOpen 提前触发。
await step("step 02c BR-1 错峰: dialog 在 VT 窗口内不 [open], 之后才 [open]（重锚到点击时刻）", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa02c-${RUN_SUFFIX}`;
    // 种子 A 设备离线 1 局 + 设 room key（与 step 02 同型）
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("X")) {
        xFirst = true;
        break;
      }
      await page.reload({ waitUntil: "networkidle" });
    }
    assert.ok(xFirst, "未取到 X-first offline");
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => {
        try {
          const v = window.localStorage.getItem("ttt.offline.stats.v1");
          return v ? JSON.parse(v).totalGames >= 1 : false;
        } catch {
          return false;
        }
      },
      { timeout: 5000 },
    );
    // 重锚：错峰开启判定时刻锚定到真实点击时刻，禁依赖 softNavHome 后的
    // 相对量 waitForTimeout(100)。诊断注入揭示 afterViewTransition 真实开框
    // 路径（animationend / safety / rAF）。
    //
    // 阈值依据（实测前推演 + 必要时回测调整）：
    //   - page-fade-in 150ms / view-swap-in 180ms（app/globals.css @keyframes）
    //   - React 18 commit ~16~32ms
    //   - safety 600ms（lib/view-transition.ts:25）
    //   - 双 rAF ~32ms（无 VT 路径）
    //   EARLY_THRESHOLD_MS=100：strict < 150ms animation 时长；catch path C
    //     早开回归（双 rAF < 80ms 触发 → 与 BR-1 错峰语义相违）
    //   LATE_LOWER_MS=80：path C 双 rAF 上限 + 10ms 余量；保留 catch "setOpen
    //     提前到 rAF 后立刻" 回归的能力
    //   LATE_BOUND_MS=1500：> safety 600ms + commit + 浏览器抖动 + 探针 poll 余量

    // 注入 animationend 监听 — 与 product lib/view-transition.ts:onEnd 同型位置
    // （document.addEventListener('animationend', ..., true) capture phase）。
    // SPA 软导航不重 init document，监听在当前 document 持续生效。
    await page.evaluate(() => {
      if (!window.__qaVTAnimEvents) window.__qaVTAnimEvents = [];
      if (!window.__qaVTAnimListenerAdded) {
        document.addEventListener(
          "animationend",
          (e) => {
            if (
              e.animationName === "page-fade-in" ||
              e.animationName === "view-swap-in"
            ) {
              window.__qaVTAnimEvents.push({
                name: e.animationName,
                t: performance.now(),
                pseudo: e.pseudoElement || "(none)",
                target: e.target && e.target.tagName,
              });
            }
          },
          true,
        );
        window.__qaVTAnimListenerAdded = true;
      }
      // 清空 driveTopRowWin 期间残余（cell-pop / draw-shake 等非目标名不进数组）
      window.__qaVTAnimEvents.length = 0;
    });

    // 软导航回首页（inline 替代 softNavHome，捕获 click 时刻锚点）
    const tBefore = await page.evaluate(() => performance.now());
    await Promise.all([
      page.waitForURL(/\/$/, { timeout: 8000 }),
      page.locator('a[href="/"]').first().click(),
    ]);
    const tAfter = await page.evaluate(() => performance.now());
    // 中位近似 click 时刻（误差 < 1 frame 16ms，远小于阈值裕量）
    const tClick = (tBefore + tAfter) / 2;
    await page.waitForLoadState("networkidle");

    // 早期未开断言 — 基于真实 elapsed since click
    const EARLY_THRESHOLD_MS = 100;
    const earlyAt = await page.evaluate(
      async (args) => {
        while (performance.now() - args.tClick < args.threshold) {
          await new Promise((r) => setTimeout(r, 2));
        }
        const dialog = document.querySelector(
          '[data-testid="sync-confirm-dialog"]',
        );
        const isOpen = !!(dialog && dialog.hasAttribute("open"));
        return { elapsed: performance.now() - args.tClick, isOpen };
      },
      { tClick, threshold: EARLY_THRESHOLD_MS },
    );
    assert.equal(
      earlyAt.isOpen,
      false,
      `错峰开启: click 后 ${EARLY_THRESHOLD_MS}ms 内 dialog 不应 [open] (elapsed=${earlyAt.elapsed.toFixed(1)}ms)`,
    );
    await shoot(page, "home-dialog-vt-window.png");

    // 开启上限 + 真实开启时刻（双沿）— 取代原 waitForSelector 单断言
    const LATE_BOUND_MS = 1500;
    const LATE_LOWER_MS = 80;
    const lateAt = await page.evaluate(
      async (args) => {
        const start = performance.now();
        while (performance.now() - start < args.bound) {
          const dialog = document.querySelector(
            '[data-testid="sync-confirm-dialog"]',
          );
          if (dialog && dialog.hasAttribute("open")) {
            return performance.now() - args.tClick;
          }
          await new Promise((r) => setTimeout(r, 2));
        }
        return -1;
      },
      { tClick, bound: LATE_BOUND_MS },
    );
    assert.ok(
      lateAt > 0,
      `错峰开启: dialog 应在 click 后 ${LATE_BOUND_MS}ms 内 [open]; got clickToOpen=${lateAt.toFixed(1)}ms`,
    );
    assert.ok(
      lateAt > LATE_LOWER_MS,
      `错峰开启: dialog 开启时刻应 > ${LATE_LOWER_MS}ms (防 path C 双 rAF 早开回归); got ${lateAt.toFixed(1)}ms`,
    );
    await shoot(page, "home-dialog-after-vt.png");

    // 诊断输出 — 揭示 afterViewTransition 真实开框路径
    // （animationend vs safety 600ms vs 双 rAF），传为下一张票输入。
    const animEvents = await page.evaluate(
      () => window.__qaVTAnimEvents ?? [],
    );
    // animEvents[0].t 是 page-side performance.now() 原值（页面加载以来 ms）；
    // tClick 是同一时间轴的中位近似；lateAt 已是「相对 click」的 elapsed。
    // 单位统一：把 animationend 时刻换算到 elapsed-since-click 再相减。
    const animEndRawT = animEvents.length > 0 ? animEvents[0].t : null;
    const animEndElapsed =
      animEndRawT !== null ? animEndRawT - tClick : null;
    const animationendMargin =
      animEndElapsed !== null ? lateAt - animEndElapsed : null;
    const path =
      animEvents.length > 0
        ? "animationend"
        : lateAt < 200
          ? "rAF"
          : "safety";
    console.log(
      `[02c][diag] animationend reached: ${animEvents.length > 0}, path: ${path}, clickToOpenMs: ${lateAt.toFixed(1)}, animationendMargin: ${animationendMargin !== null ? animationendMargin.toFixed(1) + "ms" : "n/a"}, evtName: ${animEvents[0]?.name ?? "n/a"}, evtPseudo: ${animEvents[0]?.pseudo ?? "n/a"}, evtCount: ${animEvents.length}`,
    );

    // 关闭 dialog, 保持页面 idle 给后续 step 用 (ctx/page 随即关闭)
    const closeBtn = await page.$('[data-testid="sync-confirm-reject"]');
    if (closeBtn) await closeBtn.click().catch(() => {});
  } finally {
    await browser.close();
  }
});

// W3 step 03 — pending=0 首页直接起战不弹不拦 + home 全程 /api/* = 0
await step("step 03 pending=0 + named → click start-online → direct nav (zero /api/* on home)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa03-${RUN_SUFFIX}`;
    // 预设房间 key + 让 RoomGateMount 把它读进 store
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="home-stats-entry"]', { timeout: 4000 });
    // 此时 pending=0 + 有名
    assert.equal(
      await page.locator('[data-testid="sync-confirm-dialog"][open]').count(),
      0,
      "pending=0 无弹框",
    );
    // 监听 /api/* 网络写
    const writes = [];
    page.on("request", (req) => {
      if (isWriteToApi(req.method(), req.url())) {
        writes.push({ method: req.method(), url: req.url() });
      }
    });
    await Promise.all([
      page.waitForURL(/\/online$/),
      page.click('[data-testid="start-online"]'),
    ]);
    await page.waitForSelector('[data-testid="status-bar"]');
    await page.waitForTimeout(300);
    // 首页 → /online 直接导航，pending=0 无弹框，零 POST 写
    const apiWrites = writes.filter((w) => w.url.includes("/api/"));
    assert.equal(
      apiWrites.length,
      0,
      `pending=0 直行零网络写；got ${apiWrites.length}: ${JSON.stringify(apiWrites)}`,
    );
    await shoot(page, "start-online-direct.png");
  } finally {
    await browser.close();
  }
});

// W3 step 04 — 保留本地：零网络写 + sessionStorage 哨兵
await step("step 04 reject: zero /api/* writes + sessionStorage sentinel", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa04-${RUN_SUFFIX}`;
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    // 1 局 offline
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("X")) {
        xFirst = true;
        break;
      }
      await page.reload({ waitUntil: "networkidle" });
    }
    assert.ok(xFirst, "未取到 X-first");
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => {
        try {
          const v = window.localStorage.getItem("ttt.offline.stats.v1");
          return v ? JSON.parse(v).totalGames >= 1 : false;
        } catch {
          return false;
        }
      },
      { timeout: 5000 },
    );
    // 网络写监听（从此点起）
    const writesAfter = [];
    page.on("request", (req) => {
      if (isWriteToApi(req.method(), req.url())) {
        writesAfter.push({ method: req.method(), url: req.url() });
      }
    });
    // 回首页 → 弹框开（BR-1 软导航）
    await softNavHome(page);
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    // 保留本地
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="sync-confirm-dialog"]')?.hasAttribute("open"),
      { timeout: 4000 },
    );
    const apiWrites = writesAfter.filter((w) => w.url.includes("/api/"));
    assert.equal(
      apiWrites.length,
      0,
      `保留本地零网络写；got ${JSON.stringify(apiWrites)}`,
    );
    // sessionStorage 哨兵 = 1
    const sess = await captureSessionStorage(page);
    assert.equal(sess[DECLINED_KEY], "1", `sessionStorage sentinel = 1`);
    // localStorage 仍保留
    const local = await captureLocalStorage(page);
    assert.ok(local[OFFLINE_KEY] !== undefined, "本地战绩保留");
  } finally {
    await browser.close();
  }
});

// W3 step 05 — 同会话 pending 无增量不重弹
await step("step 05 same-session pending stale: no re-dialog", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa05-${RUN_SUFFIX}`;
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("X")) {
        xFirst = true;
        break;
      }
      await page.reload({ waitUntil: "networkidle" });
    }
    assert.ok(xFirst, "未取到 X-first");
    await driveTopRowWin(page);
    await page.waitForFunction(
      () => {
        try {
          const v = window.localStorage.getItem("ttt.offline.stats.v1");
          return v ? JSON.parse(v).totalGames >= 1 : false;
        } catch {
          return false;
        }
      },
      { timeout: 5000 },
    );
    await softNavHome(page);
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForTimeout(300);
    // 刷新不重弹：BR-1 直接进入无 tracker 标记 + sessionStorage 哨兵双保险
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const reOpen = await page.locator('[data-testid="sync-confirm-dialog"][open]').count();
    assert.equal(reOpen, 0, `同会话刷新不重弹（sessionStorage 哨兵仍 1）`);
    await shoot(page, "home-no-redialog-after-reload.png");
  } finally {
    await browser.close();
  }
});

// W3 step 06 — 再玩 1 局 pending 超记录值 → 重弹
await step("step 06 pending > declined sentinel → re-dialog with N=2 copy", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa06-${RUN_SUFFIX}`;
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    // 第 1 局
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("X")) {
        xFirst = true;
        break;
      }
      await page.reload({ waitUntil: "networkidle" });
    }
    assert.ok(xFirst, "未取到 X-first");
    await driveTopRowWin(page);
    await page.waitForTimeout(1400);
    // 第 1 次保留本地 → 哨兵 = 1（BR-1 软导航回首页）
    await softNavHome(page);
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    await page.click('[data-testid="sync-confirm-reject"]');
    await page.waitForTimeout(300);
    // 第 2 局
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    let xFirst2 = false;
    for (let attempt = 1; attempt <= 12 && !xFirst2; attempt += 1) {
      await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("X")) {
        xFirst2 = true;
        break;
      }
      await page.reload({ waitUntil: "networkidle" });
    }
    assert.ok(xFirst2, "第 2 局未取到 X-first");
    await driveTopRowWin(page);
    await page.waitForTimeout(1400);
    // pending = 2 > declined = 1 → 重弹（BR-1 软导航回首页）
    await softNavHome(page);
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 4000,
    });
    const desc = await page.textContent('[data-testid="sync-confirm-desc"]');
    assert.ok(desc && desc.includes("2"), `弹框文案含 2；got "${desc}"`);
    await shoot(page, "home-dialog-reopen-2.png");
    await page.click('[data-testid="sync-confirm-reject"]');
  } finally {
    await browser.close();
  }
});

// W3 step 07 (NEW) — 首页全程 /api/* = 0 强断言（替代 W2 OnlineStatsCard 前后快照）
// 这是 Q5 验收的核心强断言：切到任意设备（fresh / 已有 room / 多次 focus）
// 首页都不发任何 /api/* 请求。
await step("step 07 home zero /api/* — fresh, named, focus x3 (A1 strong)", async () => {
  const scenarios = [
    { label: "fresh-context-no-name", preset: null, focusCount: 0 },
    { label: "fresh-context-with-name", preset: "named", focusCount: 0 },
    { label: "fresh-context-with-name-focus-x3", preset: "named", focusCount: 3 },
  ];
  for (const sc of scenarios) {
    const sub = await launchQA();
    const subApi = { requests: [] };
    const onReq = (req) => {
      if (req.url().includes("/api/")) {
        subApi.requests.push({ method: req.method(), url: req.url() });
      }
    };
    sub.page.on("request", onReq);
    try {
      if (sc.preset === "named") {
        // 用 seedRoomName 通过 RoomGateMount 路径
        const name = `q7${RUN_SUFFIX.slice(0,4)}${sc.label.length > 8 ? sc.label.slice(0,8) : sc.label}`.slice(0, 24);
        // 预注册到 server（避免 mount 时副作用）
        const regCtx = await sub.browser.newContext();
        try {
          await regCtx.request.post(`${BASE}/api/rooms`, {
            data: { room: name },
          });
        } finally {
          await regCtx.close();
        }
        await sub.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        await sub.page.evaluate(
          ({ k, n }) => window.localStorage.setItem(k, n),
          { k: ROOM_KEY, n: name },
        );
        // Verify before reload
        const beforeReload = await sub.page.evaluate((k) => window.localStorage.getItem(k), ROOM_KEY);
        if (beforeReload !== name) {
          throw new Error(`localStorage setItem 失败；got ${beforeReload}`);
        }
        await sub.page.reload({ waitUntil: "load" });
        await sub.page.waitForTimeout(2000); // settle RoomGateMount hydration
        await sub.page.waitForSelector('[data-testid="home-stats-entry"]', { timeout: 6000 });
      } else {
        await sub.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        await sub.page.evaluate((k) => window.localStorage.removeItem(k), ROOM_KEY);
        await sub.page.evaluate((k) => window.localStorage.removeItem(k), LEGACY_KEY);
        await sub.page.evaluate(() => window.sessionStorage.clear());
        await sub.page.reload({ waitUntil: "networkidle" });
      }
      subApi.requests.length = 0;
      // focus × N
      for (let i = 0; i < sc.focusCount; i += 1) {
        await sub.page.evaluate(() => {
          window.dispatchEvent(new Event("blur"));
          window.dispatchEvent(new Event("focus"));
        });
        await sub.page.waitForTimeout(150);
      }
      await sub.page.waitForTimeout(800);
      assert.equal(
        subApi.requests.length,
        0,
        `[${sc.label}] 首页 /api/* 必须 0；got ${subApi.requests.length}: ${JSON.stringify(subApi.requests)}`,
      );
      await shoot(sub.page, `home-zero-api-${sc.label}.png`);
    } finally {
      await sub.browser.close();
    }
  }
});

// W3 step 08 — 合并并清空全路径（postRoomSession + postMerge）
await step("step 08 merge + clear full path (postRoomSession + postMerge + local clear)", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const name = `hrqa08-${RUN_SUFFIX}`;
    // 预注册 → server row 0
    await ctx.request.post(`${BASE}/api/rooms`, { data: { room: name } });
    // 设 room key + 灌 1 局 offline 数据
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ k, n }) => window.localStorage.setItem(k, n),
      { k: ROOM_KEY, n: name },
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.evaluate(
      ({ k, v }) => window.localStorage.setItem(k, v),
      {
        k: OFFLINE_KEY,
        v: JSON.stringify({ totalGames: 2, xWins: 2, oWins: 0, draws: 0, currentStreak: 2 }),
      },
    );
    // 监听网络写
    const writes = [];
    page.on("request", (req) => {
      if (isWriteToApi(req.method(), req.url())) {
        writes.push({ method: req.method(), url: req.url() });
      }
    });
    // 回首页触发弹框（BR-1：经 /offline 软导航回首页才带 tracker 标记；
    // 直接 reload 首页 = 直接进入，反面场景不弹——见 step 02b）
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    await softNavHome(page);
    await page.waitForSelector('[data-testid="home-stats-entry"]', { timeout: 6000 });
    await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', {
      timeout: 6000,
    });
    await shoot(page, "home-dialog-step08-pre-confirm.png");
    writes.length = 0;
    // 输入预填可能因 store hydration 时序未到位；显式 fill 一次保证 canConfirm。
    const inputVal = await page.inputValue('[data-testid="sync-confirm-name"]');
    if (!inputVal) {
      await page.fill('[data-testid="sync-confirm-name"]', name);
    }
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="sync-confirm-confirm"]')?.hasAttribute('disabled'),
      { timeout: 4000 },
    );
    // 合并并清空
    await page.click('[data-testid="sync-confirm-confirm"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="sync-confirm-dialog"]')?.hasAttribute("open"),
      { timeout: 8000 },
    );
    await page.waitForTimeout(400);
    // 必有 POST /api/rooms + POST /api/rooms/{room}/stats/merge
    const sessions = writes.filter(
      (w) => w.method === "POST" && /\/api\/rooms$/.test(w.url),
    );
    const merges = writes.filter(
      (w) => w.method === "POST" && /\/api\/rooms\/[^/]+\/stats\/merge/.test(w.url),
    );
    assert.equal(sessions.length, 1, `POST /api/rooms 恰 1；got ${sessions.length}`);
    assert.equal(merges.length, 1, `POST merge 恰 1；got ${merges.length}`);
    // localStorage OFFLINE_KEY 已清
    const local = await captureLocalStorage(page);
    assert.equal(local[OFFLINE_KEY], undefined, `合并并清空后 OFFLINE_KEY 清除`);
    // server row 累加到 (2, 2, 0, 0, 2)
    const r = await ctx.request.get(
      `${BASE}/api/rooms/${encodeURIComponent(name)}/stats`,
    );
    assert.equal(r.status(), 200);
    const body = await r.json();
    assert.equal(body.stats.totalGames, 2, `server totalGames = 2；got ${body.stats.totalGames}`);
    assert.equal(body.stats.xWins, 2, `server xWins = 2`);
  } finally {
    await browser.close();
  }
});

// W3 step 09 — reset / public ledger retired — 旧路径全 404
await step("step 09 legacy /api/sessions + /api/players/* retired — all 404", async () => {
  const browser = await launchBrowser();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="home-page"]');
    // 首页零 reset button / 零 player-name-section / 零 online-stats-grid
    const resetCount = await page.locator('[data-testid="reset-stats"]').count();
    const pnSection = await page.locator('[data-testid="player-name-section"]').count();
    const onlineStats = await page.locator('[data-testid="online-stats-grid"]').count();
    assert.equal(resetCount, 0, `home 无 reset-stats；got count=${resetCount}`);
    assert.equal(pnSection, 0, `home 无 player-name-section；got count=${pnSection}`);
    assert.equal(onlineStats, 0, `home 无 online-stats-grid；got count=${onlineStats}`);
    // 旧路径 404
    const put = await page.request.put(`${BASE}/api/stats`, { data: {} });
    assert.equal(put.status(), 404, `legacy /api/stats PUT 404；got ${put.status()}`);
    const sessions = await page.request.get(`${BASE}/api/sessions`);
    assert.equal(sessions.status(), 404, `legacy /api/sessions GET 404；got ${sessions.status()}`);
    const players = await page.request.get(`${BASE}/api/players/old-name/stats`);
    assert.equal(players.status(), 404, `legacy /api/players/*/stats GET 404；got ${players.status()}`);
    await shoot(page, "home-no-reset-no-public.png");
    await ctx.close();
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
console.log("\nALL HOME-RETURN STEPS PASSED");
process.exit(0);
