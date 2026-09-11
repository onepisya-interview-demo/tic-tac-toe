# audit-transitively-calls-commitlint - Work Plan

## TL;DR (For humans)

**What you'll get:** commit-audit.mjs（项目 commit 策略单一信源）在 `--message-file` 模式下、自身 R1-R5 全过之后，同步 spawn `pnpm exec commitlint --edit <message-file>` 作为第二检查点。hook（`.git/hooks/commit-msg`）仍只调 audit——commitlint 从"文档里说可以手动跑"变成"每次 commit 事实必跑"，规则闭环不增加任何 agent 负担。

**Why this approach:**
- 恢复事故（2026-09-12，`.omo/plans/recovery-from-unknown-cleanup.md`）重建 hook 时做了 audit-only 取舍：52204f2 Directive 指定 audit 为策略真源，且现行 AGENTS.md:200 只记载 audit 委托。但 commitlint.config.cjs 覆盖的 Conventional 标准件（type-enum 全集、header-max-length、body-min-length、subject-full-stop 等 config-conventional 内建规则）比 audit 的 R1-R5 正则宽，audit-only = commitlint 沦为死配置。
- 用户决策走方案 3：audit 间接必跑 commitlint。AGENTS.md:200 的"hook 调 audit"契约保持字节不动，52204f2 的"audit 是真源"Directive 也保持——commitlint 只是被串在 audit 通过之后，audit 仍先赢。

**What it will NOT do:**
- 不改 `.git/hooks/commit-msg`（单一 hook 入口不变）。
- 不改 `commitlint.config.cjs` 规则（它是被消费方）。
- 不改 AGENTS.md（行为契约未变：hook 仍只调 audit）。
- 不在 `--branch` 模式跑 commitlint（历史审计保持 R1-R5 口径，126+1=127 基线不受影响）。
- 不引入新 npm 依赖。

**Effort:** XS（单文件 ~20 行 + 1 个新测试文件）
**Risk:** Low——spawn 只发生在 audit 全过的路径上；commitlint 不可用时 fail-closed 并打印可诊断信息。

## 动机（latent 问题陈述）

1. commit-audit.mjs 不调 commitlint；commitlint.config.cjs 是 audit 的镜像 + config-conventional 标准件，无任何调用方（hook 不调、audit 不调、CI 不跑）。
2. AGENTS.md:200 把 commitlint 定位成"需要独立校验时使用"——AI agent 写 commit 不会主动跑。
3. 结果：commitlint 的全部规则（含 config-conventional 的 subject-full-stop / type-case / body-max-line-length 等审计正则没建模的规则）对每次 commit 实际不生效，两个系统静默漂移。

## 选项评估

| 选项 | 做法 | 代价 / 为何不选 |
| --- | --- | --- |
| A. 维持 audit-only | hook → audit | commitlint 永久死配置；两系统规则漂移无人发现。**现状即此，被用户否决** |
| B. 双 hook | hook → audit + commitlint 两条命令 | 违反 52204f2 Directive 与 AGENTS.md:200 的单一 hook 入口契约；hook 脚本重新承担策略编排；恢复事故中刚确立"hook 是薄壳、audit 是真源"的契约要被打破 |
| **C. audit 串 commitlint（选定）** | audit 在 `--message-file` 模式、R1-R5 全过后 spawn `pnpm exec commitlint --edit <file>` | AGENTS.md:200 字节不动；audit 保持真源地位（先 audit 后 commitlint，audit 赢）；代价是 audit 进程树多一个 ~1-2s 的子进程（只在 hook 路径，--branch 模式不受影响） |

## 设计要点

1. **模式门控**：spawn 块只存在于 `args.messageFile` 分支。`--branch` 模式审计历史 commits，不重跑 commitlint（历史消息由 R1-R5 口径管辖，127/127 基线不动）。
2. **顺序**：audit 自己的 findings 为空（R1-R5 全过）才 spawn commitlint——audit 是 canonical，先赢。
3. **同步阻塞**：`execFileSync`（已 import），hook 进程自然拿到 commitlint 的 exit code。
4. **输出透传**：`stdio: 'inherit'`——commitlint 失败时把具体 rule（如 `subject-full-stop`、`body-min-length`）直接打到 agent 终端；audit 随后补一行 FAIL 汇总指向上方输出。
5. **失败语义（fail-closed）**：commitlint 非零退出 → audit exit 1；spawn 本身失败（ENOENT 等，如 node_modules 缺失）→ 同样 exit 1，但打印区分性的诊断信息（"commitlint could not be executed"而非"commitlint rejected"）。fail-open 会让"间接必跑"的保证失效。
6. **cwd**：`process.cwd()`——git 以 repo root 为 cwd 调 hook，audit 由 hook 或人从 repo root 调用，路径一致。
7. **PASS 路径不变**：commitlint 静默通过（无输出）后，audit 打原有 `PASS <label> <subject>` 行、exit 0。

## 测试策略

audit.mjs 顶部 `main();` 直接执行且 `process.exit`——不可 import 级单测（会杀死 vitest 进程），不做侵入式重构（超出本任务范围）。选**子进程集成测试**：vitest 里 `execFileSync("node", ["tests/qa/commit-audit.mjs", "--message-file", <tmp>])`。

新增 `tests/qa/commit-audit.test.ts`（vitest include `**/*.test.ts` 会扫到；tsconfig strict 全量 typecheck，写干净 TS）：

- 用例 1：audit-pass + commitlint-pass 的消息 → exit 0，stdout 含 `PASS`
- 用例 2：audit-pass + commitlint-fail（subject 末尾句号——R1 只查前缀不查句号，audit 放行；config-conventional `subject-full-stop` 拦截）→ exit 非 0，stderr/stdout 含 commitlint 输出特征

fixture 注意：body 每行 ≤100 字符（config-conventional `body-max-line-length`），`fix:` 前缀 + 完整 WHAT/WHY/HOW + 四 trailer + Plan footer。测试 timeout 放宽到 30s（每次 spawn 链 ~2-4s）。

## 验证策略（七条门禁）

1. `pnpm vitest run`：91 → **93**（+2），0 fail
2. `pnpm typecheck` exit 0
3. `pnpm lint` exit 0（eslint ignore tests/qa/**，警告基线不新增）
4. `pnpm build` exit 0
5. `node tests/qa/commit-audit.mjs --branch main`：**127/127**（a74b44e 已计入，实测基线）
6. 构造消息双向验证：audit+commitlint 双过 → exit 0；audit 过 + commitlint 挂（句号 subject）→ exit 1 且输出 commitlint rule
7. 端到端：pass 消息走**真实 `git commit`**（即本 feature commit 本身）；fail 消息直接以 git 等价方式调 `.git/hooks/commit-msg <file>`（git 以 repo root cwd + $1=msgfile 调 hook，等价仿真），期望 exit 1 被拦截。不制造 throwaway commit（reset 不可用）

## Must-not-have

- 不动 `.git/hooks/commit-msg` / `AGENTS.md` / `commitlint.config.cjs`
- 不引入新依赖；不 `as any` / `@ts-ignore` / `@ts-expect-error`
- 不用 `--no-verify`；不做 history rewrite
- `--branch` 模式行为逐字节不变

## Rollback

单 commit revert 即回到 audit-only 现状；无数据/格式迁移。
