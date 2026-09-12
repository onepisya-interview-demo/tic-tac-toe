# herdr 多代理 session 卫生协议（沉淀入 AGENTS.md）

## 决策
把本 session 实证的 herdr 委托代理 session 管理经验固化为 AGENTS.md 新章节
「## herdr 多代理 session 卫生」，让任何拉取本仓库、用 herdr 跑本项目的人
直接复用。切分原则：**协议入库（复利），session id 留机器本地（不入库）**。

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
capture（`herdr agent list` 的 `agent_session.value` → 机器本地注册文件
`~/.hermes/memory/sessions/<workspace>.md`）→ 优雅退出（`/exit`、`/quit`）→
`herdr pane close`。关 pane 不销毁会话（落盘 `~/.pi/agent/sessions/`、
`~/.codex/sessions/`）；读终端 scrollback 只是无注册文件时的兜底。

## 被否决的替代方案
- **把 session id 写进仓库**：机器本地状态，推上去对他人是噪音且很快过期。
- **靠读终端 scrollback 采 id**：的信息密度低、易被 TUI 重绘冲掉；
  `herdr agent list` 是结构化真源。
- **不关 pane 长期保留**：pane 是稀缺布局资源；会话已落盘，关闭零损失。

## 关联
- 机器本地注册表：`~/.hermes/memory/sessions/tic-tac-toe-w1.md`（含 9 个
  委托 session 全量清单）
- 上游约束：`~/.pi/agent/AGENTS.md` §委派协议（每任务新 session）——本协议
  是它的项目级落地 + 关闭侧补充
