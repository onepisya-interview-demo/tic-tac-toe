#!/usr/bin/env node
// pwa-sw-cache-qa.mjs — PWA / Service Worker cache-first coverage for
// the P3 dual-layer fix (commit 2). Production build + real Chromium;
// after the SW registers and claims the client, we trigger two fetch
// passes for /manifest.webmanifest and assert the second one is served
// from the SW cache ('service-worker' source via Playwright
// response.fromServiceWorker). Also inspects Cache Storage via
// window.caches and confirms the 'tic-tac-toe-v1' cache name carries
// the manifest entry.
//
// Note: headless Chromium does not eagerly fetch the manifest link
// (no install prompt yet, no PWA criteria met), so the probe drives
// fetches via the page context — the same origin the SW controls.
// The user-visible scenario from HAR §P3 (56-94 manifest requests
// per PWA session) only manifests in installed / long-lived contexts
// where the browser auto-fetches the manifest, but the SW layer
// behaves identically whether the request comes from a <link rel>
// prefetch or a manual fetch().
//
// Usage:
//   node tests/qa/pwa-sw-cache-qa.mjs

import assert from "node:assert/strict";

import { launchQA, BASE_URL } from "./lib/browser.mjs";

const BASE = BASE_URL;
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

const { browser, ctx, page } = await launchQA();

let cacheDump = {};
try {
  await step("01 SW registers and claims the client", async () => {
    // ServiceWorkerRegister only registers in production builds, which
    // is exactly what this probe targets (pnpm start). Visit the home
    // page so the SW script is fetched and the registration completes.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    // Wait for SW to reach the 'activated' state and claim the client
    // (clients.claim() in sw.js activate handler).
    const reg = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("navigator.serviceWorker unavailable");
      }
      // Force any pending registration to settle.
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
    // Give SW one extra tick to write the first fetch into the cache
    // before we trigger the second pass.
    await page.waitForTimeout(300);
  });

  await step("02 first fetch of /manifest.webmanifest populates cache", async () => {
    // Direct fetch from the page context so the SW (which now controls
    // the page) is in the fetch path. Cache miss → fetch + cache.put →
    // return; subsequent reloads should hit the cache.
    const status = await page.evaluate(async () => {
      const r = await fetch("/manifest.webmanifest", { cache: "no-store" });
      return r.status;
    });
    assert.equal(status, 200, `expected 200 from /manifest.webmanifest, got ${status}`);
    // Give cache.put a microtask to flush before we assert.
    await page.waitForTimeout(200);
    const caches = await page.evaluate(async () => {
      const names = await caches.keys();
      const out = {};
      for (const name of names) {
        const cache = await caches.open(name);
        const reqs = await cache.keys();
        out[name] = reqs.map((r) => r.url);
      }
      return out;
    });
    cacheDump = caches;
    assert.ok(
      "tic-tac-toe-v1" in caches,
      `expected tic-tac-toe-v1 cache after first fetch, got ${JSON.stringify(Object.keys(caches))}`,
    );
    assert.ok(
      caches["tic-tac-toe-v1"].some((u) => u.endsWith("/manifest.webmanifest")),
      `expected manifest in tic-tac-toe-v1, got ${JSON.stringify(caches["tic-tac-toe-v1"])}`,
    );
  });

  await step("03 second fetch is served by the SW (cache hit)", async () => {
    // Track the second fetch's source via response.fromServiceWorker().
    let fromSw = null;
    const onResponse = async (resp) => {
      if (resp.url().endsWith("/manifest.webmanifest")) {
        try {
          fromSw = await resp.fromServiceWorker();
        } catch {
          fromSw = null;
        }
      }
    };
    page.on("response", onResponse);
    try {
      await page.evaluate(async () => {
        const r = await fetch("/manifest.webmanifest");
        await r.text();
      });
      // Give the response handler a tick to settle.
      await page.waitForTimeout(100);
    } finally {
      page.off("response", onResponse);
    }
    assert.equal(
      fromSw,
      true,
      `expected second manifest fetch from service worker, got fromSw=${fromSw}; cache=${JSON.stringify(cacheDump)}`,
    );
  });

  await step("04 manifest Cache-Control header is max-age=300 (P3 layer-1)", async () => {
    // Layer-1 of the P3 dual-layer fix lives in next.config.ts headers()
    // (commit 1). The SW serves from cache (0 ms), but a direct fetch
    // that bypasses the SW (e.g., page.request.fetch uses an
    // APIRequestContext outside the SW's fetch event scope) still
    // gets the 5-minute TTL.
    const resp = await ctx.request.fetch(`${BASE}/manifest.webmanifest`);
    assert.equal(resp.status(), 200);
    const cc = resp.headers()["cache-control"] ?? "";
    assert.ok(
      cc.includes("max-age=300"),
      `expected Cache-Control to include max-age=300, got "${cc}"`,
    );
  });

  console.log("");
  console.log(`total=4 pass=4 fail=0`);
} catch (e) {
  console.error("");
  console.error("FAIL details:");
  console.error(JSON.stringify(findings, null, 2));
  console.error("Cache contents at failure:", JSON.stringify(cacheDump, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
