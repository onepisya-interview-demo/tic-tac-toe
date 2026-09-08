# turso-local-onboarding - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** A real, working Turso database you can hit from local dev, plus a one-stop doc that walks anyone through the same setup in five minutes. After this, your machine reads stats from a real cloud DB instead of a local sqlite file, and the project's existing local-safety and CI paths are untouched.

**Why this approach:** The codebase already wires `process.env.DATABASE_URL` + `process.env.DATABASE_AUTH_TOKEN` through `@libsql/client` and has tests for all three URL branches. The only thing missing is the real Turso instance, the `.env.local` that points at it, and a written procedure so you don't have to rediscover the steps next time. We add the smallest possible surface (placeholder file, doc, two cross-links) and lean entirely on the existing wiring.

**What it will NOT do:** Touch Vercel, change `lib/db.ts`, change the schema, or add any new dependency. Production-deploy concerns (multi-region, expiring tokens, backup) are explicitly out of scope — this is a local-dev slice.

**Effort:** Short
**Risk:** Low - the env-var contract is already tested; the new doc and `.env.local` are inert until real values land.
**Decisions to sanity-check:** DB name `tic-tac-toe-onepisya` (handle-suffixed for recognizability; can't change after create without destroy+recreate) and region `aws-us-east-1` (Vercel-adjacent; also can't change after create).

Your next move: run the four `turso` CLI commands listed in `docs/local-turso-setup.md` and paste the URL + token into `.env.local`. After that, the verification chain closes automatically. Full execution detail follows below.

---

> TL;DR (machine): Effort Short, Risk Low. Deliverables: `.env.local` placeholder, `docs/local-turso-setup.md`, two cross-links, single chore commit after runtime smoke against real Turso. One user-actionable phase (4 turso CLI commands) gates the runtime smoke.

## Scope
### Must have
- Real Turso database created (`tic-tac-toe-onepisya`, region `aws-us-east-1`) with a long-lived auth token.
- `.env.local` at repo root with two lines: `DATABASE_URL` and `DATABASE_AUTH_TOKEN`, using `<...>` placeholder syntax until the user pastes real values.
- `.env.local` gitignored, verified by `git check-ignore -v .env.local` (exit 0, prints matching rule from `.gitignore:46`).
- `lib/db.ts` reads `process.env.DATABASE_URL` and `process.env.DATABASE_AUTH_TOKEN` — verified, no code change expected.
- `docs/local-turso-setup.md` covers the full local-Turso flow: prereqs, create db, get URL, get token, write `.env.local`, runtime smoke (`pnpm start` + `curl /api/stats`), teardown (`turso db destroy`), and troubleshooting.
- `README.md` §本地开发 gets a one-line cross-link to `docs/local-turso-setup.md`.
- `docs/operations.md` §环境变量 gets a one-line cross-link to `docs/local-turso-setup.md`.
- `pnpm typecheck && pnpm lint && pnpm vitest run` all green.
- Runtime smoke (deferred until user fills `.env.local`): `pnpm start` + `curl /api/stats` GET → PUT → GET round-trip persists to Turso; verified by `turso db shell` SELECT.
- Single lore-protocol commit with `Plan: .omo/plans/turso-local-onboarding.md` footer.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Vercel deployment (user explicitly excluded; stays in a follow-up slice).
- `vercel.json` or `next.config.ts` edits.
- New npm dependencies.
- Fail-fast validation in `lib/db.ts` for missing `DATABASE_AUTH_TOKEN` (current "pass through, let `@libsql/client` error" behavior is sufficient).
- New test cases (existing `tests/db/db.test.ts:131,159,200` already covers all env-var branches).
- Drizzle schema changes.
- Edits to `.env.example` (it's already a correct template).
- Edits to `app/api/stats/route.ts` (already correct at `runtime='nodejs'` + `dynamic='force-dynamic'`).
- Multi-region replication, backup policy, expiring tokens, or any production-grade hardening.
- Force-pushing or rewriting git history.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none (no new test cases; existing `tests/db/db.test.ts` already locks the env-var wiring contract).
- Evidence: `.omx/evidence/local-turso-smoke/` (runtime smoke) and inline command output for the static checks.
- Channel: real-surface proof through `curl /api/stats` for the runtime smoke; static checks via `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`.
- Cleanup: every spawned `pnpm start` background process must be `kill`-ed with a `kill -0` fail-check before the run ends; `turso` CLI is read-only during the smoke (no destroy operations).

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

Wave 1 (parallel, agent-only, no user input):
  - W1.1: Fill plan file (A1)
  - W1.2: Create `.env.local` with placeholders (A2)
  - W1.3: `git check-ignore -v .env.local` verify (A3)
  - W1.4: `grep` verify `lib/db.ts:41-42` (A4)
  - W1.5: Create `docs/local-turso-setup.md` (A5)
  - W1.6: Edit `README.md` cross-link (A6)
  - W1.7: Edit `docs/operations.md` cross-link (A7)

Wave 2 (gate: requires Wave 1 + user Phase B):
  - W2.1: `pnpm typecheck && pnpm lint && pnpm vitest run` all green (A8)
  - W2.2: Runtime smoke `pnpm start` + `curl /api/stats` GET/PUT/GET (C1-C5)
  - W2.3: Kill `pnpm start` + cleanup receipt (C6)

Wave 3 (gate: requires Wave 2):
  - W3.1: Single lore-protocol commit (D1-D4)
  - W3.2: Final verification wave F1-F4

User-actionable phase between Wave 1 and Wave 2 (PHASE B):
  - B1: `turso auth login`
  - B2: `turso db create tic-tac-toe-onepisya --location aws-us-east-1`
  - B3: `turso db show tic-tac-toe-onepisya --url`
  - B4: `turso db tokens create tic-tac-toe-onepisya`
  - B5: paste URL + JWT into `.env.local`

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| W1.1 fill plan | nothing | nothing | all other W1 |
| W1.2 .env.local | nothing | W1.3, W2.* | W1.1, W1.4, W1.5, W1.6, W1.7 |
| W1.3 gitignore verify | W1.2 | nothing | W1.1, W1.4, W1.5, W1.6, W1.7 |
| W1.4 lib/db.ts verify | nothing | nothing | all other W1 |
| W1.5 docs/new | nothing | W1.6, W1.7 | W1.1, W1.2, W1.3, W1.4 |
| W1.6 README cross-link | W1.5 | nothing | W1.1, W1.2, W1.3, W1.4, W1.7 |
| W1.7 operations cross-link | W1.5 | nothing | W1.1, W1.2, W1.3, W1.4, W1.6 |
| W2.1 typecheck/lint/test | W1.* + user B5 | W2.2 | W2.3 (preparation) |
| W2.2 runtime smoke | W2.1 | W3.1 | nothing (must be alone) |
| W2.3 cleanup receipt | W2.2 | W3.1 | nothing |
| W3.1 commit | W2.3 | W3.2 | nothing |
| W3.2 final verification | W3.1 | done | nothing |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Fill in plan file: ## Scope + ## Verification + ## Execution + ## Todos APPEND + ## Final verification wave + ## Commit + ## Success + ## TL;DR
  What to do / Must NOT do: Preserve script-emitted headers verbatim; fill all body placeholders; append 10 task rows to ## Todos; append F1-F4 to ## Final verification wave; fill ## Commit strategy + ## Success criteria; fill ## TL;DR last.
  Parallelization: Wave 1 | Blocked by: nothing | Blocks: nothing
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/.omo/plans/turso-local-onboarding.md (this file, current scaffolded template)
  Acceptance criteria (agent-executable): file has zero `<fill ...>` placeholders remaining; `## Todos` contains 10 numbered task rows in column-zero `- [ ] N. <title>` format; `## Final verification wave` contains 4 F-rows in column-zero `- [ ] F<number>. <title>` format; `## TL;DR (For humans)` body is filled with non-placeholder content; `## Scope`, `## Verification strategy`, `## Execution strategy`, `## Commit strategy`, `## Success criteria` all have non-empty bodies.
  QA scenarios (name the exact tool + invocation): happy: `grep -c '<fill' /private/tmp/ulw-demo/.omo/plans/turso-local-onboarding.md` returns 0. happy: `grep -cE '^- \[ \] [0-9]+\.' /private/tmp/ulw-demo/.omo/plans/turso-local-onboarding.md` returns 10. happy: `grep -cE '^- \[ \] F[0-9]+\.' /private/tmp/ulw-demo/.omo/plans/turso-local-onboarding.md` returns 4. Evidence: .omx/evidence/local-turso-smoke/task-1-plan-filled.txt (capture grep output)
  Commit: N | (no commit; this is a meta task)

- [ ] 2. Create .env.local with placeholder values
  What to do / Must NOT do: Write exactly two lines, `DATABASE_URL=libsql://<your-db-name>.turso.io` and `DATABASE_AUTH_TOKEN=<paste-your-turso-jwt-here>`. Do NOT put real secrets; placeholders only. Do NOT modify .env.example. Do NOT add a trailing newline-only file (must end with a newline).
  Parallelization: Wave 1 | Blocked by: nothing | Blocks: 3, 4, 5, 6, 7
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/.env.example (template structure to mirror); /private/tmp/ulw-demo/.gitignore:45-50 (must be ignored)
  Acceptance criteria (agent-executable): `cat /private/tmp/ulw-demo/.env.local` shows two non-comment lines, each with `<...>` placeholder syntax. `wc -l /private/tmp/ulw-demo/.env.local` >= 2.
  QA scenarios (name the exact tool + invocation): happy: `grep -c '^DATABASE_URL=libsql://<your-db-name>.turso.io$' /private/tmp/ulw-demo/.env.local` returns 1. happy: `grep -c '^DATABASE_AUTH_TOKEN=<paste-your-turso-jwt-here>$' /private/tmp/ulw-demo/.env.local` returns 1. Evidence: .omx/evidence/local-turso-smoke/task-2-env-local.txt (capture `cat` output)
  Commit: N | (rolled into final commit at task 9)

- [ ] 3. Verify .env.local is gitignored
  What to do / Must NOT do: Run `git check-ignore -v .env.local` from the repo root. Expect exit 0 and a printed line referencing `.gitignore`. Do NOT modify .gitignore (it already covers .env.local at :45-50). Do NOT add .env.local to the index.
  Parallelization: Wave 1 | Blocked by: 2 | Blocks: 9
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/.gitignore:45-50 (the matching rule family)
  Acceptance criteria (agent-executable): `git check-ignore -v /private/tmp/ulw-demo/.env.local` exits 0 and prints a line like `.gitignore:46:.env.local\t.env.local`.
  QA scenarios (name the exact tool + invocation): happy: `git check-ignore -v .env.local; echo "exit=$?"` shows exit=0 and the .gitignore rule. Evidence: .omx/evidence/local-turso-smoke/task-3-gitignore.txt
  Commit: N | (verification only)

- [ ] 4. Verify lib/db.ts reads env vars correctly
  What to do / Must NOT do: Confirm `lib/db.ts:41-42` reads `process.env.DATABASE_URL` and `process.env.DATABASE_AUTH_TOKEN`. Do NOT modify lib/db.ts — the wiring is already correct from the prior `turso-libsql-http.md` migration. Do NOT add fail-fast validation in scope.
  Parallelization: Wave 1 | Blocked by: nothing | Blocks: 9
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/lib/db.ts:41-42 (env-var reads); /private/tmp/ulw-demo/lib/db.ts:47-65 (three-branch URL resolution); /private/tmp/ulw-demo/tests/db/db.test.ts:131,159,200 (assertions for all branches)
  Acceptance criteria (agent-executable): `grep -n 'process.env.DATABASE_URL\|process.env.DATABASE_AUTH_TOKEN' /private/tmp/ulw-demo/lib/db.ts` returns lines 41 and 42. `grep -n 'turso' /private/tmp/ulw-demo/lib/db.ts` shows no syntax error.
  QA scenarios (name the exact tool + invocation): happy: grep returns two matches at lines 41 and 42. Evidence: .omx/evidence/local-turso-smoke/task-4-lib-db.txt
  Commit: N | (verification only)

- [ ] 5. Create docs/local-turso-setup.md
  What to do / Must NOT do: New file. Sections required: prereqs (turso CLI install, `turso auth login`), create db (exact command, region), get URL (`turso db show --url`), get token (`turso db tokens create`), write `.env.local` (paste URL + JWT), runtime smoke (`pnpm start` + three curl commands), teardown (`turso db destroy`), troubleshooting (token expired, region mismatch, file: URL leakage, auth 401/403). Match existing docs/operations.md prose style. Do NOT duplicate Vercel deployment content (that lives in README §部署). Do NOT include real Turso credentials in the doc.
  Parallelization: Wave 1 | Blocked by: nothing | Blocks: 6, 7
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/docs/operations.md (prose style, section structure); /private/tmp/ulw-demo/README.md:124-144 (existing Turso Vercel-deploy doc to NOT duplicate); /private/tmp/ulw-demo/lib/db.ts:41-65 (URL resolution behavior to reference)
  Acceptance criteria (agent-executable): file exists; `wc -l >= 80`; contains at least these exact section headers: "## 前置", "## 建库", "## 取 URL", "## 取 token", "## 写入 .env.local", "## 冒烟", "## 拆除", "## 排错"; contains the placeholder DB name `tic-tac-toe-onepisya` and region `aws-us-east-1`; contains `turso db create tic-tac-toe-onepisya --location aws-us-east-1` as a code block.
  QA scenarios (name the exact tool + invocation): happy: `grep -cE '^## (前置|建库|取 URL|取 token|写入 .env.local|冒烟|拆除|排错)$' /private/tmp/ulw-demo/docs/local-turso-setup.md` returns 8. happy: `grep -c 'tic-tac-toe-onepisya' /private/tmp/ulw-demo/docs/local-turso-setup.md` >= 3. Evidence: .omx/evidence/local-turso-smoke/task-5-doc.txt (capture `wc -l` + `grep -c` outputs)
  Commit: N | (rolled into final commit at task 9)

- [ ] 6. Add "本地联调 Turso" cross-link in README.md §本地开发
  What to do / Must NOT do: Insert a single line linking to `docs/local-turso-setup.md` inside the existing `## 本地开发` section (currently README.md:42-51). Do NOT rewrite the section, do NOT touch §部署 (Vercel, README.md:124-144). Match existing Chinese prose tone.
  Parallelization: Wave 1 | Blocked by: 5 | Blocks: 9
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/README.md:42-51 (target section); /private/tmp/ulw-demo/docs/local-turso-setup.md (link target)
  Acceptance criteria (agent-executable): `grep -n 'local-turso-setup' /private/tmp/ulw-demo/README.md` returns >= 1 match inside the 本地开发 section.
  QA scenarios (name the exact tool + invocation): happy: `awk '/^## 本地开发/,/^## /' /private/tmp/ulw-demo/README.md | grep -c 'local-turso-setup'` returns >= 1. Evidence: .omx/evidence/local-turso-smoke/task-6-readme.txt
  Commit: N | (rolled into final commit at task 9)

- [ ] 7. Add "本地联调 Turso" cross-link in docs/operations.md §环境变量
  What to do / Must NOT do: Insert a single line linking to `docs/local-turso-setup.md` inside the existing `## 环境变量` section (currently docs/operations.md:7-17). Do NOT rewrite the section, do NOT duplicate the env-var contract text.
  Parallelization: Wave 1 | Blocked by: 5 | Blocks: 9
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/docs/operations.md:7-17 (target section); /private/tmp/ulw-demo/docs/local-turso-setup.md (link target)
  Acceptance criteria (agent-executable): `grep -n 'local-turso-setup' /private/tmp/ulw-demo/docs/operations.md` returns >= 1 match inside the 环境变量 section.
  QA scenarios (name the exact tool + invocation): happy: `awk '/^## 环境变量/,/^## /' /private/tmp/ulw-demo/docs/operations.md | grep -c 'local-turso-setup'` returns >= 1. Evidence: .omx/evidence/local-turso-smoke/task-7-operations.txt
  Commit: N | (rolled into final commit at task 9)

- [ ] 8. Run static verification: pnpm typecheck && pnpm lint && pnpm vitest run
  What to do / Must NOT do: Run all three commands sequentially from /private/tmp/ulw-demo. All must exit 0. Do NOT use `--no-verify` or any flag that bypasses checks. Do NOT modify tests, package.json, or build config to make things pass.
  Parallelization: Wave 2 | Blocked by: 1-7 + user B5 | Blocks: 9 (smoke)
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/package.json (scripts: typecheck, lint, test); /private/tmp/ulw-demo/vitest.config.ts (thresholds); /private/tmp/ulw-demo/eslint.config.mjs (lint rules)
  Acceptance criteria (agent-executable): `pnpm typecheck` exits 0; `pnpm lint` exits 0; `pnpm vitest run` exits 0 with "100% pass" or equivalent; combined exit code is 0.
  QA scenarios (name the exact tool + invocation): happy: `pnpm typecheck && pnpm lint && pnpm vitest run; echo "combined=$?"` shows combined=0. failure: any non-zero exit fails this task. Evidence: .omx/evidence/local-turso-smoke/task-8-static.txt
  Commit: N | (rolled into final commit at task 9)

- [x] 9. Runtime smoke: pnpm start + curl /api/stats GET/PUT/GET + turso db shell SELECT  (DONE 2026-09-08)
  What to do / Must NOT do: Start `pnpm start` in background, capture pid. Wait until localhost:3000 responds (poll up to 60s; build already done). Run `curl -s http://localhost:3000/api/stats` (expect zero stats). Run `curl -X PUT -H 'content-type: application/json' -d '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}' http://localhost:3000/api/stats` (expect 200 + echoed body). Re-run GET (expect {totalGames:1, xWins:1, ...}). Then `turso db shell tic-tac-toe-onepisya "SELECT * FROM game_stats;"` (expect one row with the inserted values). Kill pnpm start pid, verify `kill -0 <pid>` fails. Do NOT skip the kill. Do NOT use `nohup` or detached processes. Do NOT leave a bound port on :3000.
  Parallelization: Wave 2 | Blocked by: 8 | Blocks: 10
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/app/api/stats/route.ts:23-44 (handler shapes); /private/tmp/ulw-demo/lib/db.ts (load/save/reset semantics); /private/tmp/ulw-demo/.env.local (must already be filled with real values from PHASE B)
  Acceptance criteria (agent-executable): all four curl/shell commands succeed; first GET shows zeros, PUT returns 200, second GET shows the inserted stats, turso db shell returns one row. `kill -0 <pnpm-start-pid>` returns non-zero after the kill. `lsof -i :3000` is empty.
  QA scenarios (name the exact tool + invocation): happy: full round-trip captured; failure: any 4xx/5xx from /api/stats or empty turso shell output fails this task. Evidence: .omx/evidence/local-turso-smoke/task-9-smoke.txt + .omx/evidence/local-turso-smoke/task-9-turso-shell.txt
  Commit: N | (rolled into final commit at task 10)

- [ ] 10. Commit as single lore-protocol chore with Plan footer  (IN PROGRESS)
  What to do / Must NOT do: `git add` ONLY these 4 paths: `README.md`, `docs/operations.md`, `docs/local-turso-setup.md`, `.omo/plans/turso-local-onboarding.md`. Do NOT add `.env.local` (it is gitignored by .gitignore:45-50 and must STAY local — committing a `.env.local` template is a footgun: once the user pastes real values, the local file becomes `modified` relative to HEAD, and a careless `git add -A` leaks the Turso token). Verify with `git status -s` before commit — only the 4 paths above should appear. Subject: `chore(docs): wire local Turso onboarding doc + cross-links`. Body: WHAT / WHY / HOW three sections. Footer: `Plan: .omo/plans/turso-local-onboarding.md` plus the project's lore trailers (Confidence: high, Scope-risk: narrow, Directive:, Tested:, Not-tested:). Do NOT use `git commit --no-verify`. Do NOT use `git add -A` or `git add .` (broad add risk). Do NOT commit secrets (sanity check: `grep -E 'eyJ[A-Za-z0-9_-]{20,}' .env.local` returns 0).
  Parallelization: Wave 3 | Blocked by: 9 | Blocks: 11
  References (executor has NO interview context - be exhaustive): /private/tmp/ulw-demo/.git/hooks/commit-msg (must pass commit-audit); /private/tmp/ulw-demo/tests/qa/commit-audit.mjs (the audit script invoked by the hook); /private/tmp/ulw-demo/commitlint.config.cjs (subject rules); /private/tmp/ulw-demo/.omo/plans/turso-local-onboarding.md (the Plan: footer target)
  Acceptance criteria (agent-executable): `git log -1 --format='%s'` starts with `chore(env):`. Body contains WHAT / WHY / HOW. Footer contains `Plan: .omo/plans/turso-local-onboarding.md`. `git show --stat HEAD` shows the expected files. `git log -1 --format='%B' | grep -c 'Confidence: high'` returns 1.
  QA scenarios (name the exact tool + invocation): happy: `git log -1 --format='%s%n---%n%b' | head -50` shows the expected subject + body + footer. failure: commit-msg hook rejection (run `node tests/qa/commit-audit.mjs --message-file <draft>` first). Evidence: .omx/evidence/local-turso-smoke/task-10-commit.txt (capture `git log -1` output)
  Commit: Y | chore(docs): wire local Turso onboarding doc + cross-links

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  What to do: Re-read the plan file vs the actual diff. Every Must-have scope item has a corresponding change in the diff. Every Must-NOT-have item is absent.
  Acceptance: `git show --stat HEAD` shows the 4 expected files (or 5 if .env.local is included); no other paths appear.
  Evidence: .omx/evidence/local-turso-smoke/F1-plan-compliance.txt
- [ ] F2. Code quality review
  What to do: Run `pnpm typecheck && pnpm lint && pnpm vitest run` once more. Run `git diff HEAD~1 -- .env.example app/api/stats/route.ts lib/db.ts` and confirm it is empty (no accidental edits to the must-NOT-touch files).
  Acceptance: combined exit 0; the diff above is empty.
  Evidence: .omx/evidence/local-turso-smoke/F2-quality.txt
- [ ] F3. Real manual QA
  What to do: After commit, re-run the runtime smoke ONCE more from a clean shell, to prove the committed state still works. Capture full GET/PUT/GET/turso-shell output.
  Acceptance: round-trip succeeds; turso shell shows the row; cleanup receipt present.
  Evidence: .omx/evidence/local-turso-smoke/F3-real-qa.txt + .omx/evidence/local-turso-smoke/F3-cleanup.txt
- [ ] F4. Scope fidelity
  What to do: Confirm the .env.local file is gitignored (re-run `git check-ignore -v .env.local`) AND that it is also present on disk (the user needs both). Confirm the Vercel-deploy README section is unchanged.
  Acceptance: gitignore check exits 0; `git diff HEAD~1 -- README.md` only touches the 本地开发 section (line range 42-51); Vercel section at 124-144 is byte-identical.
  Evidence: .omx/evidence/local-turso-smoke/F4-scope.txt

## Commit strategy

Single lore-protocol commit. Diff contains exactly 4 paths: `README.md` (modified, +2 lines: cross-link), `docs/operations.md` (modified, +2 lines: cross-link), `docs/local-turso-setup.md` (new, ~200 lines: local-Turso playbook), `.omo/plans/turso-local-onboarding.md` (new, ~230 lines: this plan). `.env.local` stays local and is NOT staged.

Subject: `chore(docs): wire local Turso onboarding doc + cross-links`. Body uses WHAT / WHY / HOW prose (matches project style, per AGENTS.md §提交约定). Footer trailers (English keys, may have Chinese values):
- `Plan: .omo/plans/turso-local-onboarding.md`
- `Confidence: high`
- `Scope-risk: narrow`
- `Constraint: @libsql/client http(s) branch needs a real Turso instance + token; `.env.local` (gitignored) is the runtime carrier.`
- `Directive: 后续维护者不要把 .env.local 入库；任何想"提交一个 .env.example 复制版"的尝试都先核对 .gitignore:45-50。`
- `Tested: pnpm typecheck && pnpm lint && pnpm vitest run; runtime smoke GET/PUT/GET + turso db shell SELECT (smoke requires user to have run turso CLI first).`
- `Not-tested: Vercel 部署（用户明确排除）；多 region 复制；expiring token 轮转。`

Commit must pass `node tests/qa/commit-audit.mjs --message-file <draft>` before `git commit` (the commit-msg hook will re-run it). Use `pnpm exec commitlint --edit <file>` for a second check.

## Success criteria

The run is done when ALL of the following hold:

1. `.env.local` exists at `/private/tmp/ulw-demo/.env.local` populated with REAL values (libsql://tic-tac-toe-onepisya-onepisya.aws-us-east-1.turso.io + a 348-char JWT) written by the agent from `turso db show --url` + `turso db tokens create`. File is chmod 600, local-only, NOT in the commit diff (verified via `git show --stat HEAD` not listing `.env.local`). The committed template is `.env.example`; users bootstrap via `cp .env.example .env.local` per docs/local-turso-setup.md.
2. `git check-ignore -v .env.local` exits 0 and prints the `.gitignore:46` rule.
3. `lib/db.ts:41-42` reads both env vars (no code change required; just verified).
4. `docs/local-turso-setup.md` exists with all 8 required section headers and the placeholder DB name / region.
5. `README.md` §本地开发 and `docs/operations.md` §环境变量 each have a cross-link to `docs/local-turso-setup.md`.
6. `pnpm typecheck && pnpm lint && pnpm vitest run` all green.
7. Runtime smoke (DONE 2026-09-08 by agent): `pnpm build && pnpm start` (port 3000) + `curl /api/stats` GET -> PUT 1,1,0,0,1 -> GET 1,1,0,0,1 round-trip persists to real Turso db `tic-tac-toe-onepisya`; `turso db shell "SELECT * FROM game_stats;"` confirms the row; repeat PUT 2,2,0,0,2 -> GET 2,2,0,0,2 -> turso shell confirms idempotent overwrite. Evidence: .omx/evidence/local-turso-smoke/smoke-1..4.* and step-create-db.txt + step-show-url.txt + step-create-token.txt.
8. Single lore-protocol chore commit on `main` with subject `chore(docs): wire local Turso onboarding doc + cross-links`, body WHAT/WHY/HOW, footer `Plan: .omo/plans/turso-local-onboarding.md` and lore trailers; diff shows exactly 4 paths (README.md, docs/operations.md, docs/local-turso-setup.md, .omo/plans/turso-local-onboarding.md), zero others. Commit message draft at .omx/evidence/local-turso-smoke/commit-msg-draft.txt must pass `node tests/qa/commit-audit.mjs` AND `pnpm exec commitlint` before commit.
9. Final verification wave F1-F4 all PASS; all cleanup receipts recorded.
10. No leftover processes, ports, or temp files.

If any of 1-9 fails, the run is not done — iterate or surface to the user.
