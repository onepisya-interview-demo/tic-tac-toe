// Stronger audio evidence: probe the AudioContext's destination state and
// inspect the running oscillator count after triggering a win with sound
// unmuted. We can't actually hear audio in headless Chromium, but we can
// prove that the Web Audio path is live and producing nodes.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.request.delete(`${BASE}/api/stats`);
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

// 1. Unmute via the toggle on the home page.
await page.click('[data-testid="sound-toggle"]');
const mutedFlag = await page.evaluate(() => localStorage.getItem('ttt.sound.muted'));
assert.equal(mutedFlag, '0');

// 2. Navigate to /play (this reloads the page, so install the probe
//    AFTER navigation — the mute flag is in localStorage so it persists).
await page.click('[data-testid="start-game"]');
await page.waitForURL('**/play');
await page.waitForSelector('[data-testid="board"]');
await page.waitForTimeout(200);

// 3. Install the AudioContext probe BEFORE the first cell click so we can
//    count oscillators created by playSound.
await page.evaluate(() => {
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) throw new Error('No AudioContext');
  const RealCtor = Ctor;
  const Patched = function (...args) {
    const inst = new RealCtor(...args);
    window.__probe = window.__probe ?? { oscillators: 0, gains: 0, resume: 0 };
    const origCreateOsc = inst.createOscillator.bind(inst);
    const origCreateGain = inst.createGain.bind(inst);
    inst.createOscillator = (...a) => { window.__probe.oscillators++; return origCreateOsc(...a); };
    inst.createGain = (...a) => { window.__probe.gains++; return origCreateGain(...a); };
    const origResume = inst.resume.bind(inst);
    inst.resume = (...a) => { window.__probe.resume++; return origResume(...a); };
    return inst;
  };
  window.AudioContext = Patched;
  if (window.webkitAudioContext) window.webkitAudioContext = Patched;
});

// 4. Drive a win: whoever goes first wins top row.
const firstStatus = await page.locator('[data-testid="status-text"]').textContent();
const firstPlayer = firstStatus?.match(/轮到 ([XO])/)?.[1];
for (const i of [0, 3, 1, 4, 2]) {
  await page.click(`[data-testid="cell-${i}"]`);
  await page.waitForTimeout(120);
}

// 5. Allow the page to settle so playSound('win') ran.
await page.waitForURL('**/result', { timeout: 4000 });
await page.waitForTimeout(400);

const probe = await page.evaluate(() => window.__probe);
console.log('first player who won:', firstPlayer);
console.log('audio probe:', JSON.stringify(probe));

// 6. Strong assertions on the audio path. playSound('move') fires 4 times
//    (4 moves) at 1 oscillator each = 4 oscillators, then playSound('win')
//    fires once with 2 oscillators. So we expect at least 4.
assert.ok(probe.oscillators >= 4, `expected ≥4 oscillators across the game, got ${probe.oscillators}`);
// resume() only fires if the context starts suspended; with --autoplay-policy=no-user-gesture-required it starts running. Either way is correct.
assert.ok(probe.gains >= probe.oscillators, `gains (${probe.gains}) should be ≥ oscillators (${probe.oscillators})`);

await ctx.close();
await browser.close();
console.log('AUDIO PROBE PASS');
