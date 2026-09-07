// UX visual QA — captures before/after evidence for the UX enhancement pass.
//
// Usage:
//   node tests/qa/ux-qa.mjs before    # baseline screenshots
//   node tests/qa/ux-qa.mjs after     # post-change screenshots (same scenes)
//
// Output: .omx/evidence/ux-{before,after}/*.png + qa-log.json

import { launchBrowser } from './lib/browser.mjs';
import { ensureDir, shootTo, writeQaLog } from './lib/evidence.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';
import { assertUXContract } from './lib/ux-contract.mjs';

const phase = process.argv[2] || 'before';
if (phase !== 'before' && phase !== 'after') {
  console.error('phase must be "before" or "after"');
  process.exit(2);
}
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EVIDENCE_DIR = `.omx/evidence/ux-${phase}`;

// Each scenario: name, viewport, then a setup action sequence.
const SCENARIOS = [
  {
    name: 'home-empty',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      // Reset stats so home shows zero-state.
      await page.request.delete(`${BASE}/api/stats`);
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'home-with-history',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      // Synthesize some history via the API so the stats card has content.
      await page.request.put(`${BASE}/api/stats`, {
        data: {
          totalGames: 7,
          xWins: 3,
          oWins: 2,
          draws: 2,
          currentStreak: 2,
        },
      });
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'play-blank',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'play-mid-game',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      // X plays 0, O plays 3
      await page.click('[data-testid="cell-0"]');
      await page.waitForTimeout(120);
      await page.click('[data-testid="cell-3"]');
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'play-win',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      // Drive a clean top-row win: first player takes 0, 1, 2.
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await driveTopRowWin(page, { clickGapMs: 100 });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'result-after-win',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await driveTopRowWin(page, { clickGapMs: 100 });
      await page.waitForURL(`${BASE}/result`, { timeout: 3000 });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'mobile-play',
    viewport: { width: 375, height: 667 }, // iPhone SE
    setup: async (page) => {
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'mobile-home',
    viewport: { width: 375, height: 667 },
    setup: async (page) => {
      await page.request.delete(`${BASE}/api/stats`);
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'reduced-motion',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.click('[data-testid="cell-0"]');
      await page.waitForTimeout(200);
    },
  },
];

async function captureA11y(page) {
  return page.evaluate(() => {
    const live = document.querySelectorAll('[aria-live]');
    const labels = Array.from(document.querySelectorAll('[role="grid"] button')).map(
      (b) => b.getAttribute('aria-label'),
    );
    return {
      liveCount: live.length,
      liveTexts: Array.from(live).map((n) => n.textContent),
      cellLabels: labels,
      title: document.title,
    };
  });
}

async function main() {
  await ensureDir(EVIDENCE_DIR);
  const browser = await launchBrowser();
  const shoot = shootTo(EVIDENCE_DIR);
  const log = [];
  const strictFailures = [];

  for (const sc of SCENARIOS) {
    const ctx = await browser.newContext({ viewport: sc.viewport });
    const page = await ctx.newPage();
    try {
      await sc.setup(page);
      let strictFailure = null;
      try {
        await assertUXContract(page, sc.name);
      } catch (error) {
        strictFailure = error instanceof Error ? error.message : String(error);
        strictFailures.push({ scenario: sc.name, error: strictFailure });
        console.error(`[${phase}] ${sc.name} RED: ${strictFailure}`);
      }
      const shot = await shoot(page, `${sc.name}.png`);
      const a11y = await captureA11y(page);
      log.push({
        scenario: sc.name,
        viewport: sc.viewport,
        shot,
        a11y,
        strictFailure,
      });
      console.log(`[${phase}] ${sc.name} -> ${shot}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  await writeQaLog(EVIDENCE_DIR, log);
  console.log(`Wrote ${log.length} scenarios to ${EVIDENCE_DIR}/qa-log.json`);
  if (strictFailures.length > 0) {
    throw new Error(`UX strict contract failed in ${strictFailures.length} scenario(s)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
