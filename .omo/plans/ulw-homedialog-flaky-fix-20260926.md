# 计划：HomeDialogMount flaky 治理（T-F1）+ 层⑤口径冲突说明（Q-B 待裁决）

> 性质：执行计划（T-F1 已批待派）+ 待裁决说明（Q-B）。裁决来源：主公 2026-09-26 文字批注——**Q-A 已 push**（调度者现查确认：origin/dev 与 dev 齐平）、**Q-F 同意开票修**、**Q-B 需进一步解释后再裁**（本计划 §三）、Q-C / Q-D / Q-E 继续待定。
> 基线：dev @ `1f74775`（与 origin/dev 齐平，树 clean）。统一语言：本计划 §三与 [alignment-20260926-doc-governance.md](../alignment-20260926-doc-governance.md) 项 3 同口径（他会话对齐报告）。

---

## 一、事实链（2026-09-26 现查）

| # | 事实 | 证据 |
|---|---|---|
| 1 | `components/HomeDialogMount.test.tsx` 一个用例在全量并发下偶发假红：`:288 expect(confirmBtn).not.toBeDisabled()` 失败，按钮 `[data-testid="sync-confirm-confirm"]`（aria-label「合并并清空」）在断言时刻为 disabled | `/tmp/vitest-final-verify.log`（04:24，`Tests 1 failed | 539 passed | 11 skipped`，exit 1） |
| 2 | 偶发率约 1/6：全量 6 轮中仅此 1 次复现，其余 5 轮全绿 540/11 | 席位 2 轮 + 返工席 1 轮 + 调度者 3 轮 |
| 3 | 单文件隔离跑 3/3 全绿（11 tests）——竞态只在全量并发/特定 worker 调度下现形 | `/tmp/flaky-check-{1,2,3}.log` |
| 4 | 与 TTL 波零交集：该文件不在 `2d7709b` 触及面；属 T-M1 合并弹框域（d685cf6，BR-11 身份锁定） | 文件面白名单断言 + `git log` |
| 5 | 失败用例名：「handleConfirm on a fresh-room user: clears local + persists baseline + mirrors new room into the store」（test-only coverage: lines 123-138） | vitest 失败详情 |

## 二、票面

### T-F1：HomeDialogMount flaky 治理（herdr codex 单席，Q-F 已批）

- **诊断先行（先取证后动手）**：定位 `sync-confirm-confirm` 钮的 disabled 条件链——组件源码里哪个 state 驱动 disabled、该 state 在本用例的执行流里何时被异步置位/清除；报告必须给「一句话机制结论 + 组件/测试行号证据」，然后才允许改。
- **修复方向（按证据定）**：
  - a) 首选**测试侧**：用 `waitFor` / `findBy*` 等终态到达再断言（或消除测试内的时序假设），零产品代码改动；
  - b) 仅当坐实**产品码**在正常路径会闪 disabled（用户可见抖动）才动产品码——此时先停手回报机制与影响面，调度者升级主公后再定。
- **明确不改**：其他任何测试文件与产品文件；`lib/db.ts`、`app/api`、`docs/`、`tests/qa/` 探针、`tests/qa/commit-audit.mjs`、`commitlint.config.cjs`、`.github/`、`next-env.d.ts`（M 为 dev/build 翻转噪声勿理）。层⑤口径属 Q-B 另裁，禁顺手改 audit 工具与 docs/commands.md。
- **AC**：
  ① 诊断结论（一句话机制 + 行号证据）入报告；
  ② 修复后 `pnpm vitest run` 连跑 5 轮全绿 + 单文件 3 轮全绿；
  ③ `pnpm typecheck` / `pnpm lint` 绿；
  ④ commit-msg hook 一次过（禁 `--no-verify`）；
  ⑤ 文件面：diff 相对基线 `1f74775` 仅触及「该测试文件 +（如走 b）坐实的产品码文件 + 本计划 §二席位 plan」。
- **commit 契约**：type 用 `test` 或 `fix`，subject 中文开头（示例：`fix(test): 合并确认钮断言消竞态——等待终态再断言`）；WHAT:/WHY:/HOW: token 独占行、内容每行 ≤72 字符；trailer 含 `Confidence: high` / `Scope-risk: narrow` / `Plan: .omo/plans/ulw-homedialog-flaky-fix-20260926.md`。
- **执行形态**：herdr codex fresh 单席（session `3t`，tab 优先 `--no-focus`），brief 首行 `$omo:start-work .omo/plans/ulw-homedialog-flaky-fix-20260926.md` + 硬声明「本席范围=仅 T-F1 一票；§三 Q-B 是待裁决说明，非票，禁执行」。审批权前置授予（主公 Q-F 批注）。调度者收尾独立复跑 AC②（另跑 5 轮全量）+ 文件面/hook 核对，不信任自报。

## 三、Q-B 层⑤口径：承诺与现状的冲突到底在哪（待主公裁决）

**承诺**：`docs/commands.md` 验证六层第 5 层写「每个 commit 必跑 `node tests/qa/commit-audit.mjs --branch main`（0 violations）」。隐含前提：main 的**全部历史**都满足**当前的**提交规范。

**现状**：`--branch` 模式 = 拿**今天的全部规则**回扫**整条分支的全部历史**。而规则集是逐波叠加演进的：

- 09-23 上线 R6（BR↔探针双向绑定）、R7（subject/trailer 值须含中文）；09-25 又收紧（自由 trailer 值必须含中文，纯路径也不行，只豁免 Confidence/Scope-risk/Plan 三键）；
- 每新增/收紧一条规则，所有**更早的**历史 commit 里不满足新规则的就 retroactively 变成「违规」——尽管它们**在提交当天是完全合规的**（当天的 hook 按当天的规则放行过）；
- 再加两类天生不合规的机器 commit：GitHub PR merge（「Merge pull request #…」自动生成，无正文无 trailer）与 dependabot（英文 subject）——`ae02a33` 曾专门豁免 dependabot 让全史复绿过一次，之后新规则一来又欠上。

**结果**：今天全史扫描 fail=164（main / dev 两口径相同；最新一笔 2026-09-24 15:16；本波与近三波 commit 全部 PASS）。**冲突的实质：「0 violations」不是不变式，是随规则演进而腐烂的快照**——「承诺恒为 0」与「规则会生长」在全史回扫口径下逻辑上不能同时成立。危害是门禁失去信号：164 笔旧账把真违规淹没（本波 workflow 就被它触发了一次假警报，烧掉两轮返工）。

**选项**：
- **a)** 层⑤口径收窄为「本波 commit 面」：扫 `origin/main..HEAD`（或逐 commit `--message-file`——commit-msg hook 本就逐 commit 把关，层⑤实质是对 hook 的抽查复跑）；`docs/commands.md` 同步改一行。零工具改动，语义就是「本波合规」。
- **b)** audit 工具加历史豁免基线（欠账清单进配置，沿 `ae02a33` 先例）。保留全史视野，但要养清单，且每条新规则仍需重新对账一遍。
- **c)** 维持现状，把 docs 期望改成「全史 fail 计数不增加」。零成本但最弱，真违规仍难浮现。
- **愚见：a**。（b 可并入规则机械化调研「规则演进回扫欠账」洞察一并评估。）

> **主公批注位（Q-B）**：

## 四、波次与验证

单席单波：T-F1 一次交付。调度者收尾 = 独立复跑 AC②（5 轮全量 + 单文件 3 轮）+ 文件面断言 + hook/commit 契约核对 + 合入态门禁（vitest / typecheck / lint；纯测试改动不触发浏览器探针层）。

## 五、边界声明

- Q-B 在主公批注前**不执行任何动作**（含 `docs/commands.md` 的一行修改）。
- Q-C（CRON_SECRET）/ Q-D（验收结论 + tag）/ Q-E（anonymous A/B/C/D、规则机械化唤醒）继续待定，不在本票；统一裁决面见 [alignment-20260926-doc-governance.md](../alignment-20260926-doc-governance.md)。
- 若诊断坐实为产品码 bug（方向 b）且影响面超预期，席位停手回报，调度者升级主公再定，不擅自扩大改动面。
