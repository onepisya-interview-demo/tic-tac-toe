# Sub-plan: C5 — docs 同步（learnings + verification gauntlet）

> Master plan: [`.omo/plans/rsc-leaf-boundary-refactor.md`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.md)
> 分支: `refactor/rsc-c5-docs`
> 服务于并行子代理 #4（C1 / C2 / C3 / C5 同时启动；C4 串行）
> 工作量估算：XS（两个文档小改）

## Intent

把本轮 RSC 重构的设计理由记入 `docs/learnings.md`，把 store 解耦后的 mutation target 情况补到 `docs/verification-gauntlet.md`。≤ 30 行 + ≤ 5 行。

## 为什么

- 项目约定：非平凡提交后必须同步相关文档（[AGENTS.md §提交约定](/private/tmp/tic-tac-toe/AGENTS.md)）。
- 未来读 `docs/learnings.md` 的 agent/工程师可以快速看到"RSC 改 client 子树"的决策历史。
- `docs/verification-gauntlet.md` 是项目 Gauntlet 单一信息源；store.stats 解耦后，`lib/store.ts` 的 mutation 行为变化（少了 stats 相关分支）需要留个注释，下一个跑 Stryker 的人不会困惑。

## File changes

### 1. `docs/learnings.md`（追加一条）

在文末追加（保持与现有 entries 同样的中文 + 简短风格）：

```markdown

### N. RSC leaf boundary refactor（commit C1–C5）

将 3 个 page（`/`、`/play`、`/result`）从 `'use client'` 改为 async RSC；交互逻辑收敛到叶子 client 组件（`<StartGameButton>` / `<PlayController>` / `<ResultActions>` / `<ResultState>`）；`stats` 数据由 RSC `await loadStats()` 直读 `lib/db.ts`，`useGameStore` 不再持有 stats 字段。

决策记录：[`.omo/plans/rsc-leaf-boundary-refactor.md`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.md)（master） + 4 份 sub-plan。

收益：
- 首屏 HTML 含战绩（之前需 hydration 后 fetch）；
- `useRouter` / `useEffect` 不再被 page 直接 import，Next router glue 不再进首屏；
- store 类型干净（只剩 board/phase）。

反模式注意：
- 不要再把整个 page 改回 `'use client'`；新加交互请用叶子 client 组件。
- SoundToggle **不**上移到 layout（每 page header 留 slot；v0.2 用户决策）。
```

### 2. `docs/verification-gauntlet.md`（追加 mutation target 注释）

找到 store 解耦相关的段落，追加：

```markdown

> 2026-09-11 更新：`lib/store.ts` 在 RSC refactor C4 之后不再持有 `stats` 字段，mutation target 仍为 `lib/store.ts` 但内容已收缩（无 `hydrateStats`、无 stats set 分支）。如发现 mutation 得分变化，在本文件记录新基线。
```

## Acceptance criteria

- `docs/learnings.md` 文末新增 ≤ 30 行的 RSC refactor 条目。
- `docs/verification-gauntlet.md` 出现 2026-09-11 mutation target 注释。
- `node tests/qa/commit-audit.mjs --branch main` 0 violations（docs commit 也要过 audit）。

## Verification

```bash
pnpm typecheck        # docs 不影响 typecheck，应 exit 0
pnpm lint             # docs 不影响 lint，应 exit 0
pnpm vitest run       # 不影响 vitest，应 exit 0
pnpm build            # 不影响 build，应 exit 0
node tests/qa/commit-audit.mjs --branch main
```

附加：用 `rg -n "RSC leaf boundary" docs/learnings.md` 确认条目存在。

## Evidence 产物

落到 `.omx/evidence/rsc-leaf-boundary-refactor/c5/`：
- `commit-audit.log`
- `learnings-snapshot.md`（commit 后的 docs/learnings.md 摘录）
- `gauntlet-snapshot.md`（commit 后的 docs/verification-gauntlet.md 摘录）
- `rg-verify.txt`（`rg -n "RSC leaf boundary" docs/learnings.md` 输出）

## Commit 模板

```
docs(learnings): record RSC leaf boundary refactor + mutation target note

WHAT: docs/learnings.md 追加 RSC refactor 条目；docs/verification-gauntlet.md 追加 mutation target 注释。

WHY: 项目约定非平凡提交同步相关文档；未来读 learnings 的工程师需要看到本次重构的决策历史；verification-gauntlet 是 Gauntlet 单一信息源，store 解耦后 mutation target 注释需要更新。

HOW: 两个文档都做小追加，不动其他结构；rg 自验条目存在；commit-audit 0 violations。

Constraint: docs/learnings.md 追加 ≤ 30 行；docs/verification-gauntlet.md 追加 ≤ 5 行
Rejected: 重新组织 learnings 现有条目（本次只追加）
Confidence: 高（两份文档都简单追加）
Scope-risk: 极低（纯文档）
Directive: 6 层 Gauntlet + rg 自验
Tested: commit-audit + rg verify
Not-tested: docs 渲染（项目无 docs 渲染 CI）

Plan: .omo/plans/rsc-leaf-boundary-refactor.md
Sub-plan: .omo/plans/rsc-leaf-boundary-refactor-c5-docs.md
```

## 必须 Not have

- 不修改 learnings / gauntlet 现有条目（仅追加）。
- 不修改其他 docs 文件。
- 不引入新依赖。
- 不使用 `git commit --no-verify`。

