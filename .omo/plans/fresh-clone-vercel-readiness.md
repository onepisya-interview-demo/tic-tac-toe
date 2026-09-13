# fresh-clone-vercel-readiness - Work Plan

## TL;DR (For humans)

**What you'll get:** A README and supporting docs that make the dual-mode DB contract obvious to a fresh cloner and a Vercel deployer. Local dev: clone -> install -> dev works with zero env vars (file: branch). Vercel deploy: same code, env vars in dashboard -> stats persist on Turso. After this commit, nobody has to rediscover that @libsql/client is a single library that handles both.

**Why this approach:** The codebase already implements the right design. `lib/db.ts:32-65` has a three-branch resolver that auto-falls-back to `file:./data/tic-tac-toe.db` when `DATABASE_URL` is unset, and `tests/db/db.test.ts:200-217` already locks the unset->file: branch. The only gap is discoverability: the README hints at it but doesn't lead with it, and there's no first-deploy recipe for Vercel. We prove the fresh-clone path with a runtime smoke, then write docs that say what the code already does.

**What it will NOT do:** Modify any product code, add npm deps, change schema or env-var names, rename the existing `docs/local-turso-setup.md`, do an actual Vercel deploy, or introduce new tests. The unset->file: branch is already covered by the existing test at line 200.

**Effort:** Short
**Risk:** Low - docs-only surface change backed by a runtime smoke; no production code touched.
**Decisions to sanity-check:** README §部署 uses `<your-db-name>` placeholders (public repo serves fresh cloners; the private db name `tic-tac-toe-onepisya` stays in `docs/local-turso-setup.md`); Vercel local-simulation recipe lives in README §部署, not a new doc; 4 standard troubleshooting scenarios (stats gone / fetch failed / 401-403 / build fails); ONE chore commit with `Plan:` footer.

Your next move: read this plan, approve at the gate, then run `$start-work fresh-clone-vercel-readiness` in a worker session to execute the 10 todos + F1-F4. Full execution detail follows below.

---

> TL;DR (machine): Short effort, Low risk. Verification-first docs slice. No code change to `lib/db.ts`; no new deps. Deliverables: fresh-clone smoke evidence + 5 doc edits + 1 chore commit. Single user-actionable phase = approval only.

## Amendment 2026-09-09 (Wave 1 discovery)

Wave 1's fresh-clone smoke FALSIFIED the plan premise "the codebase already implements the right design": with `DATABASE_URL` unset, `lib/db.ts` returned `file:<cwd>/data/tic-tac-toe.db` without creating the gitignored `data/` parent dir, so every `/api/stats` request failed with sqlite error 14 on a fresh clone (evidence: `.omx/evidence/fresh-clone-smoke/task-1-smoke.txt`; RED-first repro: `tests/db/db.test.ts` "default branch creates the missing data/ dir"). The plan is amended, with user-visible disclosure rather than silent override:

- Scope add: minimal fix in `lib/db.ts` (unset branch mirrors the existing `file:` branch's `mkdirSync` behavior) + RED-first regression test in `tests/db/db.test.ts`. No new deps, no env-var changes, no other file touched.
- Commit strategy becomes TWO atomic commits on main: 1) `fix(db)` with `lib/db.ts` + `tests/db/db.test.ts`, 2) `chore(docs)` with the original 6 doc/plan paths. Each independently green.
- F2/F4 diff baselines move from `HEAD~1` to `HEAD~2` (the chore commit is HEAD; the fix commit is HEAD~1).

## Scope
### Must have
- Fresh-clone runtime smoke captured: clean tmpdir, no env vars, `pnpm install` + `pnpm build && pnpm start`, full GET -> PUT -> GET -> DELETE round-trip on `/api/stats`, sqlite file materialized at `data/tic-tac-toe.db`, port 3000 freed. Evidence at `.omx/evidence/fresh-clone-smoke/`.
- `lib/db.ts` unset-DATABASE_URL branch creates the missing parent dir (same auto-create contract the explicit `file:` branch already documents), locked by a RED-first regression test.
- `README.md` Quick-start-for-newcomers section above the fold (clone -> install -> dev -> done, no env vars).
- `README.md` §本地开发 gets one explicit "no `.env.local` needed for local dev" sentence.
- `README.md` §部署 restructured into 4 subsections: 单机 / 本地, Vercel + Turso 首次部署 (with `<your-db-name>` placeholders + env var table + local-simulation recipe), Vercel 排错 (4 standard scenarios), 生产 vs 开发的数据库选择.
- `.env.example` top comment rewritten to make the unset->file: fallback explicit.
- `CONTRIBUTING.md` Quick-start mentions `.env.example` and the no-env-vars path; links to `docs/operations.md §环境变量`.
- `docs/operations.md §部署` trimmed/aligned to point at the new README structure; the Vercel-must-set-env-vars callout is preserved.
- `docs/local-turso-setup.md` gets one explicit cross-link to `README.md §部署`.
- `pnpm typecheck && pnpm lint && pnpm vitest run` all green after the doc changes.
- Single lore-protocol commit with subject `chore(docs): make fresh-clone + Vercel deploy paths discoverable`, body WHAT/WHY/HOW, footer `Plan: .omo/plans/fresh-clone-vercel-readiness.md` + lore trailers.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Code change to `app/api/stats/route.ts`, `db/schema.ts`, `package.json`, `next.config.ts`, `vercel.json`. (`lib/db.ts` was banned pre-amendment; the Wave 1 smoke falsified the premise — see Amendment 2026-09-09. Only the unset-branch mkdir fix is allowed, nothing else in the file.)
- New npm dependencies.
- New env var names. The contract stays `DATABASE_URL` + `DATABASE_AUTH_TOKEN`.
- New test cases (existing `tests/db/db.test.ts:200` covers unset->file:).
- CI workflow changes (`.github/workflows/*`).
- `git commit --no-verify`, `git add -A`, force-add of `.env.local`, or staging anything outside the diff below.
- Doc translation, renaming of existing files, or restructuring outside the listed sections.
- Actual Vercel deploy, Vercel CLI install, multi-region Turso setup, backup/restore docs, expiring-token policy.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none (no new test cases; existing `tests/db/db.test.ts:200-217` already locks unset->file:).
- Evidence: `.omx/evidence/fresh-clone-smoke/` (runtime smoke + grep receipts), `.omx/evidence/fresh-clone-smoke/task-N-*.txt` for each todo.
- Channel: real-surface proof through `curl /api/stats` GET/PUT/GET/DELETE round-trip from a clean tmpdir; static checks via `pnpm typecheck && pnpm lint && pnpm vitest run`.
- Cleanup: every spawned `pnpm start` background process must be killed and `lsof -i :3000` empty before the run ends.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

Wave 1 (Verification, must precede doc edits — claims need evidence):
  - W1.1: Fresh-clone smoke in clean tmpdir (no env vars, full round-trip, db file materialized, port freed)

Wave 2 (Doc edits, all parallel — no dependency between doc files):
  - W2.1: `README.md` Quick-start-for-newcomers section
  - W2.2: `README.md` §本地开发 add no-env-needed sentence
  - W2.3: `README.md` §部署 restructure (4 subsections)
  - W2.4: `.env.example` rewrite top comment
  - W2.5: `CONTRIBUTING.md` Quick-start update
  - W2.6: `docs/operations.md §部署` alignment
  - W2.7: `docs/local-turso-setup.md` cross-link to README §部署

Wave 3 (Commit gate, depends on Wave 1 + Wave 2):
  - W3.1: Static re-verify (`pnpm typecheck && pnpm lint && pnpm vitest run`)
  - W3.2: Single lore-protocol chore commit with `Plan:` footer

Final verification wave F1-F4 runs in parallel after W3.2.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| W1.1 smoke | nothing | W3.1 | nothing (verification gate) |
| W2.1 README quick-start | W1.1 | W3.2 | W2.2, W2.3, W2.4, W2.5, W2.6, W2.7 |
| W2.2 README 本地开发 | W1.1 | W3.2 | W2.1, W2.3, W2.4, W2.5, W2.6, W2.7 |
| W2.3 README §部署 | W1.1 | W3.2 | W2.1, W2.2, W2.4, W2.5, W2.6, W2.7 |
| W2.4 .env.example | W1.1 | W3.2 | W2.1, W2.2, W2.3, W2.5, W2.6, W2.7 |
| W2.5 CONTRIBUTING | W1.1 | W3.2 | W2.1, W2.2, W2.3, W2.4, W2.6, W2.7 |
| W2.6 operations.md | W1.1 | W3.2 | W2.1, W2.2, W2.3, W2.4, W2.5, W2.7 |
| W2.7 local-turso-setup cross-link | W1.1 | W3.2 | W2.1, W2.2, W2.3, W2.4, W2.5, W2.6 |
| W3.1 static re-verify | W2.1..W2.7 | W3.2 | nothing |
| W3.2 commit | W3.1 | F1, F2, F3, F4 | nothing |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Fresh-clone runtime smoke in clean tmpdir
  What to do / Must NOT do: `mktemp -d`, `cp -R <本地演示目录>/. <tmpdir>` (or `git clone --depth 1`), `cd <tmpdir>`, `rm -f .env.local`, `unset DATABASE_URL DATABASE_AUTH_TOKEN` in the shell. `pnpm install --frozen-lockfile`. `pnpm build && pnpm start` in background, capture pid. Poll `curl -fsS http://localhost:3000/api/stats` until 200 (up to 60s). Run GET (expect zeros), PUT `{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}` (expect 200), GET again (expect 1,1,0,0,1), DELETE (expect zeros). Verify `[ -f data/tic-tac-toe.db ]`. Kill pnpm-start pid, `kill -0 <pid>` must fail, `lsof -i :3000` empty. Do NOT use `--no-verify` flags. Do NOT touch any source file in this task. Do NOT skip the kill cleanup. Do NOT skip the port-release verification.
  Parallelization: Wave 1 | Blocked by: nothing | Blocks: 2, 3, 4, 5, 6, 7, 8, 9, 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/lib/db.ts:32-65 (three-branch resolver); <本地演示目录>/lib/db.ts:81-93 (CREATE TABLE bootstrap); <本地演示目录>/app/api/stats/route.ts (handler shape for GET/PUT/DELETE); <本地演示目录>/lib/game.ts (GameStats type shape for PUT body); <本地演示目录>/package.json (scripts: build, start, typecheck, lint, test)
  Acceptance criteria (agent-executable): tmpdir path recorded; GET/PUT/GET/DELETE all return expected bodies; `data/tic-tac-toe.db` exists after the smoke; `lsof -i :3000` is empty after the kill.
  QA scenarios (name the exact tool + invocation): happy: `curl -fsS http://localhost:3000/api/stats` returns `{"totalGames":0,...}` on first call and `{"totalGames":1,"xWins":1,...}` after PUT; failure: any non-200 from /api/stats or missing db file fails this task. Evidence: `.omx/evidence/fresh-clone-smoke/task-1-smoke.txt`
  Commit: N | (evidence only; rolled into final commit at task 10)

- [x] 2. README.md Quick-start-for-newcomers section + 适用 blockquote at top
  What to do / Must NOT do: (a) Insert a new top-level section (suggested `## Quick start`, before the table of contents / install instructions). 4 numbered lines: clone, install, dev, done. Explicitly say "no `.env.local` needed for local dev" and "stats persist to a local sqlite file at `data/tic-tac-toe.db`". (b) ALSO insert a `> 适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。` blockquote (matching the format at docs/local-turso-setup.md:5) right after the `# 井字棋 (tic-tac-toe)` title, before the badges paragraph, so the version contract is the first thing a cloner reads. Do NOT add emoji icons. Do NOT touch the Features list. Do NOT touch the install / usage sections below.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/README.md:1-30 (current top-of-file structure to preserve); <本地演示目录>/README.md:42-51 (existing §本地开发 to keep aligned); <本地演示目录>/docs/local-turso-setup.md:5 (the 适用 blockquote format to mirror — node v24.20.0, pnpm 10.10.0, turso CLI v1.0.32 confirmed by user on 2026-09-08, all satisfy the ≥ bounds)
  Acceptance criteria (agent-executable): `grep -c '^## Quick start' <本地演示目录>/README.md` returns 1; `awk '/^## Quick start/,/^## /' <本地演示目录>/README.md | grep -c 'env.local'` >= 1; `grep -F '适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100' <本地演示目录>/README.md` >= 1 (the 适用 blockquote is the first content after the title, byte-identical to docs/local-turso-setup.md:5).
  QA scenarios: happy: grep returns 1 for the header; the captured section contains "no `.env.local` needed" or equivalent Chinese phrase; the 适用 blockquote in README is byte-identical to the docs/local-turso-setup.md:5 version. Evidence: `.omx/evidence/fresh-clone-smoke/task-2-readme-quickstart.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 3. README.md §本地开发 add explicit "no .env.local needed" sentence
  What to do / Must NOT do: Inside the existing `## 本地开发` section (README.md:42-51), insert ONE sentence after the `默认 DATABASE_URL=file:./data/tic-tac-toe.db` line: "**首次 clone 后不需要建 `.env.local`** — `lib/db.ts` 默认走 `file:./data/tic-tac-toe.db` 嵌入式 sqlite（`@libsql/client` 自带）。`.env.example` 仅在你切到 Turso 或自定义路径时才需要复制。" Do NOT rewrite the rest of §本地开发. Do NOT add emoji. Do NOT touch §部署 in this task.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/README.md:42-51 (target section); <本地演示目录>/lib/db.ts:47-49 (the unset->file: branch being documented)
  Acceptance criteria (agent-executable): `awk '/^## 本地开发/,/^## /' <本地演示目录>/README.md | grep -c '不需要建'` >= 1.
  QA scenarios: happy: grep returns 1+ for the new sentence inside §本地开发. Evidence: `.omx/evidence/fresh-clone-smoke/task-3-readme-local.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 4. README.md §部署 restructure into 4 subsections
  What to do / Must NOT do: Replace the existing `## 部署` content (currently README.md:124-144) with 4 `###` subsections: 单机 / 本地 (preserve existing), Vercel + Turso 首次部署 (use `<your-db-name>` placeholder; add env var table with `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; add "在 Vercel Dashboard 配 env vars BEFORE 第一次 push" callout; add "在推 Vercel 之前先本地模拟" recipe: 把 env vars 复制到 .env.local, pnpm build && pnpm start, curl /api/stats, 通过再 push), Vercel 排错 (4 standard scenarios: stats gone / fetch failed / 401-403 / build fails, each 2-4 lines), 生产 vs 开发的数据库选择 (1 paragraph: "本仓库代码同一份 `lib/db.ts` 同时支持两种部署形态..."). Do NOT add emoji. Do NOT include the specific `tic-tac-toe-onepisya` db name in the public README. Do NOT include any real Turso token or URL.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/README.md:124-144 (current §部署 to replace); <本地演示目录>/lib/db.ts:47-65 (URL scheme contract being documented); <本地演示目录>/.env.example (env var table source of truth)
  Acceptance criteria (agent-executable): `grep -c '^### Vercel + Turso' <本地演示目录>/README.md` returns 1; `grep -c '^### Vercel 排错' <本地演示目录>/README.md` returns 1; `grep -c '<your-db-name>' <本地演示目录>/README.md` >= 1; `grep -c 'tic-tac-toe-onepisya' <本地演示目录>/README.md` returns 0 (public repo uses placeholders).
  QA scenarios: happy: all four grep checks pass. failure: any specific private db name appearing in the public README fails this task. Evidence: `.omx/evidence/fresh-clone-smoke/task-4-readme-deploy.txt`
  Commit: N | (rolled into final commit at task 10)
- [x] 5. .env.example rewrite top comment to make unset->file: explicit
  What to do / Must NOT do: Replace the current top comment block with: "本文件是 `.env.local` 的模板，会 committed 进 git 但不会泄漏任何 secret。本地开发**不需要**复制 `.env.local` — `lib/db.ts` 在 `DATABASE_URL` 未设时 fallback 到 `file:./data/tic-tac-toe.db`（`@libsql/client` 自带嵌入式 sqlite）。复制本文件并填值只在你需要 (a) 自定义本地 db 路径 或 (b) 联调 Turso HTTP 远程库 时才有意义。". Preserve the existing `DATABASE_URL=file:./data/tic-tac-toe.db` line and the `DATABASE_AUTH_TOKEN` comment block. Do NOT remove the placeholder values. Do NOT change the env var names.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/.env.example (current file); <本地演示目录>/lib/db.ts:47-49 (the fallback being documented)
  Acceptance criteria (agent-executable): `grep -c '不需要' <本地演示目录>/.env.example` >= 1; `grep -c '^DATABASE_URL=file:' <本地演示目录>/.env.example` returns 1 (placeholder preserved); `grep -c '^# DATABASE_AUTH_TOKEN' <本地演示目录>/.env.example` returns 1.
  QA scenarios: happy: all grep checks pass. Evidence: `.omx/evidence/fresh-clone-smoke/task-5-env-example.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 6. CONTRIBUTING.md Quick-start update
  What to do / Must NOT do: After the existing `pnpm install && pnpm dev` block, add one line: "无需配置 `.env.local` — `lib/db.ts` 默认走本地 sqlite（`@libsql/client` 嵌入式）。完整 env-var 契约见 [docs/operations.md §环境变量](docs/operations.md#环境变量)。". Do NOT rewrite the existing commands. Do NOT add emoji. Do NOT touch the verification gate section.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/CONTRIBUTING.md:8-19 (target section); <本地演示目录>/docs/operations.md (link target)
  Acceptance criteria (agent-executable): `grep -c '无需配置' <本地演示目录>/CONTRIBUTING.md` >= 1; `grep -c 'docs/operations.md#环境变量' <本地演示目录>/CONTRIBUTING.md` returns 1.
  QA scenarios: happy: both grep checks pass. Evidence: `.omx/evidence/fresh-clone-smoke/task-6-contributing.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 7. docs/operations.md §部署 alignment + §环境变量 适用 triplet
  What to do / Must NOT do: (a) Replace the current §部署 content (docs/operations.md:50-58) with: "本机: 见 [README §单机 / 本地](README.md#部署). Vercel + Turso: 见 [README §部署](README.md#部署). **前置**: `lib/db.ts` 在 `DATABASE_URL` 未设时走 `file:` 本地 sqlite；Vercel 必须设 `DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`，否则容器 fs 是临时的、重启即丢。". (b) ALSO augment §环境变量 (line 7) so the version prerequisites list becomes the full triplet: "pnpm ≥ 10、包管理、Node.js ≥ 20、Turso CLI ≥ 0.100、Playwright 浏览器 (`pnpm exec playwright install`)" — i.e. add `pnpm ≥ 10` and `Turso CLI ≥ 0.100` next to the existing `Node.js ≥ 20`. Do NOT touch other sections. Do NOT add emoji. Do NOT remove the existing Playwright line.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/docs/operations.md:7 (the §环境变量 prerequisite list to augment); <本地演示目录>/docs/operations.md:50-58 (target §部署 section); <本地演示目录>/README.md §部署 (link target); <本地演示目录>/docs/local-turso-setup.md:5 (reference 适用 blockquote format)
  Acceptance criteria (agent-executable): `awk '/^## 部署/,/^## /' <本地演示目录>/docs/operations.md | grep -c 'README.md#部署'` >= 1; `awk '/^## 部署/,/^## /' <本地演示目录>/docs/operations.md | grep -c 'DATABASE_URL'` >= 1; `grep -c 'pnpm ≥ 10' <本地演示目录>/docs/operations.md` >= 1; `grep -c 'Turso CLI ≥ 0.100' <本地演示目录>/docs/operations.md` >= 1; the original `Node.js ≥ 20` line is preserved (`grep -c 'Node.js ≥ 20' <本地演示目录>/docs/operations.md` >= 1).
  QA scenarios: happy: all five grep checks pass; the original §环境变量 prerequisite list now reads the full triplet (Node ≥ 20, pnpm ≥ 10, Turso CLI ≥ 0.100, Playwright). Evidence: `.omx/evidence/fresh-clone-smoke/task-7-operations.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 8. docs/local-turso-setup.md cross-link + 适用 blockquote preserved
  What to do / Must NOT do: Near the top of `docs/local-turso-setup.md` (after the existing "Vercel 部署走的是同一条线路但配环境变量的地方不同" sentence at line 1-3), add one line: "→ Vercel 部署详见 [README §部署](README.md#部署)。". PRESERVE the existing `> 适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。` blockquote at line 5 byte-identical (this is the source of truth for the README/operations.md 适用 triplet — do NOT rephrase, do NOT move, do NOT add emoji). Do NOT touch other sections. Do NOT touch the `turso` CLI commands. Do NOT remove any existing content.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/docs/local-turso-setup.md:1-3 (insertion point); <本地演示目录>/docs/local-turso-setup.md:5 (适用 blockquote source of truth, byte-identical preservation required); <本地演示目录>/README.md §部署 (link target)
  Acceptance criteria (agent-executable): `head -10 <本地演示目录>/docs/local-turso-setup.md | grep -c 'README.md#部署'` >= 1; the original "Vercel 部署走的是同一条线路但配环境变量的地方不同" line is still present (`grep -c 'Vercel 部署走的是同一条线路' <本地演示目录>/docs/local-turso-setup.md` returns 1); the 适用 blockquote is byte-identical to its pre-edit form (`grep -F '适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。' <本地演示目录>/docs/local-turso-setup.md` returns 1, AND `git diff HEAD -- docs/local-turso-setup.md | grep -c '^[+-]'` for line 5 only shows the cross-link insertion, NOT a 适用 rephrasing).
  QA scenarios: happy: all three grep checks pass; 适用 blockquote remains byte-identical; cross-link insertion is line-isolated. Evidence: `.omx/evidence/fresh-clone-smoke/task-8-local-turso-xref.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 9. Static re-verify: pnpm typecheck && pnpm lint && pnpm vitest run
  What to do / Must NOT do: Run all three commands sequentially from <本地演示目录>. All must exit 0. Do NOT modify tests, package.json, or build config to make things pass. Do NOT use `--no-verify` or any flag that bypasses checks.
  Parallelization: Wave 3 | Blocked by: 2, 3, 4, 5, 6, 7, 8 | Blocks: 10
  References (executor has NO interview context - be exhaustive): <本地演示目录>/package.json (scripts: typecheck, lint, test); <本地演示目录>/vitest.config.ts (thresholds)
  Acceptance criteria (agent-executable): `pnpm typecheck` exits 0; `pnpm lint` exits 0; `pnpm vitest run` exits 0; combined exit code is 0.
  QA scenarios: happy: `pnpm typecheck && pnpm lint && pnpm vitest run; echo "combined=$?"` shows combined=0. failure: any non-zero exit fails this task. Evidence: `.omx/evidence/fresh-clone-smoke/task-9-static.txt`
  Commit: N | (rolled into final commit at task 10)

- [x] 10. Single lore-protocol chore commit with Plan footer
  What to do / Must NOT do: `git add` ONLY these 6 paths: `README.md`, `.env.example`, `CONTRIBUTING.md`, `docs/operations.md`, `docs/local-turso-setup.md`, `.omo/plans/fresh-clone-vercel-readiness.md`. Verify with `git status -s` before commit — only those 6 paths should appear. Do NOT add `.env.local` (it is gitignored and must STAY local). Do NOT use `git commit --no-verify`. Do NOT use `git add -A`. Do NOT commit secrets (sanity: `grep -E 'eyJ[A-Za-z0-9_-]{20,}' .env.local` returns 0). Subject: `chore(docs): make fresh-clone + Vercel deploy paths discoverable`. Body: WHAT / WHY / HOW three sections. Footer: `Plan: .omo/plans/fresh-clone-vercel-readiness.md` plus lore trailers (`Confidence: high`, `Scope-risk: narrow`, `Constraint:`, `Directive:`, `Tested:`, `Not-tested:`). Run `node tests/qa/commit-audit.mjs --message-file <draft>` BEFORE committing to verify the hook will pass.
  Parallelization: Wave 3 | Blocked by: 9 | Blocks: F1, F2, F3, F4
  References (executor has NO interview context - be exhaustive): <本地演示目录>/.git/hooks/commit-msg (calls tests/qa/commit-audit.mjs); <本地演示目录>/tests/qa/commit-audit.mjs (the audit script); <本地演示目录>/commitlint.config.cjs (subject rules); <本地演示目录>/.gitignore:45-50 (confirms .env.local stays local); <本地演示目录>/.omo/plans/fresh-clone-vercel-readiness.md (the Plan: footer target)
  Acceptance criteria (agent-executable): `git log -1 --format='%s'` starts with `chore(docs): make fresh-clone`. Body contains WHAT / WHY / HOW headings. Footer contains `Plan: .omo/plans/fresh-clone-vercel-readiness.md` and `Confidence: high`. `git show --stat HEAD` shows exactly 6 paths. `grep -c 'Confidence: high' <(git log -1 --format='%B')` returns 1.
  QA scenarios: happy: `git log -1 --format='%s%n---%n%b' | head -50` shows expected subject + body + footer. failure: commit-msg hook rejection fails this task — pre-flight with `node tests/qa/commit-audit.mjs --message-file <draft>` first. Evidence: `.omx/evidence/fresh-clone-smoke/task-10-commit.txt`
  Commit: Y | chore(docs): make fresh-clone + Vercel deploy paths discoverable

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
  What to do: Re-read the plan file vs the actual diff. Every Must-have scope item has a corresponding change in the diff. Every Must-NOT-have item is absent.
  Acceptance: `git show --stat HEAD` shows exactly the 6 paths listed in task 10; no other paths appear. `grep -c 'tic-tac-toe-onepisya' README.md` returns 0 (public repo hygiene).
  Evidence: `.omx/evidence/fresh-clone-smoke/F1-plan-compliance.txt`
- [x] F2. Code quality review
  What to do: Run `pnpm typecheck && pnpm lint && pnpm vitest run` once more after commit. Run `git diff HEAD~1 -- lib/ app/ db/ package.json next.config.ts vercel.json` and confirm it is empty (no accidental edits to the must-NOT-touch files).
  Acceptance: combined exit 0; the diff above is empty.
  Evidence: `.omx/evidence/fresh-clone-smoke/F2-quality.txt`
- [x] F3. Real manual QA
  What to do: After commit, re-run the fresh-clone smoke ONCE more from a clean tmpdir, to prove the committed state still works. Capture full GET/PUT/GET/DELETE output.
  Acceptance: round-trip succeeds; `data/tic-tac-toe.db` is materialized; port 3000 freed.
  Evidence: `.omx/evidence/fresh-clone-smoke/F3-real-qa.txt` + `.omx/evidence/fresh-clone-smoke/F3-cleanup.txt`
- [x] F4. Scope fidelity
  What to do: Confirm `.env.local` is gitignored (re-run `git check-ignore -v .env.local`) AND that the public README uses `<your-db-name>` placeholders (not the specific `tic-tac-toe-onepisya`). Confirm `lib/db.ts` is byte-identical to HEAD~1.
  Acceptance: gitignore check exits 0; `grep -c '<your-db-name>' README.md` >= 1; `git diff HEAD~1 -- lib/db.ts` is empty.
  Evidence: `.omx/evidence/fresh-clone-smoke/F4-scope.txt`

## Commit strategy

Single lore-protocol commit. Diff contains exactly 6 paths: `README.md` (modified, ~+33 lines: 适用 blockquote at top + Quick-start + 本地开发 sentence + §部署 restructure), `.env.example` (modified, ~+1 paragraph: top comment rewrite), `CONTRIBUTING.md` (modified, ~+1 line: no-env-needed callout), `docs/operations.md` (modified, ~+5 lines: §部署 alignment + §环境变量 适用 triplet augmentation), `docs/local-turso-setup.md` (modified, ~+1 line: README §部署 cross-link; 适用 blockquote byte-identical), `.omo/plans/fresh-clone-vercel-readiness.md` (new, ~300 lines: this plan).

The 适用 triplet (Node.js ≥ 20, pnpm ≥ 10, Turso CLI ≥ 0.100) is byte-identical across `README.md`, `docs/operations.md §环境变量`, and `docs/local-turso-setup.md:5` — they all source from the same one-line blockquote. Any reviewer can run `grep -F '适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。' README.md docs/operations.md docs/local-turso-setup.md` to confirm.

`.env.local` stays local and is NOT staged. The committed template is `.env.example`; users bootstrap via `cp .env.example .env.local` if they need to override.

Subject: `chore(docs): make fresh-clone + Vercel deploy paths discoverable`. Body uses WHAT / WHY / HOW prose (matches project style per AGENTS.md §提交约定). Footer trailers (English keys, may have Chinese values):

- `Plan: .omo/plans/fresh-clone-vercel-readiness.md`
- `Confidence: high`
- `Scope-risk: narrow`
- `Constraint: 本仓库已有完整双模契约（lib/db.ts 三路 resolver + tests/db/db.test.ts:200 单测覆盖 unset->file:），本期不引入代码改动，文档必须把这条契约首次可见地写出来。`
- `Rejected: 新增 README "Architecture" 章节展开双模解释 | 与本期"让首次 clone 的人不需要理解架构就能跑"目标冲突。`
- `Directive: 后续维护者若修改 lib/db.ts 的分支顺序或新增分支，必须同步更新 README §部署"生产 vs 开发的数据库选择"段，否则这条契约会静默腐烂。`
- `Tested: pnpm typecheck && pnpm lint && pnpm vitest run（前后两遍，commit 前 + commit 后）; fresh-clone smoke（commit 前在 tmpdir 跑 + F3 在 commit 后再跑一次）。`
- `Not-tested: 真实 Vercel 部署（用户明确排除本期）; multi-region Turso; expiring token 轮转; backup/restore。`

Commit must pass `node tests/qa/commit-audit.mjs --message-file <draft>` before `git commit` (the commit-msg hook will re-run it). Use `pnpm exec commitlint --edit <file>` for a second check.

## Success criteria

The run is done when ALL of the following hold:

1. Fresh-clone runtime smoke captured at `.omx/evidence/fresh-clone-smoke/task-1-smoke.txt` and F3's re-run: clean tmpdir, no env vars, `pnpm install --frozen-lockfile` + `pnpm build && pnpm start` (port 3000) + `curl /api/stats` GET -> PUT -> GET -> DELETE round-trip succeeds; `data/tic-tac-toe.db` materializes; `lsof -i :3000` empty after kill.
2. `README.md` has the new Quick-start section above the fold, an explicit "no `.env.local` needed" sentence in §本地开发, and 4 restructured subsections under §部署 (单机 / 本地, Vercel + Turso 首次部署, Vercel 排错, 生产 vs 开发的数据库选择).
3. README §部署 uses `<your-db-name>` placeholders, NOT the specific `tic-tac-toe-onepisya` (verified by `grep -c 'tic-tac-toe-onepisya' README.md` == 0).
4. `.env.example` top comment explicitly says "本地开发不需要复制 .env.local" with the unset->file: fallback explanation.
5. `CONTRIBUTING.md` Quick-start mentions no `.env.local` needed and links to `docs/operations.md §环境变量`.
6. `docs/operations.md §部署` trimmed to point at README §部署; the "Vercel 必须设 DATABASE_URL+TOKEN 否则重启即丢" callout preserved.
7. `docs/local-turso-setup.md` has a one-line cross-link to `README.md §部署`; the original "Vercel 部署走的是同一条线路但配环境变量的地方不同" sentence still present.
8. `pnpm typecheck && pnpm lint && pnpm vitest run` all green, both pre-commit and post-commit.
9. Single lore-protocol chore commit on `main` with subject `chore(docs): make fresh-clone + Vercel deploy paths discoverable`, body WHAT/WHY/HOW, footer `Plan: .omo/plans/fresh-clone-vercel-readiness.md` and lore trailers; diff shows exactly 6 paths, zero others. Commit message draft passes both `node tests/qa/commit-audit.mjs` AND `pnpm exec commitlint` before commit.
10. Final verification wave F1-F4 all PASS; all cleanup receipts recorded.
11. No leftover processes, ports, or temp files.
12. 适用 triplet (`Node.js ≥ 20, pnpm ≥ 10, Turso CLI ≥ 0.100`) appears in (a) `README.md` (new 适用 blockquote at top), (b) `docs/operations.md §环境变量` (augmented prerequisite list), AND (c) `docs/local-turso-setup.md:5` (byte-identical preservation). One `grep -F '适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。' <file>` per file returns >= 1; the doc/local-turso-setup.md version is byte-identical to its pre-edit form (verified by `git diff HEAD~1 -- docs/local-turso-setup.md` showing ONLY the cross-link insertion, no other line changes inside the 适用 region).

If any of 1-12 fails, the run is not done — iterate or surface to the user.
