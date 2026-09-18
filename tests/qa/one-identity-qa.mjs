#!/usr/bin/env node
// one-identity-qa.mjs — W4 (ulw-one-game-two-versions) one-identity
// integration probe. Six assertions on the unified-player-name model:
//   a) Anonymous offline game → localStorage 战绩零写入 + /api/* 零请求
//   b) Anonymous clicks online → 不导航 + 引导出现
//   c) Named online game → POST outcomes 恰 1 次 → /result?name= SSR 含本局新数字
//   d) Offline named + 3 games (跨 soft-nav 回首页) → 网络写请求仅 sessions 1 + merge 1
//   e) GET 不存在名 → 404 problem+json (content-type 断言)
//   f) 首页 SSR 源码含 JSON-LD (VideoGame/MultiPlayer/applicationCategory)
//
// Hermetic :3101 with `DATABASE_URL=file:/tmp/ulw-og2v/<unique>.db`.
// Usage:
//   node tests/qa/one-identity-qa.mjs   (needs `pnpm build` + `next start -p 3101`)
//   env: BASE_URL (default http://localhost:3101),
//        EVIDENCE_DIR (default .omx/evidence/one-identity-qa).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/one-identity-qa";
const PLAYER_KEY = "ttt.player.name.v1";
const OFFLINE_KEY = "ttt.offline.stats.v1";
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

async function loginAs(page, name) {
  // Hard-reset: navigate, clear, reload. Three guarantees that the
  // form is in !hasSaved state on the next render:
  //   1. goto / first — localStorage is per-origin so we must be on it
  //   2. clear PLAYER_KEY + OFFLINE_KEY — drop stale state
  //   3. reload — force a fresh mount + hydration cycle (the form's
  //      useEffect reads localStorage into the store; without reload
  //      the cached store value can mask the clear)
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (k) => window.localStorage.removeItem(k),
    PLAYER_KEY,
  );
  await page.evaluate(
    (k) => window.localStorage.removeItem(k),
    OFFLINE_KEY,
  );
  await page.reload({ waitUntil: "networkidle" });
  // Wait for hydration: input appears after the post-mount useEffect.
  await page.waitForSelector('[data-testid="player-name-input"]', {
    timeout: 8000,
  });
  // Fill + submit. The save button triggers handleSubmit → postSession →
  // on success setStoreName (writes localStorage) → setEditing(false).
  await page.fill('[data-testid="player-name-input"]', name);
  await page.click('[data-testid="player-name-save"]');
  await page.waitForFunction(
    ({ k, expected }) => window.localStorage.getItem(k) === expected,
    { k: PLAYER_KEY, expected: name },
    { timeout: 8000 },
  );
}

async function clearPlayer(page) {
  // Navigate to a same-origin page first (about:blank has no localStorage).
  if (!page.url().startsWith(BASE)) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate((k) => window.localStorage.removeItem(k), PLAYER_KEY);
  await page.evaluate((k) => window.localStorage.removeItem(k), OFFLINE_KEY);
  // Reload so the form's post-mount useEffect sees the cleared store.
  await page.reload({ waitUntil: "networkidle" });
}

const { browser, ctx, page } = await launchQA();
const api = captureApiTraffic(page);

try {

  // ─────────────────────────────────────────────────────────────────
  // (a) Anonymous offline game → localStorage 战绩零写入 + /api/* 零请求
  // ─────────────────────────────────────────────────────────────────
  await step("a-anonymous-offline-zero-writes-zero-storage", async () => {
    await clearPlayer(page);
    api.writes.length = 0;
    api.reads.length = 0;
    await reloadOfflineUntilXFirst(page);
    await driveTopRowWin(page);
    // Wait for the win to settle and phase to flip + auto-switch to stats
    await page.waitForTimeout(1500);
    const offlineRow = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      OFFLINE_KEY,
    );
    assert.equal(
      offlineRow,
      null,
      `anonymous offline must NOT write ${OFFLINE_KEY}; got ${offlineRow}`,
    );
    assert.equal(
      api.writes.length,
      0,
      `anonymous offline must NOT issue any /api/* writes; got ${api.writes.length}: ${JSON.stringify(api.writes)}`,
    );
    // V7 P2-3: anonymous hint must be visible after offline win so the
    // user sees the "无名不记" guard explained inline (auto-switched
    // stats view ≥ WIN_AUTO_SWITCH_MS). The view-toggle testid names
    // are not asserted here — we only check that the testid the
    // OfflineStatsPanel testid-contracts on is on screen.
    const anonVisible = await page.isVisible('[data-testid="offline-stats-anonymous"]');
    assert.ok(
      anonVisible,
      'anonymous offline must show the offline-stats-anonymous hint after win (auto-switch to stats view)',
    );
    await shoot(page, "a-anonymous-offline.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // (b) Anonymous clicks online → 不导航 + 引导出现
  // ─────────────────────────────────────────────────────────────────
  await step("b-anonymous-online-no-nav-guidance", async () => {
    await clearPlayer(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // Set up the CustomEvent spy before clicking
    await page.evaluate(() => {
      window.__playerNameRequiredEvents = [];
      window.addEventListener("ttt:player-name-required", () => {
        window.__playerNameRequiredEvents.push(Date.now());
      });
    });
    const urlBefore = page.url();
    await page.click('[data-testid="start-online"]');
    await page.waitForTimeout(500);
    const urlAfter = page.url();
    assert.equal(
      urlAfter,
      urlBefore,
      `anonymous online click must NOT navigate; was ${urlBefore} now ${urlAfter}`,
    );
    const events = await page.evaluate(
      () => window.__playerNameRequiredEvents ?? [],
    );
    assert.ok(
      events.length >= 1,
      `expected ttt:player-name-required event to fire; got ${events.length}`,
    );
    // Guidance should appear: PlayerNameForm section should be in view
    const sectionVisible = await page.isVisible(
      '[data-testid="player-name-section"]',
    );
    assert.ok(sectionVisible, "player-name-section must be visible after gate");
    await shoot(page, "b-anonymous-online-blocked.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // (c) Named online game → POST outcomes 恰 1 次 → /result SSR 含本局新数字
  // ─────────────────────────────────────────────────────────────────
  await step("c-named-online-once-post-result-ssr-stats", async () => {
    const name = `oiqa-c-${RUN_SUFFIX}`;
    await loginAs(page, name);
    // Soft-nav to /online via the start-online button. This preserves
    // the Zustand store's playerName across navigation (Link-based
    // navigation is the production path; a hard reload would reset
    // the module singleton, and startGame('online') deliberately does
    // NOT rehydrate playerName from localStorage the way
    // startGame('offline') does — same-session login is the only path
    // the online flow supports).
    await page.click('[data-testid="start-online"]');
    await page.waitForURL(/\/online/);
    // Wait for first turn to settle.
    await page.waitForSelector('[data-testid="status-bar"]');
    await page.waitForSelector('[data-testid="status-text"]', { timeout: 4000 });
    // driveTopRowWin assumes X-first. Loop via restart (which keeps
    // store.playerName intact) until the randomized first player is X.
    let xFirst = false;
    for (let attempt = 1; attempt <= 12 && !xFirst; attempt += 1) {
      const text = await page.textContent('[data-testid="status-text"]');
      if (text && text.includes("轮到 X")) {
        xFirst = true;
        break;
      }
      // Click restart → phase flips to 'idle' → PlayController's
      // useEffect fires startGame('online') with a fresh random first
      // player. The store retains playerName throughout.
      await page.click('[data-testid="restart"]');
      // Wait for the new game to settle (status-text re-renders).
      await page.waitForFunction(
        () => /轮到/.test(
          document.querySelector('[data-testid="status-text"]')?.textContent ?? '',
        ),
        null,
        { timeout: 4000 },
      );
    }
    assert.ok(xFirst, "could not get an X-first online game within 12 attempts");

    // Reset write counter before the win. We only care about the
    // POST outcomes fired during the actual game-end.
    api.writes.length = 0;
    api.reads.length = 0;

    // Drive the top-row win (X at 0, 1, 2; O at 3, 4).
    await driveTopRowWin(page);

    // Wait for /result navigation. The ResultNavigator pushes /result
    // immediately after the store settles on 'won'/'drawn', so the URL
    // flip is the canonical signal. Skip the inline status-text check:
    // it briefly shows "X 获胜" for a few hundred ms before the
    // navigator unmounts the status-text element.
    await page.waitForURL(/\/result/, { timeout: 8000 });

    // POST outcomes must have fired exactly once.
    const outcomePosts = api.writes.filter(
      (w) => w.method === "POST" && /\/api\/players\/[^/]+\/stats\/outcomes/.test(w.url),
    );
    assert.equal(
      outcomePosts.length,
      1,
      `expected exactly 1 POST outcomes; got ${outcomePosts.length}: ${JSON.stringify(outcomePosts)}`,
    );

    // /result SSR source must contain the post-game stat (xWins=1).
    const resultHtml = await page.content();
    assert.ok(
      /data-value="1"/.test(resultHtml),
      `/result SSR must contain the post-game stat (data-value="1")`,
    );
    await shoot(page, "c-named-online-result.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // (d) Offline named + 3 games (跨 soft-nav 回首页) → 网络写 = sessions 1 + merge 1
  // ─────────────────────────────────────────────────────────────────
  await step("d-offline-named-three-games-soft-nav-home", async () => {
    const name = `oiqa-d-${RUN_SUFFIX}`;
    await loginAs(page, name);
    api.writes.length = 0;
    api.reads.length = 0;
    // Three offline games
    for (let i = 0; i < 3; i += 1) {
      await reloadOfflineUntilXFirst(page);
      await driveTopRowWin(page);
      await page.waitForTimeout(1400); // wait for auto-switch to stats
      // Click play-again-offline to reset phase → board view
      const playAgain = await page.$('[data-testid="play-again-offline"]');
      if (playAgain) await playAgain.click();
      await page.waitForSelector('[data-testid="cell-0"]', { timeout: 4000 });
    }
    // Soft-nav back to home
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // Wait for the sync dialog if pending > 0
    await page.waitForTimeout(800);
    const dialogVisible = await page.isVisible('[data-testid="sync-confirm-dialog"][open]');
    assert.ok(
      dialogVisible,
      "sync-confirm-dialog must open after offline named returns to home with pending > 0",
    );
    // Confirm merge
    await page.click('[data-testid="sync-confirm-confirm"]');
    // Wait for dialog to close + merge to complete
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="sync-confirm-dialog"][open]'),
      null,
      { timeout: 8000 },
    );
    // Filter writes: only sessions + merge expected
    const sessionsPosts = api.writes.filter(
      (w) => w.method === "POST" && /\/api\/sessions$/.test(w.url),
    );
    const mergePosts = api.writes.filter(
      (w) => w.method === "POST" && /\/api\/players\/[^/]+\/stats\/merge$/.test(w.url),
    );
    // All other write requests must be 0
    const otherWrites = api.writes.filter(
      (w) => !/\/api\/sessions$/.test(w.url) && !/\/api\/players\/[^/]+\/stats\/merge$/.test(w.url),
    );
    assert.equal(
      sessionsPosts.length,
      1,
      `expected exactly 1 POST /api/sessions; got ${sessionsPosts.length}`,
    );
    assert.equal(
      mergePosts.length,
      1,
      `expected exactly 1 POST /api/players/{name}/stats/merge; got ${mergePosts.length}`,
    );
    assert.equal(
      otherWrites.length,
      0,
      `no other writes allowed; got ${otherWrites.length}: ${JSON.stringify(otherWrites)}`,
    );
    await shoot(page, "d-offline-named-three-games.png");
  });

  // ─────────────────────────────────────────────────────────────────
  // (e) GET 不存在名 → 404 problem+json (content-type 断言)
  // ─────────────────────────────────────────────────────────────────
  await step("e-get-unknown-name-404-problem-json", async () => {
    const r = await ctx.request.get(
      `${BASE}/api/players/oiqa-nonexistent-${RUN_SUFFIX}/stats`,
      { failOnStatusCode: false },
    );
    assert.equal(r.status(), 404, `expected 404 for unknown name; got ${r.status()}`);
    const ct = r.headers()["content-type"] || "";
    assert.ok(
      /application\/problem\+json/.test(ct),
      `expected application/problem+json content-type; got "${ct}"`,
    );
    const body = await r.json();
    assert.ok(
      typeof body.type === "string" && body.type.startsWith("https://"),
      `problem+json must have an https:// type URI; got ${body.type}`,
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // (f) 首页 SSR 源码含 JSON-LD (VideoGame/MultiPlayer/applicationCategory)
  // ─────────────────────────────────────────────────────────────────
  await step("f-home-ssr-jsonld-videogame-multiplayer", async () => {
    const html = await page.evaluate(async () => {
      const r = await fetch("/?__jsonld=1", { cache: "no-store" });
      return r.text();
    });
    const m = html.match(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    );
    assert.ok(m, "home SSR must contain a JSON-LD <script> block");
    const payload = JSON.parse(m[1]);
    const types = Array.isArray(payload["@type"])
      ? payload["@type"]
      : [payload["@type"]];
    assert.ok(
      types.includes("VideoGame"),
      `JSON-LD @type must include VideoGame; got ${types.join(",")}`,
    );
    assert.equal(
      payload.playMode,
      "https://schema.org/MultiPlayer",
      `JSON-LD playMode must be MultiPlayer; got ${payload.playMode}`,
    );
    assert.equal(
      payload.applicationCategory,
      "Game",
      `JSON-LD applicationCategory must be Game; got ${payload.applicationCategory}`,
    );
    await shoot(page, "f-home-ssr-jsonld.png");
  });

  console.log("\nAll 6 one-identity assertions PASSED.");
} catch (err) {
  console.error("\nProbe failed:", err?.message ?? err);
  console.error(err?.stack);
  process.exitCode = 1;
} finally {
  api.detach();
  await browser.close();
}

await writeQaLog(EVIDENCE, { base: BASE, runSuffix: RUN_SUFFIX, findings });
