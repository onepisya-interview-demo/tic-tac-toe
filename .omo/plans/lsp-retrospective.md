# LSP 配置复盘文档（设计记录）

**类型：** docs(lsp)
**范围：** 新增 `docs/lsp-setup-retrospective.md` 与本 plan 文件
**生成时间：** 2026-09-12
**对应提交：** footer `Plan:` 指向本文件

## 决策

新增 `docs/lsp-setup-retrospective.md` 作为 LSP 配置三次演进的「单一事实源」
（single source of truth），把三次 commit（`fe892fb` → `b146e50` → `566745f`）
的机制、被否决理由、Plan 间冲突与被证伪声明、坑清单、SOP 一次性写齐；同时
新建本 plan 文件作为该 docs 提交的设计记录。

不修改任何代码 / 配置文件 / 现有 plan / 现有 commit message；不重写
`.codex/lsp-client.json`、AGENTS.md、`.github/copilot-instructions.md`——这
些文档在 `566745f` 时已与可移植形态同步到位。

## 背景

`.codex/lsp-client.json` 在 2026-09-12 同一天内经历三次方案演进（`fe892fb`
03:33 → `b146e50` 04:57 → `566745f` 05:39，全部为同一作者），三个 plan 文件
之间存在被后续实证证伪或互相矛盾的声明（详见 `docs/lsp-setup-retrospective.md`
§3）。未来读者若只读其中一个 plan，极易得到错误心智模型：

- 读 `lsp-project-local-setup.md` → 以为 engine 会自动解析 `node_modules/.bin/`
  （已被 4.19.4 dist 行 3874-3876 证伪）。
- 读 `lsp-revert-to-global.md` → 以为 workspace 解析已被否决、必须 pin hash
  路径（已被 `566745f` 重新采纳）。
- 读 `lsp-client-portable-config.md` → 只能看到当前正确状态，看不到为何之前
  走错以及如何避免重蹈覆辙。

沉淀文档的目标是把「为什么会走到这里」与「怎么继续走」合并到一份可独立
阅读的工程文档里，避免知识散落在三个互相冲突的 plan 中。

## 引用

- **commit `566745f`** — 当前状态：`.codex/lsp-client.json` 最小形态（仅
  `priority`）；删除 typescript entry 的 `initialization.tsserver.path` 含 vp
  install hash 的绝对路径。Plan: `.omo/plans/lsp-client-portable-config.md`。
- **commit `b146e50`** — 中间态：vp 全局 + `tsserver.path` 含 install hash
  的绝对路径。Plan: `.omo/plans/lsp-revert-to-global.md`。
- **commit `fe892fb`** — 最初态：项目本地 devDep，三个 server + typescript 
  同装到 `.pnpm/` 共享依赖树。Plan: `.omo/plans/lsp-project-local-setup.md`。
- **omo 4.19.4 dist 源码**：`~/.codex/plugins/cache/sisyphuslabs/omo/4.19.4/
  components/lsp/dist/cli.js`。docs §1.2 / §1.4 引用：
  - 行 3683-3698 `BUILTIN_SERVERS`（typescrypt / bash / yaml-ls 三个 id）
  - 行 3845-3910 `createServerFromEntry` + 合并顺序
  - 行 3870-3882 `createServerFromProjectEntry` 的 source="project" 分支
    （强制使用 `builtin.command`、忽略 entry.command）
  - 行 3977-4010 `isServerInstalled` 的 PATH 查找
  - 行 5768-5769 配置加载路径
- **`$omo:lsp` SKILL.md** — MCP 工具面 (`lsp.status` / `lsp.diagnostics` / 
  `lsp.symbols` / `lsp.goto_definition` / `lsp.find_references` / 
  `lsp.prepare_rename` / `lsp.rename`)。
- **`$omo:lsp-setup` SKILL.md** — `detect-lsp.ts` 与 `verify-lsp.ts` 脚本的
  官方验证路径；docs §1.5 fallback 段引用。

## 取舍

| 备选 | 选择 | 否决原因 |
|---|---|---|
| 把复盘内容直接拼到 AGENTS.md §本项目反模式 LSP bullet | 否 | AGENTS.md 是给 agent 的硬规则文档，不承担教学/历史叙述；膨胀会拖累 agent 上下文读取 |
| 把复盘拆成三个 plan 文件增量更新（每个 plan 引用下一个） | 否 | 三个 plan 已经互相冲突，叠加引用只会让冲突更隐式；single source of truth 必须独立存在 |
| 在 `docs/operations.md` 加一节 | 否 | `operations.md` 是部署/运维文档；LSP 配置演进属于工程经验沉淀，归到 `docs/learnings.md` 同类型文档更自然 |
| 在 `docs/learnings.md` 加一条 | 否 | learnings 是「踩坑与版本记录」散文式列表；LSP 演进本身已经有完整 plan 链，散文式会丢掉结构化引用 |
| 新建独立文档 | **是** | LSP 配置可移植性是仓库契约的一部分，独立文档便于 agent 与人类 future-proof 检索；与 `docs/verification-gauntlet.md` 同等地位 |
| 文档用英文写 | 否 | 仓库 AGENTS.md / `docs/learnings.md` / `docs/operations.md` 均中文为主；本仓库已确立「中文正文」契约，仅 token 与枚举英文 |
| 在文档里展开复现每个探针的代码 | 否 | 探针代码已落到 `/tmp/lsp-verify/*.js`，复现命令已在附 A 表里逐行列出；docs 强调出处 + 命令，不重复代码 |

## 风险与约束

- 文档只叙述不修代码：若未来 LSP 行为再次变化（例如 omo 上游改变
  project-source 合并语义），docs §1.2 / §4.6 会过时。**预防**：每条
  断言都标注 dist 源码行号或 commit hash，未来读者可一行 grep 复核
  （如 `sed -n '3870,3882p' ~/.codex/.../cli.js`）。
- docs §4.6「omo 版本语义漂移」声明含两处「未验证」标记（main 分支
  source code 与假设的合并语义变化）。**未验证原因**：本环境无 omo 
  git worktree，无法访问 main 分支源码；4.19.4 dist 行为已确认，但
  4.19.4 之后 omo 内部改动无可见信号。读者读到 §4.6 时应自行取信。
- docs §4.1 ~ §4.5 描述 vp smart-shim / TLS peer dep / hash 路径等行为，
  均基于历史 commit 实证记录与 plan 引用；本环境复测是 `vp ls -g` +
  `which` + `ls -la node_modules/typescript`，但未对 TLS 内部 
  `findTypescriptVersion` 做源码级验证（仅引用 plan 文案）。
- 本次不重跑任何 LSP 实证：所有探针输出引用上一轮「独立验证」任务的
  结果。**约束**：docs/lsp-setup-retrospective.md 自身不附「本次亲手跑
  通」的护城河；这是 docs-only 提交的本质，不是失误。
- 5 层 Gauntlet 仍要跑（vitest / typecheck / lint / build / commit-audit），
  即便没改代码——`verification-gauntlet.md` §on-demand 规则要求所有
  PR 跑通；本次触发规则是「docs commit 不命中 on-demand 触发条件（不
  触及 lib/db/Stryker scope）→ Tested trailer 注明覆盖范围」。

## 反向操作

若本文档本身造成误导（例如 §3.1-§3.4 的解读被未来读者反向引用为依据）
需要回收：

1. 不删文档，而是加一个 §「勘误」段记录哪条解读被反向引用、被什么
   后续 commit 推翻；保留原文以便未来读者看到知识演化路径。
2. 若文档结构本身被证明不适用（如 omo 引入 project-source 合并语义
   重大变更），拆分为两个文件：`docs/lsp-setup-retrospective.md`（架构
   与 SOP 永久保留） + `docs/lsp-setup-retrospective-2026-09.md`（某
   一次演进的快照）；保留向后可读性。

## 与既有规则的关系

- 沿用 AGENTS.md §验证门禁「每 commit 必跑」6 层（其中 browser QA 与
  mutation / coverage / property 三层 on-demand 不触发）：本文档 commit
  仅新增 `docs/` 与 `.omo/plans/` 两个文件，不触及 lib/db/app/
  components，不触发 on-demand。
- 沿用 commit 契约：中文 commit message + WHAT/WHY/HOW + 全套 lore 
  trailer + Plan: footer + 禁 `--no-verify`。
- 沿用 `docs/` 命名风格：与 `docs/verification-gauntlet.md` / 
  `docs/learnings.md` / `docs/operations.md` 同级，独立成文。
