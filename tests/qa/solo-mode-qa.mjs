// solo-mode-qa.mjs — Integration probe for the solo practice mode
// (ulw-solo-mode-split-view-transitions C4). One real Chromium +
// production build. Proves the solo contract end to end:
//   1. Home renders the dual CTA (start-game + start-solo).
//   2. A full solo game (forced X-first top-row win) issues ZERO write
//      requests (POST /api/stats/outcome, PUT/DELETE /api/stats) and
//      never navigates to /result — the ResultBanner mounts inline.
//   3. The outcome lands in localStorage 'ttt.solo.stats.v1'
//      (xWins=1) and survives a reload via SoloStatsPanel.
//   4. The local clear button empties the localStorage row instantly
//      (panel follows) while the ranked (server) ledger is untouched.
//
// Usage:
//   node tests/qa/solo-mode-qa.mjs          (needs pnpm build && pnpm start)
//
// Note: driveTopRowWin makes the FIRST player win the top row, so the
// probe reloads /solo until the status bar announces 轮到 X — that makes
// the "xWins=1" localStorage assertion deterministic instead of a
// coin flip (the same first-player-randomness rule every probe obeys).

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { driveTopRowWin } from "./lib/win-drive.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/solo-mode-qa";
const SOLO_KEY = "ttt.solo.stats.v1";
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

// Same-origin fetch helpers (page context) — avoids the cross-origin
// preflight hang stats-race-qa documented for Playwright's request
// context on HTTPS.
async function getStats(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/stats", { cache: "no-store" });
    return r.json();
  });
}

async function deleteStats(page) {
  if (!page.url().startsWith(BASE)) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/stats", { method: "DELETE", cache: "no-store" });
    return r.status;
  });
  assert.equal(status, 200, `DELETE expected 200, got ${status}`);
}

async function readSoloStats(page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), SOLO_KEY);
  return raw === null ? null : JSON.parse(raw);
}

async function panelValues(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="solo-stats"]');
    if (!panel) return null;
    return Array.from(panel.querySelectorAll('[data-testid="stat-value"]')).map((n) =>
      n.getAttribute("data-value"),
    );
  });
}

// Reload /solo until the randomized first player is X (max 12 tries;
// P(still O-first after 12) < 0.03%). Status bar reads 轮到 X / 轮到 O.
async function openSoloAsXFirst(page) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await page.goto(`${BASE}/solo`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="status-text"]');
    const text = await page.textContent('[data-testid="status-text"]');
    if (text.includes("X")) return;
    await page.reload({ waitUntil: "networkidle" });
  }
  throw new Error("could not get an X-first solo game within 12 attempts");
}

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

const { browser, ctx, page } = await launchQA();

// Write-request counter (the solo contract: zero of these during solo).
let soloWriteCount = 0;
page.on("request", (req) => {
  const url = req.url();
  const method = req.method();
  const isWrite =
    (method === "POST" && url.endsWith("/api/stats/outcome")) ||
    (method === "PUT" && url.endsWith("/api/stats")) ||
    (method === "DELETE" && url.endsWith("/api/stats"));
  if (isWrite) soloWriteCount += 1;
});

try {
  await step("01 home dual CTA (start-game + start-solo)", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-game"]');
    await page.waitForSelector('[data-testid="start-solo"]');
    // The testid sits on the Button inside the wrapping Link; the anchor
    // must carry href=/solo.
    const soloHref = await page.getAttribute('a:has([data-testid="start-solo"])', "href");
    assert.equal(soloHref, "/solo", `expected start-solo link href=/solo, got ${soloHref}`);
    await Promise.all([
      page.waitForURL("**/solo", { timeout: 6000 }),
      page.click('[data-testid="start-solo"]'),
    ]);
    await page.waitForSelector('[data-testid="board"]');
    assert.ok(page.url().endsWith("/solo"), `expected to land on /solo, got ${page.url()}`);
  });

  await step("02 ranked ledger reset (baseline for isolation check)", async () => {
    await deleteStats(page);
    const stats = await getStats(page);
    assert.equal(stats.totalGames, 0, `expected clean ranked ledger, got ${stats.totalGames}`);
  });

  await step("03 solo win: zero write requests, inline banner, localStorage xWins=1", async () => {
    soloWriteCount = 0;
    await openSoloAsXFirst(page);
    await driveTopRowWin(page);

    // Inline banner mounts under the board; the URL must NOT change.
    await page.waitForSelector('[data-testid="result-headline"]', { timeout: 4000 });
    const headline = await page.textContent('[data-testid="result-headline"]');
    assert.match(headline, /X 获胜/, `expected X 获胜 banner, got "${headline}"`);
    assert.ok(page.url().endsWith("/solo"), `solo must not navigate, got ${page.url()}`);
    await page.waitForTimeout(500); // settle window for any rogue write

    assert.equal(
      soloWriteCount,
      0,
      `solo issued ${soloWriteCount} write request(s); expected 0`,
    );

    const solo = await readSoloStats(page);
    assert.ok(solo, `expected ${SOLO_KEY} to exist after a solo win`);
    assert.equal(solo.xWins, 1, `expected xWins=1 in ${SOLO_KEY}, got ${solo.xWins}`);
    assert.equal(solo.totalGames, 1, `expected totalGames=1, got ${solo.totalGames}`);
    await shoot(page, "solo-win-inline-banner.png");
  });

  await step("04 reload: SoloStatsPanel hydrates the persisted row", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="solo-stats"]');
    await page.waitForSelector('[data-testid="board"]');
    // Panel re-reads in a post-mount effect; poll until hydrated.
    await page.waitForFunction(
      () => {
        const panel = document.querySelector('[data-testid="solo-stats"]');
        if (!panel) return false;
        const first = panel.querySelector('[data-testid="stat-value"]');
        return first && first.getAttribute("data-value") === "1";
      },
      null,
      { timeout: 4000 },
    );
    const values = await panelValues(page);
    assert.deepEqual(
      values,
      ["1", "1", "0", "0", "X 连胜 1"],
      `expected persisted solo row after reload, got ${JSON.stringify(values)}`,
    );
    await shoot(page, "solo-reload-panel.png");
  });

  await step("05 local clear: localStorage emptied, panel follows, no reload needed", async () => {
    await page.click('[data-testid="reset-solo-stats"]');
    await page.waitForFunction(
      (key) => window.localStorage.getItem(key) === null,
      SOLO_KEY,
      { timeout: 4000 },
    );
    const solo = await readSoloStats(page);
    assert.equal(solo, null, `expected ${SOLO_KEY} removed, got ${JSON.stringify(solo)}`);
    const values = await panelValues(page);
    assert.deepEqual(
      values,
      ["0", "0", "0", "0", "—"],
      `expected panel to show zeros after local clear, got ${JSON.stringify(values)}`,
    );
    await shoot(page, "solo-cleared.png");
  });

  await step("06 ranked ledger untouched by the solo session", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="start-game"]');
    const stats = await getStats(page);
    assert.equal(
      stats.totalGames,
      0,
      `ranked ledger changed during solo session: ${JSON.stringify(stats)}`,
    );
    const domTotal = await page
      .locator('[data-testid="stat-value"]')
      .first()
      .getAttribute("data-value");
    assert.equal(domTotal, "0", `expected home DOM total=0, got ${domTotal}`);
    await shoot(page, "home-after-solo.png");
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
  await ctx.close();
  await browser.close();
}

await writeQaLog(EVIDENCE, { base: BASE, soloKey: SOLO_KEY, findings });

const pass = findings.filter((f) => f.status === "PASS").length;
const fail = findings.filter((f) => f.status === "FAIL").length;
console.log(`\n=== QA SUMMARY: ${pass} PASS / ${fail} FAIL / ${findings.length} total ===`);
process.exit(fail === 0 ? 0 : 1);
