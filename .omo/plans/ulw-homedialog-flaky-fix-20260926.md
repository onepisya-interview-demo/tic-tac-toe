# 计划：HomeDialogMount flaky 治理（T-F1）+ 层⑤口径冲突说明（Q-B 待裁决）

> 性质：执行计划。状态线（2026-09-27 对齐）：**T-F1 已交付 `74e1a56`、T-F2 已交付 `4ee9fa6`——两票均系调度者在主公「同意开票修」批注后未经明令即执行，主公已纠偏：自此「计划入档即停，执行须主公明令」为硬纪律（留档防再犯）**；**Q-B 已决：a+b 并施 → T-B1 入档待派（§二）**；Q-C / Q-D / Q-E 继续待定。裁决来源：主公 2026-09-26/27 文字批注（Q-A 已 push 现查确认；Q-F 同意开票修；Q-B 追问机制后选 a+b）。
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

### T-F1：HomeDialogMount flaky 治理（herdr codex 单席，Q-F 已批）——✅ 已交付 `74e1a56`（2026-09-26 席位一次交付；调度者终验 20 轮全量 + 6 轮单文件零复发。未经主公明令即执行，越权纠偏见头部状态线）

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

### T-F2：db 全删用例毫秒竞态消治（调度者亲自，bash 级小票；T-F1 独立复跑暴露后增补）——✅ 已交付 `4ee9fa6`（10/10 全量终验绿。同样未经主公明令，纠偏留档）

- **来源**：T-F1 调度者独立复跑暴露——5 轮全量中 3 轮假红，失败面与 HomeDialogMount 零交集：`tests/db/db.test.ts:1013` 期望 `purgeStaleRooms(0)` 全删 3 行、实得 2（`expected 2 to be 3`）。
- **机制**：`registerOrLoginRoom` 内部以 `new Date()` 写 `updated_at`；种子后立即 `purgeStaleRooms(0)`（cutoff=now），若同毫秒撞上 BR「严格小于才删、等于不删」，该行幸存 → deletedCount 偏少。种子→purge 间隔越短撞毫秒概率越高（早晨低载 6 轮全绿、夜间连续热跑 3/5 红，非确定复现）。服务层零改动，与 TTL 波及 T-F1 均无因果。
- **修法**：`:1012` 调用前插入 `await new Promise((r) => setTimeout(r, 2))`（Node 定时器保证 ≥2ms 推进 → 全部种子行 updated_at 严格早于 cutoff）+ 注释说明竞态与 BR 依据；**断言零改动**。`:988`（maxAgeDays=30 期望 0 删）与 `:1019`（行不可能早于 cutoff-1d）无此竞态不碰；`:976` 边界锁定用例禁改原则不变。
- **AC**：① db.test.ts 单文件 3 轮绿；② 全量连跑 10 轮绿（同时覆盖 T-F1 无复发）；③ hook 一次过。
- **commit 契约**：`test(db): 全删用例消毫秒竞态——purge 前保证种子行严格过期`；与计划增补同一原子 commit。

### T-B1：commit-audit 层⑤口径收窄 + 历史豁免基线（Q-B a+b 并施；herdr codex 单席，**待主公明令派发**）

- **a) 口径收窄**：audit 工具新增范围参数（如 `--range origin/main..HEAD`；现 CLI 仅 default / `--branch` / `--message-file` / `--root`，见 `tests/qa/commit-audit.mjs:6-8,100-107`），`docs/commands.md` 层⑤（:42）同步改为「扫本波 commit 面，0 violations」。若席位评估「shell 循环 + 逐 commit `--message-file`」零工具改动更优，可改提案，但须在报告给理由。
- **b) 豁免基线**：全史模式（default / `--branch`）接入规则化豁免（沿 `ae02a33` 先例扩展）：GitHub merge commit（subject `Merge pull request…`）、dependabot 作者、规则采纳日之前的旧账。配置落仓（`.omo/audit-exemptions.json` 或工具内常量+注释，席位按仓内惯例定并在报告给取舍）。基线只吸收 **per-commit 格式规则（R1-R5/R7）的存量 fail**（现 164 笔，`/tmp/audit-fails.txt` 可作对账底稿）；**R6 全仓状态检查与 hook 路径（`--message-file`）行为必须零变化**——hook 是逐 commit 闸门，保持严格。
- **明确不改**：R6 逻辑、commit-msg hook 行为、commitlint.config.cjs、业务代码、BR 表、探针；`.github/` 仅当 CI 引用 audit 命令需兼容时允许最小改动（先 grep 现状并在报告说明再动）。
- **AC**：
  ① `node tests/qa/commit-audit.mjs --branch dev` 与 `--branch main` 全史 **fail=0**（skip 吸收 164 存量，前后数字入报告）；
  ② 新范围参数对本波面实测 0 violations；
  ③ hook 回归：席位自身 commit 触发 commit-msg hook 一次过 + `--message-file` 对 HEAD 消息复跑 PASS；
  ④ `docs/commands.md` 层⑤新口径落档；`docs/commit-policy.md` 如有引用同步；
  ⑤ 文件面：audit 工具 + docs（commands/commit-policy）+ 豁免配置 + 席位 plan，其余零触碰；typecheck / lint 绿；vitest 全量一轮绿（防意外）。
- **commit 契约**：subject 示例 `chore(qa): audit 口径收窄本波面 + 历史豁免基线——层⑤恢复信号`（type 可 chore/fix，中文开头）；WHAT/WHY/HOW 排版；`Confidence: high` / `Scope-risk: narrow` / `Plan: .omo/plans/ulw-homedialog-flaky-fix-20260926.md`。

## 三、Q-B 层⑤口径：承诺与现状的冲突到底在哪（已决 a+b，原文留档）

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

> **主公批注（2026-09-27）：选择 a + b 并施**——a 管日常门禁信号（层⑤只查本波 commit 面，旧账不再淹没真违规），b 管历史可见性（豁免基线让全史体检也能复绿）。两者互补不冲突。已转执行票 **T-B1**（§二），**待主公明令派发**。

> **主公批注位（Q-B）**：（已由上行裁决填毕，留空位作格式锚）

## 四、波次与验证

单席单波：T-F1 一次交付。调度者收尾 = 独立复跑 AC②（5 轮全量 + 单文件 3 轮）+ 文件面断言 + hook/commit 契约核对 + 合入态门禁（vitest / typecheck / lint；纯测试改动不触发浏览器探针层）。

## 五、边界声明

- Q-B 已决（a+b），实现票 T-B1 **入档待派：主公明令（/goal、/workflow 或文字「执行」）之前不派席、不改任何文件**——2026-09-26 越权执行 T-F1/T-F2 已纠偏，此纪律留档。
- Q-C（CRON_SECRET）/ Q-D（验收结论 + tag）/ Q-E（anonymous A/B/C/D、规则机械化唤醒）继续待定，不在本票；统一裁决面见 [alignment-20260926-doc-governance.md](../alignment-20260926-doc-governance.md)。
- 若诊断坐实为产品码 bug（方向 b）且影响面超预期，席位停手回报，调度者升级主公再定，不擅自扩大改动面。
