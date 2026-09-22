#!/usr/bin/env node
// room-reset-qa.mjs — W-R (ulw-online-reset-and-result-fresh §1) probe.
// BR: BR-7
//
// Production build probe (BASE_URL, hermetic tmp DB). Covers plan §1:
//   N1  负对照：未知房间 API 直调 reset → 404 problem+json
//       (stats-not-found，防静默建档) 且行仍不存在（GET 仍 404）。
//   S1  进入房间（POST /api/rooms）→ 直接 POST outcomes 造战绩
//       → /result?room= 显示非零账本（总场次=1 / X 胜=1）且清空入口可见。
//   S2  点「清空战绩」→ 确认弹框 → 主 CTA「清空」→ StatsGrid 全零，
//       window 标记存活（零整页 reload），服务端权威 GET totalGames=0。
//
// Usage (production build required — 禁 dev server):
//   DATABASE_URL=file:/tmp/ulw-wr1/probe.db PORT=3111 pnpm start
//   BASE_URL=http://localhost:3111 node tests/qa/room-reset-qa.mjs
// env: BASE_URL (default http://localhost:3000),
//      EVIDENCE_DIR (default .omx/evidence/room-reset-qa).

import assert from "node:assert/strict";
import { launchQA, BASE_URL } from "./lib/browser.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

const BASE = BASE_URL;
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omx/evidence/room-reset-qa";
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

// result-stats 内 5 张 StatsCard：前 4 张 data-value 是数字（总场次 /
// X 胜 / O 胜 / 平局），第 5 张是连胜文案（streakLabel：「X 连胜 N」/
// 「O 连胜 N」/「—」）。
async function statValues(page) {
  return page.$$eval(
    '[data-testid="result-stats"] [data-testid="stat-value"]',
    (els) => els.map((el) => el.getAttribute("data-value")),
  );
}

// N1 — 负对照：未知房间 API 直调 reset。
await step("N1 unknown room: POST reset → 404 problem+json + no silent create", async () => {
  const { browser, ctx } = await launchQA();
  try {
    const ghost = `wr-ghost-${RUN_SUFFIX}`;
    const r = await ctx.request.post(
      `${BASE}/api/rooms/${encodeURIComponent(ghost)}/stats/reset`,
    );
    assert.equal(r.status(), 404, `reset 404；got ${r.status()}`);
    assert.match(
      r.headers()["content-type"] ?? "",
      /application\/problem\+json/,
      `problem+json content-type；got ${r.headers()["content-type"]}`,
    );
    const body = await r.json();
    assert.equal(body.status, 404, `problem body status；got ${body.status}`);
    assert.equal(
      body.type,
      "https://docs.example.com/probs/stats-not-found",
      `problem type slug；got ${body.type}`,
    );
    // 防静默建档：reset 后行仍不存在。
    const get = await ctx.request.get(
      `${BASE}/api/rooms/${encodeURIComponent(ghost)}/stats`,
    );
    assert.equal(get.status(), 404, `GET still 404；got ${get.status()}`);
  } finally {
    await browser.close();
  }
});

// S1 + S2 — 有账本分支的清空全流程。
await step("S1 seed → /result non-zero ledger + reset entry visible", async () => {
  const { browser, ctx, page } = await launchQA();
  try {
    const room = `wr-${RUN_SUFFIX}`;
    const seed = await ctx.request.post(`${BASE}/api/rooms`, {
      data: { room },
    });
    assert.equal(seed.status(), 200, `seed /api/rooms 200；got ${seed.status()}`);
    const outcome = await ctx.request.post(
      `${BASE}/api/rooms/${encodeURIComponent(room)}/stats/outcomes`,
      { data: { outcome: "X" } },
    );
    assert.equal(outcome.status(), 200, `outcomes 200；got ${outcome.status()}`);
    const ob = await outcome.json();
    assert.equal(ob.stats.totalGames, 1, `seeded totalGames=1；got ${ob.stats.totalGames}`);

    await page.goto(
      `${BASE}/result?room=${encodeURIComponent(room)}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForSelector('[data-testid="result-stats"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="reset-room-stats"]', { timeout: 6000 });
    const values = await statValues(page);
    assert.deepEqual(
      values.slice(0, 4),
      ["1", "1", "0", "0"],
      `非零账本（X 胜一局）；got ${JSON.stringify(values)}`,
    );
    assert.match(
      values[4] ?? "",
      /X 连胜 1/,
      `连胜卡非零；got "${values[4]}"`,
    );
    // 零 reload 哨兵：整页 reload 会抹掉 window 标记；router.refresh()
    // 不会。必须在点击清空之前落标记。
    await page.evaluate(() => {
      window.__wrProbeAlive = "yes";
    });
    await shoot(page, "s1-nonzero-ledger.png");

    // S2 — 确认弹框 → 清零 → 全零 + 零 reload + 服务端权威 0。
    await page.click('[data-testid="reset-room-stats"]');
    await page.waitForSelector('[data-testid="reset-room-dialog"][open]', {
      timeout: 6000,
    });
    const title = await page.textContent('[data-testid="reset-room-title"]');
    assert.equal(title, "清空房间战绩？", `dialog 标题逐字；got "${title}"`);
    await shoot(page, "s2-confirm-dialog.png");
    await page.click('[data-testid="reset-room-confirm"]');
    // force-dynamic RSC refresh 后首卡归零（POST 往返 + RSC 重渲染）。
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-testid="result-stats"] [data-testid="stat-value"]',
        )?.getAttribute("data-value") === "0",
      { timeout: 15000 },
    );
    const zeroed = await statValues(page);
    assert.deepEqual(
      zeroed.slice(0, 4),
      ["0", "0", "0", "0"],
      `清零后四数值卡全 0；got ${JSON.stringify(zeroed)}`,
    );
    assert.equal(
      zeroed[4],
      "—",
      `连胜卡归零（—）；got "${zeroed[4]}"`,
    );
    const alive = await page.evaluate(() => window.__wrProbeAlive);
    assert.equal(alive, "yes", "window 标记存活 = 零整页 reload");
    // 服务端权威：清零后的 per-room 行全零。
    const server = await ctx.request.get(
      `${BASE}/api/rooms/${encodeURIComponent(room)}/stats`,
    );
    assert.equal(server.status(), 200, `GET stats 200；got ${server.status()}`);
    const sb = await server.json();
    assert.equal(sb.stats.totalGames, 0, `server totalGames=0；got ${sb.stats.totalGames}`);
    assert.equal(sb.stats.currentStreak, 0, `server currentStreak=0；got ${sb.stats.currentStreak}`);
    // 弹框已关。
    const openCount = await page
      .locator('[data-testid="reset-room-dialog"][open]')
      .count();
    assert.equal(openCount, 0, `确认后弹框关；got open=${openCount}`);
    await shoot(page, "s2-zeroed-ledger.png");
  } finally {
    await browser.close();
  }
});

await writeQaLog(EVIDENCE, {
  probe: "room-reset-qa",
  base: BASE,
  plan: "ulw-online-reset-and-result-fresh",
  findings,
  finishedAt: new Date().toISOString(),
});
console.log("\nALL ROOM-RESET STEPS PASSED");
process.exit(0);
