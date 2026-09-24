# 待主公裁决事项（2026-09-24 汇总，rooms-race 波收口开出）

> 性质：决策支持文档。每项按「事实 → 选项 → 调度者建议」组织；裁决结果可直接批注在本文件对应项下，由下次会话落实。本波主线（rooms-race 七票）已全链收口，地图 [ulw-rooms-race-map-20260924.md](plans/ulw-rooms-race-map-20260924.md) 为准，此处只列收口时开出的遗留小项。
>
> **【收口批注 2026-09-24】四项已全部裁决并落实**：主公当日批注（项1 立小票 / 项2 处理悬空与孤儿 / 项3 立小票 / 项4 用已有 Turso key 处理），执行计划 [ulw-legacy-four-cleanup-20260924.md](plans/ulw-legacy-four-cleanup-20260924.md)，逐项去向见各节批注。本文档转为决策记录，原文保留。

---

## 项 1：BR-10 merge→409 半边探针缺口

### 事实

- BR-10（合并/上报不静默建档）的反面场景有两半：merge 对未登记房间 409、outcomes 对未知房间 404。新探针 `rooms-race-qa.mjs` step 5 只盖 outcomes→404；merge→409 半边的原探针 `merge-sync-qa.mjs` 已退役为 DISABLED 存根，其 merge 部分无人接位。
- 已如实标注：`docs/business-rules.md` BR-10 探针列（`54045f7`）；R6 校验不阻断（存根豁免）。
- 409 语义有单测覆盖（service 层），缺的是端到端半边。

### 选项与建议

| 选项 | 利 | 弊 |
|---|---|---|
| 立小票：rooms-race-qa 补 step 8（merge→409→problem+json） | BR-10 双半边端到端闭环 | 单独一张席票（估 20-30 分钟）只为一半场景 |
| 维持标注，下次触及 merge 链的票顺带 | 零成本 | 缺口可能长期挂白名单标注 |

**调度者建议**：维持标注、挂「顺带触发」——merge→409 的产品语义近期无变更计划，单开一票的调度成本与风险不成比例。

> **【已决 2026-09-24】主公裁决：立小票**（改判，高于调度者建议）。落实：T-L1 → rooms-race-qa.mjs step 8（merge→409→enter-room-required + 不静默建档双确认），commit `dc352ed`；BR-10 探针列已改指 step 8。

---

## 项 2：KNOWN_ORPHANS 13 条历史悬空探针 triage

### 事实

- 机械对账用例（`tests/qa/probe-reconciliation.test.ts`）反向扫描发现 13 个 tests/qa/*.mjs 既无 ci.yml/docs 引用也无 DISABLED 标记，已进 KNOWN_ORPHANS 白名单（每条带 triage TODO）。
- 白名单是「已知悬空」的显式登记，不是健康态；新增悬空会立即 FAIL。

### 选项与建议

| 选项 | 利 | 弊 |
|---|---|---|
| 批量 triage 票（逐条判：删 / 补引用 / 加 DISABLED / 归档） | 对账白名单清零，探针目录恢复「每文件有主」 | 一张中票（估 45-60 分钟，13 条逐条判需要历史语境） |
| 维持现状 | 零成本 | 白名单常驻，新悬空的信噪比被稀释 |

**调度者建议**：批量 triage 票按需立——下次大规模动 tests/qa 前先跑它；若近期无此类波次，可在下个稳定 tag 前作为清理票带上。

> **【已决 2026-09-24】主公裁决：处理悬空问题，孤儿需要处理**（改判，高于调度者建议）。落实：T-L2 → 13 条逐条四选一处置，白名单清零（13→0），commit `361cff0`；其中 5 个有活回归向量的探针接进 ci.yml 新 job（main-gate ruleset required checks 已同步至 11 项，与 ci.yml job 严格对齐）。两项收口判定：① `merge-sync-qa.mjs`（DISABLED 存根，经 DISABLED 豁免通道不在 13 条名单内）**维持存根**——BR-5 行仍引用其 merge 幂等语义指针，BR-10 的 409 反面已由 rooms-race step 8（`dc352ed`）接位，无删除必要；② qa:audit 既有红项 `magick` unlisted binaries ×2（3eb769a PWA 波 favicon 脚本）以 knip.json `ignoreBinaries` 声明收编，qa:audit 复跑归零。

---

## 项 3：lib/room-name.ts 遗留重复导出（knip 首跑发现）

### 事实

- `pnpm qa:audit`（knip）首跑发现 `lib/room-name.ts` 的 `emptyStats` / `GameStats` 导出全仓无引用方——真源在 `lib/game.ts`（`lib/db.ts` 只 import 后者），疑似房间迁移波（name→room rename）留下的重复体。
- knip 是定期体检不进 CI（D3 裁决），该发现已记入波次报告。

### 选项与建议

| 选项 | 利 | 弊 |
|---|---|---|
| 立清理票（删重复导出或加重导出别名归一） | 消灭双真源隐患；qa:audit 输出归零 | 极小的改动面审查成本 |
| 不动 | 零成本 | 双真源漂移风险（改一处漏一处） |

**调度者建议**：立小票（10 分钟级、单文件、有 505 测试基线护航），可与项 1/2 合并成一张「qa 卫生票」一次派掉。

> **【已决 2026-09-24】主公裁决：立小票处理**（与调度者建议一致）。落实：T-L3 → 删 `lib/room-name.ts` 对 game 符号的重导出去重（-10 行），commit `9123a0b`；qa:audit 该项归零。

---

## 项 4：remote Turso 端到端事务实测

### 事实

- T-A 实验的 E5/E7（BUSY / 锁泄漏）是 file: 双连接事实；remote HTTP 侧只核实了 API 形态（HttpClient.transaction 存在，http.js:189），未对真实 Turso 实例跑过——本地无凭据。
- 已按「单进程互斥保证 + 多实例 last-write-wins 残差」在 lib/db.ts 注释标注适用范围；地图 Out of scope 声明不做分布式承诺。

### 选项与建议

| 选项 | 利 | 弊 |
|---|---|---|
| 有 staging Turso 凭据时跑一次 E5 同型实测 | 适用范围标注升级为实测结论 | 需要凭据与一次性环境 |
| 永久维持文档标注 | 零成本 | 多实例行为停留在「合理推断」级 |

**调度者建议**：维持标注即可——作品集部署为单实例 Vercel，单进程互斥（已实测）是当前唯一真实并发面；凭据出现前不值得为推断级问题开工。

> **【已决 2026-09-24】主公裁决：用已有 Turso key 处理**（改判，高于调度者建议；主公提示 key 在 env——侦查证实 `.env.local` 凭据完好，token 试连 SELECT 1 通过）。落实：T-L4 御裁 A 落点（生产库 + `_probe_*` 临时表）实测完成——R-E5 30/30、R-E6 60/60、R-E7 20/20 全部终值精确、零锁泄漏；**多实例「last-write-wins」推断被实测窄化**（三步在单事务内时服务端串行化，远程不丢）。commit `7447b64`（回归锚 + lib/db.ts 注释升级 + operations/learnings）；实验报告 `.omo/evidence/turso-race/T-L4-remote-turso-race-report.md`。
