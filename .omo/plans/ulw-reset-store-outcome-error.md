# Plan: ulw-reset-store-outcome-error

## Goal
Fix the test-isolation defect where three hand-copied `resetStore` paths in the test suite do not clear the `outcomeError` field added in commit 667b9ea. Without the fix, future tests that read store shape or render `OutcomeErrorBanner` can observe stale values from a prior test.

## Background (decided, not re-investigated)
- `lib/store.ts` GameState (line 83) declares `outcomeError: { reason: string; at: number } | null`. Initial value at line 148 is `outcomeError: null`. Production transitions clear it on new-game / restart (lines 308, 411) and set it via `setOutcomeError` (line 464).
- Zustand `setState` is merge-semantics: fields not listed are preserved. Three test-side copies of `resetStore` omitted `outcomeError`, so any test that called `setOutcomeError(...)` before `resetStore()` would leak the value into the next test.
- The leak is currently latent (no existing test renders `OutcomeErrorBanner` or asserts store shape post-reset), but the next such test would fail mysteriously. Root cause is the three-handwritten-copies invariant breaking silently on field addition.

## Scope (in)
1. Add `outcomeError: null` to the `useGameStore.setState({...})` call in:
   - `tests/store/store.test.ts` — `function resetStore()` at lines 46-57.
   - `components/HomeDialogMount.test.tsx` — `beforeEach(...)` block, the `useGameStore.setState({...})` call at lines 41-49. Order of all other cleanup steps preserved (localStorage.clear / sessionStorage.clear / fetchSpy.mockClear stay before; `__resetInternalForTests` stays after).
   - `components/OnlineGateMount.test.tsx` — `function resetStore()` at lines 44-54. Order preserved (setState → `__resetInternalForTests` → `routerPush.mockClear()`).
2. Add ONE regression test in `tests/store/store.test.ts` named `'resetStore clears outcomeError so subsequent tests do not see a stale banner'` that:
   - seeds `outcomeError` via `setOutcomeError({ reason: 'aborted', at: Date.now() })`,
   - asserts `outcomeError !== null` mid-test,
   - calls `resetStore()`,
   - asserts `useGameStore.getState().outcomeError === null`.
3. Single atomic commit.

## Scope OUT (Must-NOT-Have)
- Do NOT touch `lib/store.ts` or any product code.
- Do NOT touch other test files (`tests/qa/*`, view-transition, Alert, etc.).
- Do NOT run `pnpm build` or `pnpm dev` (vitest does not need them; tier is LIGHT).
- Do NOT rewrite unrelated assertions or change test ordering.
- Do NOT change the existing reset paths' signatures (no extra params, no new helper file).
- Do NOT enable `--no-verify` on the commit.
- Do NOT extract a shared `tests/helpers/resetStore.ts` helper in this commit. See Decision below.

## Decision: direct-edit vs. shared helper

Choose **direct-edit** (3 place add of one field line + 1 regression test). Rationale:

- Lowest surface risk on a fix-branch: keeps diff mechanical, preserves each test file's existing reset ordering (HomeDialogMount's beforeEach interleaves localStorage / sessionStorage / fetchSpy.mockClear; OnlineGateMount's resetStore ends with routerPush.mockClear()). Helper extraction would force re-expressing that interleaving — exactly the kind of incidental semantic change that introduces the next regression.
- The DRY benefit is one line per file; the bug-prevention benefit (forcing future fields through one site) is real but orthogonal to this task and lives better as its own change once a second field lands.
- The task explicitly allows either choice: "保守起见也可以只做第 1、2 条". This commit is the conservative interpretation.

The helper extraction is NOT deleted as an option — if a second store field gets added within a quarter and the same defect recurs, that becomes the next fix-branch.

## Tier

**LIGHT**. One-spot bugfix: known pattern (Zustand reset), no open design decisions, blast radius limited to three test files plus one new test case. Evidence channel: vitest output (no browser surface involved — pure store-state contract). Self-review recorded in the notepad; no reviewer loop required.

## Files Touched (expected `git diff dev..HEAD --name-only`)
- `tests/store/store.test.ts` (modify resetStore + add 1 test)
- `components/HomeDialogMount.test.tsx` (modify beforeEach)
- `components/OnlineGateMount.test.tsx` (modify resetStore)
- `.omo/plans/ulw-reset-store-outcome-error.md` (this plan)

## Acceptance Criteria

| ID | Criterion | Verify by |
| --- | --- | --- |
| AC-1 | `rg -n "outcomeError: null" tests/store/store.test.ts components/HomeDialogMount.test.tsx components/OnlineGateMount.test.tsx` returns 3+ matches across the three files | ripgrep exit 0 + ≥1 hit per file |
| AC-2 | At least one new test in `tests/store/store.test.ts` whose name contains both `outcomeError` and `reset` semantics, asserting `useGameStore.getState().outcomeError === null` after `resetStore()` | vitest output shows the new test PASS |
| AC-3 | `pnpm vitest run` is fully green (≥479 tests) | exit 0, "Tests" summary line complete, no failures / skips added |
| AC-4 | `git diff dev..HEAD --name-only` is exactly the four files above (no product code, no other test changes) | command output matches expected file list byte-for-byte |
| AC-5 | `pnpm typecheck` and `pnpm lint` both green | each command exits 0 |
| AC-6 | One atomic commit with subject ≤100 chars, type-prefix, lore trailer, Plan footer; no `--no-verify` | `git log -1` + `git show HEAD` shows the trailer; `tests/qa/commit-audit.mjs` exit 0 |

## Todos

- [ ] 1. `tests/store/store.test.ts: add outcomeError: null to resetStore() setState block` — verify by `rg -n "outcomeError: null" tests/store/store.test.ts` returning a hit inside that function body.
- [ ] 2. `components/HomeDialogMount.test.tsx: add outcomeError: null to beforeEach setState block (preserve localStorage.clear / sessionStorage.clear / fetchSpy.mockClear order before; __resetInternalForTests after)` — verify by `rg -n "outcomeError: null" components/HomeDialogMount.test.tsx` returning a hit inside the beforeEach.
- [ ] 3. `components/OnlineGateMount.test.tsx: add outcomeError: null to resetStore() setState block (preserve __resetInternalForTests and routerPush.mockClear ordering)` — verify by `rg -n "outcomeError: null" components/OnlineGateMount.test.tsx` returning a hit inside that function body.
- [ ] 4. `tests/store/store.test.ts: add regression test 'resetStore clears outcomeError so subsequent tests do not see a stale banner' that seeds → asserts non-null → calls resetStore → asserts null` — verify by vitest output showing the new test PASS and `rg -n "outcomeError" tests/store/store.test.ts` showing the new case.
- [ ] F1. Final verification wave: run `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` + `git diff dev..HEAD --name-only` + `tests/qa/commit-audit.mjs` and record PASS/FAIL for AC-1 through AC-6 in the notepad.

## Commit

- type: `test`
- scope: `store`
- subject: `test(store): resetStore clears outcomeError (leak regression)`
- lore trailer: Constraint / Rejected / Confidence / Scope-risk / Directive / Tested
- footer: `Plan: .omo/plans/ulw-reset-store-outcome-error.md`

## Stop condition

I'll stop right away when AC-1 through AC-6 all PASS with captured evidence in the notepad, the atomic commit lands, and the final reply carries the plan path, commit SHA, AC-1~6 one-line table, and the direct-edit decision.
