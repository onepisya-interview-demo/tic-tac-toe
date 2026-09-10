#!/usr/bin/env node
// Regenerate app/favicon.ico from a 180x180-class PNG source.
// Source: app/apple-icon.tsx → build → .next/server/app/apple-icon.body
//         (default), OR pass --source <path> to use an external PNG
//         (for example a designer-supplied 180x180 PNG; identical
//         pixel content still produces an identical multi-size ICO).
// Output: app/favicon.ico (multi-size 16/32/48 ICO assembled by ImageMagick)
//
// Why this exists:
//   Next.js 16 favicon file convention only accepts a literal .ico at app/
//   root (cannot be generated from .ts/.tsx, per the official docs:
//   "You cannot generate a `favicon` icon. Use `icon` or a `favicon.ico`
//   file instead."). We keep the apple-icon design as the single source of
//   truth for the visual identity and downsample its rendered PNG to the
//   small sizes iOS Safari + legacy browsers need for tab favicons.
//
// Why ImageMagick and not sharp: this script must run with no new npm
// dependency. `sharp` is a transitive dep of @next/image but not declared in
// our package.json, so importing it would break `node` resolution. macOS
// ships ImageMagick via Homebrew (magick) and it covers everything we need:
// Lanczos resize for crisp downsampling and multi-image ICO assembly.
//
// Usage:
//   Default (CI / dev rebuild):
//     1. pnpm build                          # generates .next/server/app/apple-icon.body
//     2. node scripts/build-favicon-ico.mjs  # writes app/favicon.ico
//   External PNG (designer-supplied source):
//     1. node scripts/build-favicon-ico.mjs --source path/to/icon-180.png

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_SOURCE = ".next/server/app/apple-icon.body";
const TARGET_ICO = "app/favicon.ico";
const SIZES = [16, 32, 48];

// Minimal CLI parse: --source <path>. No deps.
const args = process.argv.slice(2);
let source = DEFAULT_SOURCE;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--source" && args[i + 1]) {
    source = args[i + 1];
    i++;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log("Usage: node scripts/build-favicon-ico.mjs [--source <png>]");
    console.log(`  Default source: ${DEFAULT_SOURCE} (requires prior \`pnpm build\`)`);
    process.exit(0);
  }
}

if (!existsSync(source)) {
  console.error(`Missing source PNG: ${source}`);
  if (source === DEFAULT_SOURCE) {
    console.error("Run `pnpm build` first to render apple-icon.tsx, or pass --source <path>.");
  } else {
    console.error("Pass a path that exists.");
  }
  process.exit(1);
}

const tmpDir = join(tmpdir(), "build-favicon-ico");
mkdirSync(tmpDir, { recursive: true });

// 1. Render each size via ImageMagick (Lanczos filter = best downsample).
const pngs = [];
for (const sz of SIZES) {
  const out = join(tmpDir, `favicon-${sz}.png`);
  execFileSync("magick", [source, "-filter", "Lanczos", "-resize", `${sz}x${sz}`, out]);
  pngs.push(out);
}

// 2. Assemble multi-size ICO.
execFileSync("magick", [...pngs, TARGET_ICO], { stdio: "inherit" });

// 3. Clean up tmp files.
for (const p of pngs) {
  try { execFileSync("rm", [p]); } catch {}
}

console.log(`Wrote ${TARGET_ICO} (sizes ${SIZES.join("+")}, derived from ${source})`);
