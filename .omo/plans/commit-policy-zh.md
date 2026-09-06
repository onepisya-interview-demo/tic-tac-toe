# 计划：feat/ux-polish 全量 commit message 中文化

意图：在已经合规的英文 commit 基础上，把 `feat/ux-polish` 上全部 14 条 commit message 改成中文（保留 Conventional 前缀以兼容工具链，正文 / trailer 值中文），同步更新 AGENTS.md 策略、审计脚本与 commit-msg 钩子以接纳中文，最后 GREEN：审计 0 违规 + bad 中文消息钩子拦截 + 备份可回放 + 全部回归通过。

## 范围

只动 `feat/ux-polish`。Conventional 前缀（feat/fix/chore/docs）保留英文以兼容 commit-as-prompt 工具；subject 描述部分用中文。body 与 lore trailer 值（Constraint/Rejected/Confidence/Scope-risk/Directive/Tested/Not-tested 之后的说明文字）改为中文，但 trailer 键名（`Constraint:` `Plan:` 等）保持英文，因为 commitlint 插件解析依赖键名。

## 改动清单

1. **AGENTS.md**：在 `## Commit convention` 节加 `### 中文 commit（branch-local 覆盖）` 子节，明确允许：
   - subject 用 `<type>(<scope>): <中文描述>`，例如 `feat(audio): 在胜利提示之上叠加欢呼`
   - body 用中文 prose，仍需 WHAT / WHY / HOW 三段
   - lore trailer 键名仍为英文（Constraint/Rejected/Confidence/Scope-risk/Directive/Tested/Not-tested/Plan），值可中文
   - `Plan:` 路径保持英文（仓库路径约定）

2. **`tests/qa/commit-audit.mjs`**：
   - `TYPE_RE` 改成允许 subject 中混入中文标点（`： ` `：` 后面接中文字符）
   - `WHY_RE` 加中文近义：因为 / 由于 / 为了 / 满足 / 修复 / 因为 / 用户要求 / 用户希望 / 满足 / 拒绝 / 风险
   - `HOW_RE` 加：通过 / 使用 / 验证 / 测试 / 钩子 / 脚本 / 命令 / 重写 / 备份
   - subject 长度上限保留 100 字符（中文按字符计）

3. **`commitlint.config.cjs`**：
   - `headerPattern` 允许 subject 中冒号后接中文
   - type-enum / body-min-length / trailer 规则保持

4. **14 条中文消息**：每条重写到 `/tmp/ulw-reword/<old_sha>.txt`，subject 前缀不变，描述部分中文，body 中文，trailer 值中文

5. **钩子**：`.git/hooks/commit-msg` 调 `tests/qa/commit-audit.mjs`，扩 audit 之后钩子自动支持中文，无需改钩子本身

## 重写矩阵

| 旧 SHA | 新 subject（中文） | 备注 |
| --- | --- | --- |
| cc049d0 | `chore: 初始化仓库并提交项目意图与 Next.js .gitignore` | 重写 |
| 5c4a33f | `feat: 上线井字棋游戏（App Router / Zustand / Drizzle+SQLite / 完整 Gauntlet）` | 重写 |
| a714771 | `feat(ux): 在已上线游戏之上叠加 UX 打磨` | 重写 |
| 0362e50 | `fix(audio): 修复音效开关 + 接入彩色胜利庆祝动画` | 重写 |
| 4e911d0 | `fix(audio): 阻止 SoundToggle 在水合时读取 localStorage` | 重写 |
| e45afaf | `feat(audio): 在胜利提示之上叠加合成欢呼声` | 重写 |
| 49d0473 | `fix(store): 客户端挂载时水合持久化战绩以便刷新 /result 看到历史` | 重写 |
| d639a0f | `chore(deps): 跟踪 Next.js 16.3 自动生成的 next-env.d.ts dev-types 路径` | 重写 |
| 2cc813d | `docs(plans): 归档胜利欢呼方案设计记录` | 重写 |
| 04ad66a | `docs(agents): 上线 Next.js 16 代理规则基线` | 重写 |
| 105aa1a | `docs(agents): 补充贡献指南与 commit-as-prompt 锚点` | 重写 |
| dff238d | `docs(agents): 扩展 commit 规范为完整 commit-as-prompt 规则` | 重写 |
| 52204f2 | `chore(repo): 安装 commitlint 策略与 commit-msg 钩子` | 重写 |
| 591415f | `chore(deps): 把 @commitlint/cli 与 config-conventional 锁定为 devDeps` | 重写 |

## 必须不做

- 不改运行时代码 `app/` `components/` `lib/` `tests/`
- 不删除备份 `.omx/backups/20260906T200533Z/`
- 不换工具链（保持 commitlint v21 + audit 脚本 + .git/hooks/commit-msg 三件套）
- 不删除 `Plan:` 路径（设计记录路径约定不动）

## 验证

- `node tests/qa/commit-audit.mjs` → 14/14 PASS（含中文 subject + body）
- `git commit --allow-empty -m "feat: 中文测试"` + 中文 body → exit=0；同命令缺 trailer → exit=1 带 R4/R5 规则名
- `pnpm vitest run` → 67/67；typecheck / lint / build → clean
- 4 个 QA 脚本（hydration-check / audio-probe / audio-cheer / audio-confetti-qa）→ PASS

## 最终 commit

`chore(repo): 中文化 feat/ux-polish 全量历史并扩展策略/钩子支持中文`

`Plan: .omo/plans/commit-policy-zh.md`
