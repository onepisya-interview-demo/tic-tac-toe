# Plan: BR ↔ 探针双向机械校验（commit-audit R6 + BR 表规范化）

> 调度者：`ulw` (2026-09-23)
> 基线：`dev @ 81ee7b9`
> 形态：审计工具增强 + 文档规范化（单卡）
> Tier：LIGHT（无新模块 / 无产品代码 / 无认证 / 无 schema / 遵循既有 R1-R5 模式）

## 一、意图块（Feature / Rule / Scenario + 反面场景）

**【意图块 / Intent Block】**

Feature：BR ↔ 探针双向机械校验——保证 `business-rules.md` BR 表引用的每个探针文件真实存在且头部反向引用 BR 编号

Rule：**流程约定非 BR**（不新增 BR-11）——理由：本任务是审计工具自身的闭环约束，不属于用户可见行为；user-facing BR-1..10 不变。BR 表新增一行「探针列格式约定」说明文档层契约。

  Scenario: BR-3 引用 `tests/qa/home-return-qa.mjs`（正向——什么时候发生）
    GIVEN `docs/business-rules.md` BR 表「探针」列写明 `tests/qa/home-return-qa.mjs`
    WHEN 跑 `node tests/qa/commit-audit.mjs --branch dev`
    THEN 该探针文件存在于仓库 + 文件首 20 行含 `BR-3` 文本，audit 0 violations

  Scenario: BR-3 引用不存在的路径（反面——什么时候不发生）
    GIVEN BR 表「探针」列引用 `tests/qa/does-not-exist.mjs`
    WHEN 跑 `--branch dev`
    THEN audit 报 R6 violation: `R6: BR-3: probe file not found: tests/qa/does-not-exist.mjs`，exit 1
    AND 不允许 commit-msg hook 放行（hook 调 audit）

  Scenario: 文件存在但头部漏 BR 引用（反面）
    GIVEN 探针文件存在但首 20 行不含 `BR-3`
    WHEN 跑 `--branch dev`
    THEN audit 报 R6 violation: `R6: BR-3: probe file tests/qa/home-return-qa.mjs header missing BR reference`，exit 1

  Scenario: 探针列含「⚠ 未探针化」（豁免路径）
    GIVEN BR 条目探针列明确标 `⚠ 未探针化`
    WHEN 跑 `--branch dev`
    THEN 该条目跳过 R6（缺探针由文档约束而非机械约束）

  Scenario: `--message-file` 模式单消息审计
    GIVEN 仅校验一条 commit message
    WHEN 跑 `commit-audit.mjs --message-file <f>`
    THEN R6 跳过（R6 是仓库状态检查，非单消息语义）

保持项：
- commit-audit R1-R5 现有逻辑与结构完全不动
- 既有 probe 执行代码（tests/qa/*.mjs 的 step 逻辑）完全不动
- business-rules.md 的 BR-1..10 规则语义完全不动（只规范探针列格式）
- commitlint 串联行为（--message-file 模式）保留
- dependabot 豁免（botAuthored）保留

## 二、intake 五维清单

| 维度 | 答 |
| --- | --- |
| **范围** | `tests/qa/commit-audit.mjs`（+ R6）+ `tests/qa/commit-audit.test.ts`（+ R6 测试）+ `docs/business-rules.md`（探针列规范化 + 格式约定）+ 被 BR 引用的探针/组件测试头（前 20 行内加 `// BR: ...`）。触及面 = 这四类。边界外：`src/` `app/` `components/*.tsx`（产品组件实现本身）`lib/` `db/` 任何产品代码、`package.json`、commitlint 配置。 |
| **深度** | 审计工具新增一条规则（R6）；探针文件元数据（头注释）非行为；business-rules.md 是 markdown 格式。契约影响：无（commit-msg hook 调用的 audit 公共 CLI 行为向后兼容——R6 是新增 FAIL 信号，不会让既有 PASS 变 FAIL；除非现有 dev 分支 BR 表引用的探针缺 BR 头注释，这种情况 §3 第 5 项验收会先暴露）。 |
| **形态** | 工具增强 + 文档规范化。提交形态：单笔原子提交（`feat(audit)`）。 |
| **边界** | 红线（§四）。绝对不动：R1-R5 既有语义；probe 执行代码；产品代码；`package.json`（不引入 cucumber / playwright-bdd）；commitlint 配置。 |
| **验收** | §三 六层门禁 + 负对照，全部机器可跑。 |

## 三、验收（六层门禁 + 负对照）

| # | 判据 | 命令 / 检查 |
| --- | --- | --- |
| 1 | vitest 全绿含新增 R6 测试 | `pnpm vitest run` exit 0 |
| 2 | typecheck exit 0 | `pnpm typecheck` exit 0 |
| 3 | lint exit 0 | `pnpm lint` exit 0 |
| 4 | build exit 0（走独立 git worktree 隔离 dev 服） | `git worktree add /tmp/<slug> HEAD` + `pnpm install` + `pnpm build` exit 0 |
| 5 | commit-audit --branch dev 0 violations | `node tests/qa/commit-audit.mjs --branch dev` exit 0 + 0 R6 FAIL |
| 6 | R6 负对照（mutation test） | (a) 临时改探针头去掉 `// BR: ...` 行 → R6 红；(b) 临时改 business-rules.md 引用不存在文件 → R6 红；(c) 恢复 → R6 绿。证据附交付报告 |

## 四、红线

- 不动 `commit-audit.mjs` R1-R5 既有逻辑与两模式（`--branch` / `--message-file`）结构
- 不动探针的执行逻辑（仅头部加注释行）
- 不动 business-rules.md 的 BR-1..10 规则语义（仅规范探针列格式）
- 不引入新依赖（`package.json` 零变更）
- 不动 src/、app/、components/*.tsx、lib/、db/、commitlint.config.cjs、vitest.config.ts
- 不 push；不 `--no-verify`；不 `git add . / -A`
- 已有未提交本地修改（`.gitignore`、`next-env.d.ts`）不触碰

## 五、词汇映射表

| 术语 | CONTEXT.md 映射 | 处置 |
| --- | --- | --- |
| 探针 / probe | `tests/qa/*.mjs` headless Playwright 断言脚本 | preferred（已有定义，§Language） |
| 业务规则 / BR | `docs/business-rules.md` BR-N 条目 | preferred |
| 双向机械校验 | 新词 | 局部词汇（仅本 plan） |
| R6 | 新词：commit-audit 第六条规则 | 局部词汇（仅本 plan + commit message） |
| ⚠ 未探针化 | 已存在（business-rules.md「维护约定」段） | preferred |

## 六、改动清单（按文件）

1. `.omo/plans/ulw-br-probe-binding-20260923.md` — 本档（计划首入档）
2. `docs/business-rules.md` — 探针列规范化（每个引用统一为反引号包裹的仓库根相对路径，BR-9 落地为具体文件）+ 表底「探针列格式约定」段
3. `tests/qa/commit-audit.mjs` — 新增 R6 规则（`auditBrProbeBinding(repoRoot)` 函数 + --branch 模式末尾调用；--message-file 模式跳过）
4. `tests/qa/commit-audit.test.ts` — 新增 R6 测试（happy + missing-file + missing-header + exempt 四场景）
5. 8 个探针/测试文件头加 `// BR: BR-N` 行（详见 §七）
6. 单笔原子提交 `feat(audit): BR ↔ 探针双向机械校验（R6）+ BR 表规范化`

## 七、探针头部 BR 注释映射（基于现状 BR 表引用）

| 文件 | BR 注释 |
| --- | --- |
| `tests/qa/home-return-qa.mjs` | `// BR: BR-1, BR-2, BR-3, BR-5` |
| `tests/qa/online-direct-qa.mjs` | `// BR: BR-2, BR-8` |
| `tests/qa/offline-qa.mjs` | `// BR: BR-4` |
| `tests/qa/offline-mode-qa.mjs` | `// BR: BR-4` |
| `tests/qa/merge-sync-qa.mjs` | `// BR: BR-5, BR-10` |
| `tests/qa/concurrent-surface-qa.mjs` | `// BR: BR-6` |
| `tests/qa/room-reset-qa.mjs` | `// BR: BR-7` |
| `components/HomeDialogMount.test.tsx` | `// BR: BR-1, BR-9` |

技术探针（`pwa-sw-cache-qa`、`hydration-check` 等）不强制。

## 八、最终验证 wave

- [ ] F1. `pnpm vitest run` exit 0（包含 R6 新测试）
- [ ] F2. `pnpm typecheck` exit 0
- [ ] F3. `pnpm lint` exit 0
- [ ] F4. 独立 worktree `pnpm build` exit 0
- [ ] F5. `node tests/qa/commit-audit.mjs --branch dev` exit 0 + 0 R6 FAIL
- [ ] F6. R6 负对照三场景（mutation test）通过：mutation → 红，恢复 → 绿
- [ ] F7. `git log --oneline -3` 显示本笔提交；`git status` 无未提交本地改动（除已有 .gitignore / next-env.d.ts）
- [ ] F8. `node .git/hooks/commit-msg` 自检或 commit-audit --message-file 自检通过（确认 R6 不破坏 --message-file 语义）

## 九、流程入口

执行起点 = 本 plan §六 改动清单 1→6 → §八 验收 → 单笔提交。
