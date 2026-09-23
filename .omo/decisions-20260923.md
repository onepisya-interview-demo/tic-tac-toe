# 主公裁决记录（2026-09-23）

> 性质：决策记录（原《待主公裁决事项》，2026-09-23 主公逐项裁决后入档）。每项按「事实 → 选项 → 利弊 → 调度者建议 → 主公裁决」组织；执行票由 workflow 波（4 修复席 + 4 交叉审席）落地，落地后在各裁决项追加 commit 指针。

---

## 项 1：语言一致性契约（commit subject/trailer 与 plan 文档的中文要求）

### 事实（已逐一查证）

- `tests/qa/commit-audit.mjs`（R1-R6）只查格式：subject ≤100、不大写开头、type 前缀、WHAT/WHY/HOW、trailer 存在性、Plan footer——**没有任何语言规则**。
- 本轮语言漂移谱系：plan `ulw-reset-store-outcome-error.md` 81 行中文仅 1 行（≈全英文）；`ulw-modal-collision-and-error-alerts-20260923.md` 309 行中文 122 行（40%，英文骨架来自 omo ulw-plan 技能模板）；commit `f68e328` subject+trailer 全英文。历史 plan 惯例约 65% 中文。
- 成因：三层（门禁 / 调度 brief / omo 模板）都没钉语言，执行席随模板自由漂移。
- 已处置：`ulw-modal-collision` 正在翻译为中文（本批另票）；语言惯例已显式写入 `docs/dispatcher-playbook.md`（commit bc5d914）。
- dev 分支 ahead 9 未 push——历史重写（reword）技术上安全。

### 选项与利弊

| 选项 | 利 | 弊 |
|---|---|---|
| A. commit-audit 加语言规则（R7，如「subject 与 trailer 须含中文」） | 机械拦截、永不漂移；符合仓库「能探针化的约束不靠记忆」哲学（L1-29） | 规则变更要同步三处（audit 脚本 / 文档 / commitlint config——tests/qa/AGENTS.md 反模式条款明示「不能只改一处」）；中文判定阈值（CJK 占比）要设计，防英文标识符多的 subject 误杀；只管新 commit |
| B. 调度 brief 模板钉死「plan 正文与 commit subject/trailer 一律中文」 | 零门禁成本、立即生效 | 靠纪律；但 brief 位于任务最前端、plan 写作在最早期，L1-29 的「15 call 失效」风险在此场景最低 |
| C. 存量改写 | 语言统一彻底 | plan 翻译：内容型改写，安全（本票已在做 modal-collision；`ulw-reset-store-outcome-error.md` 同样全英文，待裁）。commit reword：dev 未 push 可做，但 6 条 SHA 全变，已发出的汇报表作废，追溯成本 > 收益 |

### 调度者建议

**A + B 组合**；存量只翻 plan（modal-collision 已办，席②那份 81 行待你点头，成本 ≈10 分钟）、**不 reword commit**。

### 主公裁决（2026-09-23）

> **A + B 组合。存量只翻 plan——modal-collision 已办，`ulw-reset-store-outcome-error.md`（81 行）本次一并翻译；不 reword commit。**
> 执行票：修复席①（分支 `feat/commit-lang-rule`）——已落地 `3068b22`（R7 语言规则 + 三处同步 + brief 模板中文节 + 81 行 plan 全文中文化；实弹验证：全英文 subject 被 R7 拒、中文 subject 过）。

---

## 项 2：resetStore 统一 helper 票

### 事实（本次 rg 全仓清点）

- `useGameStore.setState` 重置块遍布 **11 个测试文件 12 处**；本波只修了 2 处（HomeDialogMount:52 / OnlineGateMount:57 补 `outcomeError: null`），**剩 10 处未修**。
- `GameShell.test.tsx` 的重置块连 `roomName` 字段都没有——它是 outcomeError 之前就开始的陈旧漂移，证明这份手抄清单已经烂过一轮。
- 复发机制已实锤：outcomeError 就是「store 加新字段、手抄块漏同步」的现行案例（两轮 review 均独立指出）。
- 抽取难点：HomeDialogMount 的块在 beforeEach 里混有 localStorage / sessionStorage / fetchSpy.mockClear；OnlineGateMount 末尾有 routerPush.mockClear——抽取时清理顺序与语义必须逐文件保持。

### 选项与利弊

| 选项 | 利 | 弊 |
|---|---|---|
| 立票统一 helper（估 30-60 分钟，单席） | 一次根治；store 以后加字段只改一处；顺带消除 GameShell 陈旧漂移 | 10 文件逐处语义审查的改动面；若某文件清理顺序被破坏会产生难查的测试互相污染 |
| 不修（维持现状） | 零成本 | store 每加一个字段，10 处人肉同步；漏一处 = 隐性状态泄露复发一次，且很难在 code review 里肉眼抓到 |

### 调度者建议

**立票**。触发条件已成熟（同一问题两轮被抓）；风险可控（有 494 测试基线护航）。

### 主公裁决（2026-09-23）

> **立票。**
> 执行票：修复席②（分支 `refactor/reset-store-helper`）——已落地 `47ad7d7`（`tests/helpers/reset-store.ts` 单点 helper，含 roomName/outcomeError 全字段 + 内部缓存清理；vitest 基线 494→498）。

---

## 项 3：探针 step 02c 阈值在慢 CI 上的裕量

### 事实（实现与实测数据齐全）

- 当前阈值：EARLY 上界 100ms、LATE 下限 80ms、LATE 上界 1500ms（`tests/qa/home-return-qa.mjs` step 02c）。
- 实测（本机 5 跑）：真实开框 path A（animationend）clickToOpen 327-354ms、margin ~137ms；path C（双 rAF ~32ms + commit ~16ms ≈ 96ms）尚未实测出现。
- 风险量化：若 CI 慢机使 path C 真实耗时逼近 100ms，EARLY 断言可能误杀正确实现（flake）；LATE 下限 80ms 对 path C 余量 48ms。
- 观测手段已内置：每次跑 DIAG 行输出 clickToOpenMs 实测值，无需额外埋点。

### 选项与利弊

| 选项 | 利 | 弊 |
|---|---|---|
| 现在就调宽 EARLY（如 100→120ms） | 提前消除 flake 隐患 | 无 CI 数据支撑的调参就是拍脑袋；且放宽 EARLY 会同步削弱「早开回归」的捕获能力 |
| 等第一次 CI flake 再调，按 DIAG 实测值精准调 | 数据驱动；当前本机 5 跑零 flake | CI 上可能出现 1-2 次红（可重跑） |

### 调度者建议

**等数据**。判据明确：CI 上 02c 首次 flake 时读 DIAG 行的 clickToOpenMs，若 path C 实测 >80ms 则把 EARLY 调到实测 P99 + 20ms。现阶段不动。

### 主公裁决（2026-09-23）

> **等数据，现阶段不动。判据明确：CI 上 02c 首次 flake 时读 DIAG 行的 clickToOpenMs，若 path C 实测 >80ms 则把 EARLY 调到实测 P99 + 20ms。**
> 判据外化（防只活在决策文档里）：修复席④落 `tests/qa/AGENTS.md` 时序敏感断言节。
> 判据已外化至 tests/qa/AGENTS.md（本票，分支 docs/decree-record）——已落地 `93f890e`，探针本体零改动。

---

## 项 4：rev-units 的 P3×5 文档级 findings

### 事实

五条均为低价值清理项：① jsdom 里 mock 的 `getAnimations` 属性用后不删（文件内无功能影响）；②③ plan 两处措辞与实现不同步；④ Alert.test.tsx 注释微瑕；⑤ 分支矩阵表 4b 未单测（语义与 case 4 同效）。reviewer 自己判定「留 TODO 不阻塞」。

### 选项与利弊

| 选项 | 利 | 弊 |
|---|---|---|
| 派工清掉 | 文档与实现零漂移 | 花一张票的调度成本处理 5 条 P3 |
| 留 TODO 不派工 | 零成本 | 文档轻微滞后 |

### 调度者建议

**不派工**。下次有任何一席再动 `view-transition.test.ts` 或对应 plan 时顺路带上。

### 主公裁决（2026-09-23）

> **派工清掉（推翻调度者「不派工」建议）。文档与实现零漂移，花一张票的调度成本处理 5 条 P3。**
> 执行票：修复席③（分支 `chore/p3-doc-hygiene`）——已落地 `b2bda4c`（五项闭环）；交叉审 6 条 low findings 的收尾处置见 `848aa9b`（.omo/plans/ulw-review-rework-20260923.md，修四记二）。

---

## 项 5：dev 分支 push

### 事实

- dev 当前 ahead 9（含：两案修复 2 commit + 四案修复 4 commit + REJECT 整改 1 + P0 补丁 1 + 复利资产 1），全部经六层验收与交叉审。
- origin：github.com/onepisya-interview-demo/tic-tac-toe（公开仓库）。
- push 是不可逆外发动作——按惯例停下问人。

### 选项与利弊

| 选项 | 利 | 弊 |
|---|---|---|
| push | 成果落远端，复利资产对协作者可见 | 若事后要 reword 语言（项 1 选项 C）就得 force push |
| 暂不 push | 保留项 1 存量处置的灵活性 | 本地积累越多， eventual push 的批量越大 |

### 调度者建议

若项 1 裁决「不 reword commit」（我的建议），即可 push；若要 reword，先 reword 再 push。

### 状态（2026-09-23）

> **未裁决。** 项 1 已定「不 reword commit」，push 技术上已解锁；等主公点头后执行。
