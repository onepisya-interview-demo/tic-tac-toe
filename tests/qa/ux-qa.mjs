// UX visual QA — captures before/after evidence for the UX enhancement pass.
//
// Usage:
//   node tests/qa/ux-qa.mjs before    # baseline screenshots
//   node tests/qa/ux-qa.mjs after     # post-change screenshots (same scenes)
//
// Output: .omx/evidence/ux-{before,after}/*.png + qa-log.json

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const phase = process.argv[2] || 'before';
if (phase !== 'before' && phase !== 'after') {
  console.error('phase must be "before" or "after"');
  process.exit(2);
}
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EVIDENCE_DIR = `.omx/evidence/ux-${phase}`;

// Move plan: index → (X,O,X,O,X) for X win on top row; or full draw sequence.
// Each step: name, viewport, then a sequence of actions.
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
      // Drive a clean X top-row win: X 0, O 3, X 1, O 4, X 2
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.click('[data-testid="cell-0"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-3"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-1"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-4"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-2"]'); await page.waitForTimeout(500);
    },
  },
  {
    name: 'result-after-win',
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(`${BASE}/play`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.click('[data-testid="cell-0"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-3"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-1"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-4"]'); await page.waitForTimeout(100);
      await page.click('[data-testid="cell-2"]'); await page.waitForTimeout(500);
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

async function shoot(page, name) {
  const p = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

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

async function assertUXContract(page, name) {
  if (process.env.UX_STRICT !== '1') return;

  if (name === 'home-empty') {
    assert.equal(
      await page.locator('[data-testid="empty-state"]').count(),
      1,
      'home must expose an empty-state hint',
    );
  }

  if (name === 'home-with-history') {
    assert.ok(
      await page.locator('[data-testid="stat-value"]').count() >= 5,
      'stats values must expose the animated value primitive',
    );
  }

  if (name === 'play-blank') {
    assert.equal(
      await page.locator('[aria-live="polite"]').count(),
      1,
      'play status must be one polite live region',
    );
    assert.equal(
      await page.locator('[data-testid="board"] button[tabindex="0"]').count(),
      1,
      'board must use one roving tab stop',
    );
    assert.equal(
      await page.locator('[data-testid="sound-toggle"]').count(),
      1,
      'sound preference control must be available',
    );

    await page.locator('[data-testid="cell-0"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
      'cell-1',
      'ArrowRight must move focus to the next cell',
    );
    await page.keyboard.press('Enter');
    assert.notEqual(
      await page.locator('[data-testid="cell-1"]').textContent(),
      '\u00a0',
      'Enter must activate the focused cell',
    );
  }

  if (name === 'play-mid-game') {
    assert.ok(
      await page.locator('[data-testid="cell-0"] .cell-pop').count() === 1,
      'a newly placed mark must use the cell-pop animation',
    );
  }

  if (name === 'play-win') {
    assert.ok(
      await page.locator('[data-testid^="cell-"] .win-glow').count() >= 3,
      'winning cells must expose the win-glow animation',
    );
  }

  if (name === 'result-after-win') {
    assert.equal(
      await page.locator('[data-testid="confetti"]').count(),
      1,
      'winning result must render the confetti layer',
    );
    assert.equal(
      await page.locator('[data-testid="result-headline"][aria-live="assertive"]').count(),
      1,
      'result headline must be an assertive live region',
    );
  }

  if (name === 'mobile-play' || name === 'mobile-home') {
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cellWidth: document.querySelector('[data-testid="cell-0"]')?.getBoundingClientRect().width ?? 0,
    }));
    assert.ok(layout.scrollWidth <= layout.viewport, 'mobile pages must not overflow horizontally');
    if (name === 'mobile-play') {
      assert.ok(layout.cellWidth <= 84, 'mobile board cells must scale below 84px');
    }
  }

  if (name === 'reduced-motion') {
    assert.equal(
      await page.locator('[data-testid="cell-0"] .cell-pop').count(),
      1,
      'reduced-motion path must keep the semantic move content mounted',
    );
    assert.equal(
      await page.locator('[data-testid="cell-0"] .cell-pop').evaluate((node) => getComputedStyle(node).animationDuration),
      '0s',
      'reduced-motion must disable the cell animation',
    );
  }
}

async function main() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
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
      const shot = await shoot(page, sc.name);
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
  await fs.writeFile(
    path.join(EVIDENCE_DIR, 'qa-log.json'),
    JSON.stringify(log, null, 2),
  );
  console.log(`Wrote ${log.length} scenarios to ${EVIDENCE_DIR}/qa-log.json`);
  if (strictFailures.length > 0) {
    throw new Error(`UX strict contract failed in ${strictFailures.length} scenario(s)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
