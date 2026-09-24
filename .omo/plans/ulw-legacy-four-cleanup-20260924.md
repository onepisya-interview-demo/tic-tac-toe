# 计划：遗留四项清理 + remote Turso 实测（ulw）

> 性质：执行计划。裁决来源：[decisions-pending-20260924.md](../decisions-pending-20260924.md) 四项，主公 2026-09-24 批注：项1 立小票 / 项2 处理悬空与孤儿 / 项3 立小票处理 / 项4 用已有 Turso key 处理；T-L4 落点已御裁 A（生产库 + `_probe_*` 临时表，见 §五）。**【收口 2026-09-24】四票全部落地**：T-L1 `dc352ed`（step 8 探针 8/8）、T-L2 `361cff0`（白名单 13→0，5 探针接 ci.yml，ruleset 同步为收口待办）、T-L3 `9123a0b`、T-L4 `7447b64`（R-E5/E6/E7 全绿，边界注升级实测）。
> 预检事实：项4 凭据已就位（见 §三），四项全部可执行。基线：dev @ eac96f5，vitest 505+8 skip 全绿，探针 rooms-race 7/7。

---

## 一、裁决与票面总览

| 裁决项 | 票 | 内容 | 载体 |
|---|---|---|---|
| 项1 BR-10 merge→409 半边 | T-L1 | rooms-race-qa 补 step 8，BR-10 双半边端到端闭环 | fresh codex 席 |
| 项2 KNOWN_ORPHANS 13 条 | T-L2 | 逐条 triage，白名单清零，孤儿各有归属 | fresh codex 席 |
| 项3 room-name.ts 重复导出 | T-L3 | 删重复导出，qa:audit 归零 | Pi（纯执行） |
| 项4 remote Turso 实测 | T-L4 | E5/E6/E7 同型实验对真实 Turso 跑，标注升级实测 | 调度者亲自 |

## 二、票面

### T-L1：merge→409 端到端半边（rooms-race-qa step 8）

- **范围**：`tests/qa/rooms-race-qa.mjs` 追加 step 8：登记房间 A → 对**未登记**房间 B 调 `POST /api/rooms/[room]/stats/merge` → 断言 409 + 错误 body（service 层 409 语义已有单测，写断言前先读该单测确认 tagged-result/problem+json 形态；入口 `lib/game-net.ts` httpJson 契约）→ 复核 GET 房间 B 仍不存在（BR-10「不静默建档」双确认）。
- **联动文档**：`docs/business-rules.md` BR-10 行探针列从「merge-sync-qa（DISABLED 存根）」改为指向 rooms-race step 8；若 merge-sync-qa 存根自此完全无引用，其处置归 T-L2 一并判。
- **验收**：探针 8/8 PASS（生产构建 + `:3101` 惯例）；六层门禁绿；R6 校验零违例。
- **预估**：20-30 分钟，单文件为主。

### T-L2：KNOWN_ORPHANS 13 条批量 triage

- **范围**：`tests/qa/probe-reconciliation.test.ts` 的 `KNOWN_ORPHANS` 常量所列 13 条（席上读该文件取全名单，勿抄写本计划）。逐条四选一：**删**（git 历史留档）/ **补引用**（接进 ci.yml job 或 docs 指路）/ **DISABLED 存根**（头部标记 + 去向注记）/ **上报**（判断拿不准的列清单交调度者，不擅自删）。
- **判断标准**：① 引用已退役端点且无活回归向量 → 删；② 有活回归向量但未接任何门 → 补接线或 DISABLED + 注记；③ 与现存探针场景重复 → 删 + 注记归属；④ 含唯一场景价值的 → 补接线。每条处置理由写入 commit message。
- **验收**：KNOWN_ORPHANS 清零且 reconciliation 测试绿；`rg` 复扫无新增悬空；六层门禁绿。
- **预估**：45-60 分钟，需逐条读文件 + git log 历史语境。

### T-L3：lib/room-name.ts 重复导出清理

- **范围**：`lib/room-name.ts` 的 `emptyStats` / `GameStats` 导出全仓无引用方（knip 首跑发现），真源在 `lib/game.ts`。删除重复定义；若删后编译报缺，改为从 `lib/game.ts` 重导出归一（二选一，以编译 + 测试为准）。
- **验收**：vitest 505 基线绿 + typecheck 绿；`pnpm qa:audit` 复跑该项归零。
- **预估**：10 分钟级。纯执行、目标明确 → Pi。

### T-L4：remote Turso E5/E6/E7 同型实测（落点已御裁 A）

- **范围**：复刻 T-A 实验（`tests/db/ta-transaction-feasibility.test.ts` 的实验设计，见其头部文档）对真实 Turso 远程库：
  - **E5 同型**：双连接并发写 `_probe_race_tmp`，观测远程 HTTP 下 BUSY / 丢失行为（Hrana over HTTP 事务语义与 file: 不同，这是本票核心未知数）；
  - **E6 同型**：单连接 promise-chain mutex + `transaction('write')`，60 轮双连接并发 → 断言 0 丢失 0 错误（修复形态在远程的实测确认）;
  - **E7 同型**：失败回滚后锁泄漏的远程表现 + 客户端 close 回收是否恢复。
  - 环境门控 `TURSO_RACE_EXPERIMENT=1` 手动跑（同 T-A 惯例），不进 vitest 常规收集。
- **实验安全序**（A 方案定案）：① 起跑前 `sqlite_master` 快照留档（当前仅 `game_stats`）；② 只对 `_probe_*` 前缀表建/写/删；③ 每个实验配置收尾立即清表，全脚本 finally 关闭全部连接；④ 收口复查 `sqlite_master` 无 `_probe_*` 残留，前后快照一起入 evidence。
- **验收**：实验结果表（写入 `.omo/evidence/` + 计划收口批注）；`lib/db.ts` 行为契约注释升级（「remote 实测 2026-09-XX：……」取代「合理推断」级表述）；`docs/operations.md` Turso 节补充实测边界注；实验前后 `sqlite_master` 快照对照（`_probe_*` 零残留、`game_stats` 原样）。
- **边界与红线**：
  - 远程库是**生产库**（`tic-tac-toe-onepisya`，aws-us-east-1，Vercel 同源）：只建/删 `_probe_*` 前缀临时表，**绝不碰 `game_stats`**；实验失败立即 close 全部连接。
  - token 只在脚本运行时从 `.env.local` 现读，不进任何 commit / 文档 / brief / 日志。
  - 实测边界仍写明：验证的是「单客户端进程 + 远程 HTTP DB」；多实例 last-write-wins 是分布式边界，不在承诺内（Out of scope 承接地图声明）。
- **预估**：45-60 分钟。

## 三、项4 预检事实（2026-09-24 已核）

| 事实 | 结果 |
|---|---|
| 凭据位置 | `.env.local`（gitignored）：`DATABASE_URL=libsql://tic-tac-toe-onepisya-onepisya.aws-us-east-1.turso.io` + `DATABASE_AUTH_TOKEN`（348 字符 JWT） |
| token 活性 | ✅ 只读试连 `SELECT 1` 成功，往返 1110ms（预检脚本 `.omo/evidence/turso-preflight.mjs`，token 未回显） |
| 远程库现状 | 仅 `game_stats` 一表（旧 schema，新版 bootstrap 未在其上跑过）；实验不受影响（用 `_probe_*` 临时表） |
| CLI 登录态 | turso v1.0.32 已装（`~/.turso`，PATH 已配 zshrc:561）但**未登录**——仅 `turso db shell` 旁路对照时才需要；node 侧 `@libsql/client` 带 token 直连即可，本票不依赖 CLI 登录 |
| 旧操作手册 | [docs/local-turso-setup.md](../../docs/local-turso-setup.md)（建库/取 URL/取 token 全流程）；token 失效时重签：`turso auth login` → `turso db tokens create tic-tac-toe-onepisya` |

## 四、正交性与执行顺序

| 票 | 文件面 | 上下文域 | 并行性 |
|---|---|---|---|
| T-L1 | tests/qa/rooms-race-qa.mjs + business-rules.md | rooms-race 链 | 与 L2 文件面不相交，可并行 |
| T-L2 | tests/qa 13 孤儿 + probe-reconciliation 白名单 | 孤儿历史语境 | 与 L1 不同文件面，可并行 |
| T-L3 | lib/room-name.ts | 单文件 | 独立，随时可跑 |
| T-L4 | lib/db.ts 注释 + 一次性脚本 + operations.md | T-A 实验语境（会话级锁状态） | 独立，调度者亲自与外派并行无冲突 |

**波次**：波1 四票并行（L1→codex 席 A，L2→codex 席 B，L3→Pi，L4→调度者亲自）；波2 调度者统一收口——六层门禁 + R6 校验 + 本计划收口入档 + commit。

### 波2 收口动作：decisions-pending-20260924.md 批注转已决

- **时机**：四票全部收口后（各票 commit 指针齐备）一次性批注，不中途改。
- **批注方式**（原文全保留，文档性质从「待裁决」转「决策记录」，不删不改历史内容）：
  - 头部加收口行：四项已全部裁决并落实，执行计划见本文件，逐项去向见各节批注；
  - 每项「选项与建议」表后追加裁决行：主公裁决原文（项1 立小票 / 项2 处理悬空与孤儿 / 项3 立小票 / 项4 用已有 Turso key）、落实去向（T-Lx 票 + commit SHA）、与调度者原建议的差异如实留痕（项1/2/4 主公改判为主动处理，项3 与建议一致）。
- **归档**：批注后的 decisions-pending-20260924.md 随波2 收口 commit 入档，作为本轮决策档案。

## 五、T-L4 落点裁决（2026-09-24 主公御裁）

**裁决 = A**：直接用生产库 + `_probe_*` 临时表（零额外操作，表级隔离，实验分钟级写锁在作品集低流量下影响面小）。选项 B（主公 `turso auth login` → `turso db create` 建 staging 库）作废留档，token 失效等异常时才升级启用。安全序见 T-L4 票面「实验安全序」四步。

## 六、全局纪律（brief 模板已含）

- commit 排版硬规则：WHAT:/WHY:/HOW: 各自独立行、正文每行 ≤72 字符、subject 小写/CJK 开头（`docs/commit-policy.md`，exemplar 2e7104d）；禁 `--no-verify`。
- 席位产出的 plan 文件随收口 commit 入档；证据留 `.omo/evidence/`（gitignored）不 commit。
- 每席收尾独立复跑六层验收；调席不重发 brief，卡审批门用 "approve" 解锁。
