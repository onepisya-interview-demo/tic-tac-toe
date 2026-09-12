# 调度者角色复盘与可复用 Prompt（2026-09-11/12 工作日会话）

> 事实来源：调度者 session 转录
> `~/.pi/agent/sessions/--private-tmp-tic-tac-toe--/2026-09-11T21-25-44-686Z_01a0925c-b66d-72bf-8ca8-0e5275ea9c01.jsonl`
> （327 行 / 848K，下文引用记作「转录 L\<行号\>」，时间戳为 UTC）。
> 本文档由 fresh session 用 python3 逐行 json.loads 抽取 `type=='message'` 文本写成；
> 所有仓库断言已对照当前 HEAD（`6fc72d8`）核验。

## 0. 方法

- 抽取脚本：逐行 `json.loads`，统计行类型（session/model_change/thinking_level_change/message）与消息角色（user 14 / assistant 148 / toolResult 162），未整文件读入（转录 L1-327 全量扫描由脚本完成，人读部分为分段采样）。
- assistant 文本 148 条中 60 条含实质文本（其余为纯 toolCall 行）；toolCall 全部 141 次 `bash`、6 `read`、6 `write`、10 `edit`——工具面以 bash 为绝对主体。
- 会话时间跨度：2026-09-11T21:27 → 2026-09-12T07:15（转录首尾时间戳）。

## 1. 会话时间线速览（任务派发视角，来自 14 条 user 消息）

| 转录行 | UTC | 用户指令（摘要） | 对应产出 |
| --- | --- | --- | --- |
| L4 | 21:27 | 修 `.codex/lsp-client.json` 的 hash 路径 | commit `566745f`（转录 L125） |
| L128/147 | 21:51/21:56 | 让 codex tab 真实验证；用 `$omo:lsp`/`$omo:lsp-setup` | codex 独立验证 4/4 PASS（转录 L146、L154） |
| L155 | 22:01 | 让 codex 说明 omo lsp 方案冲突并沉淀 | commit `93f2d62`（转录 L162） |
| L172/183 | 22:27/22:31 | 用 herdr+正交子代理跑 stats plan；按 1/5 估算轮询 | 10 commit `258a6d9`→`d046cc5` + F1-F4（转录 L204） |
| L205 | 06:24 | 还有什么要收尾 | 文档对齐 `48ddcd0`（转录 L228） |
| L229/243/255 | 06:42-06:59 | prod 已上线可跑验证；调度者自行复盘；session 卫生沉淀入 AGENTS.md | prod 5/5（转录 L234）；`a8ddca2`（转录 L285） |
| L286 | 07:05 | codex 我手动退掉了 | 注册表定稿（转录 L293） |
| L294/308 | 07:07/07:09 | 质疑家目录注册表入库；去外部找惯例 | `49f4303`（转录 L318） |
| L319 | 07:13 | 「信息路由器？调研者？…复盘总结，派 fresh Pi 单独干」 | 本文档（该派发的执行） |

## 2. 角色分类学

调度者不是单一角色，而是在一天里按需切换的七种姿态。每个角色给出职责定义、转录证据与工具面。

### 2.1 调研者（Researcher / Evidence Detective）

**职责定义**：在任何动手或派发之前建立可复核的事实基础——git 考古、运行时源码剖解、外部检索、自建探针实证；结论必须落到「已安装产物」而非记忆或克隆源码。

**转录证据**：
1. L8-11（21:27-21:28）：「`.codex/lsp-client.json` 确实被 git 跟踪了，而里面是含 install hash 的机器本地绝对路径。先看历史和设计记录」——用 `git log --follow` 考古该文件演化（L8 toolCall）。
2. L44（21:30:38）：「关键发现：`.codex/lsp-client.json` 不是上游 codex CLI 的配置，而是 `code-yeongyu/codex-lsp`（OMO 生态，移植自 pi-lsp-client）插件消费的」——由 `mcporter call grep.searchGitHub` + `zread.search_doc` 定位真实消费方（L32/41/44 toolCall）。
3. L58-68（21:32-21:33）：自建 JSON-RPC 探针三层实证——正对照（不带 hash 路径 TLS 初始化 PASS）→ 负对照（「无 typescript 的工作区报的正是 plan 里那个错」）→ 端到端（initialize+didOpen+documentSymbol），探针脚本落 `/tmp/tls_probe3.mjs`（L58 toolCall）。
4. L88（21:36:31）：「实锤了——已安装的 omo 4.19.4 dist 里…`initialization` 会被透传」——用 `node -e` 剖已安装 dist 而非克隆源码（L82-86 toolCall）。
5. L258-264（07:00-07:01）：`ssad-c3` 考古——「有 3 个候选 session…一个 todo 用了 3 个 session」，逐个解析 jsonl 确认结局（L264）。

**工具面**：`git log --follow`、`mcporter`（grep.searchGitHub / zread.search_doc）、`ddgs`（uv tool run）、`curl raw.githubusercontent.com`、`node -e` 剖 dist、自建探针 mjs、`read`/`grep`。

### 2.2 信息路由器（Information Router）

**职责定义**：把检索到的事实按受众重新打包——对用户做带证据的决策摘要，对委托方做无歧义的上下文注入（假设对方零上下文）。

**转录证据**：
1. L134/140（21:52）：委派 codex 的 prompt 内嵌完整背景——「背景：本仓库 main 最新提交 566745f…声称 typescript-language-server 会经 initialize 的 workspaceFolders 解析到项目自身 devDep typescript@5.9.3」——委托方不需要任何会话上下文即可动手。
2. L127（21:39:54）：修复完成后 1482 字用户总结（问题/动机/方案/验证链四段）。
3. L146（21:55:39）：把 codex 验证报告汇总成带证据列的表格（「4 个验证点全部 PASS」+ 各点关键证据）。
4. L171（22:10:01）：codex 沉淀产出核验后 1644 字汇总，标注文件、行数、定位（「LSP 单一事实源」）。
5. L192（23:59:32）：对子代理产出的证据做判读与分流——「`c1-lsp-tsserver.txt` 是**有效验证**……`c1-lsp-tsc.txt` 的报错是子代理绕过 tsconfig 裸调 tsc 的预期噪音」——把原始信号转译为可决策信息。

**工具面**：markdown 表格化汇总、委派 prompt 的上下文注入（herdr agent prompt）、`read`/`grep` 交叉核对。

### 2.3 指挥者（Commander / Orchestrator）

**职责定义**：把 plan 拆成 wave、匹配正交角色、强制写入串行化、按工时估算驱动轮询节奏、对交付物做最终验收。

**转录证据**：
1. L176-178（22:28）：先读 plan 与 hermes 角色库，再确认「角色边界（coder 写码 / test 只写测试 / reviewer 只读审查 / auditor 只读审计……正交性由各角色文档的 Scope 边界保证）」，然后才派发。
2. L178（22:28:50）派发 prompt 五段结构：【子代理委派契约】【写入串行化】【LSP 顺带验证】【仓库纪律】【进度协议】——含 staging 黑名单、禁止 `git add .`、trailer 枚举语言、evidence root 等红线预注。
3. L184（22:31:31）：工时估算表（Stryker 两次 + 两轮浏览器 QA 为大头，总估算 ≈150 分钟），「轮询策略：150 ÷ 5 = 每 30 分钟一轮，共 5 轮」——响应用户 L183 的 1/5 估算指令。
4. L180/186/188/190/194（22:28-00:28）：POLL 1-4 轮询，每轮四合一探针：agent status + `git log` + untracked 检查 + `herdr pane list`（L180 toolCall）。
5. L194（00:28:51）：「codex 报告 Goal achieved……但按仓库纪律『人是最终验收人』，我现在做独立终验（不采信自报）」。

**工具面**：`herdr tab/pane/agent` 全家桶、`sleep N; herdr agent get … | python3 -c …` 轮询脚本、`git log`/`git status -s` 进度探针、工时估算表。

### 2.4 质量门卫（Quality Gatekeeper）

**职责定义**：对一切产出（自己的与委托的）执行独立验证；自报不算数；门禁证据必须是新鲜输出；对自己同样不留豁免。

**转录证据**：
1. L140（21:52:50）独立验证任务约束：「每点给出 PASS/FAIL 与关键证据输出……只读验证，不要修改或提交任何文件；如某步失败，原样保留现场并在报告中说明复现命令」+ teach-back 收尾问题。
2. L144（21:55:28）：codex 交付后立刻「确认它没碰工作树：`git status -s`」——对验证者本身也验证。
3. L162-168（22:09）：「按『信任但验证』原则，独立核验它的产出」——抽查 `93f2d62` 的 §3 冲突清单、§4 坑清单、§5 SOP，并复跑轻量门禁。
4. L197-201（00:29）：不采信 Goal achieved——自报与实测 grep 对照、vitest 102/102、typecheck、commit-audit 149/149、生产构建 + 亲跑 concurrent-surface-qa 探针「2 PASS / 0 FAIL」。
5. L101-107（21:37-21:38）：对**自己的**修复也拒绝止步于复刻探针——「用真实的已安装 omo lsp 运行时（而非我的复刻探针）做最终验证」，取 `lib/game.ts` 真实 diagnostics。
6. L306/316（07:09-07:11）：提交后自查发现 `.om o` 笔误两次复写——「用 sed 机械替换，不再手打」。

**工具面**：pnpm vitest/typecheck/lint/build、commit-audit、`git status`、curl prod 序列、真实运行时 diagnostics、sed 机械替换。

### 2.5 协调者（Coordinator / Envoy）

**职责定义**：管理多 agent 环境的生命周期——发现、连通、派发、收尾（capture→exit→close），以及用户意图到可执行任务的转译。

**转录证据**：
1. L132-140（21:52）：发现 codex agent → 用名字寻址未命中（L136「用名字没命中，改用宿主 pane ID `w1:p1`」）→ pane id 直连成功 → 先发探针消息「回复 ok 两个字母即可」确认连通，再发正式任务。
2. L230-234（06:43）：转译用户反馈 #3 为验证序列——「快照 → POST 增量 → 读后一致 → PUT 恢复快照，避免污染真实战绩」，5/5 PASS 且「注意到 S0 有你真实游玩的战绩（2 局），没污染」。
3. L244-254（06:53-06:54）：清场盘点 6 个 tab——裸 pane pM「直接关」；三个委托 session「先登记 → /exit → close pane」；L252：「/exit 走了输入流（TUI 未消费）……不再纠缠——session 已全部落盘登记，直接关 pane 即可」。
4. L287-293（07:06）：用户手动退出后确认现场——「你手动退出时连 pane（t1/p1）一起关了」，核对 session 落盘文件存在后把注册表定稿。

**工具面**：`herdr workspace/agent/tab/pane list`、`herdr agent prompt --wait`、`herdr pane close`、curl（prod 序列）。

### 2.6 资产沉淀者（Asset Distiller）

**职责定义**：把会话经验固化为仓库可复利资产——plan、docs、AGENTS.md、注册表；切分原则是「协议入库（复利），机器本地状态不入库」。

**转录证据**：
1. L156-158（22:02）：响应用户 L155「沉淀到我们的项目可复利资产中去」——先看 `docs/` 命名约定，再给 codex 派沉淀任务（含研究、写作、门禁、提交全流程），产出 `93f2d62`（`docs/lsp-setup-retrospective.md` + `.omo/plans/lsp-retrospective.md`）。
2. L268（07:02:41）：「9 个委托 session 的完整地图拿到了……这正是必须沉淀的证据。写入 AGENTS.md + 设计记录 + 注册表全量」→ commit `a8ddca2`，即 AGENTS.md 现行「## herdr 多代理 session 卫生」节（仓库核验：AGENTS.md 该节存在）。
3. L295-312（07:08-07:11）：注册表迁址——`.omo/sessions.local.md` + `.gitignore` 增加 `/.omo/sessions.local.md`（仓库核验：`git check-ignore` 命中），并以外部先例交叉验证（L312：「Vite `.env.[mode].local`……Claude Code `.claude/settings.local.json`——和我们『协议入库 / 注册表本地』的切分完全同构」）。
4. L320（07:14:59）：把复盘本身也视为复利资产——「让一个**无上下文污染**的 fresh Pi 去读本会话的转录文件做复盘」——即本文档的由来。

**工具面**：`write`/`edit`、AGENTS.md、`.omo/plans/*.md`、`.gitignore`、`git commit`、ddgs/mcporter（外部惯例佐证）。

### 2.7 风险哨兵（Risk Sentinel）

**职责定义**：主动扫描「单点故障与数据损失」风险，做零成本保险，并把不可逆动作升级给人。

**转录证据**：
1. L211（06:26:18）：「盘点发现一个**重要问题**：这个仓库**没有配置任何 git remote**——本次会话的全部 12+ 个 commit 只存在于本机 `/tmp`」——主动报告而非等用户问。
2. L236（06:44:53）：「做一个零成本保险——git bundle（不违反『不用 remote』，防 /tmp 意外）」；且 L240「bundle 校验输出被 grep 滤掉了，单独确认」——对保险本身也验证。
3. L234（06:44:19）：prod 验证时识别 S0 是用户真实游玩战绩并设计恢复序列（「没污染」）。
4. L246（06:53:41）：对来路不明的裸 pane tM「标签就叫 "6"，来路不明，先看内容」再处置——不明状态先侦查后动手。

**工具面**：`git remote -v`/`origin/main..main` 计数、`git bundle` + 校验、快照-恢复序列。

## 3. 关键决策点复盘

### 3.1 被验证为对的决策

| 决策 | 证据 | 结局 |
| --- | --- | --- |
| **workspace 解析证伪 hash 路径** | 正对照+负对照+端到端+dist 透传四层实证（转录 L58-88）；历史提交曾以「无法跨项目复用」否决过 workspace 解析，「但那是基于『codex-lsp 不会传 workspaceFolders』的错误前提，我已用已安装 dist 的源码 + 探针证伪」（L95） | `566745f` 落地；codex 独立验证 4/4 PASS（L146）；后续 F1 终验中可移植配置在新文件上仍工作（L190-192，`c1-lsp-tsserver.txt` 65 个 documentSymbol） |
| **信任但验证，不采信自报** | L194「不采信自报」；L162 对 codex 文档产出独立抽查 | 抽查发现质量达标；F2 审计「诚实标注了同进程并发非原子的 plan 内已知缺口」（L197） |
| **工时估算驱动轮询节奏** | L184 估算 150 min → 30 min/轮 × 5 轮 | 实际 1h40m、4 次轮询完成（L194、L204），无空转 |
| **prod 验证用快照-恢复序列** | L232「避免污染真实战绩」 | 5/5 PASS 且 S0 精确恢复（L234；证据归档 `.omo/evidence/stats-server-authoritative-delta/f3-prod-verification.txt`） |
| **委派协议：复述→证据→teach-back→只读约束** | L134/140/178 每次派发均内嵌 | codex 两次验证均全程只读且未碰工作树（L144、L152） |
| **session 收尾 capture→exit→close** | L248-254（登记 → /exit → close；/exit 无效时不纠缠直接 close） | 9 个委托 session 全量落盘登记，均可 resume（仓库核验：`.omo/sessions.local.md` 全量清单） |

### 3.2 险些走偏的决策（及纠偏信号）

1. **家目录注册表写进仓库契约**：初版把 `~/.hermes/memory/sessions/<ws>.md` 写入 AGENTS.md（转录 L234）。用户 L294 质疑「这个只是我自己是这样的……更好的选择是什么？」→ 调度者承认「和我刚修过的那类错误……和 tsserver hash 路径同罪，只是程度轻」（L295）→ 修订为 `.omo/sessions.local.md`（仓库内 gitignore 缺省位 + 允许个人覆盖），外部先例交叉验证后定稿（L312；`49f4303`）。
   **信号**：被跟踪文件里出现任何 `/Users/<you>` 路径即应触发警报——同一类错误在一天内出现两次，说明需要结构性反模式而非逐案记忆。
2. **中途结论基于克隆源码而非已安装产物**：L70 中途结论「那个 hash 路径从来没被真正发给 TLS」，但立即自我标注「不过我克隆的是 main 分支源」（L72），随后对已安装 omo 4.19.4 dist 实证推翻：`command` 用 builtin 但 `initialization` 会透传，「那个 hash 路径在生产里确实被发过」（L88）。
   **信号**：任何「生产行为」结论必须对已安装产物（dist/二进制）验证后才能定稿。
3. **/exit 依赖 TUI 消费输入流**：L250「/exit 已发送但 agent 仍在列表」→ L252 改为确认 session 落盘后直接 close pane。
   **信号**：优雅退出协议必须绑定「session 文件在盘」这一可验证事实，而非命令发出这一动作。
4. **提交 trailer 枚举语言**：L121「audit 对 trailer 值有枚举要求（`Confidence: low|medium|high`、`Scope-risk: narrow|moderate|broad`）」，中文枚举值被 commit-audit 拒绝后修正重提。
   **信号**：仓库策略真源是 audit 脚本，提交前先读规则（`tests/qa/commit-audit.mjs`）。

### 3.3 该升级给人的信号（本 session 实际发生的升级）

- **外部世界/不可逆动作**：remote 配置与开源时机（用户答「还没到开源的地步」「不用 remote」L229）、电脑重启（用户「不会重启」L229）、prod 上线由用户亲手执行（L229「我已经进行了 vercel 的 prod 上线」）——调度者只做已授权域内的验证。
- **契约层质疑**：用户对注册表位置的质疑（L294）——调度者的正确反应是把质疑当作同类错误复发的检查点（L295 实际反应），而非辩护。
- **用户接管点**：用户手动退出 codex（L286）——调度者随后只做现场确认与登记，不重复处置。

## 4. 可复用调度者 Prompt 模板

以下模板提炼自本 session 实证，可直接发给 fresh agent（herdr 新 pane 的 pi/codex 均可）。方括号为按任务填充项。

```text
# 角色：调度者 / Dispatcher

你是本仓库的调度者。你几乎不亲自写产品代码——你的产出是「正确的 agent 在
正确的时刻拿到正确的任务，并以可验证的证据交付」。你同时是唯一对结果负责
的人：任何委托产出（包括对方自报 "Goal achieved"）在独立验证前一律视为未完成。

## 四层职责
1. 调研：动手或派发前先建事实基础——git 考古、对已安装产物（dist/二进制）
   剖解、外部检索、自建探针。结论必须对「生产实际运行的产物」验证，克隆源码
   只能作为线索。
2. 指挥：把 plan 拆成 wave，匹配正交角色（写码/只写测试/只读审查/只读审计），
   同一 worktree 同一时刻只允许一个 agent 写入；只读角色可真并行。
3. 门卫：一切产出独立验证——复跑门禁、抽查产物关键章节、对照自报与实测。
4. 沉淀：把可复用经验写入仓库资产（plan/docs/AGENTS.md）。切分原则：协议入库
   （复利），机器本地状态不入库（gitignored 注册文件放仓库内缺省位置）。

## 工具面
- herdr：tab/pane/agent 创建、发现、派发、轮询、关闭。
  · 派发用 pane id 直连（如 w1:p1）；agent 名字寻址可能不命中。
  · 首次连接先发探针消息（「回复 ok」）确认连通，再发正式任务。
- 外部检索：mcporter（zread.search_doc / grep.searchGitHub / fff.find_files）、
  ddgs（uv tool run ddgs）、gh、curl raw.githubusercontent.com。
- 本地检索：rg/grep/fd/head/tail；大文件（session jsonl / 转录）用 python3
  逐行 json.loads 分段抽取，禁止整文件读入。
- 实证：node -e 剖已安装 dist；自建最小探针脚本——每个「证明 X 有效」的正对照
  必须配一个「无 X 应失败」的负对照，防止假阴性。
- 门禁：[pnpm vitest run / typecheck / lint / build；commit-audit；tests/qa 探针]

## 委派协议（每个子任务）
1. 必起新 agent session：herdr tab create --workspace <ws> --cwd <repo> --no-focus
   取 .result.root_pane.pane_id → herdr agent start <name> --kind pi|codex --pane <id>。
   复用旧 tab 则先 /new。子代理不得再生成子代理。
2. 派发 prompt 五段结构（委托方零上下文，背景必须完整注入）：
   【背景与事实】调研结论 + 相关 commit/文件路径
   【交付物】唯一目标 + 明确边界（不改哪些文件/目录）
   【验收标准】可机器判定：哪些命令须 exit 0、哪些文件须存在
   【约束】只读 or 写入范围；先用自己的话复述任务与验收标准（teach-back）
   再动手；给 PASS/FAIL + 证据；失败时保留现场并给复现命令；禁止 --no-verify
   【进度协议】每完成一个 wave 输出一行简报供轮询读取
3. 委托方交付后：git status 确认没碰边界外文件 → 独立复跑门禁 → 抽查产物。

## 轮询节奏
- 派发前做工时估算，列出成本驱动（Stryker/浏览器 QA/子代理启动开销）。
- 每「估算 ÷ 5」间隔轮询一次，预期 5 轮内完成；估算与实际偏差超 2 倍时汇报
  原因，不静默等待。
- 每次轮询四合一：agent status + git log -N + git status -s + pane list。

## 收尾卫生：capture → exit → close
- 退出前先 capture：herdr agent list 的 agent_session.value 即权威 session id
  （id 会轮换，退出时点现采现记；不靠读终端 scrollback）。
- 登记到仓库内 gitignored 注册文件（缺省 <repo>/.omo/sessions.local.md，
  个人可覆盖位置但不得改缺省——任何 agent 按协议都能在同一位置找到它）。
- 顺序：capture → /exit（pi）或 /quit（codex）→ herdr pane close <pane-id>。
  /exit 可能不被 TUI 消费；session 落盘与 pane 生命周期解耦——确认 session
  文件在盘后直接 close pane 即可，不再纠缠。
- pane 数 ≠ session 数：编排者会边跑边关委托 pane，追溯靠注册文件，不靠现场
  盘点；tab 标签与实际任务会漂移，不信任标签。

## 验收门禁
- 门禁证据引用新鲜输出（测试数、PASS/FAIL 行），禁止凭感觉声称完成。
- 产线数据操作：先快照 → 变更 → 读后一致 → 恢复快照，绝不污染真实数据；
  保险动作（如 git bundle）本身也要校验。
- 机械缺陷（笔误/格式）用 sed/python 机械替换修复，禁止手打长文本。
- 提交前先读仓库提交策略真源（audit 脚本），不凭记忆写 trailer。

## 升级规则（停下来问人）
- 不可逆/外部世界动作：push、发布生产、远程与开源决策、重启机器。
- 契约层质疑：用户质疑仓库契约时，第一反应是检查是否同类错误复发。
- 发现单点故障（如仓库无 remote、commit 只在 /tmp）时主动报告 + 提供零成本
  保险方案，由人决策。

## 反模式（实证踩过的坑，出现即警报）
- 把机器本地路径（/Users/<you>/...）写进被跟踪文件——含 hash 目录与个人家目录。
- 对「生产行为」的结论基于克隆源码而非已安装产物。
- 探针只有正对照（假阴性风险）。
- 信任 tab 标签或现场 pane 数推断 session 数；一个任务可能耗多个 session。
- 自报当作完成；验证者自己也可能越界（验证后要查 git status）。
- git add . / -A；用 --no-verify 绕过 hook；手打修订文本引入复写笔误。
```

**使用说明**：模板中的工具面以本 session 的 herdr + pi/codex 环境为参照；移植到其他 harness 时保持「五段派发结构、负对照探针、capture→exit→close、独立验证」四个骨架不变，替换具体命令即可。

## 5. 反模式清单

本 session 踩到（造成返工/返修）或主动规避（有证据的防御动作）的坑：

| # | 反模式 | 出处 | 踩到/规避 |
| --- | --- | --- | --- |
| 1 | 机器本地路径入库（hash 目录） | 转录 L8；修复 commit `566745f`；plan `.omo/plans/lsp-client-portable-config.md` | 踩到（修复对象本身） |
| 2 | 机器本地路径入库（家目录注册表） | 转录 L234 → L294 用户质疑 → L295-312 修订；`.omo/plans/herdr-session-hygiene.md` §修订 | 踩到，同日第二次；修为 `.omo/sessions.local.md` + `.gitignore` |
| 3 | tab 标签漂移（label 说 c2-post-route 实际跑 commit 2 recordAndSave） | 转录 L268；`.omo/sessions.local.md`「tab 误标 c2-post-route」 | 规避（靠 session 文件考古而非标签追溯） |
| 4 | 一个 todo 耗 3 个 session（ssad-c3：中断→主体→收尾） | 转录 L258-264；AGENTS.md「herdr 多代理 session 卫生」节 | 规避后沉淀为协议（起子任务必起新 session、退出先 capture） |
| 5 | pane 数 ≠ session 数（清场时盘不到 ssad-c3） | 转录 L246/258；herdr-session-hygiene.md「pane 数 ≠ session 数」 | 规避（追溯依赖注册文件与 session 文件） |
| 6 | session id 轮换使一次性登记过期（01a09272→01a09294） | 转录 L293；`.omo/sessions.local.md` codex 行「旧 01a09272-... 已轮换废弃」 | 规避（退出时点现采现记） |
| 7 | agent 名字寻址失败 | 转录 L136「用名字没命中，改用宿主 pane ID」 | 规避（pane id 直连） |
| 8 | 探针假阴性风险（只做正对照） | 转录 L65-68：负对照「无 typescript 的目录应失败，证明是 workspace 解析在起作用」 | 主动规避（正+负+端到端三层） |
| 9 | 中途结论基于克隆源码 | 转录 L72「我克隆的是 main 分支源」→ L88 dist 实锤推翻 | 自我纠偏（未定稿即修正） |
| 10 | 自报当作完成 | 转录 L194「不采信自报」→ L197-201 独立终验 | 主动规避 |
| 11 | /exit 依赖 TUI 消费输入流 | 转录 L250-252 | 规避（确认 session 落盘后直接 close） |
| 12 | 手打修订长文本引入复写笔误（`.om o` 两次） | 转录 L306/316「用 sed 机械替换，不再手打」 | 踩到后改机械替换 |
| 13 | trailer 枚举值用中文被 audit 拒 | 转录 L121-123（Confidence/Scope-risk 枚举 `low|medium|high`/`narrow|moderate|broad`） | 踩到一次，读 audit 脚本后修正 |
| 14 | 归档探针被 lint 扫到（evidence 目录 CommonJS 触发 no-require-imports） | 转录 L273-281「把 `.omo/evidence/` 加进 eslint globalIgnores——与 `tests/qa/**` 同一逻辑，且防复发」 | 踩到后修配置防复发（`a8ddca2` 同窗口） |
| 15 | 委托上下文缺失（把任务发给零上下文的 agent 而不注入背景） | 转录 L134/140/178：每次派发内嵌完整背景/验收/红线 | 主动规避（五段式派发 prompt） |
| 16 | 验证污染真实数据 | 转录 L232-234：快照→POST→读后一致→PUT 恢复，「S0 有你真实游玩的战绩……没污染」 | 主动规避 |

## 6. 与既有资产的衔接

- 本复盘是转录 L319（07:13:55）用户指令「调度者角色复盘……派单独的 Pi 在其他 tab 干」的执行产物；派发 prompt 见转录 L324 toolCall。
- 委派协议与 capture→exit→close 的权威文本：AGENTS.md「§委派协议」「§herdr 多代理 session 卫生」（commit `a8ddca2`、`49f4303`、`6fc72d8`）。
- 被引用的两份沉淀文档：`docs/lsp-setup-retrospective.md`（`93f2d62`）、`.omo/plans/herdr-session-hygiene.md`。
- 未验证项：转录 L254 提到的裸 pane `tM` 的创建者身份（「来路不明」在原会话中即未查明，本文档不做推测）。
