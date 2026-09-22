#!/usr/bin/env node
// sw-console-hygiene.mjs — Service Worker / font preload hygiene probe.
//
// Hard assertions (PASS / FAIL):
//   (a) Loading `/`, `/online` and `/offline` on a production build:
//       (i) the `Link` response header(s) carry zero `rel=preload` +
//       `as=font` entries, (ii) the served HTML carries zero
//       <link rel=preload as=font> elements, and (iii) the console is
//       free of "preloaded using link preload" warnings. D-1 (font
//       preload residual plan §三) removed next/font preloading at the
//       layout layer entirely (Geist/Geist_Mono preload:false): both
//       sporadic warning sources — Chromium's 304-Not-Modified preload
//       false positive (Bug 517439604, fixed ~Chrome 141) and stale
//       Vercel Early Hints entries across deploys — root in the preload
//       entry's existence, so the entry itself must stay gone.
//       (Historical root cause B-A: the SW's CACHEABLE_RE used to match
//       /_next/static/**, which intercepted the next/font preload link
//       and stranded it from Chromium's preload cache; fixed in
//       fa76a39 — that class of warning is now moot with no preload
//       entry at all, but the assertion stays as the regression gate.)
//   (a2) After loading the three routes, reload() each of them and
//       re-assert zero "preloaded using link preload" console warnings
//       on the cached-revisit path — the reproduction matrix showed
//       reload + 304 is the main sporadic path.
//   (b) After loading `/`, `/online` and `/offline` (and waiting for
//       cache.put to flush), caches.open('tic-tac-toe-v1').keys()
//       contains zero /_next/static/ entries. Re-verifies (a) at the
//       Cache Storage level — the SW must not be in the path for hashed
//       bundles.
//   (c) public/sw.js source: the non-cacheable GET pass-through no
//       longer wraps fetch() in respondWith (would otherwise produce
//       "Uncaught (in promise) TypeError: Failed to fetch" noise on
//       network errors); the cache-miss fetch is wrapped in try/catch
//       and the catch returns Response.error() so callers see the
//       browser's default network-error shape.
//
// Soft assertion (best-effort):
//   (d) Reload `/` while the page context is offline (route abort all
//       same-origin requests) produces no SW "Uncaught (in promise)"
//       event. Playwright cannot directly observe worker-console
//       events in this configuration, so this step logs PASS / SKIP
//       and never gates the probe — but it captures the diagnostic
//       evidence (page error list) for human review.
//
// Production build only:
//   The SW is registered by ServiceWorkerRegister, which only
//   activates in production builds (`process.env.NODE_ENV ===
//   'production'`). Running against `pnpm dev` would falsely PASS
//   because no SW is intercepting anything. AGENTS.md §本项目反模式
//   reinforces the production-only QA contract for browser probes.
//
// Usage:
//   BASE_URL=http://localhost:3000 node tests/qa/sw-console-hygiene.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchQA, BASE_URL } from "./lib/browser.mjs";

const BASE = BASE_URL;
const SW_PATH = "public/sw.js";

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

async function collectConsole(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  return page.evaluate(() => ({
    location: location.pathname,
    warnings: (window.__consoleWarnings ?? []).slice(),
  }));
}

const { browser, ctx, page } = await launchQA();
let cacheSnapshot = { "tic-tac-toe-v1": [] };
const pageErrors = [];

try {
  await step("00 wire console + pageerror listeners", async () => {
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        // Forward to the harness log so a human reviewer can correlate
        // the hard-assertion gate with the raw console stream. The
        // location URL also answers the LOW side-question of which
        // resource produced the recurring [console:error] 404 noise
        // (preload plan §四 change 2, non-blocking).
        const loc = msg.location()?.url ? ` (from ${msg.location().url})` : "";
        console.log(`     [console:${msg.type()}] ${msg.text()}${loc}`);
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
      console.log(`     [pageerror] ${err.message}`);
    });
  });

  await step("01 SW registers on production build", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const reg = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("navigator.serviceWorker unavailable");
      }
      const ready = await navigator.serviceWorker.ready;
      const r = await navigator.serviceWorker.getRegistration();
      return {
        scope: r?.scope ?? null,
        active: !!ready.active,
        controller: !!navigator.serviceWorker.controller,
      };
    });
    assert.ok(reg.active, `SW not active: ${JSON.stringify(reg)}`);
    assert.equal(
      reg.controller,
      true,
      `SW does not control the page; clients.claim() may not have fired (reg=${JSON.stringify(reg)})`,
    );
  });

  await step("02 hard(a) three routes: zero font preload in Link headers, HTML and console", async () => {
    // Add the init script once: install a console.warn shim that hoists
    // warnings into a global so we can inspect them after navigation.
    await page.addInitScript(() => {
      window.__consoleWarnings = [];
      const origWarn = console.warn.bind(console);
      console.warn = (...args) => {
        try {
          window.__consoleWarnings.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
        } catch {}
        return origWarn(...args);
      };
    });
    // D-1 hard gate: collect every same-name `Link` response header (the
    // server may emit several) and flag any entry that combines
    // rel=preload with as=font. Entries are comma-separated at the top
    // level and each starts with `<uri>`, so split on commas that
    // precede a `<` to keep per-entry parameters intact.
    const fontPreloadEntries = (linkValues) => {
      const hits = [];
      for (const value of linkValues) {
        for (const entry of value.split(/,\s*(?=<)/)) {
          if (/rel\s*=\s*["']?preload/i.test(entry) && /as\s*=\s*["']?font/i.test(entry)) {
            hits.push(entry.trim());
          }
        }
      }
      return hits;
    };
    const samples = [];
    for (const url of [`${BASE}/`, `${BASE}/online`, `${BASE}/offline`]) {
      const resp = await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const linkHeaders = (await resp.headersArray())
        .filter((h) => h.name.toLowerCase() === "link")
        .map((h) => h.value);
      const headerHits = fontPreloadEntries(linkHeaders);
      const collected = await page.evaluate(() => ({
        location: location.pathname,
        htmlPreloads: document.querySelectorAll('link[rel="preload"][as="font"]').length,
        warnings: (window.__consoleWarnings ?? []).slice(),
      }));
      samples.push({
        url: collected.location,
        linkHeaders,
        headerHits,
        htmlPreloads: collected.htmlPreloads,
        warnings: collected.warnings,
      });
      // Reset the captured warnings between routes.
      await page.evaluate(() => {
        window.__consoleWarnings = [];
      });
    }
    const headerBad = samples.filter((s) => s.headerHits.length > 0);
    assert.equal(
      headerBad.length,
      0,
      `Link header still carries font preload entries (D-1 regression): ${JSON.stringify(headerBad)}`,
    );
    const htmlBad = samples.filter((s) => s.htmlPreloads > 0);
    assert.equal(
      htmlBad.length,
      0,
      `HTML still carries <link rel=preload as=font> elements (D-1 regression): ${JSON.stringify(htmlBad.map((s) => ({ url: s.url, count: s.htmlPreloads })))}`,
    );
    const consoleBad = samples
      .map((s) => ({
        url: s.url,
        hit: s.warnings.filter((w) => /preloaded using link preload/i.test(w)),
      }))
      .filter((s) => s.hit.length > 0);
    if (consoleBad.length > 0) {
      throw new Error(
        `font preload warning present on ${JSON.stringify(consoleBad)}; full samples=${JSON.stringify(samples)}`,
      );
    }
  });

  await step("03 hard(a2) reload each route: console stays free of preload warnings", async () => {
    // The reproduction matrix (preload plan §2.3) showed reload + 304
    // Not Modified is the main sporadic path of the Chromium false
    // positive. With the preload entries removed (D-1) the warning must
    // be impossible on the cached-revisit path too.
    const samples = [];
    for (const url of [`${BASE}/`, `${BASE}/online`, `${BASE}/offline`]) {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const collected = await page.evaluate(() => ({
        location: location.pathname,
        warnings: (window.__consoleWarnings ?? []).slice(),
      }));
      samples.push({ url: collected.location, warnings: collected.warnings });
    }
    const bad = samples
      .map((s) => ({
        url: s.url,
        hit: s.warnings.filter((w) => /preloaded using link preload/i.test(w)),
      }))
      .filter((s) => s.hit.length > 0);
    if (bad.length > 0) {
      throw new Error(`font preload warning present after reload on ${JSON.stringify(bad)}`);
    }
  });

  await step("04 hard(b) caches['tic-tac-toe-v1'] has no /_next/static/ entries", async () => {
    // Drive the same-origin fetch loop so the SW has a chance to
    // populate whatever it intends to populate. Then dump Cache
    // Storage and assert the _next/static prefix is empty.
    await page.evaluate(async () => {
      // Force a refetch of representative static assets; if the SW
      // were caching them they would land in the cache by now.
      await fetch("/").catch(() => {});
      await fetch("/online").catch(() => {});
    });
    await page.waitForTimeout(500);
    const cacheDump = await page.evaluate(async () => {
      const names = await caches.keys();
      const out = {};
      for (const name of names) {
        const cache = await caches.open(name);
        const reqs = await cache.keys();
        out[name] = reqs.map((r) => r.url);
      }
      return out;
    });
    cacheSnapshot = cacheDump;
    const nextStatic = (cacheDump["tic-tac-toe-v1"] ?? []).filter((u) =>
      u.includes("/_next/static/"),
    );
    assert.equal(
      nextStatic.length,
      0,
      `expected zero /_next/static/ entries in tic-tac-toe-v1 cache, found ${JSON.stringify(nextStatic)}; full cache=${JSON.stringify(cacheDump)}`,
    );
  });

  await step("05 hard(c) public/sw.js source passes pass-through + catch guards", async () => {
    const src = readFileSync(SW_PATH, "utf8");
    // Strip block + line comments so documentation / 注释 cannot
    // masquerade as code that satisfies the assertions.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // The non-cacheable GET branch must not respondWith(fetch(...))
    // anymore — that was the source of the "Uncaught (in promise)" noise.
    assert.ok(
      !/event\.respondWith\s*\(\s*fetch\s*\(/.test(codeOnly),
      `sw.js still contains event.respondWith(fetch(...)) pass-through — non-cacheable GETs must short-circuit (return;) to avoid SW unhandled rejections. src=${src}`,
    );
    // Locate the cache-miss branch: everything from the first `caches.open(`
    // after the fetch listener through the matching `})()` IIFE close.
    const openIdx = codeOnly.indexOf("caches.open(");
    assert.ok(openIdx >= 0, `sw.js no longer contains a caches.open(...) call — the cache-first branch disappeared`);
    const tail = codeOnly.slice(openIdx);
    const closeIdx = tail.indexOf("})()");
    assert.ok(closeIdx >= 0, `could not locate the cache-miss IIFE close (})() ) in sw.js`);
    const missBranch = tail.slice(0, closeIdx + 4);
    // The miss branch must wrap fetch(event.request) in a try block.
    assert.ok(
      /\btry\s*\{[\s\S]*?\bawait\s+fetch\s*\(\s*event\.request\b/.test(missBranch),
      `cache-miss branch does not wrap fetch(event.request) in try{} — branch=${missBranch}`,
    );
    // The catch must produce a network-error response (so the page sees
    // the same error shape it would have seen without the SW).
    assert.ok(
      /\}\s*catch\s*(?:\([^)]*\)\s*)?\{[\s\S]*?Response\.error\s*\(\s*\)/.test(missBranch),
      `cache-miss branch must wrap fetch in try/catch and the catch must return Response.error(); branch=${missBranch}`,
    );
    // B-1 invariant: method guard must stay ahead of the SW branch.
    assert.ok(
      /event\.request\.method\s*!==?\s*["']GET["']/.test(codeOnly),
      `method guard (B-1) missing — PUT/POST/DELETE must short-circuit before any respondWith`,
    );
    // Ensure _next/static/ is no longer in the CACHEABLE_RE allow-list.
    // The file header deliberately mentions the path to document the
    // design decision; matching those comments would falsely fail the
    // assertion, so we constrain the check to the CACHEABLE_RE line.
    const cacheableLineMatch = codeOnly.match(/const\s+CACHEABLE_RE\s*=\s*([^;]+);/);
    assert.ok(cacheableLineMatch, `sw.js no longer defines a CACHEABLE_RE constant — the cache-first branch disappeared`);
    assert.ok(
      !/_next\s*\/\s*static\s*\//.test(cacheableLineMatch[1]),
      `CACHEABLE_RE still references /_next/static/ — the fix did not land. line=${cacheableLineMatch[1]}`,
    );
  });

  await step("06 real-surface proof: zero font preload entries on the live page", async () => {
    // D-1 (preload plan §三): next/font preloading was removed at the
    // layout layer (Geist/Geist_Mono preload:false), so the old proof —
    // "the font preload response must not be served from the service
    // worker" — has no subject anymore: there is no preload entry to
    // race against the SW, and the F5 fallback that probed a hardcoded
    // production font hash is gone with it. Per the plan, this step now
    // asserts the absence itself: a fresh navigation of a production
    // route must serve zero <link rel=preload as=font> elements (and
    // zero as=font entries in the Link response header). Either present
    // means the D-1 removal regressed. The SW-out-of-path property for
    // /_next/static/** stays guarded at the cache level (step 04) and
    // the source level (step 05).
    const resp = await page.goto(`${BASE}/online`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const htmlPreloads = await page.evaluate(
      () => document.querySelectorAll('link[rel="preload"][as="font"]').length,
    );
    const linkHeaderHits = (await resp.headersArray())
      .filter((h) => h.name.toLowerCase() === "link")
      .flatMap((h) => h.value.split(/,\s*(?=<)/))
      .filter((entry) => /rel\s*=\s*["']?preload/i.test(entry) && /as\s*=\s*["']?font/i.test(entry));
    assert.equal(
      htmlPreloads,
      0,
      `live page still carries ${htmlPreloads} <link rel=preload as=font> element(s) — D-1 removal regressed`,
    );
    assert.equal(
      linkHeaderHits.length,
      0,
      `live page Link header still carries font preload entries — D-1 removal regressed: ${JSON.stringify(linkHeaderHits)}`,
    );
  });

  await step("07 soft(d) offline reload produces no SW unhandled rejection", async () => {
    // Best-effort: page-level 'pageerror' rarely surfaces SW
    // unhandled rejections directly, so this step logs the diagnostic
    // and PASSES regardless of SW-only events. The hard assertion
    // that matters is (c) above — if respondWith(fetch(...)) is gone
    // from source, there is no SW promise to be rejected.
    await ctx.route("**/*", (route) => route.abort("internetdisconnected"));
    try {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(500);
    } finally {
      await ctx.unroute("**/*");
    }
    if (pageErrors.length > 0) {
      console.log(`     [soft] page errors observed during offline reload: ${JSON.stringify(pageErrors)}`);
    } else {
      console.log(`     [soft] no page errors captured during offline reload (Playwright does not surface SW-only rejections; trust hard assertion (c) instead)`);
    }
  });

  console.log("");
  console.log(`total=${findings.length} pass=${findings.length} fail=0`);
} catch (e) {
  console.error("");
  console.error("FAIL details:");
  console.error(JSON.stringify(findings, null, 2));
  console.error("Cache contents at failure:", JSON.stringify(cacheSnapshot, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
