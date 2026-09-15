// stats-race-qa.mjs — Integration probe for the 3 production-only stats
// bugs (B-1 SW double-PUT, B-2 PlayController setTimeout race, B-3 RSC
// static prerender). One real Chromium + production build; client-side
// navigation; DOM digits cross-checked against /api/stats.
//
// Usage:
//   node tests/qa/stats-race-qa.mjs
//   DATABASE_URL_SLOW_DELAY_MS=1500 node tests/qa/stats-race-qa.mjs
//
// The DATABASE_URL_SLOW_DELAY_MS knob (read in lib/db.ts) reproduces
// Turso HTTP latency on local sqlite so the post-fix event-driven
// navigation still has to wait for PUT completion before navigating.

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";

// Process-level safety: ensure an unhandled rejection or uncaught
// exception in a Playwright helper doesn't leave code 0 behind. The
// per-step try/catch only covers synchronous throws inside step(name, fn);
// async helpers outside (e.g. internal Playwright listeners firing after a
// navigation close, or a stray throw inside one of the page.on() callbacks
// below) can surface as unhandled rejections on this process. Without
// these handlers, node 22 exits 1 silently on unhandled rejection — but
// the exit happens mid-step before the QA SUMMARY line, so the harness
// looks like a flaky crash with no stack trace. Convert to a clear print
// + exit 1 so the failure mode is observable.
process.on("unhandledRejection", (reason) => {
  console.error(
    "\nUNHANDLED REJECTION:",
    reason && reason.stack ? reason.stack : reason,
  );
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error(
    "\nUNCAUGHT EXCEPTION:",
    err && err.stack ? err.stack : err,
  );
  process.exit(1);
});

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/stats-race-qa";
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

// Acquire probe stats via the page context so cross-page refresh sees the
// same response the user would see. Cache-bust every fetch.
async function getStats(page) {
  return page.evaluate(async () => {
    // 2026-09-15 hardening: 1 retry + 5s timeout per attempt via
    // Promise.race. Kills the occasional "TypeError: Failed to fetch"
    // observed at :189 / :368 on local sqlite when the SW lifecycle
    // races a probe-issued read.
    const fetchWithRetry = async (url, init = {}) => {
      const withTimeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("fetch timeout")), ms),
          ),
        ]);
      let lastErr;
      for (let i = 0; i < 2; i++) {
        try {
          return await withTimeout(
            fetch(url, { ...init, cache: "no-store" }),
            5000,
          );
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    };
    const r = await fetchWithRetry("/api/stats");
    return r.json();
  });
}

// Reset stats via the page's own fetch so the request is same-origin and
// skips the CORS preflight that Playwright's APIRequestContext triggers on
// cross-origin HTTPS (Vercel); that preflight hangs past the 30 s default
// timeout. Page must already be navigated to BASE — every step that calls
// deleteStats navigates first (or, for step 01, we navigate here).
async function deleteStats(page) {
  if (!page.url().startsWith(BASE)) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  const status = await page.evaluate(async (base) => {
    // 2026-09-15 hardening: same retry contract as getStats. The
    // DELETE path is the one that races SW lifecycle most often
    // because the reset button fires it right after a navigation.
    const fetchWithRetry = async (url, init = {}) => {
      const withTimeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("fetch timeout")), ms),
          ),
        ]);
      let lastErr;
      for (let i = 0; i < 2; i++) {
        try {
          return await withTimeout(
            fetch(url, { ...init, cache: "no-store" }),
            5000,
          );
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    };
    const r = await fetchWithRetry(`${base}/api/stats`, {
      method: "DELETE",
    });
    return r.status;
  }, BASE);
  assert.equal(status, 200, `DELETE expected 200, got ${status}`);
}

const launch = await launchQA();
const { browser, ctx } = launch;
let { page } = launch;

// Count PUTs that flow through the SW during the page lifetime. Service
// worker pass-through is the regression vector for B-1; this counts only
// the requests the SW actually forwards to the network.
let swPutCount = 0;
let swPostCount = 0;
// Defensive: Playwright re-enters this listener for every request even
// after a navigation close or page error; a throw here surfaces as an
// unhandled rejection on this process and (pre-fix) silently killed the
// probe mid-step. Counter increments can't fail in practice, but the
// try/catch is cheap and makes the listener provably non-throwing.
page.on("request", (req) => {
  try {
    if (req.method() === "PUT" && req.url().endsWith("/api/stats")) {
      swPutCount += 1;
    }
    // POST outcome is the server-authoritative write path introduced by
    // stats-server-authoritative-delta (commit 6 rewrites step 06 to
    // count these instead of full PUTs).
    if (req.method() === "POST" && req.url().endsWith("/api/stats/outcome")) {
      swPostCount += 1;
    }
  } catch (e) {
    console.error("request listener error:", e && e.message);
  }
});

try {
  await step("01 reset via DELETE (pre-setup)", async () => {
    await deleteStats(page);
  });

  await step("02 SW-only intercepts GET (A1, B-1 regression)", async () => {
    // B-1: pre-fix the SW fired event.respondWith for non-GET methods too
    // and the browser observed two outbound requests. Post-fix only GETs
    // pass through. The win path now goes via POST /api/stats/outcome
    // (server-authoritative delta, commit 3), so we count POSTs not PUTs.
    swPostCount = 0;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300); // let StatsHydrator mount
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    await driveTopRowWin(page);
    await page.waitForURL("**/result", { timeout: 6000 });
    await page.waitForSelector('[data-testid="result-headline"]');
    await page.waitForTimeout(800); // give the POST time to land
    assert.equal(
      swPostCount,
      1,
      `expected exactly 1 POST outcome after a win, got ${swPostCount}`,
    );
  });

  await step("03 event-driven nav (no setTimeout — B-2 regression)", async () => {
    // B-2: pre-fix PlayController had setTimeout(router.replace, 700ms)
    // racing the PUT. Post-fix navigation follows lastWriteAt. Verify the
    // URL changed without the previous setTimeout-shaped gap, and that
    // /result shows the same stats the DB now has.
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    const tWin = Date.now();
    await driveTopRowWin(page);
    await page.waitForURL("**/result", { timeout: 4000 });
    const navMs = Date.now() - tWin;
    // Last driveTopRowWin click gap is 120ms × 5 = 600ms; nav should land
    // roughly within the same window (no extra 700ms timer).
    assert.ok(
      navMs < 3500,
      `navigation took ${navMs}ms; expected <3500ms (no setTimeout)`,
    );
    // DOM digits should match API digits — B-3 regression guard.
    const api = await getStats(page);
    const domDigits = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="stat-value"]')).map(
        (n) => n.getAttribute("data-value"),
      ),
    );
    assert.equal(api.totalGames, 1, `expected totalGames=1, got ${api.totalGames}`);
    assert.ok(
      domDigits.includes(String(api.totalGames)),
      `DOM digits ${JSON.stringify(domDigits)} missing API totalGames=${api.totalGames}`,
    );
  });

  await step("04 RSC reads DB on every nav (B-3a regression)", async () => {
    // B-3a: pre-fix RSC pages were statically prerendered, so a fresh
    // /result nav showed build-time baked stats. Post-fix force-dynamic
    // means each nav reads the current row.
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    await driveTopRowWin(page);
    await page.waitForURL("**/result", { timeout: 6000 });
    await page.waitForSelector('[data-testid="result-headline"]');
    await page.waitForTimeout(800);
    const fresh = await getStats(page);
    assert.equal(
      fresh.totalGames,
      1,
      `expected totalGames=1 after fresh reset+win, got ${fresh.totalGames}`,
    );
    const domDigits = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="stat-value"]')).map(
        (n) => n.getAttribute("data-value"),
      ),
    );
    assert.ok(
      domDigits.includes(String(fresh.totalGames)),
      `DOM digits ${JSON.stringify(domDigits)} missing fresh totalGames=${fresh.totalGames}`,
    );
  });

  await step("05 resetAll awaited + refresh (B-3b regression)", async () => {
    // B-3b: pre-fix resetAll fired the DELETE then synchronously called
    // router.refresh(); the refresh re-read the still-present row. After
    // the fix, the onClick awaits resetAll then refreshes, so a fresh
    // /result reads zeros.
    //
    // 2026-09-15 hardening: step 05 used to poll /api/stats from the
    // page context and wait for totalGames === 0 with an 8000 ms budget
    // — same race step 10 already fixed (the click→assert-below used to
    // read /api/stats from a probe-issued GET that RACED the button's own
    // DELETE). On idle hardware with React 19 <ViewTransition> page
    // boundary (f45ddbf) the probe GET can win the scheduler window
    // repeatedly: the DELETE handler returns { ok: false, reason:
    // 'aborted' } once the store's 8000 ms AbortController fires
    // (NETWORK_TIMEOUT_MS in lib/store.ts:135), after which
    // router.refresh() re-reads the unchanged row and the probe poll
    // keeps seeing totalGames > 0 until the 8000 ms budget elapses.
    // Baseline 10-run probe (tmp/race-baseline{,-2}/run-*.log):
    // 9/10 PASS, 1/10 FAIL at this step with the exact
    // "page.waitForFunction: Timeout 8000ms exceeded" signature.
    //
    // Fix mirrors step 10's proven pattern: explicitly await the DELETE
    // response (waitForResponse), so the probe-issued poll cannot win
    // against the button's own DELETE. 10000 ms timeout matches step
    // 10 (DB round-trip <5 s × 2 budget = 10000 ms; 10000 ms is the
    // chosen floor per V2 F2 — the Turso outlier at 30733 ms never
    // recurs but the budget keeps the probe non-flaky without hiding
    // regressions). The probe then navigates to /result, which is
    // force-dynamic, so the RSC re-read observes the post-reset row.
    await page.waitForSelector('[data-testid="reset-stats-result"]');
    const deleteSettled = page.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes("/api/stats"),
      { timeout: 10000 },
    );
    await page.click('[data-testid="reset-stats-result"]');
    await deleteSettled;
    // After reset + refresh, navigate to /result to observe the new read.
    await page.goto(`${BASE}/result`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="result-headline"]');
    const after = await getStats(page);
    assert.equal(
      after.totalGames,
      0,
      `expected totalGames=0 after reset, got ${after.totalGames}`,
    );
    const domDigits = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="stat-value"]')).map(
        (n) => n.getAttribute("data-value"),
      ),
    );
    // First four stat values are plain integers (总场次/X胜/O胜/平局);
    // the streak label renders '—' for zero by design (see
    // lib/game.ts:94 streakLabel).
    const numeric = domDigits.slice(0, 4);
    const streak = domDigits[4];
    assert.ok(
      numeric.every((d) => d === "0"),
      `expected first 4 stat values to be 0, got ${JSON.stringify(numeric)}`,
    );
    assert.equal(streak, "—", `expected streak label '—' at zero, got ${streak}`);
  });

  await step("06 multi-POST {outcome} ordering under slow DB (D4)", async () => {
    // D4 (post-fix): 10 sequential POST /api/stats/outcome {outcome:'X'}
    // requests — the server-authoritative accumulator reads, applies
    // recordOutcome, writes — must produce exactly 10 POSTs observed by
    // the SW and totalGames=10, xWins=10 in the response. This proves
    // server-side write serialization, not client-side ordering
    // assumptions. The DATABASE_URL_SLOW_DELAY_MS knob reproduces Turso
    // HTTP latency on local sqlite so the per-op slowness doesn't
    // collapse into a single batched write.
    const slowDelayMs = Number(process.env.DATABASE_URL_SLOW_DELAY_MS ?? 0);
    swPostCount = 0;
    await deleteStats(page);
    const statuses = await page.evaluate(async (base) => {
      const out = [];
      for (let i = 0; i < 10; i += 1) {
        const r = await fetch(`${base}/api/stats/outcome`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outcome: "X" }),
          cache: "no-store",
        });
        out.push(r.status);
      }
      return out;
    }, BASE);
    for (const s of statuses) {
      assert.equal(s, 200, `expected POST status=200, got ${s}`);
    }
    await page.waitForTimeout(slowDelayMs + 200);
    const api = await getStats(page);
    assert.equal(api.totalGames, 10, `expected totalGames=10, got ${api.totalGames}`);
    assert.equal(api.xWins, 10, `expected xWins=10, got ${api.xWins}`);
    assert.equal(swPostCount, 10, `expected 10 POSTs, got ${swPostCount}`);
  });

  await step("07 cross-mount no leaked state (D5)", async () => {
    // D5: leave /play mid-game, navigate to /, then back to /play — the
    // new game must auto-start cleanly with no leaked stats from the
    // previous run.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    // Make one move only — leave mid-game.
    await page.click('[data-testid="cell-0"]');
    await page.waitForTimeout(200);
    const midBoard = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('[data-testid^="cell-"]'));
      return cells.map((c) => c.textContent?.trim() ?? "");
    });
    assert.ok(midBoard.some((t) => t !== ""), "first move should appear on the board");
    // Navigate away and back via the in-app link.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    await page.waitForTimeout(200);
    const newBoard = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('[data-testid^="cell-"]'));
      return cells.map((c) => c.textContent?.trim() ?? "");
    });
    assert.ok(
      newBoard.every((t) => t === ""),
      `expected fresh board on second visit, got ${JSON.stringify(newBoard)}`,
    );
  });

  await step("08 manual nav race (D3)", async () => {
    // D3: post-win, a user pressing "back to home" within the navigation
    // window must not leave the app in a stuck state. The win flow is
    // event-driven now, so the manual nav just wins — the URL still
    // resolves and stats stay consistent.
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    await driveTopRowWin(page);
    // Don't wait for /result — click 返回首页 before it lands.
    await Promise.all([
      page.waitForURL("**/", { timeout: 4000 }).catch(() => {}),
      page.click('text="返回首页"').catch(() => {}),
    ]);
    await page.waitForTimeout(800);
    const api = await getStats(page);
    assert.equal(api.totalGames, 1, `expected totalGames=1, got ${api.totalGames}`);
  });

  await step("09 SW activation race (E1)", async () => {
    // E1: a freshly installed SW that activates mid-PUT must not drop or
    // double the write. With the SW guarded by method, the PUT bypasses
    // the SW entirely so activation timing is irrelevant — the count is
    // always 1.
    swPostCount = 0;
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    // Force a fresh SW activation before the win.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) {
        await reg.update().catch(() => {});
      }
    });
    await page.waitForTimeout(200);
    // Run the win driver and the navigation wait concurrently so the URL
    // transition can be observed the moment the route changes — avoids
    // waiting for the full 5-click chain (5 × 120 ms = 600 ms) BEFORE
    // waitForURL even starts, which is the source of the original 6 s
    // timeout flake. driveTopRowWin does not navigate; Promise.all is safe.
    await Promise.all([
      page.waitForURL("**/result", { timeout: 10000 }),
      driveTopRowWin(page),
    ]);
    await page.waitForTimeout(800);
    assert.equal(swPostCount, 1, `expected 1 POST through SW, got ${swPostCount}`);
  });

  await step("10 reset button on / refreshes (B-3b path 2)", async () => {
    // B-3b path 2: the home page's 重置战绩 button (not the /result one).
    // Wait for the DOM to flip to 0 instead of a fixed sleep — Turso
    // round-trips push the home page re-render past a fixed 500 ms budget
    // on Vercel; the local sqlite run finishes in ~80 ms.
    //
    // 2026-09-15 hardening: the click→assert below used to read /api/stats
    // from a probe-issued GET that RACED the button's own DELETE. The React
    // 19 <ViewTransition> page boundary (f45ddbf) shifted the scheduler
    // margin and the probe GET started deterministically winning on a
    // local-sqlite box (2× repro on main; 51f164c / 2b79d14 both PASS), so
    // the step was asserting scheduler luck, not the B-3b contract. The
    // contract is "resetAll (DELETE) awaited before refresh reads zeros" —
    // await the DELETE response explicitly, then read.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="reset-stats"]');
    const deleteSettled = page.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes("/api/stats"),
      { timeout: 10000 },
    );
    await page.click('[data-testid="reset-stats"]');
    await deleteSettled;
    const api = await getStats(page);
    assert.equal(api.totalGames, 0, `expected reset to zero stats, got ${api.totalGames}`);
    await page
      .locator('[data-testid="stat-value"]')
      .first()
      .evaluate(
        (el, target) =>
          new Promise((resolve, reject) => {
            const deadline = Date.now() + 8000;
            const tick = () => {
              if (el.getAttribute("data-value") === target) return resolve();
              if (Date.now() > deadline)
                return reject(
                  new Error(
                    `DOM total did not reach ${target} in 8000ms (got ${el.getAttribute("data-value")})`,
                  ),
                );
              setTimeout(tick, 50);
            };
            tick();
          }),
        "0",
      );
  });

  await step("11 cross-session persistence (close + reopen)", async () => {
    // After a win, close the tab and open a new context — the new context
    // should see the persisted stats via RSC on first paint.
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    await driveTopRowWin(page);
    await page.waitForURL("**/result", { timeout: 6000 });
    await page.waitForSelector('[data-testid="result-headline"]');
    await page.waitForTimeout(800);
    await ctx.close();
    const { browser: b2, ctx: c2, page: p2 } = await launchQA();
    try {
      await p2.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const fresh = await getStats(p2);
      assert.equal(fresh.totalGames, 1, `expected persisted totalGames=1, got ${fresh.totalGames}`);
      const domTotal = await p2
        .locator('[data-testid="stat-value"]')
        .first()
        .getAttribute("data-value");
      assert.equal(domTotal, "1", `expected DOM total=1 in new session, got ${domTotal}`);
    } finally {
      await c2.close();
      await b2.close();
    }
  });

  // Step 11 closed the original context; relaunch a fresh page for the
  // remaining steps.
  const ctx2 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  page = await ctx2.newPage();
  // Defensive try/catch — see the initial page.on("request") block above
  // for rationale (mid-step unhandled rejection ⇒ silent exit 0).
  page.on("request", (req) => {
    try {
      if (req.method() === "PUT" && req.url().endsWith("/api/stats")) {
        swPutCount += 1;
      }
      // The win path is POST /api/stats/outcome (server-authoritative
      // delta). The bridge listener only mirrored the PUT half of the
      // main counter, so every POST-count assertion after step 11 read
      // 0 — pre-existing since the PUT→POST migration (2026-09-15
      // hardening, repro on 51f164c and main alike).
      if (req.method() === "POST" && req.url().endsWith("/api/stats/outcome")) {
        swPostCount += 1;
      }
    } catch (e) {
      console.error("request listener error:", e && e.message);
    }
  });

  await step("12 SW skip-api equivalent (POST count = 1)", async () => {
    // A3: same intent as step 02 — verify the win-write count is exactly 1,
    // the minimal regression assertion for B-1. Win path is POST outcome.
    await deleteStats(page);
    swPostCount = 0;
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click('[data-testid="start-game"]');
    await page.waitForURL("**/play");
    await page.waitForSelector('[data-testid="board"]');
    await driveTopRowWin(page);
    await page.waitForURL("**/result", { timeout: 6000 });
    await page.waitForTimeout(800);
    assert.equal(swPostCount, 1, `expected 1 POST outcome, got ${swPostCount}`);
  });

  await step("13 StatsGrid not subscribed to store (D6)", async () => {
    // D6: the home page shows the same totalGames as the API even before
    // any client-side interaction. If StatsGrid were subscribing to the
    // store instead of taking the server-rendered snapshot as a prop,
    // it would lag during the PUT window.
    await deleteStats(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const apiAtLoad = await getStats(page);
    const domAtLoad = await page
      .locator('[data-testid="stat-value"]')
      .first()
      .getAttribute("data-value");
    assert.equal(
      domAtLoad,
      String(apiAtLoad.totalGames),
      `expected DOM total=${apiAtLoad.totalGames} at first paint, got ${domAtLoad}`,
    );
  });

  await step("14 DOM === API after every nav (B-1+B-2+B-3 combo)", async () => {
    // Final combo: drive 3 wins, after each navigate to /result, assert
    // DOM digits match the API. This is the integration regression that
    // 6-layer Gauntlet alone could not catch (B-3a evidence).
    await deleteStats(page);
    for (let i = 0; i < 3; i += 1) {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.click('[data-testid="start-game"]');
      await page.waitForURL("**/play");
      await page.waitForSelector('[data-testid="board"]');
      await driveTopRowWin(page);
      await page.waitForURL("**/result", { timeout: 6000 });
      await page.waitForSelector('[data-testid="result-headline"]');
      await page.waitForTimeout(500);
      const api = await getStats(page);
      const dom = await page
        .locator('[data-testid="stat-value"]')
        .first()
        .getAttribute("data-value");
      assert.equal(
        dom,
        String(api.totalGames),
        `after win ${i + 1}: DOM=${dom}, API=${api.totalGames}`,
      );
      // Click 返回首页 to reset phase for next iteration.
      await page.click('text="返回首页"');
    }
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
  // ctx was explicitly closed inside step 11; closing again throws
  // "Target page, context, or browser has been closed" — pre-fix that
  // bubbled up and aborted the finally block before browser.close() ran,
  // leaking Chromium. Wrap both close() calls defensively.
  try {
    await ctx.close();
  } catch {
    /* may already be closed */
  }
  try {
    await ctx2.close();
  } catch {
    /* may already be closed */
  }
  try {
    await browser.close();
  } catch {
    /* may already be closed */
  }
}

const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
