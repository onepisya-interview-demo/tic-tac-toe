# herdr 多代理 session 卫生协议

> 定位：本文承接 AGENTS.md §herdr 多代理 session 卫生（digest）的全部细节。协议设计与实证
> 背景见 `.omo/plans/herdr-session-hygiene.md`（决策/修订/否决项）；调度者完整模板见
> `.omo/plans/dispatcher-roles-retrospective.md` §4。

本项目在 herdr 里以「一个编排者 + 多个正交委托代理（pi/codex）」执行大 plan。任何拉取本仓库、用 herdr 跑本项目的代理都必须遵守以下 session 协议：

## 协议

- **起子任务必起新 agent session**：`herdr tab create --workspace <ws> --cwd <repo> --no-focus` 取 pane id，再 `herdr agent start <name> --kind pi --pane <id>`。同一 worktree 同一时刻只允许一个 agent 写入；只读角色（reviewer / auditor / explorer）才可真并行。
- **退出前先 capture，且不靠读终端**：`herdr agent list` 的 JSON 字段 `agent_session.value` 即权威 session id（codex 是 uuid；pi 是 `~/.pi/agent/sessions/` 下的 jsonl 全路径）。把它连同 pane id、任务标签写入仓库内注册文件 **`.omo/sessions.local.md`**（已 gitignore；session id 属机器本地状态，**不写入仓库跟踪**）。缺省位置固定在仓库内是为了让任何人/任何 agent 在任何机器上都能按同一协议找到它；个人另有记忆目录习惯可自行覆盖，但不得改动缺省位置。
- **关 pane 不销毁会话**：会话落盘在 `~/.pi/agent/sessions/`（pi）与 `~/.codex/sessions/`（codex），pane 只是视图。固定顺序：capture → `/exit`（pi）或 `/quit`（codex）→ `herdr pane close <pane-id>`；读终端 scrollback 只是没有注册文件时的兜底。
- **session id 会轮换，退出时点现采现记**：实证一次编排内 codex session id 从 `01a09272-…` 轮换到 `01a09294-…`，旧登记不可信。
- **resume**：pi 用 `pi --resume <jsonl 路径>`；codex 用 `codex resume <uuid>`；恢复会话后接新任务先 `/new`。
- **编排者会边跑边关委托 pane**：清场时看到的 pane 数 ≠ 实际用过的 session 数。实证 stats-server-authoritative-delta plan：10 个 commit 产生 9 个委托 session，其中一个 todo（commit 3）先后耗掉 3 个 session（中断、主体、收尾），且 tab 标签与实际任务存在漂移——追溯依赖注册文件与 session 文件，不依赖标签。
- **等待须分片：预估 T ÷ 5 为检查间隔（完成通知规 v2 · 2026-09-15 立 · 实证两次整段 wait 被用户中止，主公亲定除五法）**：等待本身不禁，禁的是**一次等到头**。派发后先估总时长 T（如 60min），检查间隔 = T ÷ 5（60min → 每 12min 一查）；每片用 `herdr agent wait <name> --until done --timeout <T/5>` 或 `herdr agent get <name>` 短查（单次 <1s），片间插调度者自己的 lane（独立门禁、diff 实阅、文档）。到点未 done 则续等下一片，见 done 即 `herdr agent read` 读尾部汇报。禁止 `--timeout ≥ 10min` 的一次性整段 wait；`herdr agent wait` 仅以 T/5 分片形态使用。有完成回调基建时（notify-subscribe / notify_on_complete）优先订阅取代轮询。
- **候 done 不候 idle（v2.1 · 2026-09-15 · 主公指正）**：pi worker 竣工后的终态是 `done`（实证：W1 竣后 agent_status=done 而 `wait --until idle` 超时；W5 同）；idle 语义是「待输入」而非「已完」，可能永不触发。凡 wait/状态判定一律以 **done** 为准；拿不准时 `herdr agent read` 尾部看汇报实体，不猜状态。

## 实证背景（三事实，来自源 plan）

1. **id 轮换**：一次编排内 codex session id 从 `01a09272-fac4-…` 轮换到 `01a09294-042f-…`，一次性登记会过期。
2. **pane 数 ≠ session 数**：stats plan 10 个 commit 实际产生 9 个委托 pi session，编排者边跑边关 pane，清场时只看到 3 个。
3. **一个 todo 耗多个 session + 标签漂移**：commit 3（store + Stryker）先后用 3 个 session；tab 标签 `ssad-c2-post-route` 实际执行的是 commit 2 recordAndSave——追溯必须靠 session 文件，不靠标签。

## 被否决的替代方案

- **把 session id 写进仓库**：机器本地状态，推上去对他人是噪音且很快过期。
- **靠读终端 scrollback 采 id**：信息密度低、易被 TUI 重绘冲掉；`herdr agent list` 是结构化真源。
- **不关 pane 长期保留**：pane 是稀缺布局资源；会话已落盘，关闭零损失。
