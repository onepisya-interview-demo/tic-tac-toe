# 交接报告：TTL 通道修复 + 分支清扫波（执行与终裁 2026-09-26）

> 性质：移交主公核对与决策。票源：[ulw-ttl-channel-and-cleanup-20260926.md](plans/ulw-ttl-channel-and-cleanup-20260926.md)（T-P1/T-P2）——主公四项批注（Q3 选 a / Q4 维持 30 / Q5 删 `ulw/t-n4` / Q1 已 push）转执行。上波交接：[handover-20260926-two-plans-wave.md](handover-20260926-two-plans-wave.md)。
> 执行形态：`/workflow` 强制路径，run `dwfrun-3c4e787c`——herdr codex fresh 席（`$omo:ulw-plan` 首行触发 omo 流程，先写 ulw 计划再修复）× 3 席 + 脚本 world.run 机械门禁 + 换人独立终验 + 返工闭环两轮 + 调度者亲自终裁。

---

## 一、交付总览（现状）

**结论先行：两票全部落地，调度者终裁全绿，无遗留代码动作。**

| 项 | 现状 | 证据 |
|---|---|---|
| T-P1 TTL 通道修复 | commit `2d7709b` 落在 dev | `git log` 现查；三文件零越界 |
| T-P2 分支清扫 | `ulw/*` 五条分支清零 | `git branch --list 'ulw/*'` 空输出 |
| 工作树 | clean（含 next-env.d.ts） | `git status -sb`：仅 `ahead 2` |
| 本地领先 | ahead 2 = `01283ed`（他席 doc-status 对账入档）+ `2a49af9`（本报告）；**波交付 `2d7709b` 主公已亲手 push**（origin/dev 已含，04:52 前后现查） | `git branch -r --contains 2d7709b` |
| herdr 现场 | 3 席 tab 全关，回到原态（1 tab / 0 agent） | `herdr --session 3t workspace list` / `agent list` |
| 席位台账 | `.omo/sessions.local.md` 三条（jsonl 路径齐） | 调度者核对过 |

**T-P1 改动内容**（commit `2d7709b`，席位自写 plan 一并入档）：
- `app/api/maintenance/purge/route.ts:64/:75`：`purgeStaleRooms(30)` → `purgeStaleRooms()`（POST/GET 两处删显式实参）。
- `tests/api/maintenance-purge.test.ts:114/:129`：`toHaveBeenCalledWith(30)` → `toHaveBeenCalledWith()`（「端点不得传显式 TTL」钉进契约防回归）。
- 新增 `.omo/plans/ulw-ttl-channel-fix-tp1-20260926.md`（席位 plan，68 行）。
- **未动**：`lib/db.ts` 本体与默认值 30（Q4 裁决）、`db.test.ts`、`operations.md`、README、BR 表、前端、探针——文件面白名单断言全绿。
- 自此语义：**改 TTL 只改 `lib/db.ts:679` 一个常数**，`operations.md`「改一处」承诺自动成立。

**门禁终裁数字**（票面 AC①–④ 全部满足）：

| 门禁 | 结果 | 跑了几轮 |
|---|---|---|
| vitest 全量 | **540 passed / 11 skipped（551），基线不减** | 6 轮全量（席位 2 + 返工席 1 + 调度者 3） |
| typecheck / lint / build | 全 exit 0 | 各 3 轮（workflow 三次合入态） |
| 负对照 `rg 'purgeStaleRooms\([^)\s]' app/` | 零命中（字面实参清零） | 3 轮 |
| 调用保留断言 | route.ts 两处 `await purgeStaleRooms()` 恰为 2 | 3 轮 |
| commit-msg hook | 一次过（commit 存在即证） | 1 次 |
| commit-audit 对 `2d7709b` 本身 | PASS | 席位/终验/脚本三方一致 |

> 票面 AC③ 笔误留档：票面写 `rg 'purgeStaleRooms\(' app/` 零命中，但修复后调用本身仍会命中该正则；按「字面实参清零」意图落为上表双断言，非语义变更。

## 二、本波事件与处置（诚实记录）

1. **workflow 自报两项 high 红项，调度者终裁均为门禁伪影，非交付缺陷**：
   - **vitest 假红**：门禁脚本正则 `/(\d+) passed/` 首匹配抓到输出里更靠前的 `Test Files 45 passed | 2 skipped`（**文件数**行），误当用例数（540）。终裁证据：返工席全量输出原样转录两行汇总 + 调度者三轮全量复跑 540/11。教训已固化调度者记忆（正则须锚定 `Tests` 行）。
   - **commit-audit 假红**：`--branch` 全史模式用现行规则回扫全历史，dev/main 两口径均 fail=164——**全部为 ≤2026-09-24 的存量**（GitHub PR merge commit、dependabot、旧格式提交；r3 席对 164 个 hash 逐一 `merge-base --is-ancestor` 证实 0 笔 post-baseline）。本波与近三波 commit 全 PASS。详见待决 Q-C。
   - 返工闭环两轮（r2/r3 席）处置正确：全量复跑 + 逐一取证 + **零改动零 commit**，如实写报告。round cap 防住了假红死循环。
2. **既有 flaky 首次现形**（详见待决 Q-F）：调度者首轮全量复跑抓到 `components/HomeDialogMount.test.tsx:288` 假红一次（约 1/6 概率），单文件 3/3 绿。属 T-M1 合并弹框域，与本票零交集。
3. **终验员一处证据引用有误，已纠正**：把审计输出截断头的 `cdacf88` PASS 行误读为 FAIL 示例；调度者 grep FAIL 清单确认 `cdacf88` 0 命中。其「FAIL 面为基线前存量」的结论本身仍被 r3 席独立证实。
4. commit subject 与票面建议语序对调（两个短语互换），语义等价、格式全合规，属 brief 预授权「措辞可微调」内的细节自决，放行留档。
5. **交接数字时效性实证（本报告自吃自案）**：报告以「ahead 4 待 push」成稿，期间主公亲手 push 了波交付（origin/dev 含 `2d7709b`）、另一会话并发入档 doc-status 对账波（`01283ed`，13 份计划状态线修正 + 总图，含本票计划状态行），04:52 再现查已 ahead 2——本报告已按 04:52 现查修正。与上波教训互证：**交接数字是快照，引用前必现查**。
6. 并发会话说明：`01283ed` 归属 doc-status 对账波（Plan: ulw-doc-status-sync-20260926.md），与本波文件面正交、无冲突；若主公仍在该会话作业，push 两笔 docs 前宜与该会话收尾节奏协调。

## 三、需要主公审批 / 对齐的清单

### Q-A：push 时点（对象已变：两笔 docs，非波交付）
- **事实**：波交付 `2d7709b` 主公已亲手 push（04:52 现查，origin/dev 已含）——原 Q-A 对波 commit 已闭环。当前 ahead 2 全为 docs：`01283ed`（他席 doc-status 对账波入档）+ `2a49af9`（本报告），树 clean。
- **选项**：a) 顺手 push 两笔 docs；b) 等 doc-status 会话收尾后一起推。
- **利弊**：a) 报告与状态线尽早进远端，防再次漂移；b) 若该会话还有在途 commit 可一次推净。
- **建议**：a)（若主公确认另一会话已收尾）。

### Q-B：commit-audit 层⑤口径裁决（本波暴露的工具口径问题）
- **事实**：`docs/commands.md` 层⑤承诺 `--branch main`（0 violations），但 2026-09-26 现查 main/dev 全史均 fail=164（存量：PR merge / dependabot / 旧格式，最新一笔 2026-09-24 15:16）。规则是逐波叠加的（R6/R7 等），新规则回扫旧历史必然欠账；先例 `ae02a33` 曾靠豁免 dependabot 让全史复绿，其后又欠。另：上波交接报告「`--branch dev` 0 violations」的记载与今查矛盾——引用交接数字前应现查（已入调度者记忆）。
- **选项**：a) 层⑤收窄为本波 commit 面（`origin/main..HEAD` 或逐 commit `--message-file`，hook 已天然逐 commit 把关）；b) audit 工具加历史豁免基线（沿 ae02a33 先例，欠账清单入 `knip.json` 式配置）；c) 全史专项清理（改史，不现实，不建议）。
- **利弊**：a) 零工具改动、语义就是「本波合规」；b) 保留全史视野但要维护豁免清单；c) 成本高且违背「历史不可改写」纪律。
- **建议**：a)（b 可作为规则机械化调研的活案例一并考虑）。

### Q-F：HomeDialogMount 既有 flaky 是否开票治理
- **事实**：`components/HomeDialogMount.test.tsx:288` `expect(confirmBtn).not.toBeDisabled()`（「合并并清空」按钮）全量并发下约 1/6 概率假红（6 轮全量 1 次复现，单文件 3/3 绿）。属 T-M1 域（d685cf6），与本票零交集。放着会随机打红未来六层门禁。
- **选项**：a) 下波开 ulw 票修（嫌疑：确认钮 disabled 态的异步竞态——名称校验/loading 窗口与断言时序）；b) 暂留档观察。
- **建议**：a)——小票，主检 disabled 态驱动链路即可定位。

### Q-C：上波遗留 Q2（CRON_SECRET 配置 Vercel）
- **事实**：端点已按 `Authorization: Bearer ${CRON_SECRET}` 落地；配值属 Vercel Dashboard 操作，须主公亲手（调度者无凭据）。本地 `.env.local` 建议同步一份以启用 `operations.md` 手动 curl 通道。
- **建议**：主公 `openssl rand -hex 32` 自生成后配置（沿上波建议 a）。

### Q-D：上波遗留 Q6（验收结论 + 稳定 tag）
- **事实**：惯例是主公业务语义抽查后给「未发现业务不符合」结论，令打 `dev-stable-*` annotated tag（只留本地）。上波 §六想法统一区四条语义（清空/退出/删除三分、删除自愈、TTL 口径、身份锁定边界）主公尚未给对齐确认。本波 TTL 语义已在上波 Q3/Q4 批注中确认落地。
- **建议**：主公抽查后给结论 + tag 指令（可含本波 2d7709b）。

### Q-E：更早遗留（不阻塞本波，列此备查）
- `ulw-anonymous-online-server-row-missing-20260922` 仍待主公 A/B/C/D 裁决（状态行陈旧不可信，对账靠 `Plan:` footer 反查 git log，见 [doc-status-map-20260926.md](doc-status-map-20260926.md)）。
- 规则机械化调研 [research-rules-mechanization-20260926.md](research-rules-mechanization-20260926.md) 待唤醒（触发条件：三犯法则 / t-n4 式再犯 / 点名）。本波 Q-B 的 audit 口径即其「规则演进回扫欠账」洞察的活案例，主公点名即可拉报告立票。

## 四、我需要主公什么

1. **§三逐项文字批注**（Q-A / Q-B / Q-F / Q-C / Q-D / Q-E，可只批有意见的项，未批项我按建议执行或继续挂起）——文字批注即转已决入档。
2. **亲手项**：push（Q-A）；Vercel 配 secret（Q-C）；验收结论与 tag 指令（Q-D）。
3. **无其他需要**：本波无剩余代码动作；不需主公提供任何凭据给调度者。批注后我即出票/转已决，继续沿 herdr + workflow 拓扑执行。

## 五、证据指针

- 运行工件：《TTL 通道修复与分支清扫·执行报告》（workflow 卡片；其中 vitest/audit 两行 ❌ 以本报告 §二终裁为准）。
- 席位报告：`/tmp/ttl-fix-tp1-report-20260926.md`、`/tmp/ttl-fix-rework-r2-report.md`、`/tmp/ttl-fix-rework-r3-report.md`；brief 同目录。
- codex session jsonl 与 tab id：`.omo/sessions.local.md` 末三条。
- 调度者复跑日志：`/tmp/vitest-final-verify.log`（flaky 唯一一次复现）、`/tmp/flaky-check-{1,2,3}.log`、`/tmp/audit-fails.txt`（164 sha 清单）。
