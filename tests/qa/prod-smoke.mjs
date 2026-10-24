#!/usr/bin/env node
// prod-smoke.mjs — 验证基础设施路线图票 17（prod-smoke，0→1）。
// Plan: .omo/plans/ulw-verification-infra-roadmap-20261007.md §七 票 17
//
// 生产冒烟探针——对 https://3t.onepis.net 实跑，三条断言全只读：
//   ① 首屏 200：GET / → 200 + text/html + 字面 <title>
//   ② 关键资源契约：og:url 钉 D16 正源 3t.onepis.net ＋
//      /manifest.webmanifest（mime + name/start_url/icons 契约字段）、
//      /sw.js、/icon-192.png 全 200 且 mime 逐字面
//   ③ 只读 404 链路：不存在页面 → 404；GET /api/rooms/<合法名无行>/stats
//      → 404 problem+json（stats-not-found）
//
// 生产边界纪律（docs/verification-gauntlet.md「生产边界实证两阶段」）：
//   - 只读：本探针零写路径——自带只读自卫断言（所有观测到的请求方法必为
//     GET，出现任何 POST/PUT/DELETE/PATCH 立即 FAIL，防未来改动悄悄破界）。
//   - 凭据不回显：零凭据设计——只打公开页面与只读 API，不发 Authorization
//     头、不读任何 secret env。若未来扩展需鉴权面，token 一律
//     process.env 现读且绝不打印（回显即红线）。
//   - 两阶段验证：本探针＝首跑（票 17）；「人带多遍」随验证波复跑起算。
//
// 依赖（票 5 统一证据通道）：经 launchQA() 起 browser，console/pageerror
// 捕获与 performance 时序自动落
// .omo/evidence/console-captures/prod-smoke-<stamp>.json（best-effort，
// 绝不改本探针 exit code）。
//
// Usage（不需要本地 server——直连生产）:
//   node tests/qa/prod-smoke.mjs
//   env: PROD_BASE_URL（默认 https://3t.onepis.net，D16 正源常量同
//        app/layout.tsx metadataBase；URL 非凭据）、
//        EVIDENCE_DIR（默认 .omo/evidence/prod-smoke）、
//        PROD_SMOKE_ALLOW_LOCAL=1（显式放行 localhost 目标，仅调试用）。

import assert from "node:assert/strict";
import { launchQA } from "./lib/browser.mjs";
import { ensureDir, shootTo, writeQaLog } from "./lib/evidence.mjs";

// D16 唯一正源（app/layout.tsx metadataBase 同字面量）。这是公开文档化
// 的生产域名，不是凭据；覆写只经 PROD_BASE_URL env。
const DEFAULT_PROD_BASE = "https://3t.onepis.net";
const BASE = (process.env.PROD_BASE_URL ?? DEFAULT_PROD_BASE).replace(/\/+$/, "");
const EVIDENCE = process.env.EVIDENCE_DIR ?? ".omo/evidence/prod-smoke";

// 生产面探针的自我保护：默认拒绝本地目标——防止「以为在冒烟生产、实际
// 打到了本地 server」的假绿（hermetic 冒烟请走既有 :3101 探针范式）。
// 显式 PROD_SMOKE_ALLOW_LOCAL=1 才放行（调试本地生产构建用）。
{
  const url = new URL(BASE);
  const host = url.hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (isLocal && process.env.PROD_SMOKE_ALLOW_LOCAL !== "1") {
    console.error(
      `[prod-smoke] 拒绝本地目标 ${host}：本探针只对生产实跑（PROD_SMOKE_ALLOW_LOCAL=1 可显式放行）`,
    );
    process.exit(1);
  }
  assert.equal(url.protocol, "https:", `生产目标必须是 https；got ${url.protocol}`);
}

// 只读自卫：记录本探针观测到的所有请求方法，末步断言全为 GET。
const observedMethods = [];

// 404 链路用的「合法格式但必然无行」房间名——normalizeRoom 白名单内
// （1-24 字符、无控制字符），永不 POST 建行所以服务端永远无此行。
const RUN_SUFFIX = String(Date.now() % 1_000_000).padStart(6, "0");
const ROOM_404_A = `ps404-${RUN_SUFFIX}`; // 页面 404 路径（复用同一随机段）
const ROOM_404_B = `ps404b-${RUN_SUFFIX}`; // API 404 房名（独立段）

const findings = [];
let failed = false;

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
    failed = true;
    throw e;
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("\nUNHANDLED REJECTION:", reason?.stack ?? reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("\nUNCAUGHT EXCEPTION:", err?.stack ?? err);
  process.exit(1);
});

await ensureDir(EVIDENCE);
const shoot = shootTo(EVIDENCE);

const { browser, ctx, page } = await launchQA({ probeName: "prod-smoke" });
page.on("request", (req) => {
  observedMethods.push({ method: req.method(), url: req.url() });
});
// 观测面补全（评审问题⑤）：page.on("request") 只覆盖 page 级请求；本探针
// 另经 ctx.request（Playwright APIRequestContext）发出的请求——manifest/
// sw.js/icon/API-stats 四处——不触发任何 page 级事件，原观测面对其为零，
// 「防未来改动悄悄破界」的宣称与实际防护面不符。Playwright 的全部动词
// 方法（get/post/put/patch/delete/head）都委托 ctx.request.fetch 单一收口
// （本仓 playwright 实测六动词各恰记 1 条），故只包 fetch 一层：既有四个
// get 调用点与未来任何写调用一律进入末步只读断言的观测面。
{
  const api = ctx.request;
  const origFetch = api.fetch.bind(api);
  api.fetch = (...args) => {
    const method = String(args[1]?.method ?? "GET").toUpperCase();
    observedMethods.push({ method, url: String(args[0]), via: "ctx.request" });
    return origFetch(...args);
  };
}

// step() 失败即 rethrow 中止后续步骤（首屏失败后续步骤无从谈起），但异常在
// 主流程 catch 捕获、不再穿透顶层——保证失败路径走到底部的 writeQaLog
// （status:"FAIL" 证据件）与 if(failed) exit(1) 分支（评审问题②④：原版
// try/finally 下二者在任何 STEP FAIL 场景均为不可达代码，失败时只剩
// best-effort console-capture，退出码只靠 uncaughtException 兜底）。
let stepError = null;

try {
  // ① 首屏 200。
  await step("first-screen 200: GET / → 200 text/html + 字面 title", async () => {
    const resp = await page.goto(`${BASE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    assert.notEqual(resp, null, "homepage navigation response 存在");
    assert.equal(resp.status(), 200, `首屏 status；got ${resp.status()}`);
    const contentType = resp.headers()["content-type"] ?? "";
    assert.ok(
      contentType.includes("text/html"),
      `首屏 content-type 含 text/html；got "${contentType}"`,
    );
    const title = await page.title();
    assert.equal(
      title,
      "井字棋 · 同设备 pass-and-play",
      `首屏 <title> 字面期望；got "${title}"`,
    );
    await shoot(page, "first-screen.png");
  });

  // ② 关键资源契约。
  await step("key-resource contract: og:url 正源 + manifest/sw/icon mime 契约", async () => {
    // og:url 钉 D16 唯一正源（字面量，随 metadataBase 漂移即红）。
    const ogUrl = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:url"]');
      return meta ? meta.content : null;
    });
    assert.equal(
      ogUrl,
      "https://3t.onepis.net",
      `og:url 钉 3t.onepis.net 正源；got "${ogUrl}"`,
    );

    // manifest.webmanifest：mime + 契约字段（name/start_url/关键 icons）。
    const manifestResp = await ctx.request.get(`${BASE}/manifest.webmanifest`, {
      timeout: 20000,
    });
    assert.equal(
      manifestResp.status(),
      200,
      `manifest 200；got ${manifestResp.status()}`,
    );
    const manifestType = manifestResp.headers()["content-type"] ?? "";
    assert.ok(
      manifestType.includes("application/manifest+json"),
      `manifest mime 含 application/manifest+json；got "${manifestType}"`,
    );
    const manifest = await manifestResp.json();
    assert.equal(manifest.name, "井字棋 · 同设备 pass-and-play", "manifest.name 字面期望");
    assert.equal(manifest.start_url, "/", `manifest.start_url="/"；got "${manifest.start_url}"`);
    const iconSrcs = (manifest.icons ?? []).map((i) => i.src);
    for (const src of ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"]) {
      assert.ok(
        iconSrcs.includes(src),
        `manifest.icons 含 ${src}；got ${JSON.stringify(iconSrcs)}`,
      );
    }

    // sw.js：200 + javascript mime。
    const swResp = await ctx.request.get(`${BASE}/sw.js`, { timeout: 20000 });
    assert.equal(swResp.status(), 200, `sw.js 200；got ${swResp.status()}`);
    const swType = swResp.headers()["content-type"] ?? "";
    assert.ok(
      swType.includes("javascript"),
      `sw.js mime 含 javascript；got "${swType}"`,
    );

    // icon-192.png：200 + image/png。
    const iconResp = await ctx.request.get(`${BASE}/icon-192.png`, { timeout: 20000 });
    assert.equal(iconResp.status(), 200, `icon-192.png 200；got ${iconResp.status()}`);
    const iconType = iconResp.headers()["content-type"] ?? "";
    assert.ok(
      iconType.includes("image/png"),
      `icon-192.png mime 含 image/png；got "${iconType}"`,
    );
  });

  // ③ 只读 404 链路。
  await step("read-only 404: 不存在页面 404 + /api/rooms/<无行>/stats 404 problem+json", async () => {
    // 页面 404：硬 status 404（非软 404）。
    const page404 = await page.goto(`${BASE}/${ROOM_404_A}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    assert.notEqual(page404, null, "404 page navigation response 存在");
    assert.equal(
      page404.status(),
      404,
      `不存在页面 status=404；got ${page404.status()}`,
    );

    // API 404：合法房名、无行 → 404 problem+json（stats-not-found）。
    const apiResp = await ctx.request.get(
      `${BASE}/api/rooms/${encodeURIComponent(ROOM_404_B)}/stats`,
      { timeout: 20000 },
    );
    assert.equal(apiResp.status(), 404, `API stats status=404；got ${apiResp.status()}`);
    const apiType = apiResp.headers()["content-type"] ?? "";
    assert.ok(
      apiType.includes("application/problem+json"),
      `API 404 mime 含 application/problem+json；got "${apiType}"`,
    );
    const problem = await apiResp.json();
    assert.equal(
      problem.title,
      "Room stats not found",
      `problem.title 字面期望；got "${problem.title}"`,
    );
    assert.equal(problem.status, 404, `problem.status=404；got ${problem.status}`);
  });

  // 只读自卫断言：全程观测到的请求方法必须全为 GET（观测面＝page 级
  // page.on("request") ＋ ctx.request 级包装记录，双面合计——本探针零写
  // 路径的机械化证明：未来任何人往这里加写调用，这一步立即红）。
  await step("read-only guard: 全程观测请求全为 GET", async () => {
    assert.ok(observedMethods.length > 0, "至少观测到一条请求（探针确实发了流量）");
    const nonGet = observedMethods.filter((r) => r.method !== "GET");
    assert.deepEqual(
      nonGet.map((r) => r.method),
      [],
      `只读红线：出现非 GET 请求 ${JSON.stringify(nonGet)}`,
    );
  });
} catch (e) {
  // 失败事实已由 step() 记入 findings/failed；此处仅阻止异常穿透，让
  // 失败证据件（qa-log.json）与显式 exit(1) 分支可达。
  stepError = e;
} finally {
  await browser.close();
}

await writeQaLog(EVIDENCE, {
  test: "prod-smoke",
  status: failed ? "FAIL" : "PASS",
  base: BASE,
  findings,
  runSuffix: RUN_SUFFIX,
  requestMethodsObserved: observedMethods.map((r) => r.method),
});

if (failed) {
  console.error(`\nPROD-SMOKE FAILED${stepError ? ` -- ${stepError.message}` : ""}`);
  process.exit(1);
}
console.log("\nPROD-SMOKE PASSED（首屏 200 + 资源契约 + 只读 404 全绿）");
process.exit(0);
