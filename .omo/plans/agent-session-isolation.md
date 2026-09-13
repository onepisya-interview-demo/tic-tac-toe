# Plan: Agent Session 隔离硬约束（AGENTS.md § 8 委派协议第 3 条 bullet）

日期：2026-09-12　|　执行：Pi fresh session（herdr 拉起，cwd /private/tmp/tic-tac-toe）

## 1. 动机

2026-09-12 两段任务（恢复工作树清除事故 + 关 audit 闭环）复用同一 Pi session，
context 累积了 9 个 pwa 计划 commit + a74b44e（post-mortem）+ 0f49375
（commit-policy 闭环）+ 大量 AGENTS.md / commit-policy-enforcement.md / 52204f2
反查——每次新 prompt 都要重新拎陈年 context 判断"还适不适用"，拖慢且引入
stale 假设风险。

用户决定（原文）："开新的 Pi 会话，比如你个开新 Tab 关掉旧的 Tab，或者旧的 Tab
中使用 /new 命令来启动新 Session"。

**收益**：新 session 不继承历史对话，agent 重读关键文件（AGENTS.md /
commitlint.config.cjs / 上一个 plan）而非依赖 stale 假设；每个 session 的产物
对应一段干净 transcript，决策可追溯。
**代价**：失去对话连续性——需要历史时用 `pi --resume` / session 文件显式找回，
而不是默认背着走。

## 2. 目标文件消歧（原 prompt 歧义修正）

- 仓库 /private/tmp/tic-tac-toe/AGENTS.md **没有** § 8 委派协议（已全文核实）。
- § 8（含"派发子任务时…"+"完成后能回答…（teach-back）"两条 bullet）在全局
  本机 pi agent 配置目录的 AGENTS.md —— symlink → 本机 .codex 配置目录的同名文件，
  § 8 位于 L47-49。
- 用户已修正：改全局文件，不动仓库文件。

## 3. 两条路径对照（写入 bullet 的硬约束）

| 路径 | 命令链 | 适用 | 证据 |
| --- | --- | --- | --- |
| 新 tab | `herdr tab create --workspace <ws> --cwd <repo> --no-focus` → 取 `.result.root_pane.pane_id` → `herdr agent start <name> --kind pi --pane <id>` | 需要独立 pane / 收尾后关 tab | herdr `tab create --help`（--workspace/--cwd/--no-focus）+ `agent start --help`（--kind pi / --pane ID）实测存在；`.result.root_pane.pane_id` 取自任务 brief（herdr JSON 输出约定），本 session 未实际执行 tab create 验证 |
| 复用 tab + 新 session | pi REPL 内输入 `/new` | 同一 pane 连续做独立任务 | pi 0.85.1 文档 docs/usage.md L46、docs/sessions.md L27、README L186：`/new` = Start a new session |

## 4. 设计要点

1. **bullet 是规则不是论文**：短、dogmatic、两条路径内联、不写长 rationale——
   理由全部落在本 plan（§1 收益/代价）。
2. **风格对齐 § 8 既有 2 条**：祈使语气、1-2 句、渲染 ≤4 行、以"禁止…"收尾
   点明硬约束属性。
3. **版本约束标注**：pi 0.85.1 已验证 `/new` 存在；未来若换 agent kind，
   以各 agent 自己的 new-session REPL 命令为准（bullet 约束的是 Pi 场景）。

### 新 bullet 文案（定稿）

    - 每个独立任务必须起新 agent session：herdr 下 `herdr tab create --workspace <ws> --cwd <repo> --no-focus` 取 `.result.root_pane.pane_id`，再 `herdr agent start <name> --kind pi --pane <id>`；复用 tab 则在 pi REPL 输入 `/new`（pi 0.85.1 已验证）。禁止在旧 session 上下文里接着跑新任务。

## 5. Commit 决策（证据驱动，结论：不 commit，in-place 编辑）

用户修正指令：若 .codex 在 git repo 内 → 走该 repo 的 audit 路径（先 inspect
hooks + 约定）；否则 in-place 编辑。实测用户 home 目录（home repo toplevel）：

| 检查 | 结果 | 含义 |
| --- | --- | --- |
| `rev-parse --is-inside-work-tree` | true（toplevel=用户 home 目录） | 技术上"在" repo 内 |
| `git log` | fatal: current branch 'main' does not have any commits yet | unborn main，**零历史** |
| `git branch -a` | 空输出 | 无任何分支引用 |
| `.git/hooks` | 仅 *.sample | 无 commit-msg / audit 基建 |
| `git check-ignore -v .codex/AGENTS.md` | `.gitignore:1:/**/**` | **被 .gitignore 第 1 行全量忽略** |
| repo 自身约定 | home 仓根的 AGENTS.md（2560B, 05-21）存在但无 commit 契约 | 无可套用的 audit/lint |

结论：该 repo 是"全忽略、未启用"的白名单式备份壳。不存在用户所说的"audit
路径"；`git add -f` 会对抗用户自己的 ignore 配置；为 home repo 制造第一个
commit 是结构性决策，超出本任务授权。按修正指令 fallback 分支处理：**in-place
编辑，不 commit**。本 plan 文件留在 tic-tac-toe `.omo/plans/`，与其 3 个
sibling plan 同为 untracked 状态（是否入库由仓库主人决定，本任务不越位）。

## 6. 验证策略

1. `grep -n` 目标文件 § 8 段：应见 3 条 bullet，第 3 条同时含
   `herdr tab create` + `agent start` + `/new` 三个 token。
2. 经 symlink 路径编辑本机 pi agent 目录的 AGENTS.md，读回本机
   .codex 目录下的同名文件确认落盘（symlink 生效）。
3. tic-tac-toe 仓库 `git status`：仅新增 1 个 untracked plan 文件，tracked
   文件零变化 → 6 层门禁不适用（未触碰任何被门禁覆盖的文件）。
4. 旧 Pi session（commit-policy-closer，w1:p2）零打扰：本任务不向该 pane 发送
   任何 prompt / 按键。

## 7. Rejected

- **写进 tic-tac-toe 仓库 AGENTS.md**：那里没有 § 8，硬造一节违反"在那 2 条
  之后追加"的原意（用户修正已否决）。
- **在 home repo 制造首个 commit**：见 §5——零基建 + 全 ignore + 结构性越权。
- **bullet 内写长 rationale**：规则文件变论文；理由归 plan。
- **只写一条路径（仅 /new 或仅新 tab）**：用户原话明确两条路径都可接受，
  收窄会误伤不同工作流。
