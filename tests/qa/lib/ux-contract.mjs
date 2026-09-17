// UX_STRICT=1 contract assertions for the ux-qa scenarios. Lives apart from
// the scenario table because each entry pins one observable a11y/animation
// guarantee rather than orchestrating a flow.
import assert from 'node:assert/strict';

export async function assertUXContract(page, name) {
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

  // play-win: win-glow strict check moved into the play-win scenario setup
  // (tests/qa/ux-qa.mjs) because PlayController's router.replace('/result')
  // unmounts the board inside the existing 400ms wait, so the assertion
  // here would see zero win-glow spans. See reports/review/V3.md MINOR-F1.

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
