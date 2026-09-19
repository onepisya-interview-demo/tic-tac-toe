#!/usr/bin/env node
// one-identity-qa.mjs — W3-probes (ulw-room-migration-home-landing).
//
// Production build probe (BASE_URL=http://localhost:3199, hermetic tmp DB).
// Covers plan §3.5 Q1/Q2/Q3/Q6 + AC A1 (home zero /api/*), A2 (home CTA),
// A3 (RoomGateDialog R1-R9 outline), A7 (legacy localStorage key cleanup),
// A8 (?room= three-branch + ?name= fallback), and JSON-LD integrity.

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/one-identity-qa";
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

function isReadToApi(method, url) {
  if (!url.includes("/api/")) return false;
  return method === "GET";
}

function captureApiTraffic(page) {
  const writes = [];
  const reads = [];
  const onReq = (req) => {
    const url = req.url();
    const method = req.method();
    if (isWriteToApi(method, url)) writes.push({ url, method, t: Date.now() });
    if (isReadToApi(method, url)) reads.push({ url, method, t: Date.now() });
  };
  page.on("request", onReq);
  return { writes, reads, detach: () => page.off("request", onReq) };
}

// W3-probes Q3 helper — solo /offline X-first determinism.
async function reloadOfflineUntilXFirst(page, maxAttempts = 12) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(`${BASE}/offline`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="status-bar"]');
    await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
    const text = await page.textContent('[data-testid="status-text"]');
    if (text && text.includes("X")) return;
    await page.reload({ waitUntil: "networkidle" });
  }
  throw new Error("could not get an X-first offline game within 12 attempts");
}

// W3-probes Q1 helper — wipe all session keys + reload. Fresh start.
async function wipeAllKeys(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (keys) => keys.forEach((k) => window.localStorage.removeItem(k)),
    [ROOM_KEY, LEGACY_KEY, OFFLINE_KEY, DECLINED_KEY],
  );
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

// W3-probes Q1 helper — preset a room name on the home origin. After
// RoomGateMount's identity bootstrap fires (commit cace8f4), the store
// picks it up; hard reload preserves the relationship because
// getRoomName() sweeps legacy AND reads new key.
async function seedRoomName(page, name) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ k, n }) => window.localStorage.setItem(k, n),
    { k: ROOM_KEY, n: name },
  );
  await page.reload({ waitUntil: "networkidle" });
  // Wait for RoomGateMount to hydrate the store + HomeStatsEntry to render.
  await page.waitForSelector('[data-testid="home-stats-entry"]', { timeout: 4000 });
}

async function registerViaRoomGate(page, name) {
  // Anonymous + click online → RoomGateDialog opens (no nav, no fetch).
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click('[data-testid="start-online"]');
  await page.waitForSelector('[data-testid="room-gate-dialog"][open]', {
    timeout: 4000,
  });
  await page.fill('[data-testid="room-gate-name"]', name);
  await page.click('[data-testid="room-gate-confirm"]');
  // The dialog closes + navigation fires. Room key MUST land on localStorage.
  await page.waitForFunction(
    ({ k, expected }) => window.localStorage.getItem(k) === expected,
    { k: ROOM_KEY, expected: name },
    { timeout: 8000 },
  );
}

const { browser, ctx, page } = await launchQA();
const api = captureApiTraffic(page);

try {

  // Q3 (W3 plan §3.5) b step — anonymous offline CTA 直行零拦截
  await step("b-anonymous-offline-direct-nav-zero-block", async () => {
    await wipeAllKeys(page);
    api.writes.length = 0;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-offline"]');
    const urlBefore = page.url();
    await Promise.all([
      page.waitForURL(/\/offline/, { timeout: 6000 }),
      page.click('[data-testid="start-offline"]'),
    ]);
    assert.ok(
      page.url().endsWith("/offline"),
      `offline CTA 直行零拦截；当前 URL=${page.url()}`,
    );
    const gateOpen = await page.locator('[data-testid="room-gate-dialog"][open]').count();
    assert.equal(gateOpen, 0, `RoomGateDialog 未弹（offline CTA 直行）`);
    const syncOpen = await page.locator('[data-testid="sync-confirm-dialog"][open]').count();
    assert.equal(syncOpen, 0, `sync-confirm-dialog 不弹（pending=0）`);
    const apiWrites = api.writes.filter((w) => w.url.includes("/api/"));
    assert.equal(apiWrites.length, 0, `offline 直行零网络写；got ${JSON.stringify(apiWrites)}`);
    await shoot(page, "b-anonymous-offline-direct.png");
  });

  // Q1 part 1 — anonymous click online → RoomGateDialog + 零 nav
  await step("q1-anonymous-online-room-gate-dialog", async () => {
    await wipeAllKeys(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.__roomRequiredEvents = [];
      window.addEventListener("ttt:room-required", () => {
        window.__roomRequiredEvents.push(Date.now());
      });
    });
    api.writes.length = 0;
    const urlBefore = page.url();
    await page.click('[data-testid="start-online"]');
    await page.waitForSelector('[data-testid="room-gate-dialog"][open]', {
      timeout: 4000,
    });
    const urlAfter = page.url();
    assert.equal(urlAfter, urlBefore, `匿名 online 点击不导航；was ${urlBefore} now ${urlAfter}`);
    const events = await page.evaluate(() => window.__roomRequiredEvents ?? []);
    assert.ok(events.length >= 1, `ttt:room-required 事件必须触发；got ${events.length}`);
    const apiWrites = api.writes.filter((w) => w.url.includes("/api/"));
    assert.equal(apiWrites.length, 0, `弹框期间零 POST；got ${JSON.stringify(apiWrites)}`);
    await shoot(page, "q1-anonymous-room-gate.png");
    await page.click('[data-testid="room-gate-cancel"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="room-gate-dialog"]')?.hasAttribute("open"),
      { timeout: 4000 },
    );
    const roomAfter = await page.evaluate((k) => window.localStorage.getItem(k), ROOM_KEY);
    assert.equal(roomAfter, null, `取消不写 localStorage；got ${roomAfter}`);
  });

  // Q2 c step — RoomGateDialog 收名 → /online → 上排胜 → /result?room= SSR + outcome POST 恰 1
  await step("c-room-gate-online-once-post-result-ssr-stats", async () => {
    const name = `oiqa-c-${RUN_SUFFIX}`;
    await registerViaRoomGate(page, name);
    await page.waitForURL(/\/online/, { timeout: 4000 });
    await page.waitForSelector('[data-testid="status-bar"]');
    await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("轮到 X")) {
        xFirst = true;
        break;
      }
      await page.click('[data-testid="restart"]');
      await page.waitForFunction(
        () => /轮到/.test(
          document.querySelector('[data-testid="status-text"]')?.textContent ?? '',
        ),
        null,
        { timeout: 4000 },
      );
    }
    assert.ok(xFirst, "12 次内未取到 X-first 在线局");

    api.writes.length = 0;
    api.reads.length = 0;
    await driveTopRowWin(page);
    await page.waitForURL(/\/result/, { timeout: 8000 });
    const outcomePosts = api.writes.filter(
      (w) => w.method === "POST" && /\/api\/rooms\/[^/]+\/stats\/outcomes/.test(w.url),
    );
    assert.equal(
      outcomePosts.length,
      1,
      `outcome POST 恰 1；got ${outcomePosts.length}: ${JSON.stringify(outcomePosts)}`,
    );
    // /api/rooms POST 在 registerViaRoomGate 已 fire（在 api.writes 重置之前），故此处不重复断言。
    // c-step 的硬约束：outcome POST 恰 1（足够；sessions 计数由 R2 单测覆盖）。
    const resultHtml = await page.content();
    assert.ok(/data-value="1"/.test(resultHtml), "/result?room= SSR 含本局新数字 data-value=1");
    assert.ok(page.url().includes("room="), `/result URL 含 room= 参数；got ${page.url()}`);
    await shoot(page, "c-room-gate-result-ssr.png");
  });

  // c2 — /result → play-again → /online 死循环守卫
  await step("c2-play-again-no-dead-loop", async () => {
    await page.click('[data-testid="play-again"]');
    await page.waitForURL(/\/online/, { timeout: 8000 });
    let bouncedToResult = false;
    const pollDeadline = Date.now() + 1500;
    while (Date.now() < pollDeadline) {
      if (/\/result/.test(page.url())) {
        bouncedToResult = true;
        break;
      }
      await page.waitForTimeout(60);
    }
    assert.equal(bouncedToResult, false, `/online 跳回 /result 死循环`);
    assert.ok(/\/online/.test(page.url()), `play-again 后应在 /online；got ${page.url()}`);
    const cellMarks = await page.evaluate(() => {
      const out = {};
      for (let i = 0; i < 9; i += 1) {
        const c = document.querySelector(`[data-testid="cell-${i}"]`);
        out[i] = c ? c.querySelector('[data-testid^="cell-"][data-testid$="-mark"]') !== null : null;
      }
      return out;
    });
    for (const [i, hasMark] of Object.entries(cellMarks)) {
      assert.equal(hasMark, false, `cell-${i} play-again 后应清空`);
    }
    await shoot(page, "c2-play-again-no-loop.png");
  });

  // Q1-a 首页三态 — 无名 mount → /api/* 请求 = 0
  await step("q1a-home-zero-api-anonymous-mount", async () => {
    await wipeAllKeys(page);
    api.writes.length = 0;
    api.reads.length = 0;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="home-page"]');
    await page.waitForTimeout(800);
    const apiReads = api.reads.filter((r) => r.url.includes("/api/"));
    const apiWrites = api.writes.filter((w) => w.url.includes("/api/"));
    assert.equal(
      apiWrites.length,
      0,
      `无名 mount 零网络写；got ${JSON.stringify(apiWrites)}`,
    );
    assert.equal(
      apiReads.length,
      0,
      `无名 mount 零 /api/* 读取；got ${JSON.stringify(apiReads)}`,
    );
    await shoot(page, "q1a-anonymous-home-zero-api.png");
  });

  // Q1-b 首页三态 — 有名 mount → /api/* = 0
  await step("q1b-home-zero-api-named-mount", async () => {
    const name = `oiqa-q1b-${RUN_SUFFIX}`;
    // Use a transient context just for the seed register so the
    // top-level ctx (and the shared `page`) remain alive for q4+ steps.
    const seedCtx = await browser.newContext();
    try {
      const session = await seedCtx.request.post(`${BASE}/api/rooms`, {
        data: { room: name },
        failOnStatusCode: false,
      });
      assert.equal(session.status(), 200, `预注册房间 200；got ${session.status()}`);
    } finally {
      await seedCtx.close();
    }
    const newCtx = await browser.newContext();
    const newPage = await newCtx.newPage();
    const newApi = captureApiTraffic(newPage);
    try {
      await seedRoomName(newPage, name);
      newApi.writes.length = 0;
      newApi.reads.length = 0;
      await newPage.waitForSelector('[data-testid="home-stats-entry"]');
      await newPage.waitForTimeout(800);
      const apiReads = newApi.reads.filter((r) => r.url.includes("/api/"));
      const apiWrites = newApi.writes.filter((w) => w.url.includes("/api/"));
      assert.equal(
        apiWrites.length,
        0,
        `有名 mount 零网络写；got ${JSON.stringify(apiWrites)}`,
      );
      assert.equal(
        apiReads.length,
        0,
        `有名 mount 零 /api/* 读取（关键 A1 强断言）；got ${JSON.stringify(apiReads)}`,
      );
      await shoot(newPage, "q1b-named-home-zero-api.png");
    } finally {
      await newCtx.close();
    }
  });

  // Q1-c 首页三态 — focus 切换 × 3 → /api/* 仍 0
  await step("q1c-home-zero-api-focus-x3", async () => {
    const name = `oiqa-q1c-${RUN_SUFFIX}`;
    const regCtx = await browser.newContext();
    const reg = await regCtx.request.post(`${BASE}/api/rooms`, {
      data: { room: name },
    });
    assert.equal(reg.status(), 200);
    await regCtx.close();
    const focusCtx = await browser.newContext();
    const focusPage = await focusCtx.newPage();
    const focusApi = captureApiTraffic(focusPage);
    try {
      await seedRoomName(focusPage, name);
      focusApi.reads.length = 0;
      focusApi.writes.length = 0;
      for (let i = 0; i < 3; i += 1) {
        await focusPage.evaluate(() => {
          window.dispatchEvent(new Event("blur"));
          window.dispatchEvent(new Event("focus"));
        });
        await focusPage.waitForTimeout(150);
      }
      await focusPage.waitForTimeout(500);
      const apiReads = focusApi.reads.filter((r) => r.url.includes("/api/"));
      const apiWrites = focusApi.writes.filter((w) => w.url.includes("/api/"));
      assert.equal(apiWrites.length, 0, `focus × 3 零网络写；got ${apiWrites.length}`);
      assert.equal(apiReads.length, 0, `focus × 3 零 /api/* 读取；got ${apiReads.length}`);
      await shoot(focusPage, "q1c-focus-x3-zero-api.png");
    } finally {
      await focusCtx.close();
    }
  });

  // Q4 — /result?room= 三分支 + ?name= fallback
  await step("q4-result-room-three-branch-and-name-fallback", async () => {
    // 分支 1：无名访问 /result → fallback 文案
    await wipeAllKeys(page);
    await page.goto(`${BASE}/result`, { waitUntil: "networkidle" });
    const fb1 = await page.isVisible('[data-testid="result-fallback"]');
    assert.ok(fb1, `无名 /result 应走 fallback；got visible=${fb1}`);
    const html1 = await page.content();
    assert.ok(/创建房间|房间/.test(html1), `fallback 文案含「房间」术语`);
    await shoot(page, "q4-branch1-no-room-fallback.png");

    // 分支 2：有名但 server 无行 → 404 → 客户端译空态
    const ghostName = `ghost-${RUN_SUFFIX}`;
    await seedRoomName(page, ghostName);
    await page.evaluate((k) => window.localStorage.removeItem(k), ROOM_KEY);
    await page.goto(`${BASE}/result?room=${ghostName}`, { waitUntil: "networkidle" });
    const emptyVisible = await page.isVisible('[data-testid="result-empty"]');
    assert.ok(emptyVisible, `有名无行 → 译空态；got visible=${emptyVisible}`);
    await shoot(page, "q4-branch2-named-empty.png");

    // 分支 3：有名 + server 有行 → SSR 战绩
    const realName = `oiqa-q4-real-${RUN_SUFFIX}`;
    const sess = await ctx.request.post(`${BASE}/api/rooms`, {
      data: { room: realName },
    });
    assert.equal(sess.status(), 200);
    const merge = await ctx.request.post(
      `${BASE}/api/rooms/${encodeURIComponent(realName)}/stats/merge`,
      {
        data: {
          stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 },
        },
      },
    );
    assert.equal(merge.status(), 200);
    await page.goto(`${BASE}/result?room=${realName}`, { waitUntil: "networkidle" });
    const statsVisible = await page.isVisible('[data-testid="result-stats"]');
    assert.ok(statsVisible, `有名有行 → SSR 战绩；got visible=${statsVisible}`);
    const html3 = await page.content();
    assert.ok(/data-value="5"/.test(html3), `SSR 含本局数字 data-value=5`);
    assert.ok(/data-value="3"/.test(html3), `SSR 含本局数字 data-value=3`);
    await shoot(page, "q4-branch3-named-with-stats.png");

    // 分支 4：旧 ?name= → 优雅 fallback（不 301）
    await page.goto(`${BASE}/result?name=${realName}`, { waitUntil: "networkidle" });
    const fb4 = await page.isVisible('[data-testid="result-fallback"]');
    assert.ok(fb4, `?name= 走 fallback；got visible=${fb4}`);
    const stats4 = await page.locator('[data-testid="result-stats"]').count();
    assert.equal(stats4, 0, `?name= 不渲染 result-stats；got count=${stats4}`);
    await shoot(page, "q4-branch4-name-fallback.png");
  });

  // Q6 — 预设 legacy ttt.player.name.v1 → 首页 mount → 已清除
  await step("q6-legacy-key-cleared-on-mount", async () => {
    const name = `oiqa-q6-${RUN_SUFFIX}`;
    const ghostCtx = await browser.newContext();
    const ghostPage = await ghostCtx.newPage();
    try {
      await ghostPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await ghostPage.evaluate(
        ({ k, n }) => window.localStorage.setItem(k, n),
        { k: LEGACY_KEY, n: name },
      );
      const before = await ghostPage.evaluate((k) => window.localStorage.getItem(k), LEGACY_KEY);
      assert.equal(before, name, `预设 legacy key 成功；got ${before}`);
      await ghostPage.reload({ waitUntil: "networkidle" });
      await ghostPage.waitForTimeout(800);
      const afterLegacy = await ghostPage.evaluate(
        (k) => window.localStorage.getItem(k),
        LEGACY_KEY,
      );
      assert.equal(afterLegacy, null, `RoomGateMount 挂载期 legacy key 清除；got ${afterLegacy}`);
      const afterNew = await ghostPage.evaluate((k) => window.localStorage.getItem(k), ROOM_KEY);
      assert.equal(afterNew, null, `新 key 未被写（D-4 不迁移）；got ${afterNew}`);
      const entryCount = await ghostPage.locator('[data-testid="home-stats-entry"]').count();
      assert.equal(entryCount, 0, `home-stats-entry 不渲染；got count=${entryCount}`);
      const ghostApi = captureApiTraffic(ghostPage);
      ghostApi.writes.length = 0;
      await ghostPage.click('[data-testid="start-online"]');
      await ghostPage.waitForSelector('[data-testid="room-gate-dialog"][open]', {
        timeout: 4000,
      });
      const writes = ghostApi.writes.filter((w) => w.url.includes("/api/"));
      assert.equal(writes.length, 0, `弹框期间零 POST；got ${JSON.stringify(writes)}`);
      await shoot(ghostPage, "q6-legacy-cleared-room-gate.png");
      await ghostPage.click('[data-testid="room-gate-cancel"]');
    } finally {
      await ghostCtx.close();
    }
  });

  // f — 首页 SSR 源码含 JSON-LD（VideoGame / MultiPlayer / Game）
  await step("f-home-ssr-jsonld-videogame-multiplayer", async () => {
    const html = await page.evaluate(async () => {
      const r = await fetch("/", { cache: "no-store" });
      return r.text();
    });
    const m = html.match(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    );
    assert.ok(m, "home SSR 必须含 JSON-LD <script> 块");
    const payload = JSON.parse(m[1]);
    const types = Array.isArray(payload["@type"]) ? payload["@type"] : [payload["@type"]];
    assert.ok(types.includes("VideoGame"), `JSON-LD @type 必须含 VideoGame；got ${types.join(",")}`);
    assert.equal(payload.playMode, "https://schema.org/MultiPlayer", `playMode = MultiPlayer`);
    assert.equal(payload.applicationCategory, "Game", `applicationCategory = Game`);
    await shoot(page, "f-home-ssr-jsonld.png");
  });

  console.log("\nAll W3-probes one-identity assertions PASSED.");
} catch (err) {
  console.error("\nProbe failed:", err?.message ?? err);
  console.error(err?.stack);
  process.exitCode = 1;
} finally {
  api.detach();
  await browser.close();
}

await writeQaLog(EVIDENCE, { base: BASE, runSuffix: RUN_SUFFIX, findings });
