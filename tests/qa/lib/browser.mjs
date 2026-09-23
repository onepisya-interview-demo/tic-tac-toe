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

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const RECORDING_ROOT =
  process.env.ULW_EVIDENCE_ROOT ?? '.omo/evidence/ulw/ulw-ux-refresh-pass';

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
  const probeName = options.probeName ?? (options.label ?? 'qa');
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
  return {
    browser,
    ctx,
    page,
    recordingDir,
    isRecording: Boolean(recordingDir),
  };
}
