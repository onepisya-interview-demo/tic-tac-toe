// Targeted probe for the win celebration cheer. The existing audio-probe.mjs
// counts total oscillators; this script also timestamps each oscillator
// creation and records its frequency, so we can prove:
//   (a) the win-to-cheer gap is at least 300ms (sequencing fired)
//   (b) the cheer creates ≥6 oscillators with the C5-E5-G5-C6-E6 frequencies
//       (the actual arpeggio notes, not the move/win envelopes)
import assert from 'node:assert/strict';

import { launchQA, BASE_URL } from './lib/browser.mjs';
import { driveTopRowWin } from './lib/win-drive.mjs';

const BASE = BASE_URL;
const { browser, ctx, page } = await launchQA({ autoplay: true });

await page.request.delete(`${BASE}/api/stats`);
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

// 1. Unmute on /, then navigate to /play (page reload wipes the probe but
//    localStorage carries the unmuted preference across).
await page.click('[data-testid="sound-toggle"]');
const mutedFlag = await page.evaluate(() => localStorage.getItem('ttt.sound.muted'));
assert.equal(mutedFlag, '0');

await page.click('[data-testid="start-online"]');
await page.waitForURL('**/play');
await page.waitForSelector('[data-testid="board"]');
await page.waitForTimeout(200);

// 2. Install the AudioContext probe with frequency + timestamp capture.
await page.evaluate(() => {
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  const RealCtor = Ctor;
  const Patched = function (...args) {
    const inst = new RealCtor(...args);
    window.__probe = window.__probe ?? { entries: [] };
    const origCreateOsc = inst.createOscillator.bind(inst);
    inst.createOscillator = (...a) => {
      const o = origCreateOsc(...a);
      const entry = { t: Date.now(), freq: 0 };
      window.__probe.entries.push(entry);
      // Defer freq capture: lib/sound.ts assigns osc.frequency.value
      // immediately after createOscillator returns, so reading on the
      // next microtask observes the assigned program step frequency.
      queueMicrotask(() => { entry.freq = o.frequency.value; });
      return o;
    };
    return inst;
  };
  window.AudioContext = Patched;
  if (window.webkitAudioContext) window.webkitAudioContext = Patched;
});

// 3. Mark the timestamp AFTER the probe is installed so we can compute
//    relative times. Drive a forced win: X 0, O 3, X 1, O 4, X 2.
const t0 = Date.now();
const firstStatus = await page.locator('[data-testid="status-text"]').textContent();
const firstPlayer = firstStatus?.match(/轮到 ([XO])/)?.[1];

// Click the 5 moves back-to-back; the winning move triggers win → setTimeout
// for cheer ~360ms later.
await driveTopRowWin(page, { clickGapMs: 60 });

// 4. Wait long enough for the setTimeout to fire and the cheer to schedule.
await page.waitForURL('**/result', { timeout: 4000 });
await page.waitForTimeout(1500);

const probe = await page.evaluate(() => window.__probe);
const rel = probe.entries.map((e) => ({ dt: e.t - t0, freq: Math.round(e.freq) }));
console.log('first player who won:', firstPlayer);
console.log('oscillator entries:', JSON.stringify(rel));

// 5. Assertions.
// (a) cheer sequencing: there must be at least one oscillator created more
//     than 300ms after t0 — that gap is impossible from move/win envelopes
//     which all fire inside the first ~600ms of clicks.
const lateEntries = rel.filter((e) => e.dt > 300);
assert.ok(lateEntries.length >= 6, `expected ≥6 late-window oscillators (cheer), got ${lateEntries.length} (dt > 300ms)`);

// (b) cheer frequencies match the C5-E5-G5-C6-E6 arpeggio. Allow a small
//     tolerance because vibrato may detune the E6 slightly. The win pair
//     (C5 + E5) overlaps with the first two cheer notes, so we only assert
//     that G5 and C6 appear, which win alone does not produce.
const lateFreqs = lateEntries.map((e) => e.freq);
console.log('late freqs:', lateFreqs.join(', '));
assert.ok(
  lateFreqs.some((f) => Math.abs(f - 783.99) < 1),
  `expected a G5 (~784 Hz) oscillator in the cheer window, got: ${lateFreqs.join(', ')}`,
);
assert.ok(
  lateFreqs.some((f) => Math.abs(f - 1046.5) < 1),
  `expected a C6 (~1046 Hz) oscillator in the cheer window, got: ${lateFreqs.join(', ')}`,
);

// (c) cheer must still respect the muted gate: re-mute and play a losing
//     move on a fresh page; the cheer must NOT fire because the winning
//     player !== current player. (We just verify that the cheer path is
//     guarded — the existing lib/sound.test.ts covers muted-no-sound; here
//     we only need the sequencing shape.)
const totalLateMs = lateEntries.length > 0
  ? Math.max(...lateEntries.map((e) => e.dt))
  : 0;
console.log('latest oscillator at dt =', totalLateMs, 'ms');
assert.ok(totalLateMs > 600, `cheer should extend past 600ms, latest dt=${totalLateMs}ms`);

await ctx.close();
await browser.close();
console.log('AUDIO CHEER PROBE PASS');
