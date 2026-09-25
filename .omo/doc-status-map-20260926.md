# 全仓 .omo 文档状态总图（2026-09-26）

> 性质：全仓文档状态盘点——117 份计划逐份裁决 + 根级决策/交接/调研文档盘点，供调度者与主公随时对账「还有什么没做、在等谁」。
> 方法：git log --grep 对账 + 头部状态线核验（4 席并行）+ 状态线修正 13 份；open 项候选逐一读档复核，关键 hash 亲验（git show / rev-parse / rg / git branch）。
> 日期：2026-09-26。基线：dev @ `2d7709b`（ahead 4，origin/dev = `74a26cb`；未 push 四笔见 §七）。

---

## 一、总览

| 分类 | 数量与一句话 |
|---|---|
| .omo/plans/*.md | 117 份全查：已实现 108（其中 13 份状态线本波按 git 实况修正）、filed-only 2（ulw-anonymous-online-server-row-missing、edge-runtime-migration，均见 §二）、placeholder 1、非可执行记录 6（§三/§四/§五） |
| .omo/research-*.md | 3 份：1 待唤醒、1 已兑现、1 提案本体待主公审查（方法论已复利入 playbook；§二 第 4 项、§六） |
| 根级决策/交接文档 | 3 份：两份决策记录已闭合、handover-20260926 余 Q2/Q6 两项待主公（§二/§五） |
| 运行区（gitignored，不入图） | drafts/ 17 份、evidence/ 541、ulw-loop/ 91、start-work/ledger.jsonl、sessions.local.md（.gitignore:113-134），盲区见 §七 |
| 工具状态 | boulder.json（omo work 状态文件，非文档）；本图与本波计划档入档后：plans 共 118 份、根级 md 共 8 份（含 gitignored 的 sessions.local.md 与本图） |

---

## 二、未实现与待裁决（真正的 open 项）

> 派单摘要（本波 workflow 派单指令，不在仓内）原列五项，逐一读档核实后：摘要三项确认为 open，另两项实况已闭（见 2.2）；本核查另新增 open 一项（第 4 项）与 filed-only 存档一项（见 2.3，非 open）。本节所称「摘要／素材」的出处对质口径见 §七 方法 3。

### 2.1 确认 open（4 项）

**1. `.omo/plans/ulw-anonymous-online-server-row-missing-20260922.md`**（filed-only 两份之一）
- 状态：drafting（该计划 `:4` 状态行，本波核验与实况一致，未修正）。
- 卡点：等主公两道裁决——该计划 §四 产品裁决（其 §三 方案 A 静默重定向 / B 显式 resync 弹框 / C 进房拦截 / D 服务端 auto-register）+ §五 技术裁决（若选 B，弹框文案/复用弹框/匿名继续语义三项）；§九 审批门通过后才翻 ready-for-approval 派发。
- 证据 commit：`5c160c6`（2026-09-22，质量复查波 w-rv 的 P3 批次收口提交；本档系同波 P2#4 号 finding 拆出的 follow-up plan 骨架。唯一提交，本波 git show 验证在档）；此后无实现提交（相关 fix 均属其他计划）。

**2. `.omo/research-rules-mechanization-20260926.md`**
- 状态：调研入档待唤醒，不立项不开坑（主公 2026-09-26 明示「等需要的时候再拉出来编写计划」）。
- 卡点：该调研档 §五 候选行动项 C1-C5 **全部未裁决**（机械化状态字段 / 文档契约测试 / ast-grep 进 CI / eslint --fix / 派发红线模板化）；唤醒条件四条（该调研档 §六）——①同类错误三犯 ②t-n4 型派发漂移再犯（＝执行席把单票任务误读为整份计划自行多票派发，实例与处置见交接报告 §四.1）③Q3 落地后评估 C2——触发事件已发生（Q3 已由 `2d7709b` 落地），但主公明示「暂不开坑」，评估动作被搁置，待主公点头或点名补做 ④主公点名「规则机械化」。
- 证据 commit：`82758cc`（2026-09-26 docs(research) 入档待唤醒）。

**3. `.omo/handover-20260926-two-plans-wave.md`**
- 状态：交接报告 §五 待主公决策清单六项，主公 2026-09-26 已批四项（Q1 push→origin/dev 已到 `74a26cb`，本波 rev-parse 亲测；Q3 选 a→`2d7709b` 落地；Q4 维持 30 天；Q5 删 `ulw/t-n4`→分支引用已不在：`git branch -l 'ulw/*'` 亲测为空，且该分支曾存在的书证与物证俱在——交接报告 §四.1 与 TTL 计划事实 #7 均记 `ulw/t-n4` @ `f8f2480`，本波 git show 亲验 `f8f2480` 对象仍在对象库（2026-09-25 21:47 docs(room-lifecycle) 收口，即 t-n4 席跑偏自跑整计划的分支头），引用删、对象留档），批注记录于 [ulw-ttl-channel-and-cleanup-20260926.md](plans/ulw-ttl-channel-and-cleanup-20260926.md) 头部。
- 卡点：**裁决清单本身余 Q2（CRON_SECRET 生成与 Vercel 配置——Dashboard 亲手项，调度者无凭据）、Q6（业务验收结论 + `dev-stable-*` annotated tag 指令）两项待主公**。交接报告 §六 另列四条已落地语义（三分术语/删除自愈/TTL 口径/身份锁定边界）请主公确认对齐——按该报告原文口径「任一条与主公理解不一致→文字批注指出」，默认对齐、有异议才出修订票，非逐条等待的阻塞项，故 open 计数只算 Q2/Q6 两项。
- 证据 commit：`74a26cb`（2026-09-26 交接报告入档）、`2d7709b`（Q3 落地）。

**4. `.omo/research-session-orthogonality-20260924.md`**（本核查新增，派单摘要未列）
- 状态：探索报告 + 计划提案，头部性质行自述「待主公审查」；方法论主体已复利落地——Session 单一事则 / 任务正交性矩阵由 docs/dispatcher-playbook.md 承接（AGENTS.md L1 指针在列），并经 `1066dc3` 派单纪律复利入档。
- 卡点：等主公对提案本体的审查结论（采纳或结档）——不阻塞任何执行，但按本图「对账在等谁」的用途口径，属在等主公的未结项，故列入。
- 证据 commit：`c102fcd`（本体与 rooms-race 调研同提交入档，本波 git log 亲验）；复利落地 `1066dc3`。

### 2.2 核实后移出 open（2 项，派单摘要所列、实况已闭）

**5. `.omo/plans/ulw-ttl-channel-and-cleanup-20260926.md`** —— 派单摘要称「入档待批 `8f7a114`，批准后调度者亲自执行」；核实：T-P1 已由 `2d7709b`（2026-09-26 03:50）落地——本波亲测 `app/api/maintenance/purge/route.ts:64`/`:75` 均为无参 `purgeStaleRooms()`、`tests/api/maintenance-purge.test.ts:114`/`:129` 契约已改 `toHaveBeenCalledWith()`；T-P2 分支清扫已完成（`git branch -l 'ulw/*'` 空）。本波已修正其性质行 → 已实现，移入 §三 全景表。Q2/Q6 不在本票（票面头部明示）。

**6. `.omo/decisions-pending-20260924.md`** —— 派单摘要称「Q2/Q6 待主公」；核实：该档四项（BR-10 探针半边 / 孤儿探针 triage / room-name 重复导出 / remote Turso 实测）主公 2026-09-24 已**全部裁决并落实**（`dc352ed` / `361cff0` / `9123a0b` / `7447b64`，四 hash 本波 git show 亲验，提交日期均 2026-09-25），头部收口批注后转为决策记录；「Q2/Q6」实际住在 handover-20260926 §五（见第 3 项）。归档至 §五。

### 2.3 filed-only 存档（非 open，1 项）

**`.omo/plans/edge-runtime-migration.md`**（本批核查新发现）——无待决人的**已终结尝试档**，不入 open 计数，列此防误唤醒：唯一提交 `27e32ec` 为三计划链合档入档，正文自述 Edge 迁移失败（Vercel 拒 + Next.js 16 弃用 Edge）；本波亲验 `git log --all -S "runtime = 'edge'" -- app/api/stats/route.ts` 零命中（--all 覆盖全部本地与远端 refs，空输出 exit 0），无实现落库；事实上被 runtime-cleanup-after-edge-attempt（§五）→ runtime-cleanup-finalize（`71511c9`）链取代。filed-only 两份中另一份即 §2.1 第 1 项 anonymous-online——drafting 待裁决与 filed-only 判定并存（其唯一提交同为入档、无后续实现）。

---

## 三、已实现计划全景表（108 份）

> 证据 commit 取核查素材之主证 hash（多为「计划与实现同一提交」或实现首笔）；「状态线修正」列 ✅ 者为本波 13 份修正——其中 12 份状态行统一替换为「已实现（hash + 日期 + 修正说明）」，两处例外按各自原格式改写：recovery-from-unknown-cleanup（执行类计划）改「已执行完毕（…）」、open-source-readiness（frontmatter）改 status: implemented。列内「A→B」箭头是旧措辞→新状态的摘要记法，非新状态线原文；原文见各档头部与本波计划档 §4.2 逐份清单。「—」者头部无状态线或状态线与实况一致/属裁决事实（纪律不动，见备考）。

| # | file（.omo/plans/） | 证据 commit | 状态线修正 |
|---|---|---|---|
| 1 | agent-runtime-boundaries.md | `cd7180d` | — |
| 2 | agents-md-freshen-2026-09-12.md | `16f782e` | — |
| 3 | ci-artifact-hidden-files.md | `8e08814` | ✅ 执行中→已实现 |
| 4 | deep-module-dedup.md | `8c9a437` | — |
| 5 | evals-mcp-practice-map.md | `df69f84` | — |
| 6 | herdr-session-hygiene.md | `a8ddca2` | — |
| 7 | lsp-revert-to-global.md | `b146e50` | — |
| 8 | pwa-install-experience.md | `3eb769a` | — |
| 9 | recovery-from-unknown-cleanup.md | `adbdfbd` | ✅ 待执行→已执行完毕 |
| 10 | rsc-leaf-boundary-refactor-c1-home.md | `571c524` | — |
| 11 | rsc-leaf-boundary-refactor-c5-docs.md | `0bb0c3e` | — |
| 12 | stats-server-authoritative-delta.md | `e8632b4` | — |
| 13 | ulw-ablation.md | `40b7611` | — |
| 14 | ulw-audit-dependsbot-exempt-20260913.md | `ae02a33` | — |
| 15 | ulw-ci-visualqa-selfbuild-20260913.md | `5e41e49` | — |
| 16 | ulw-dev-emfile-watch.md | `471967b` | — |
| 17 | ulw-handoff-governance-20260914.md | `ba19ce5` | — |
| 18 | ulw-keyboard-hijack-fix-20260913.md | `6778bd8` | — |
| 19 | ulw-meta-extras-20260914.md | `c16e9e8` | — |
| 20 | ulw-name-login-one-truth.md | `d9ad855` | — |
| 21 | ulw-online-reset-and-result-fresh.md | `9fe08aa` | — |
| 22 | ulw-readme-shots-bilingual-20260913.md | `fe7fef9` | — |
| 23 | ulw-result-play-again-loop.md | `6b53402` | — |
| 24 | ulw-review-rework-20260923.md | `848aa9b` | — |
| 25 | ulw-rooms-race-qa-ticket-20260924.md | `e148b9a` | — |
| 26 | ulw-seo-meta-20260914.md | `7b230b8` | — |
| 27 | ulw-sync-dialog-identity-lock-20260924.md | `d685cf6` | —（见备考⑦） |
| 28 | ulw-ux-mobile-sync.md | `866fbf5` | — |
| 29 | vercel-deploy-runbook.md | `b8e0a40` | — |
| 30 | zh-default-commit-message.md | `5c51f4a` | — |
| 31 | agents-md-slim.md | `87580f1` | — |
| 32 | ci-pnpm-single-source.md | `42569b4` | ✅ 执行中→已实现 |
| 33 | favicon-analytics-warnings.md | `955b24d` | — |
| 34 | lsp-client-portable-config.md | `566745f` | — |
| 35 | pwa-rsc-stats-bug-fix.md | `971bb41` | — |
| 36 | repo-shell-upgrade.md | `f6d4739` | — |
| 37 | rsc-leaf-boundary-refactor-c2-play.md | `1425000` | — |
| 38 | rsc-leaf-boundary-refactor.md | `0bbb672` | — |
| 39 | turso-libsql-http.md | `d718b94` | — |
| 40 | ulw-agents-md-router-20260922.md | `932835f` | ✅ drafting→已实现 |
| 41 | ulw-br-probe-binding-20260923.md | `373ec96` | — |
| 42 | ulw-commit-lang-rule-20260923.md | `3068b22` | — |
| 43 | ulw-font-preload-residual-20260922.md | `11baadd` | ✅ proposed→已实现 |
| 44 | ulw-home-merge-trigger-spec-20260922.md | `1c34780` | ✅ executing→已实现 |
| 45 | ulw-legacy-four-cleanup-20260924.md | `dc352ed` | —（见备考④） |
| 46 | ulw-meta-slug-fix-20260913.md | `f883fc7` | — |
| 47 | ulw-offline-anonymous-ledger.md | `67e0ab6` | — |
| 48 | ulw-p3-hygiene-20260923.md | `e24e615` | —（见备考⑧） |
| 49 | ulw-result-win-celebration.md | `1c3899e` | — |
| 50 | ulw-room-lifecycle-20260924.md | `0817519` | —（见备考⑦） |
| 51 | ulw-rooms-race-rework-20260924.md | `7e04985` | — |
| 52 | ulw-solo-mode-split-view-transitions.md | `4f5ec71` | — |
| 53 | ulw-transition-alert-unit-tests-20260923.md | `bdfc352` | ✅ 执行中→已实现 |
| 54 | ulw-ux-refresh-pass.md | `61a0ce0` | — |
| 55 | win-cheer.md | `0d9b47a` | — |
| 56 | agents-md-chinese-knowledge-base.md | `fcbde26` | — |
| 57 | ai-slop-cleanup.md | `96394c6` | — |
| 58 | commit-policy-enforcement.md | `93e18b7` | — |
| 59 | docs-sync-libsql.md | `6febbaa` | — |
| 60 | fresh-clone-vercel-readiness.md | `ecbc9b1` | — |
| 61 | lsp-project-local-setup.md | `fe892fb` | —（见备考⑨） |
| 62 | next-env-production-types.md | `b279939` | — |
| 63 | pwa-turso-delete-timeout-and-sw-cache.md | `594a40c` | — |
| 64 | result-rsc-mobile-favicon-font-warnings.md | `1a2a969` | — |
| 65 | rsc-leaf-boundary-refactor-c3-result.md | `058ddfb` | — |
| 66 | turso-local-onboarding.md | `ad998a5` | — |
| 67 | ulw-ai-slop-cleanup-20260922.md | `e83b526` | — |
| 68 | ulw-ci-push-trigger-off-20260914.md | `ca7e6ad` | — |
| 69 | ulw-compound-asset-deposition-20260923.md | `bc5d914` | — |
| 70 | ulw-font-preload-sw-fetch-20260914.md | `fa76a39` | ✅ executing→已实现 |
| 71 | ulw-hotfix-db-schema-drift.md | `9d0bfb6` | — |
| 72 | ulw-lost-update-ticket-20260924.md | `71ad38d` | — |
| 73 | ulw-mobile-one-line-ux.md | `17803d0` | — |
| 74 | ulw-offline-ledger-direct.md | `a68f5be` | — |
| 75 | ulw-qa-02c-anchor-20260923.md | `0451656` | — |
| 76 | ulw-reset-store-helper-20260923.md | `47ad7d7` | — |
| 77 | ulw-rev-units-p3-hygiene-20260923.md | `b2bda4c` | —（见备考⑨） |
| 78 | ulw-room-migration-home-landing.md | `7586e82` | ✅ 待批准执行→已实现 |
| 79 | ulw-rooms-race-step1-20260924.md | `2304554` | —（见备考⑤） |
| 80 | ulw-solo-pure-local-closeout.md | `66fdb01` | — |
| 81 | ulw-ttl-channel-and-cleanup-20260926.md | `2d7709b` | ✅ 待批准派发→已实现（T-P2 分支清空亲测） |
| 82 | ulw-vercel-ignore-script-20260914.md | `83cd313` | — |
| 83 | win-confetti-desktop-y-match-mobile.md | `cb8fd45` | — |
| 84 | agents-md-contribution-guidelines.md | `b3a788a` | — |
| 85 | audit-transitively-calls-commitlint.md | `0ffde83` | — |
| 86 | commit-policy-zh.md | `9012283` | — |
| 87 | glossary-context-md.md | `4b71391` | — |
| 88 | open-source-readiness.md | `f62238c` | ✅ frontmatter proposed→implemented |
| 89 | result-stats-reload.md | `3dd9796` | — |
| 90 | rsc-leaf-boundary-refactor-c4-store.md | `b3a85c3` | — |
| 91 | runtime-cleanup-finalize.md | `71511c9` | —（见备考③） |
| 92 | types-node-align-24-20260924.md | `2e7104d` | — |
| 93 | ulw-ci-visualqa-artifact-20260913.md | `64ccec0` | ✅ 执行中→已实现 |
| 94 | ulw-decree-record-t3-judgment-20260923.md | `93f890e` | — |
| 95 | ulw-governance-small-20260913.md | `f4e9ad8` | — |
| 96 | ulw-intent-anchoring-20260922.md | `81ee7b9` | ✅ executing→已实现 |
| 97 | ulw-meta-brand-mark-20260914.md | `6daefe3` | — |
| 98 | ulw-modal-collision-and-error-alerts-20260923.md | `873a255` | — |
| 99 | ulw-one-game-two-versions.md | `1fcc41e` | — |
| 100 | ulw-quality-hardening-opt-20260922.md | `6aaab5e` | — |
| 101 | ulw-reset-store-outcome-error.md | `f68e328` | — |
| 102 | ulw-review-ablation-remaining.md | `86ffd83` | — |
| 103 | ulw-rooms-race-map-20260924.md | `e148b9a` | — |
| 104 | ulw-runtime-ignore.md | `74b5c18` | — |
| 105 | ulw-solo-sync-rebuild.md | `a9973b2` | — |
| 106 | ulw-ttl-channel-fix-tp1-20260926.md | `2d7709b` | —（T-P1 执行时拆出的子票，与本表 81 行同证） |
| 107 | ulw-verify-handoff-20260914.md | `20f5d50` | —（见备考⑩） |
| 108 | win-confetti-inward-origin.md | `6a975c5` | — |

**备考（素材核验备注，均不影响 implemented 判定）：**

1. 裁决/收口事实类状态线按纪律不动（虽执行早已完成）：ulw-dev-emfile-watch（APPROVED）、ulw-name-login-one-truth（御批）、ulw-online-reset-and-result-fresh（拍板 D-1~D-8）、ulw-result-win-celebration（拍板 D-1~D-5）、ulw-ux-refresh-pass（御批）、ulw-hotfix-db-schema-drift（APPROVED）、ulw-mobile-one-line-ux（APPROVED）、ulw-offline-ledger-direct（已拍板）、ulw-solo-mode-split-view-transitions（APPROVED）、ulw-solo-pure-local-closeout（御批）、ulw-one-game-two-versions（APPROVED）、ulw-solo-sync-rebuild（APPROVED）、ulw-offline-anonymous-ledger（拍板）、glossary-context-md（APPROVED-PARTIAL）、rsc-leaf-boundary-refactor（FINAL v1.0）、ulw-review-ablation-remaining（DONE）、ulw-quality-hardening-opt（accepted，自述当日全波交付 V13 ACCEPT）。
2. ulw-handoff-governance-20260914：T1（Copilot 实测 issue）/T3（Discussions 开张）为 GitHub 远端操作，天然无仓内 commit 可证，本次未验证其完成与否。
3. runtime-cleanup-finalize：文末验收 9 项全 ✅，但 A 项「移除 `__setCreateClientForTests` 接缝」与今日代码不符——`lib/db.ts:133` 该导出仍在，git log -S 无移除提交；存疑备注，不臆测。
4. ulw-legacy-four-cleanup-20260924：头部【收口 2026-09-24】标记，四票实际提交日期为 2026-09-25（`dc352ed`/`361cff0`/`9123a0b`/`7447b64`，本波 git show 亲验），收口标记日期早一天；b980b39 同日收口入档。
5. ulw-rooms-race-step1-20260924：档案自述本文件「不入 git 跟踪」，实况 `45a215c` 以 179 行新增入档了本文件——差异备考。
6. ulw-ttl-channel-fix-tp1-20260926 为执行时拆出的 T-P1 子票（`2d7709b` 同提交新增），母票见本表 81 行。
7. ulw-sync-dialog-identity-lock-20260924 / ulw-room-lifecycle-20260924：引言块「待主公批准后派发」措辞已过时，但非标准「状态：」行格式，按纪律未修正仅备注；建议后续修文。实况：room-lifecycle 四票五笔 2026-09-25 全部落地——T-N1 `0817519` / T-N2 `86202f9` / T-N3 `c5aac38` / 收口 step 9 `80c21cf` / T-N4 补票 `f756129`（五 hash 本波 git show 亲验，日期均 2026-09-25），另有 `d685cf6`（T-M1）与两计划入档 `818ea02`。
8. ulw-p3-hygiene-20260923：4 项中 not-found 死键删除当日被 REJECT 整改回文案（`e3bd3c5`）——受控偏差在档。
9. ulw-rev-units-p3-hygiene-20260923（文末 F1-F4 未勾、Findings 未回填）与 lsp-project-local-setup（验证清单两个 ⏳ 未回填）：档案正文欠账，不影响实现判定。
10. ulw-verify-handoff-20260914：复核产物在 gitignored ulw-loop/ 现场（report.md 375 行总判 DONE，V1-V5 全 PASS），复核全 PASS 无缺陷可修故无实现 commit，属预期。

---

## 四、占位与被取代

| file | 性质 | 证据 |
|---|---|---|
| multi-user-stats-future-work.md | placeholder（多用户战绩候选需求占位，明确 DO NOT implement） | `76745d9`（2026-09-12 入档）；状态线即自锁占位，与实况一致不动 |

被取代：无独立档案。edge-runtime-migration.md（§二 第 4 项）事实上被 runtime-cleanup-after-edge-attempt（§五）→ runtime-cleanup-finalize（`71511c9`）链取代，跨节互见不重复归类。

---

## 五、复盘/笔记/设计记录（非可执行，8 份）

**plans 内 6 份（verdict: note）：**

| file | 性质 | 证据 commit |
|---|---|---|
| agent-session-isolation.md | 外部配置变更设计记录（交付物是写入仓库外全局 pi AGENTS.md 的一条 bullet；pi＝与 Codex 同类的仓库外代理执行席，其全局配置不在本仓） | `55d0953`（2026-09-12 prompt(plan)；素材另记链前笔 55d0973，本波 git 未解析到，疑 reword 前 hash，不采） |
| dispatcher-roles-retrospective.md | 调度者 session 转录复盘，AGENTS.md L1 指针引用的模板来源 | `d9acf4c` |
| lsp-retrospective.md | LSP 三次演进复盘（对应交付 `93f2d62` 已落） | `93f2d62` |
| quality-wave-execution-notes-20260922.md | 质量加固波执行观察记录（供 distiller 席＝波后经验提炼席位消费） | `6aaab5e`（--diff-filter=A 命中） |
| runtime-cleanup-after-edge-attempt.md | Edge 尝试→回退→Node runtime「试过但不取」决策链 | `27e32ec` |
| ulw-research-twitter-cards-20260914.md | 社交卡调研（该调研计划 AC3 规定不动工作树；候选已由 `c16e9e8`/`6daefe3`/`9e2d2b8` 落地） | `c16e9e8`（随票入库存档） |

**根级 2 份决策记录（已闭合）：**

| file | 性质 | 收口证据 |
|---|---|---|
| decisions-20260923.md | 2026-09-23 主公逐项裁决后入档（R7 语言规则等，落地 `3068b22`） | 头部性质行自述闭合 |
| decisions-pending-20260924.md | 四项 2026-09-24 全部裁决并落实，转决策记录 | `dc352ed` / `361cff0` / `9123a0b` / `7447b64` |

---

## 六、调研报告（.omo/research-*.md，3 份）

| file | 主题 | 状态与唤醒/待决口径 |
|---|---|---|
| research-rules-mechanization-20260926.md | 重复错误固化为机器规则（晋升流水线 + 业界四层） | 入档待唤醒（`82758cc`），不立项不开坑；该调研档 §五 C1-C5 全部未裁决；唤醒条件：三犯法则 / t-n4 型漂移再犯（释义见 §二 第 2 项）/ Q3 落地后评估 C2（触发已发生：`2d7709b` 落地 Q3；主公明示暂不开坑，评估动作搁置待点名）/ 主公点名 |
| research-rooms-race-probe-20260924.md | /api/rooms 竞态探针补齐（威胁模型 v2 + 票面提案） | 已兑现：rooms-race 七票全落、雾区清零（`87e7c7a` 收口），无遗留待决 |
| research-session-orthogonality-20260924.md | Session 单一事则与任务正交性方法论 | 方法论已入 docs/dispatcher-playbook.md（AGENTS.md L1 指针）并经 `1066dc3` 复利入档；**提案本体待主公审查——open，见 §二 第 4 项**（本体入档 `c102fcd`） |

---

## 七、方法与盲区

**怎么核的：**

1. **对账**：git log --grep 文件名全史定位每份档案的入档/实现提交，git show --stat 区分「计划与实现同一提交」与分票落地。
2. **状态线核验**：4 席并行（＝本波并行工作的四个文档核验子席）逐份读头部。裁决规则——裁决/收口事实（APPROVED、拍板、DONE、accepted、收口标记）一律不动；进行时措辞（执行中 / proposed / drafting / executing / 待批准）与 git 实况相悖且主动误导的 13 份，oldLine 整行精确匹配替换（12 份统一「已实现（hash + 日期 + 修正说明）」+ 2 处按原格式例外，见 §三 引言）。
3. **素材出处**：本图所称「素材／核查素材」＝派单方随任务下发的 117 份结构化核查结论（字段：file / verdict / oldLine / newLine / evidence / note），原始记录未入库、无法从仓内对质，故关键 hash 一律按第 4 条亲验兜底；「派单摘要」＝本波派单指令中对 open 项的原始描述，同不在仓内。
4. **open 项逐一读档复核**（§二），关键事实亲测：route.ts 两处无参调用（rg）、`ulw/*` 分支清空（git branch -l）、`f8f2480` 对象在档（git show，Q5 证据链物证）、origin/dev = `74a26cb`（rev-parse）、decisions-pending 四票日期（git show）、edge 零命中复测（git log --all -S）、门禁三层实跑。
5. **门禁实跑（2026-09-26 04:33）**：① vitest `pnpm test` → 540 passed | 11 skipped（551）；② `pnpm typecheck` → exit 0；③ `pnpm lint` → exit 0（0 errors / 16 warnings 存量）。
6. **成图自校**：本图与本波计划档出现的全部 commit hash 经脚本逐一 `git rev-parse --verify` 验证在档。

**什么没核：**

1. `.omo/drafts/` 草稿区 17 份未逐份分类（gitignored，.gitignore:127）。
2. build 与浏览器探针两层门禁本波未跑（docs-only 波，未触代码/测试/CI）。
3. GitHub 远端操作类交付（ulw-handoff-governance T1 Copilot issue / T3 Discussions）无仓内 commit 可证，未验证。
4. 运行区不入图：evidence/ 541、ulw-loop/ 91、start-work/ledger.jsonl、sessions.local.md、boulder.json（omo 工具状态）。
5. 本地 ahead 4（`1066dc3` / `82758cc` / `8f7a114` / `2d7709b`）未 push，远端 CI 无背书；本波 13 份状态线修正 + 2 份新档（本图与 [ulw-doc-status-sync-20260926.md](plans/ulw-doc-status-sync-20260926.md)）亦在工作树待提交，push 待主公。
