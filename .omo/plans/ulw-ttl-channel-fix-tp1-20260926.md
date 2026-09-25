# 计划：TTL 调整通道修复 — T-P1 单票（ulw）

> 性质：执行计划（worker-facing，T-P1 单票；T-P2 分支清扫归调度者）。
> 关系：上承 `.omo/plans/ulw-ttl-channel-and-cleanup-20260926.md`（决策总览），本票是该计划 T-P1 的实施落地页。
> 基线：dev @ `8f7a114`（主公 2026-09-26 批注：Q3 选 a、Q4 维持 30 天）。
> 授权：ulw-plan 流程审批前置授予，调度者视同已批，直派直做。

---

## 一、目标（SMART）

把「TTL 自动回收端点调用服务时不传显式 TTL」这条不变量从代码层与契约测试层同时钉死，使得未来在 `lib/db.ts:679` 改 `maxAgeDays = 30` 这一个常数即可全局生效，零端点对账。

## 二、改动清单（4 行 / 3 个位置）

| # | 文件 | 行 | 改前 | 改后 |
|---|---|---|---|---|
| 1 | `app/api/maintenance/purge/route.ts` | 64 | `await purgeStaleRooms(30);` | `await purgeStaleRooms();` |
| 2 | `app/api/maintenance/purge/route.ts` | 75 | `await purgeStaleRooms(30);` | `await purgeStaleRooms();` |
| 3 | `tests/api/maintenance-purge.test.ts` | 114 | `expect(purgeStaleRoomsMock).toHaveBeenCalledWith(30);` | `expect(purgeStaleRoomsMock).toHaveBeenCalledWith();` |
| 4 | `tests/api/maintenance-purge.test.ts` | 129 | `expect(purgeStaleRoomsMock).toHaveBeenCalledWith(30);` | `expect(purgeStaleRoomsMock).toHaveBeenCalledWith();` |

约束：route.ts 两处调用必须保留，只删实参；禁止删调用、改函数名、内联实现。

## 三、明确不改（负面清单 / 越界即 drift）

- `lib/db.ts` — `purgeStaleRooms(maxAgeDays = 30)` 本体与默认值（Q4 已裁决维持 30 天）。
- `tests/db/db.test.ts` — 服务层边界测试（line 988/1012/1019）显式传 30/0/1 是测服务参数语义，与端点契约正交。
- `docs/operations.md` — 「仅改一处」承诺修复后自动成立，零文档改动。
- `README.md` / `docs/business-rules.md` — 端点行与 BR-12 行「30 天不活跃」均为默认值语义，修复后仍真。
- 前端组件、`tests/qa/` 全部探针、`.github/`、`tests/qa/commit-audit.mjs`、`commitlint.config.cjs`。
- `next-env.d.ts` — 未提交 M 状态为 dev/build 变体翻转噪声：勿提交、勿还原、勿理会。
- 任何 `git branch` 删除（T-P2 归调度者）。

## 四、验收标准（AC，机器可判定）

| # | 项 | 期望 | 实测 |
|---|---|---|---|
| AC-1 | `pnpm vitest run` | 全绿；基线 540 passed / 11 skipped 不减 | 540 passed / 11 skipped PASS |
| AC-2 | `pnpm typecheck` | exit 0 | exit 0 PASS |
| AC-2 | `pnpm lint` | 0 errors（warnings 可接受但不得新增） | 0 errors（12 warnings 均为既有 `.zcode/workflow-runs/*` 噪声，未新增） PASS |
| AC-2 | `pnpm build` | exit 0 + `/api/maintenance/purge` 路由编译通过 | exit 0 PASS |
| AC-3 | 负对照 `rg 'purgeStaleRooms\([^)\s]' app/` | 零命中 | 零命中 PASS |
| AC-4 | `git commit` 经 commit-msg hook | exit 0 | 待 commit 后实测 |
| 端口 | `lsof -ti :3000 :3009 :3101` | 全空 | 全空 PASS |

## 五、commit 契约

- 主题：`fix(api): TTL 调整通道改一处生效——端点删显式实参`
- 正文：WHAT/WHY/HOW 各独占一段，每行 <=72 字符；trailer 每行 <=100 字符。
- 必备 trailer：`Confidence: high`、`Scope-risk: narrow`、`Plan: .omo/plans/ulw-ttl-channel-fix-tp1-20260926.md`。
- 类型枚举 / 中文开头 / subject 长度 / Plan footer 均交由 `tests/qa/commit-audit.mjs` 校验。
- 禁 `--no-verify`、禁改 hook / commit-audit / commitlint 配置。

## 六、执行序列

1. 代码编辑（route.ts x 2 + test.ts x 2，python in-place 安全替换）。
2. 跑 AC-1 / AC-2 / AC-3 取证。
3. 写本 plan 文件入 `.omo/plans/`。
4. `git add` route.ts + test.ts + 本 plan；显式不 add `next-env.d.ts`。
5. `git commit` 经 commit-msg hook。
6. `git log -1` 取 commit sha + 写双通道报告。

## 七、风险与回滚

- 风险：极窄（端点契约反转 + 2 处断言语义翻转；服务层默认值不变，端点->服务->DB 三段语义保持一致）。
- 回滚：`git revert <sha>` 即可，端点恢复显式 `(30)` 实参，测试恢复显式 `toHaveBeenCalledWith(30)`，全套一致。
- 行为回归：Vercel Cron 仍以 GET 命中，行为对齐默认 30 天不活跃；探针 `tests/qa/` 无相关门，故未触及。
