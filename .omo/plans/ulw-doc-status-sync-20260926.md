# 计划：全仓文档状态线对账与状态总图入档（doc-status-sync）

> 性质：docs-only 执行计划，**已执行完毕**（本档即执行记录，供后续提交 Plan: footer 引用）。
> 缘起：主公 2026-09-26 令——更新相关文档状态 + 梳理全仓文档状态。
> 基线：dev @ `2d7709b`（ahead 4：`1066dc3` / `82758cc` / `8f7a114` / `2d7709b`，未 push）。日期：2026-09-26。

---

## 一、背景

两计划波交接后（[handover-20260926](../handover-20260926-two-plans-wave.md) §五 开出六项裁决，主公已批四项），仓内多份计划头部状态线停留在「执行中 / proposed / drafting / 待批准」等进行时措辞，而 git 实况实现早已落地——主动误导检索者。主公 2026-09-26 令两件事：①按 git 实况更新相关状态；②产出全仓 .omo 文档状态总图。

## 二、范围

- **对象**：.omo/plans/*.md 全部 117 份（4 席并行逐份核查）+ .omo 根级决策/交接/调研文档 6 份。
- **动作**：状态线核验（裁决/收口事实类——APPROVED、拍板、DONE、accepted、收口标记——按纪律不动）+ 误导性进行时状态线修正 13 份 + 总图 [.omo/doc-status-map-20260926.md](../doc-status-map-20260926.md)（七节）入档。
- **不做**：零代码/测试/CI 改动；不动 gitignored 运行区（drafts/、evidence/、ulw-loop/、start-work/）；**绝不 git add / commit / push**。

## 三、验收 AC

- **AC1 状态线修正逐份有 git 证据**：13 份 oldLine 均整行精确匹配替换（无模糊替换），每份修正行内嵌证据 hash，逐份清单见 §4.2；素材全部证据 hash 经成图后脚本 `git rev-parse --verify` 校验在档。
- **AC2 总图入档**：.omo/doc-status-map-20260926.md 七节齐全（总览 / open 项 / 全景表 108 行 / 占位 / 非可执行 / 调研 / 方法与盲区），图中每个 commit hash 来自核查素材或本波 git 亲验。
- **AC3 门禁适用层过**：① vitest / ② typecheck / ③ lint 实跑通过（§4.3）；build 与浏览器探针两层按 docs-only 豁免未跑（盲区记总图 §七）；commit-audit 属 commit 时层，本波不入 commit，待提交时由 commit-msg hook 把关。
- **AC4 不卷入无关脏文件**：git status 仅含 13 份 M 计划 + 2 份本波新档；next-env.d.ts 未卷入（handover §二曾记其 dev/build 翻转噪声，本波未触碰，现况干净）。
- **AC5 不 push**：本波零 git add / commit / push，dev ahead 4 维持不变，push 沿例待主公亲手。

## 四、执行记录

### 4.1 核查总口径

核查素材（派单方随任务下发的 117 份结构化核查结论，字段 file / verdict / oldLine / newLine / evidence / note；原始记录未入库，关键 hash 已按总图 §七 亲验兜底）verdict 分布：**implemented 108 / filed-only 2 / placeholder 1 / 非可执行记录 6**；13 份状态线修正；open 项候选逐一读档复核后确认 4 项真 open（anonymous-online drafting、rules-mechanization 待唤醒、handover Q2/Q6、research-session-orthogonality 提案本体待主公审查——末项为本核查新增），2 项实况已闭移出（ttl 计划已实现、decisions-pending 四项全决），1 项 filed-only 存档非 open（edge-runtime-migration，已终结尝试，总图 §2.3）。

### 4.2 状态线修正 13 份逐份清单

| # | file | oldLine（摘） | 修正后状态线证据 |
|---|---|---|---|
| 1 | ci-artifact-hidden-files.md | `- 状态：执行中` | 已实现（`8e08814` ci include-hidden-files 与计划同一提交） |
| 2 | recovery-from-unknown-cleanup.md | `- **状态**: 待执行（planner: pi；executor: Codex @ herdr w1:p1）` | 已执行完毕（`adbdfbd` 计划与 §5.2 执行实录同档；`a74b44e` 同日复盘） |
| 3 | ci-pnpm-single-source.md | `- 状态：执行中` | 已实现（`42569b4` 删 ci.yml 显式 version，计划与实现同一提交） |
| 4 | ulw-agents-md-router-20260922.md | `- 状态: drafting → 待主公 aligned 门确认` | 已实现（`932835f` 主项目块 222→52 行 + 8 外化文件，同一提交） |
| 5 | ulw-font-preload-residual-20260922.md | `- 状态: proposed（待主公批准执行）` | 已实现（`11baadd` 拆除 next/font preload） |
| 6 | ulw-home-merge-trigger-spec-20260922.md | `- 状态: executing（主公 decree 同日当面下达…）` | 已实现（`1c34780` BR-1 导航转换触发 + 业务规则外化） |
| 7 | ulw-transition-alert-unit-tests-20260923.md | `- 状态: 执行中（test/transition-alert-units worktree；基线 667b9ea）` | 已实现（`bdfc352` 两测试文件同提交入档） |
| 8 | ulw-font-preload-sw-fetch-20260914.md | `- 状态: executing` | 已实现（`fa76a39` Fix A/B + 探针同票落地） |
| 9 | ulw-room-migration-home-landing.md | `- **状态**：已与维护者达成一致（三决议见 §0），待批准执行` | 已实现（`7586e82`/`c75cfdf` W1 迁移、`e6bd762` W3 探针、`a8abea9` V9 终验 ACCEPT-WITH-NOTES） |
| 10 | ulw-ttl-channel-and-cleanup-20260926.md | `> 性质：执行计划，待主公批准后派发…` | 已实现（`2d7709b` T-P1 落地；T-P2 分支清空 `git branch -l 'ulw/*'` 亲测为空） |
| 11 | open-source-readiness.md | frontmatter `status: proposed` | implemented（M1-M5 当日五提交 `f62238c`/`1934f8e`/`d76745a`/`c36c49c`/`ba37a61`） |
| 12 | ulw-ci-visualqa-artifact-20260913.md | `- 状态：派发 fresh codex 执行中（调度者：本 session）` | 已实现（`64ccec0` visual QA 经 artifact 下发构建，Plan footer 指本档） |
| 13 | ulw-intent-anchoring-20260922.md | `- 状态: executing（主公 decree 同日下达…）` | 已实现（`81ee7b9` 意图锚定四文档落地，vitest 469/469） |

### 4.3 门禁实跑（2026-09-26 04:33）

| 门禁 | 命令 | 结果 |
|---|---|---|
| ① vitest | `pnpm test` | 540 passed \| 11 skipped（551）——与交接报告 §二台账基线一致 |
| ② typecheck | `pnpm typecheck` | exit 0 |
| ③ lint | `pnpm lint` | exit 0（0 errors / 16 warnings 存量） |
| ④ build / ⑥ 浏览器探针 | —— | docs-only 波未跑（总图 §七盲区如实记） |
| ⑤ commit-audit | —— | commit 时层，本波不入 commit，提交时 hook 把关 |

### 4.4 收尾状态

- 工作树仅含 13 份 M 计划 + 2 份本波新档（总图 + 本档）；next-env.d.ts 未卷入（AC4 ✅）。
- dev ahead 4 维持不变，本波零提交零 push（AC5 ✅）。
- 后续：调度者按惯例以 `docs(plans)` 提交本波（Plan: footer 指本档），push 待主公；总图 §二 所列 open 项中 Q2/Q6 等主公，anonymous-online 等裁决，rules-mechanization 等唤醒，session-orthogonality 提案本体等主公审查（edge-runtime-migration 为 filed-only 存档，非 open）。
