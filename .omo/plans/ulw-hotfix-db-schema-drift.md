# ulw · hotfix：存量库缺 name 列炸服（getDb 自愈迁移）+ 评审盲区补席

- **日期**：2026-09-18
- **状态**：APPROVED（主公 2026-09-18 谕「安排 agent 去做……修复前先写计划（ulw）」，plan mode 批复）
- **触发**：主公本地 :3000 起服 `GET /` 500——`no such column: "name"`；W1（d9ad855）给 game_stats 加 name 列后，`.env.local` 指向的存量库物理结构仍停在旧形状
- **基线**：dev @ e405db6（ulw-name-login-one-truth 已收官，V5 ACCEPT）

---

## 0. 根因（探索席双确认，file:line 实证）

1. **schema 真相两份**：`db/schema.ts`（drizzle 声明）与 `lib/db.ts:133-144` 手写 bootstrap DDL。W1 两份同步加了 `name TEXT UNIQUE`，但 DDL 是 `CREATE TABLE IF NOT EXISTS`——对已存在的旧表是 no-op，永不补列。
2. **零迁移层**：全仓无 drizzle 迁移目录/`migrate()`/PRAGMA/ALTER/user_version。`db:generate`/`db:push` 从未接入运行时。物理实证：`data/scratch-test.db`（9/17，W1 前）无 name 列且含 solo_records。
3. **修复单点**：`getDb()`（lib/db.ts:127 唯一建客户端点），5 个 API 路由全部必经——一处 reconcile 全覆盖。

## 1. 为什么测试没抓到（原理性盲区，流程性补丁）

- db 测试每次 `mkdtemp` 空目录、由生产代码自己的 bootstrap DDL 现建库——「代码与它刚建的表一致」恒真；API 测试整层 mock 不碰 sqlite；QA 探针全指向一次性新库（W4 `/tmp/ulw-nlit-w4/verify.db`）。带旧 schema 的持久库从未进入任何测试路径。
- CR/V5 均为 fresh session，但 **fresh session ≠ 视角多样性**：A1–A12 验收清单没有一条覆盖「存量库/既有环境」——CR 验了两份 schema 真相互相一致（确实一致），没人问「上个月代码建的库会怎样」。
- 补丁：① 本计划新增 legacy 库迁移测试类；② AGENTS.md 反模式行固化「schema 变更必须带 reconcile + legacy 迁移测试」；③ 独立评审席以 $omo:review-work 专查盲区类缺陷。

## 2. 裁断（主公未另谕，按推荐项与既批先例）

- 迁移机制：**getDb 启动自愈 reconcile**（非 drizzle-kit 管线、非手动脚本）。
- 旧 solo_records：**直接 DROP**（沿用 ulw-name-login-one-truth §7「不做搬迁」，data/ 内皆 QA 残留）。

## 3. 波次

| 波 | 内容 | 门禁 |
|---|---|---|
| W1 | 红测试复现（旧 DDL 建库 → loadStats 炸）→ getDb bootstrap 加 reconcile：`SELECT name FROM pragma_table_info('game_stats')` 缺 name → 事务内重建（新形状含 name TEXT UNIQUE → INSERT SELECT 共有列 → DROP → RENAME）+ `DROP TABLE IF EXISTS solo_records` → 绿测试集（种子保留/UNIQUE 实证/幂等/fresh-legacy 列集相等）→ AGENTS.md 反模式行 | 六层 + legacy 迁移测试全绿 + 既有 271 测试零回归 |
| R-DRIFT | 独立评审席（fresh codex + **$omo:review-work**）：审 a732b8f..aebd837 全范围 + hotfix commit；章程专查同盲区类缺陷（存量环境漂移/双份 schema 真相/既有数据兼容/迁移幂等与事务边界）+ 正式回答「review 流程为何集体漏检」 | reports/review/RC-drift.md；P0/P1 即修即复审 |

## 4. 验收（机器可判）

| # | 验收项 | 判定 |
|---|---|---|
| A1 | legacy 自愈 | 旧形状库（种子 id=1 totalGames=7 + solo_records）启动后：loadStats 返回 7、name 列存在且 UNIQUE 实证、solo_records 已删、closeDb+重开幂等 |
| A2 | fresh 零回归 | 既有 271 测试全绿 + fresh 库与 legacy 迁移后 PRAGMA 列集相等 |
| A3 | 真实环境 | 主公重启 :3000 后 `GET /` 200（.env.local 指向库自动迁移） |
| A4 | 门禁 | 六层 × 每 commit 全绿 |
| A5 | 评审席 | RC-drift.md 无未处置 P0/P1 |

## 5. 执行协议

- fresh codex（herdr 3t，**tab** 非 split pane）；W1 教-back 先行、一回合到底；调度者（ZCode）派发/轮询/独立验收；评审席调 $omo:review-work。
- dev 分支；每 commit 六层 + lore trailer（Scope-risk 用枚举）+ Plan footer；禁 --no-verify；探针 :3101 不触 :3000。
