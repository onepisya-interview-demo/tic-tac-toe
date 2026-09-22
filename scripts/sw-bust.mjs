#!/usr/bin/env node
// Build-time substitution: bump the SW's APP_VERSION token to match the
// package version. Runs as `prebuild` so a fresh production deploy
// always ships an SW whose CACHE_NAME differs from the previous one,
// which guarantees the new SW takes over (and its activate listener
// can sweep stale caches whose name no longer matches).
//
// Why a build-time substitution and not a runtime fetch:
//   - SW.js runs before the document, so a fetch-based version lookup
//     would race install-time registration on the first cold visit.
//   - SW.js content itself drives SW registration: the browser only
//     installs a new SW when the served bytes change. A baked-in
//     CACHE_NAME means a version bump changes the SW source, which
//     is exactly the signal the install event needs.
//   - The APP_VERSION token is just a string — any monotonic counter
//     would do (sha, build-id, ISO date), but reusing package.json's
//     version field is one less moving part.
//
// Inputs / outputs:
//   - reads package.json (cwd)
//   - reads public/sw.js (cwd)
//   - writes public/sw.js in place
//
// Usage:
//   node scripts/sw-bust.mjs            # bump APP_VERSION to package version
//   node scripts/sw-bust.mjs --check    # assert file matches; exit 1 on drift
//
// Idempotent: running twice with the same version produces identical output.

import { readFileSync, writeFileSync } from "node:fs";

const SW_PATH = "public/sw.js";
const PACKAGE_PATH = "package.json";
// Token the build script patches in sw.js. Matches the literal
// `const APP_VERSION = "vX.Y.Z";` line so any prior version can be
// replaced (not just the fresh-clone placeholder).
const TOKEN_RE = /^const APP_VERSION = "v[0-9][0-9.a-zA-Z-]*";/m;
const NEW_DECL = (v) => `const APP_VERSION = "v${v}";`;

function fail(msg) {
  console.error(`[sw-bust] ${msg}`);
  process.exit(1);
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
  const version = String(pkg.version ?? "").trim();
  if (!version) fail(`package.json has no version field`);
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    fail(`package version "${version}" does not start with semver (X.Y.Z)`);
  }

  const sw = readFileSync(SW_PATH, "utf8");
  if (!TOKEN_RE.test(sw)) {
    fail(`could not locate \`const APP_VERSION = "vX";\` token in ${SW_PATH}; did the source drift?`);
  }
  const expected = NEW_DECL(version);
  const current = sw.match(TOKEN_RE)[0];
  if (current === expected) {
    if (checkOnly) {
      console.log(`[sw-bust] OK: ${SW_PATH} APP_VERSION already matches package version v${version}`);
      return;
    }
    console.log(`[sw-bust] ${SW_PATH} APP_VERSION already matches package version v${version}; no rewrite needed`);
    return;
  }
  if (checkOnly) {
    fail(`drift: ${SW_PATH} has ${current}, expected ${expected}. run \`node scripts/sw-bust.mjs\` to fix.`);
  }
  const patched = sw.replace(TOKEN_RE, expected);
  writeFileSync(SW_PATH, patched, "utf8");
  console.log(`[sw-bust] ${SW_PATH}: ${current} -> ${expected}`);
}

main();
