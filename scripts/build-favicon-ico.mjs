#!/usr/bin/env node
// Regenerate app/favicon.ico from the existing rendered apple-icon PNG.
// Source: app/apple-icon.tsx → build → .next/server/app/apple-icon.body
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
//   1. pnpm build                          # generates .next/server/app/apple-icon.body
//   2. node scripts/build-favicon-ico.mjs  # writes app/favicon.ico

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE_PNG = ".next/server/app/apple-icon.body";
const TARGET_ICO = "app/favicon.ico";
const SIZES = [16, 32, 48];

if (!existsSync(SOURCE_PNG)) {
  console.error(`Missing ${SOURCE_PNG}. Run \`pnpm build\` first to render apple-icon.tsx.`);
  process.exit(1);
}

const tmpDir = join(tmpdir(), "build-favicon-ico");
mkdirSync(tmpDir, { recursive: true });

// 1. Render each size via ImageMagick (Lanczos filter = best downsample).
const pngs = [];
for (const sz of SIZES) {
  const out = join(tmpDir, `apple-${sz}.png`);
  execFileSync("magick", [SOURCE_PNG, "-filter", "Lanczos", "-resize", `${sz}x${sz}`, out]);
  pngs.push(out);
}

// 2. Assemble multi-size ICO.
execFileSync("magick", [...pngs, TARGET_ICO], { stdio: "inherit" });

// 3. Clean up tmp files.
for (const p of pngs) {
  try { execFileSync("rm", [p]); } catch {}
}

console.log(`Wrote ${TARGET_ICO} (sizes ${SIZES.join("+")}, derived from ${SOURCE_PNG})`);
