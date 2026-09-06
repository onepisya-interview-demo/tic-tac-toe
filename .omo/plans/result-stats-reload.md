# Plan: result page stats hydration on refresh (option A — module-level kickoff)

Intent: confirmed bug — refreshing /result shows emptyStats() (0/0/0/0/—)
instead of the server-persisted history. Root cause: lib/store.ts defines a
`hydrateStats` action that calls `/api/stats` GET and sets it on the store,
but nothing ever calls the action — `startGame` is the only other caller
of apiGetStats, and it only fires when the user clicks "start-game". A
direct or reloaded visit to /result (or /, where stats show in the
home-with-history scenario) renders emptyStats() until the first play.

Review: optional — single ~7-line surgical fix in one file, scope is
narrow and existing tests cover the action surface.

## What ships
A module-level client-side kickoff that calls `useGameStore.getState()
.hydrateStats()` exactly once when the store module loads in the browser.
SSR is a no-op (`typeof window === 'undefined'`). On fetch failure the
store stays at emptyStats() and the next write path overwrites anyway.
No new API, no new endpoint, no schema change, no UI change — the same
StatsCard now sees real data.

## File-by-file

### 1. `lib/store.ts` — kick off hydration at module load (client only)

Append after `selectAvailableMoves`:

```ts
// Client-side: kick off stats hydration once when the store module loads
// in the browser. Without this, any page that reads `stats` (e.g. /result
// after a hard refresh) sees the emptyStats() initial state until the user
// first clicks "start-game", because `startGame` is the only other caller
// of apiGetStats. The fetch is fire-and-forget; on failure the store
// stays at emptyStats() and the next write path will overwrite anyway.
if (typeof window !== 'undefined') {
  useGameStore.getState().hydrateStats();
}
```

Acceptance: refreshing /result (or any visit to /) shows the persisted
stats, not 0/0/0/0/—.

### 2. Regression — nothing else changes

- `pnpm vitest run` — 67/67 (no test file touched).
- `pnpm typecheck` / `pnpm lint` — clean.
- `pnpm build` — 5 routes (next-env.d.ts drift already present).
- `tests/qa/hydration-check.mjs` — HYDRATION CHECK PASS (store hydration
  is client-side, no SSR mismatch).
- `tests/qa/audio-cheer.mjs` — AUDIO CHEER PROBE PASS (cheer sequence
  unchanged).
- `tests/qa/audio-probe.mjs` — AUDIO PROBE PASS.
- `tests/qa/audio-confetti-qa.mjs` — 9/9 PASS.
- New probe `/tmp/ulw-stats-debug/probe.mjs` — RESULT PROBE PASS.

## Must-NOT-Have (scope guardrails)
- Do NOT add an SSR fetch — `app/result/page.tsx` is `'use client'`,
  and the store is module-level. Mixing SSR data into a client store is
  a larger refactor (server-state hydration pattern), out of scope.
- Do NOT change the StatsCard shape or `api/stats` shape.
- Do NOT add a new endpoint or change PUT/GET/DELETE contract.
- Do NOT remove the existing `hydrateStats` action — it's now actually
  called.
- Do NOT touch the confetti component, cheer implementation, or sound
  module (other tasks on this branch).

## Commit
- One atomic commit on `feat/ux-polish`:
  `fix(store): hydrate persisted stats on client mount so /result shows
  history after refresh` — matches the existing commit style.
- Footer `Plan: .omo/plans/result-stats-reload.md`.

## Out-of-scope
- A future iteration could move to a server-state hydration pattern
  (RSC + `useSuspenseQuery`, or `nuqs`/React Query) so the data shows up
  on first paint rather than after the client-side fetch settles. That's
  a refactor, not this bug.
