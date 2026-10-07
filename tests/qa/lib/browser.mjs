// Shared browser bootstrap for the QA probes. One place decides headless,
// viewport, and the autoplay policy so script defaults never drift apart.
//
// Recording support (ulw-ux-refresh-pass W0): setting QA_VIDEO=1 enables
// Playwright recordVideo. The output directory defaults to
// .omo/evidence/ulw/ulw-ux-refresh-pass/<probe-name>/ (created with
// recursive mkdir). To override, set EVIDENCE_DIR before launching.
// Recording is opt-in because the encoded webm cost ~5-15s per probe and
// almost all probes are debug-reruns; the e2e recording session is the
// only time we want it on.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const RECORDING_ROOT =
  process.env.ULW_EVIDENCE_ROOT ?? '.omo/evidence/ulw/ulw-ux-refresh-pass';

// Unified console/pageerror capture (console-bootstrap, roadmap ticket 5).
//
// Every page launched through launchQA() gets a console + pageerror tap
// here so "silent console error" evidence exists for ALL probes without
// touching any probe's assertion surface. Captures accumulate in-process
// and are flushed to a JSON evidence artifact on process exit — the flush
// is best-effort and must never change a probe's exit code.
//
// Artifact location, in priority order:
//   1. $QA_CONSOLE_CAPTURE_DIR/<probe>-<timestamp>.json (explicit override)
//   2. $EVIDENCE_DIR/console-capture-<probe>.json (CI sets EVIDENCE_DIR
//      per probe job — ci.yml pattern)
//   3. .omo/evidence/console-captures/<probe>-<timestamp>.json (local
//      default; .omo/evidence/ is gitignored)
const DEFAULT_CAPTURE_ROOT = '.omo/evidence/console-captures';

// Literal registration-site anchors for the two capture channels. Kept as
// live code (not prose): the flush payload emits them so every capture
// artifact self-describes which channels produced it, and the capture
// contract stays greppable in source form.
const CAPTURE_CHANNEL_ANCHORS = [
  "page.on('console')",
  "page.on('pageerror')",
];

// Probe-side performance timing capture (trace-minimal, roadmap ticket 8).
//
// Rides the ticket-5 unified evidence channel: every main-frame navigation
// stamps a `qa-nav-<n>` performance.mark inside the page (probe-side timing
// points), and right before the probe closes its context/browser we derive
// measures between consecutive marks and read the mark/measure/navigation/
// paint timelines back into the SAME capture artifact's `performance`
// section. Zero per-probe changes — launchQA() wires it for everyone.
// Harvest is best-effort: a page that is already gone simply yields no
// snapshot, and capture must never fail a probe (same rule as console).
const PERF_MARK_PREFIX = 'qa-nav';

const perfCapture = {
  contexts: new Set(),
  snapshots: [],
  markSeq: 0,
};

function attachPerformanceCapture(ctx, page) {
  perfCapture.contexts.add(ctx);
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const n = (perfCapture.markSeq += 1);
    // Best-effort timing point: a navigation racing us just means one mark
    // fewer, never a probe failure.
    frame
      .evaluate((name) => performance.mark(name), `${PERF_MARK_PREFIX}-${n}`)
      .catch(() => {});
  });
}

// Derive qa measures + read back the page's timing entries. Runs inside the
// page so `performance.mark/measure` are exercised exactly as the ticket
// describes (real marks, real measures, then collected).
async function harvestPerformanceTiming() {
  for (const ctx of perfCapture.contexts) {
    let pages = [];
    try {
      pages = ctx.pages();
    } catch {
      continue; // context already destroyed
    }
    for (const page of pages) {
      try {
        const snapshot = await page.evaluate((prefix) => {
          const pick = (entry) => ({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });
          const qaMarks = performance
            .getEntriesByType('mark')
            .filter((entry) => entry.name.startsWith(prefix))
            .sort((a, b) => a.startTime - b.startTime);
          for (let i = 1; i < qaMarks.length; i += 1) {
            performance.measure(
              `${qaMarks[i - 1].name} -> ${qaMarks[i].name}`,
              qaMarks[i - 1].name,
              qaMarks[i].name,
            );
          }
          return {
            url: location.href,
            marks: performance.getEntriesByType('mark').map(pick),
            measures: performance.getEntriesByType('measure').map(pick),
            navigation: performance.getEntriesByType('navigation').map(pick),
            paint: performance.getEntriesByType('paint').map(pick),
          };
        }, PERF_MARK_PREFIX);
        perfCapture.snapshots.push(snapshot);
      } catch {
        // Page already navigated away or closed — no snapshot for it.
      }
    }
    perfCapture.contexts.delete(ctx);
  }
}

// Derive the probe name from the running probe script (process.argv[1])
// so capture artifacts are self-describing without any per-probe opt-in.
function defaultProbeName() {
  return (process.argv[1] && path.basename(process.argv[1], '.mjs')) || 'qa';
}

const consoleCapture = {
  probeName: defaultProbeName(),
  entries: [],
  flushRegistered: false,
};

function attachConsoleCapture(page, probeName) {
  if (probeName) consoleCapture.probeName = probeName;
  // Channel 1 — page.on('console'): every console message the page emits.
  page.on('console', (message) => {
    consoleCapture.entries.push({
      kind: 'console',
      type: message.type(),
      text: message.text(),
      at: new Date().toISOString(),
    });
  });
  // Channel 2 — page.on('pageerror'): uncaught page-side exceptions.
  page.on('pageerror', (error) => {
    consoleCapture.entries.push({
      kind: 'pageerror',
      type: 'error',
      text: error?.message ?? String(error),
      stack: error?.stack ?? null,
      at: new Date().toISOString(),
    });
  });
}

function registerConsoleCaptureFlush() {
  if (consoleCapture.flushRegistered) return;
  consoleCapture.flushRegistered = true;
  process.on('exit', (code) => {
    try {
      const counts = { console: 0, pageerror: 0 };
      for (const entry of consoleCapture.entries) counts[entry.kind] += 1;
      const payload = {
        probe: consoleCapture.probeName,
        baseUrl: BASE_URL,
        channels: CAPTURE_CHANNEL_ANCHORS,
        exitCode: code,
        capturedAt: new Date().toISOString(),
        summary: {
          totalEntries: consoleCapture.entries.length,
          consoleMessages: counts.console,
          pageErrors: counts.pageerror,
          performanceSnapshots: perfCapture.snapshots.length,
        },
        // Probe-side performance timing section (trace-minimal, ticket 8):
        // one snapshot per still-open page at close time, each carrying the
        // page's mark/measure/navigation/paint entries as plain JSON.
        performance: {
          markPrefix: PERF_MARK_PREFIX,
          timingSnapshots: perfCapture.snapshots,
        },
        entries: consoleCapture.entries,
      };
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      let file;
      if (process.env.QA_CONSOLE_CAPTURE_DIR) {
        const dir = process.env.QA_CONSOLE_CAPTURE_DIR;
        file = path.join(dir, `${consoleCapture.probeName}-${stamp}.json`);
      } else if (process.env.EVIDENCE_DIR) {
        file = path.join(
          process.env.EVIDENCE_DIR,
          `console-capture-${consoleCapture.probeName}.json`,
        );
      } else {
        file = path.join(
          DEFAULT_CAPTURE_ROOT,
          `${consoleCapture.probeName}-${stamp}.json`,
        );
      }
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(payload, null, 2));
      // One-line trail on stdout so the probe log points at the artifact.
      process.stdout.write(
        `[console-capture] ${consoleCapture.entries.length} entries -> ${file}\n`,
      );
    } catch {
      // Best-effort: capture must never break or fail a probe.
    }
  });
}

export async function launchBrowser({ autoplay = false } = {}) {
  return chromium.launch({
    headless: true,
    args: autoplay ? ['--autoplay-policy=no-user-gesture-required'] : [],
  });
}

export function isRecordingEnabled() {
  return process.env.QA_VIDEO === '1';
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function launchQA(options = {}) {
  const recording = options.recording ?? isRecordingEnabled();
  const probeName = options.probeName ?? options.label ?? defaultProbeName();
  const recordingDir = recording
    ? path.join(
        process.env.EVIDENCE_DIR ?? path.join(RECORDING_ROOT, probeName),
      )
    : null;
  if (recordingDir) await ensureDir(recordingDir);

  const browser = await launchBrowser(options);
  const contextOptions = {
    viewport: options.viewport ?? { width: 1280, height: 900 },
  };
  if (recordingDir) {
    contextOptions.recordVideo = {
      dir: recordingDir,
      size: contextOptions.viewport,
    };
  }
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  attachConsoleCapture(page, probeName);
  registerConsoleCaptureFlush();
  attachPerformanceCapture(ctx, page);
  // Wrap both close paths so the timing harvest runs while pages are still
  // alive — probes call either `ctx.close()` (mid-session contexts) or
  // `browser.close()` (final teardown); both harvest-then-close. Idempotent:
  // harvested contexts leave the live set, so double close is a no-op pass.
  const originalCtxClose = ctx.close.bind(ctx);
  ctx.close = (...args) =>
    harvestPerformanceTiming().then(() => originalCtxClose(...args));
  const originalBrowserClose = browser.close.bind(browser);
  browser.close = (...args) =>
    harvestPerformanceTiming().then(() => originalBrowserClose(...args));
  return {
    browser,
    ctx,
    page,
    recordingDir,
    isRecording: Boolean(recordingDir),
  };
}
