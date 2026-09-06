# Plan: Commit-Policy Enforcement on feat/ux-polish

Intent: rewrite every non-compliant commit message on `feat/ux-polish` to
match the AGENTS.md "Commit convention" section, then lock the policy at
commit time with a `commit-msg` hook so future commits cannot regress.

## Scope

`feat/ux-polish` only. `dc66c2d` / `0ff500e` / `4d9e8df` predate the policy
but ship on the branch, so the user's "all history" instruction includes
them. Do not touch main / origin (no remote is set).

## Audit rules (lifted from AGENTS.md "Commit convention" + "Body schema")

- R1 subject: `^prompt\([^)]+\): ` or `^(feat|fix|refactor|test|docs|chore|build|ci|perf)(\([^)]+\))?!?: `.
  Disallow `polish:`, `style:`, `wip:`, free-form.
- R2 length: subject <= 100 chars.
- R3 body: non-chore subject requires a non-empty body carrying all three
  of WHAT / WHY / HOW (sentences, not necessarily headings).
- R4 trailers: non-chore, non-prompt commits include the lore trailer
  block with at least `Confidence:` and `Scope-risk:` present.
- R5 footer: non-trivial commits carry `Plan: .omo/plans/<slug>.md`.

Current `feat/ux-polish` (12 commits) status:

| SHA       | Subject                                            | R1 | R2 | R3 | R4 | R5 | Action |
|-----------|----------------------------------------------------|----|----|----|----|----|--------|
| dc66c2d   | `chore: initialize repo with brief intent ...`     | OK | OK | OK (triv) | OK (triv) | OK (triv) | rewrite body for clarity, keep subject |
| 0ff500e   | `feat: ship tic-tac-toe per brief - ...`           | OK | OK | WARN | WARN | MISS | rewrite (add Plan + trailers) |
| 4d9e8df   | `polish: ship UX pass ...`                         | FAIL (`polish`) | OK | OK | WARN | MISS | rewrite subject to `chore(ux):` |
| ea65634   | `fix: unbreak sound toggle + flash up ...`         | OK | OK | OK | OK | MISS | rewrite (add `Plan: .omo/plans/win-cheer.md`) |
| 726b47e   | `fix: stop SoundToggle from hydrating ...`         | OK | OK | OK | OK | MISS | rewrite (add `Plan: .omo/plans/win-cheer.md`) |
| c7fe912   | `feat(audio): layer a synthesized cheer ...`       | OK | OK | OK | OK | OK | keep |
| f1aa83f   | `fix(store): hydrate persisted stats ...`          | OK | OK | OK | OK | OK | keep |
| 91b8325   | `chore(deps): track next-env.d.ts ...`             | OK | OK | OK | OK | OK (chore) | keep |
| ce38022   | `docs(plans): archive win celebration cheer plan`  | OK | OK | OK | OK | OK | keep |
| 17ecd1e   | `docs(agents): bootstrap Next.js 16 agent-rules`   | OK | OK | OK | OK | OK | keep |
| 708d5ed   | `docs(agents): add contribution guidelines ...`   | OK | OK | OK | OK | OK | keep |
| b9b78c7   | `docs(agents): expand commit convention ...`       | OK | OK | OK | OK | OK | keep |

5 commits need rewriting; 7 are already compliant.

## Rewriting strategy

Non-interactive: drive `git rebase -i --root` with
`GIT_SEQUENCER_EDITOR` set to a sed script that marks only the 5
non-compliant commits as `reword`. New messages are pre-written into
.git/reword-msg/<sha>.txt and the sed pipeline `tee`s the right one
into `GIT_EDITOR` for the next reword step.

Base for rebase: `--root` (rewind to first commit on the branch) so we
preserve the parent chain. Edit only the 5 non-compliant messages; the
other 7 ride through untouched.

Alternative rejected: `git filter-branch --msg-filter`. Heavier, harder
to selectively edit only 5 commits, harder to recover from a buggy
filter.

## Lock-in: commitlint + hook

- `commitlint.config.cjs` extends `@commitlint/config-conventional`:
  - type-enum: `feat|fix|refactor|test|docs|chore|build|ci|perf|prompt`
  - header-max-length: 100
  - body-min-length: 20 (non-chore / non-prompt)
  - custom plugin enforcing the WHAT / WHY / HOW presence and the
    `Plan:` footer for non-trivial types.
- `.git/hooks/commit-msg` runs `pnpm exec commitlint --edit "$1"` and
  exits non-zero on failure. Native git hook (not husky) per the
  user's requirement.

## Must-not-have

- No force-push to main (no remote anyway).
- No new dep beyond `@commitlint/cli` + `@commitlint/config-conventional`.
- No changes to runtime code.
- No commit on the branch that violates the policy the hook enforces.

## Verification

- `node tests/qa/commit-audit.mjs --branch feat/ux-polish` ->
  0 violations after rewrite.
- `git commit --allow-empty -m "bad: lowercase"` -> non-zero exit,
  rule-specific message.
- `git commit --allow-empty -m "fix(audio): good" -m "WHAT/WHY/HOW body"` ->
  exit 0.
- `pnpm vitest run` -> 67/67.
- `pnpm typecheck` / `lint` / `build` -> clean.
- 4 QA scripts (`hydration-check`, `audio-probe`, `audio-cheer`,
  `audio-confetti-qa`) -> PASS.

## Final commits this branch will gain

- `chore(repo): install commitlint policy + commit-msg hook`
- `docs(agents): wire commit-policy enforcement audit into Verification gate`

The history rewrite itself produces no new commit objects; it rewrites
existing SHAs into compliant messages and re-stamps SHAs only on the
edited commits.
