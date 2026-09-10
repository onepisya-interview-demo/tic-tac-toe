#!/usr/bin/env node
// Regenerate the full favicon asset set from a 180x180-class PNG source.
// Outputs:
//   - public/favicon-16x16.png   (legacy tab fallback)
//   - public/favicon-32x32.png   (Windows taskbar / legacy)
//   - public/favicon-48x48.png   (legacy @2x tab)
//   - public/icon-192.png        (Android Chrome home)
//   - public/icon-512.png        (PWA splash / maskable; Lanczos-upscale from 180)
//   - public/apple-touch-icon.png (180x180 iOS touch icon backup)
// Source: app/apple-icon.tsx → build → .next/server/app/apple-icon.body
//         (default), OR pass --source <path> to use an external PNG.
//
// Why this exists:
//   Next.js 16 favicon file conventions cover `favicon.ico`, `icon.svg`, and
//   `apple-icon.*`. Modern browsers and PWA installers expect PNG fallbacks
//   at 16/32/48/192/512 plus a 180x180 apple-touch-icon; the file
//   conventions alone cannot express that full set. We co-locate the
//   generation script with the build-favicon-ico.mjs policy (no new deps,
//   ImageMagick `magick` + Lanczos resize) and dump assets under public/
//   so they survive `next build` as static files Next.js serves verbatim.
//
// Why ImageMagick and not sharp: same as build-favicon-ico.mjs — this script
// must run with no new npm dependency. macOS ships ImageMagick via Homebrew.
//
// Usage:
//   Default (CI / dev rebuild):
//     1. pnpm build                              # generates .next/server/app/apple-icon.body
//     2. node scripts/build-favicon-assets.mjs   # writes all PNGs to public/
//   External PNG (designer-supplied source):
//     1. node scripts/build-favicon-assets.mjs --source path/to/icon-180.png

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_SOURCE = ".next/server/app/apple-icon.body";

// (target filename in public/, dimensions) pairs.
const TARGETS = [
  { file: "public/favicon-16x16.png", size: 16 },
  { file: "public/favicon-32x32.png", size: 32 },
  { file: "public/favicon-48x48.png", size: 48 },
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

// Minimal CLI parse: --source <path>. No deps.
const args = process.argv.slice(2);
let source = DEFAULT_SOURCE;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--source" && args[i + 1]) {
    source = args[i + 1];
    i++;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log("Usage: node scripts/build-favicon-assets.mjs [--source <png>]");
    console.log(`  Default source: ${DEFAULT_SOURCE} (requires prior \`pnpm build\`)`);
    console.log(`  Outputs: ${TARGETS.map((t) => t.file).join(", ")}`);
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

// Ensure public/ exists.
mkdirSync("public", { recursive: true });

const tmpDir = join(tmpdir(), "build-favicon-assets");
mkdirSync(tmpDir, { recursive: true });

// Single Lanczos pass per target size. Both `magick` calls include
// `-define png:exclude-chunks=tIME,tEXt,zTXt,iTXt` so re-running the script produces
// byte-identical PNGs; without it ImageMagick rewrites date:create /
// date:modify text chunks on every run, leaking non-deterministic
// metadata into every regen (see commit lore Directive).
// Use a tempdir so we never leave half-rendered PNGs in public/ on failure.
for (const { file, size } of TARGETS) {
  const out = join(tmpDir, `${size}.png`);
  execFileSync("magick", [
    source,
    "-filter",
    "Lanczos",
    "-resize",
    `${size}x${size}`,
    "-define",
    "png:exclude-chunks=tIME,tEXt,zTXt,iTXt",
    out,
  ]);
  execFileSync("magick", [out, "-define", "png:exclude-chunks=tIME,tEXt,zTXt,iTXt", file]);
  execFileSync("rm", [out]);
}

console.log(`Wrote ${TARGETS.length} PNG assets to public/ from ${source}:`);
for (const { file, size } of TARGETS) {
  console.log(`  - ${file} (${size}x${size})`);
}
