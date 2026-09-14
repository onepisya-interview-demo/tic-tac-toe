// End-to-end check for the SoundToggle hydration mismatch fix.
// Pre-seeds localStorage with a non-default value ('0' = unmuted),
// navigates to all three routes, and asserts that no React hydration
// warning appears in the browser console.
import assert from 'node:assert/strict';

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';

const BASE = BASE_URL;
const { browser, ctx, page } = await launchQA();

const hydrationWarnings = [];
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    consoleErrors.push(text);
    if (
      text.includes('Hydration failed') ||
      text.includes('hydration') ||
      text.includes('did not match') ||
      text.includes("server rendered")
    ) {
      hydrationWarnings.push(text);
    }
  }
});
page.on('pageerror', (err) => {
  const text = err.message ?? String(err);
  if (
    text.includes('Hydration') ||
    text.includes('hydration') ||
    text.includes('did not match') ||
    text.includes("server rendered")
  ) {
    hydrationWarnings.push(text);
  }
});

// 1. Visit / once to set localStorage on the right origin.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

// 3. Drive a full game so /play and /result both render with persisted unmuted.
await page.click('[data-testid="sound-toggle"]');
const mutedFlag = await page.evaluate(() => window.localStorage.getItem('ttt.sound.muted'));
assert.equal(mutedFlag, '0', `expected '0' after unmute, got ${mutedFlag}`);

await page.click('[data-testid="start-game"]');
await page.waitForURL('**/play');
await page.waitForSelector('[data-testid="board"]');

const firstStatus = await page.locator('[data-testid="status-text"]').textContent();
const firstPlayer = firstStatus?.match(/轮到 ([XO])/)?.[1];
await driveTopRowWin(page);

await page.waitForURL('**/result', { timeout: 4000 });
await page.waitForSelector('[data-testid="result-headline"]');

// 4. After navigating all three routes with persisted unmuted, assert the
//    post-mount DOM reflects unmuted AND no hydration warning fired.
//
// NOTE: since f45ddbf (React 19 <ViewTransition> enter animation), the new
// page's subtree effects are deferred until the transition animation settles,
// so SoundToggle's hydrated aria-label arrives after navigation completes.
// The contract here is "the label eventually arrives", NOT "it arrives
// synchronously" — hence polling instead of a strict equality check.
try {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="sound-toggle"]')?.getAttribute('aria-label') ===
      '关闭音效',
    null,
    { timeout: 2000 },
  );
} catch {
  const postMountLabel = await page
    .locator('[data-testid="sound-toggle"]')
    .getAttribute('aria-label');
  assert.fail(
    `post-mount label never reached unmuted within 2000ms, got ${postMountLabel}`,
  );
}

if (hydrationWarnings.length > 0) {
  console.error('HYDRATION WARNINGS DETECTED:');
  for (const w of hydrationWarnings) console.error('  ', w);
}
assert.equal(hydrationWarnings.length, 0, `expected 0 hydration warnings, got ${hydrationWarnings.length}`);

console.log('first player who won:', firstPlayer);
console.log('console errors (non-hydration):', consoleErrors.length);
console.log('hydration warnings:', hydrationWarnings.length);

await ctx.close();
await browser.close();
console.log('HYDRATION CHECK PASS');
