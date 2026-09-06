# Plan: win celebration cheer (option C — synthesize + layer)

Intent: UNCLEAR → user picked option C (pure synthesis, layered after existing `win`).
Review: required (UNCLEAR route, non-trivial change set).

## What ships
A celebratory cheer that fires after the existing `win` two-note confirmation
whenever the current player wins. The cheer is a 5-note ascending arpeggio
(C5 → E5 → G5 → C6 → E6) with the last note sustained 0.6s and given a
subtle 5Hz vibrato via a paired detuning oscillator. Total duration ≈ 900ms.
Zero new dependencies. Zero new asset files.

## File-by-file

### 1. `lib/sound.ts` — add `'cheer'` program

Replace the `Tone` union and `PROGRAMS` table:
- `type Tone = 'move' | 'win' | 'draw' | 'lose' | 'cheer'`
- Add `cheer` entry: 5 notes at C5, E5, G5, C6, E6 with descending durations
  (120, 110, 100, 90, 600ms — the longer last note carries the "celebration").
- `vibrato` for the last note is implemented by scheduling a parallel
  oscillator at the same frequency with a 5Hz LFO modulating its
  `detune` (±10 cents). Keep the change inside the existing `playSound`
  envelope loop — don't introduce a parallel path.

Acceptance: `playSound('cheer')` produces 6 oscillators (5 notes + 1 vibrato
modulator) and runs under the existing muted gate.

### 2. `lib/store.ts` — sequence `win` then `cheer`

At the existing win branch (file:line `lib/store.ts:134` today — replace
`playSound(win.player === s.currentPlayer ? 'win' : 'lose')` with):
```ts
if (win.player === s.currentPlayer) {
  playSound('win');
  // Defer the celebration so the listener hears "confirm" then "cheer".
  setTimeout(() => playSound('cheer'), 360);
} else {
  playSound('lose');
}
```

Acceptance: `playSound('win')` is called immediately; `playSound('cheer')`
fires ~360ms later. Both honor the mute gate independently (muting
mid-sequence must silence the rest).

### 3. `lib/sound.test.ts` — failing-first coverage

Add to the existing describe block:
- `playSound('cheer')` produces 5 oscillators + 1 vibrato = 6 total.
- `playSound('cheer')` is silent when muted.
- `playSound('cheer')` resumes the AudioContext once.
- (Don't unit-test the setTimeout sequencing in store.ts — covered by
  the Playwright probe below; jsdom timers are flaky.)

### 4. `tests/qa/audio-cheer.mjs` — end-to-end probe

Drive a forced win in the live browser with the AudioContext patch
(installed AFTER navigation to /play to survive the route change),
unmuted, then assert:
- `probe.oscillators` rises from 4 (move envelopes, 4 clicks) + 2 (win)
  + 6 (cheer) = ≥ 12. Tolerate ±2 from extra move envelopes during
  navigation timing.
- After 1.5s, the AudioContext has been resumed at least once.
- No console errors.

### 5. Regression — every existing test/QA still green

- `pnpm vitest run` — 63 + new cheer tests, all pass.
- `pnpm typecheck` — clean.
- `pnpm lint` — clean.
- `pnpm build` — 5 routes.
- `tests/qa/hydration-check.mjs` — HYDRATION CHECK PASS (the new code
  is in lib/sound.ts, not the SoundToggle component, so no risk).
- `tests/qa/audio-confetti-qa.mjs` — 9/9 PASS.
- `tests/qa/audio-probe.mjs` — original oscillator count expectation
  rises by 6 (cheer adds 6 oscillators on top of 6 for move+win). Update
  the assertion from `>=4` to `>=12` to account for the new cheer
  burst.

## Must-NOT-Have (scope guardrails)
- Do NOT introduce howler.js / Tone.js / any audio library — option C
  is explicitly pure synthesis.
- Do NOT add a public cheer audio asset under `public/`.
- Do NOT remove or replace the existing `win`/`lose`/`draw`/`move`
  programs — only add `cheer`.
- Do NOT change the mute default (still muted on first paint).
- Do NOT change the SoundToggle or hydration behavior.
- Do NOT add new public APIs to `lib/sound.ts` beyond widening the
  `Tone` union; keep the same `playSound(name)` signature.

## Commit
- One atomic commit on the existing `feat/ux-polish` branch:
  `feat: layered win cheer (synth C-E-G-C-E with vibrato)` —
  matches the existing commit style (`<type>(<scope>): <imperative>`).
- Footer `Plan: .omo/plans/win-cheer.md`.

## Out-of-scope
- A future iteration could swap the synth cheer for a recorded sample
  (option B from the earlier compare). That's a follow-up, not now.
- Persistent volume control / per-channel mixing — current `VOLUME` is
  a single global constant and stays that way.
- Localized labels for the cheer — it's not user-visible text.
