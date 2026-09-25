# 计划：TTL 调整通道修复 + 受阻分支清扫（ulw）

> 性质：已实现（T-P1 由 2d7709b 2026-09-26 fix(api) 端点删显式实参落地，T-P2 分支清扫已清空 ulw/* 全部指针；状态线 2026-09-26 按 git 实况修正）
> 基线：dev @ `82758cc`（本地另有两笔 docs 待主公 push：1066dc3 复利存档、82758cc 调研报告）。
> Q2（CRON_SECRET 配置）、Q6（验收结论 + 稳定 tag）**不在本票**，仍待主公。

---

## 一、事实链（2026-09-26 实测）

| # | 事实 | 证据 |
|---|---|---|
| 1 | 端点两处显式传参，「改默认参数一处」不生效 | `app/api/maintenance/purge/route.ts:64`、`:75` 均 `await purgeStaleRooms(30)` |
| 2 | 错误契约被测试钉死 | `tests/api/maintenance-purge.test.ts:114`、`:129` 均 `expect(purgeStaleRoomsMock).toHaveBeenCalledWith(30)` |
| 3 | 服务层边界测试显式传 30/0/1——测的是服务参数语义，与端点契约无关 | `tests/db/db.test.ts:988,1012,1019`（**禁改**） |
| 4 | 默认参数本体，Q4 维持 | `lib/db.ts:678-679` `purgeStaleRooms(maxAgeDays = 30)`（**禁改本体**） |
| 5 | 运维文档「仅改一处」承诺——修复后自动成立，零文档改动 | `docs/operations.md:274-276` |
| 6 | README 端点行与 BR-12 行「30 天不活跃」均为默认值语义，修复后仍真 | `README.md:90`、`docs/business-rules.md:22`（**零改动**） |
| 7 | `ulw/t-n4` 在（f8f2480，跑偏产物，内容已被 dev 各席等价覆盖，留档价值在交接报告 §四） | `git branch -l ulw/*` |
| 8 | 另有四条已 ff 合入的冗余分支指针 | `ulw/t-m1`、`ulw/t-n13`、`ulw/t-n2`、`ulw/t-close`（`-d` 仅删已合入，安全） |
| 9 | worktree 已全清 | `git worktree list` 仅主检出 |

## 二、票面

### T-P1：Q3 TTL 调整通道修复（建议调度者亲自；备选 herdr codex 单席 `$omo:start-work`）

- **改动 4 行、3 个文件位置**：
  - `route.ts:64` `purgeStaleRooms(30)` → `purgeStaleRooms()`
  - `route.ts:75` 同上
  - `maintenance-purge.test.ts:114`、`:129` `toHaveBeenCalledWith(30)` → `toHaveBeenCalledWith()`（把「端点不得传显式 TTL」钉进契约，防回归）
- **明确不改**：`lib/db.ts` 本体与默认值 30（Q4 裁决）、`db.test.ts` 服务层边界测试、`operations.md`（修复后承诺自动成立）、README、BR 表、前端、探针。
- **验收（AC）**：① vitest 全绿基线 540+11 不减；② typecheck / lint / build 绿；③ 负对照 `rg 'purgeStaleRooms\(' app/` 零命中（字面实参清零）；④ commit-msg hook 一次过。
- **commit 契约**：`fix(api): TTL 调整通道改一处生效——端点删显式实参`（中文开头；WHAT/WHY/HOW 排版；`Confidence: high` / `Scope-risk: narrow` / `Plan:` 本计划）。
- **执行形态理由**：≤5 行且含一处测试断言语义决策，调度者亲自的转录失真面小于派席；主公若要走 omo 流程则改派单席。

### T-P2：Q5 分支清扫（调度者亲自，bash 级）

- `git branch -D ulw/t-n4`（主公已裁决删除；未合入需 `-D`）。
- 顺带收尾惯例：`git branch -d ulw/t-m1 ulw/t-n13 ulw/t-n2 ulw/t-close`（事实 #8，`-d` 拒删未合入，零风险）。
- 可选：`/tmp/ttt-wt-20260925` 席位现场清扫（briefs/reports；/tmp 重启自清，非必须）。

## 三、正交性与波次

单波串行：T-P1 → T-P2，文件面不相交，合计 ≤10 分钟。执行完回报门禁数字；新增 1 笔 commit（+删除分支）待主公亲手 push（沿用 Q1 惯例）。

## 四、边界声明

- Q2 / Q6 待定项不在本票；本票不阻塞其后续（Q2 是 Vercel 侧操作，Q6 等主公验收结论）。
- C2（文档契约测试，调研报告候选）按主公「暂不开坑」指令不入本票，唤醒条件见[调研报告 §六](../research-rules-mechanization-20260926.md)。
- 修复后语义：「改 TTL 只改 `lib/db.ts:679` 一个常数」自此成立；`operations.md` 承诺不再需要人工对账。
