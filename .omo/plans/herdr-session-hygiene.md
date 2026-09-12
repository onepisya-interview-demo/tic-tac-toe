# herdr 多代理 session 卫生协议（沉淀入 AGENTS.md）

## 决策
把本 session 实证的 herdr 委托代理 session 管理经验固化为 AGENTS.md 新章节
「## herdr 多代理 session 卫生」，让任何拉取本仓库、用 herdr 跑本项目的人
直接复用。切分原则：**协议入库（复利），session id 留机器本地（不入库）**。

## 修订（同日，用户 review 后）
注册文件位置从初版的 `~/.hermes/memory/sessions/<ws>.md`（调度者个人记忆
目录）改为仓库内 **`.omo/sessions.local.md`**（gitignore）。理由：把个人
家目录路径写进仓库契约，与 tsserver hash 路径同类——机器本地状态泄入契约。
仓库锚定让任何克隆者在同一位置找到注册表；个人覆盖允许但不改缺省位置。
不引入 env var 配置机制：无代码消费该文件，配置即约定本身，单一缺省位置
+ 覆盖自由已覆盖全部场景。同步 .gitignore 增加 `/.omo/sessions.local.md`，
调度者本地注册表已迁至新位置。外部先例交叉验证：`.local` 后缀作「机器本地、
不入库」标记是生态惯例（Vite `.env.[mode].local` 官方建议 gitignore；Claude
Code 的 `.claude/settings.local.json` 同构——共享协议入库、本地覆盖不入
库），且我们把 ignore 规则显式写进仓库 .gitignore，比 Claude 的自动改写
`~/.config/git/ignore` 更透明。

## 背景（本次实证的三个事实）
1. **id 轮换**：一次编排内 codex session id 从 `01a09272-fac4-…` 轮换到
   `01a09294-042f-…`，一次性登记会过期。
2. **pane 数 ≠ session 数**：stats plan 10 个 commit 实际产生 9 个委托 pi
   session（`~/.pi/agent/sessions/--private-tmp-tic-tac-toe--/` 全量在册），
   编排者边跑边关 pane，清场时只看到 3 个。
3. **一个 todo 耗多个 session + 标签漂移**：commit 3（store + Stryker）先后
   用 3 个 session（22:49 中断 / 23:05 主体 / 23:15 收尾，工作最终落在
   `80f6cd1`）；tab 标签 `ssad-c2-post-route` 实际执行的是 commit 2
   recordAndSave——追溯必须靠 session 文件，不靠标签。

## 协议（写入 AGENTS.md 的内容摘要）
capture（`herdr agent list` 的 `agent_session.value` → 仓库内注册文件
`.omo/sessions.local.md`，gitignored）→ 优雅退出（`/exit`、`/quit`）→
`herdr pane close`。关 pane 不销毁会话（落盘 `~/.pi/agent/sessions/`、
`~/.codex/sessions/`）；读终端 scrollback 只是无注册文件时的兜底。

## 被否决的替代方案
- **把 session id 写进仓库**：机器本地状态，推上去对他人是噪音且很快过期。
- **靠读终端 scrollback 采 id**：的信息密度低、易被 TUI 重绘冲掉；
  `herdr agent list` 是结构化真源。
- **不关 pane 长期保留**：pane 是稀缺布局资源；会话已落盘，关闭零损失。

## 关联
- 机器本地注册表：`.omo/sessions.local.md`（含 9 个委托 session 全量清单）
- 上游约束：`~/.pi/agent/AGENTS.md` §委派协议（每任务新 session）——本协议
  是它的项目级落地 + 关闭侧补充
