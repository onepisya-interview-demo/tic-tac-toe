# 去除代码注释实践方案（v2 终稿，供主公裁决）

**合成依据**：六路调研（vault 剪藏区 / pi-agent-book / pstack 上游 / vault 主区 / 业界网络 / 本仓现状）＋ 初稿全仓一手复核 ＋ 独立审读 14 条意见逐条核验修订。

**一句话建议（不变）**：本仓不适用「一刀切删注释」。正确姿势是——**删装饰、留契约、转结构、增量机械化**。存量可删面极薄（复述≈0、死代码≈0、TODO=1），主战场在增量门禁而非存量清理。

---

## 审读修订记录

独立审读员提出 9 条 problems、5 条 missed。本轮对每条可验证断言做了命令级一手核验，处置如下。

### 吸收（13 条，全部经本轮核验证实）

| # | 审读意见 | 核验结果与修订 |
|---|---|---|
| P1 | R7 编号撞车 | **属实**。`tests/qa/commit-audit.mjs` 现有规则 R1–R7 全占（R1 subject 前缀 :195、R2 长度 :193、R3 body :227-233、R4 trailers :238-241、R5 Plan footer :244、R6 BR 绑定 :291/:301、R7 CJK 双处 :212/:260）。新规则改名 **R8**；§六补 commit-audit 规则清单对照。初稿复核只读了 270-289 行确实漏看上方 R7——复核范围不足，承认 |
| P2 | 「R6 挡提交」三重错位 | **全部属实**。① `.git/hooks/commit-msg:5` 只调 `--message-file`，而 R6 明写「runs only in --branch mode (per-commit --message-file mode skips it)」（commit-audit.mjs:270-271）；② `.github/workflows/ci.yml` 六类 job（lint/typecheck/test+property/build/6 个 Playwright 探针）与 `.git/hooks/pre-push`（push 法令守卫）均无 commit-audit 调用；本轮实跑 `node tests/qa/commit-audit.mjs --branch dev` → `ref=dev total=490 pass=476 skip=14 fail=0`；③ R6 只校验 business-rules.md 探针列登记文件（:286-289 遍历 row.probes），实核 13 个 `// BR:` 头文件仅 10 个登记，`lib/view-transition.test.ts`、`components/ui/Alert.test.tsx`、`tests/db/ta-transaction-feasibility.test.ts` 删掉 BR 头 R6 零反应。business-rules.md:33「commit-msg hook 同步阻止提交」系文档与代码不符，初稿照抄未核代码。§〇/§三/Phase 2 相应重写，R6 触发点接入列入 rollout |
| P3 | M1 负面清单存量误报 | **属实**。① 阶段叙述正则误伤 `tests/store/store.mutation.test.ts:112`「// Phase is still 'won'…」（Phase 是游戏状态字段名）——收紧为 `//\s*(Phase\|Step)\s*\d` 后实测零命中；② banner 存量 32 处（ci-verify.mjs 7、rooms-race-qa.mjs 24、confetti-origin-qa.mjs 1），其中含决策编号/判据回链 3 处、纯分隔线 25 处——降为 advisory＋回链白名单；全角 `＊{5,}` 系笔误改半角 `\*{5,}`（半角实测零命中）；③ 死代码正则收紧为代码形状要求（行尾 `;{(` 或 `console.x(`）后实测零命中，`lib/game-net.ts:22` 假阳性消除。Phase 2「存量零误报」改为分级验证目标 |
| P4 | 裸 lint 抑制归删格错误 | **属实**。实扫 7 处（6 处 `react-hooks/set-state-in-effect` next-line + `components/ui/Alert.tsx:36` 一处 `no-unused-vars` disable-line；审读员计 8 处，本轮计数为 7，不影响结论）：`components/OfflineStatsPanel.tsx:44` 无理由，删掉 `pnpm lint` 即红——「零损失」判定器不成立；该抑制且是 AGENTS.md L0「不在 SSR 首帧读 localStorage」模式的必然产物。删格⑤撤销，挪转化格；M1④ 重定义为「eslint-disable 必须带 ESLint 官方 ` -- ` 描述语法」（官方文档一手核实：『The description must come after the configuration and needs to be separated…by two or more consecutive - characters』）——机械判据可证伪 |
| P5 | M3 与治理资产自相矛盾 | **属实**。复算占比：db/schema.ts 73%、lib/game-net.ts 41%、lib/view-transition.test.ts 33%、tests/qa/rooms-race-qa.mjs 22%、lib/store.ts 41%——全部是「留」格资产。M3 改为「分诊标记剔除后的无标记注释占比」纯 advisory 报表，**撤销 Phase 4 收紧为阻断的预留** |
| P6 | M2 假冲突 | **属实**。`lib/store.ts:94-100` makeMove JSDoc 块以「Apply a move」开头（本轮 Read 实证），TODO 在块内第 5 行中部；ESLint no-warning-comments 默认 `location:"start"` 只匹配注释文本起始 → 默认配置零命中。初稿「冲突明说」是为不存在的报错做工程，撤销；lib/store.ts:98 保持原样（`rg TODO` 可搜性保留）；补写 location 参数取舍 |
| P7 | M4 名不副实 / M5 定义缺失 | **属实**。anti-patterns.md:217 原文「被未知进程按清单删除」+ L2-8:223「reflog/index 零记录证明它绕过了 git」——2026-09-12 事故不经任何脚本入口，M4 对其零约束，修正为「自觉场景入口防呆」；「untracked 先备份」补定义（`.omo/backups/<timestamp>-<label>.tar`＋恢复路径）。M5「未写它的评审员」补可操作定义：不携带产出 session 上下文的独立只读评审 session，或主公人工 |
| P8 | 分诊矩阵四处歧义 | **属实**。补四条归格规则：分诊粒度按注释块（见 §二.0）；裸抑制归转化（见 P4）；测试注释以「绑 BR/spec/案N」为界；变更描述以「含决策编号/plan 回链」为界。撤回初稿对 `// 探针（spec 要求）` 的过度声称（精确格式全仓仅 1 处且不受 R6 保护，「固定格式/体系一部分/同源保护」均不成立） |
| P9 | 两处现状错误 | **属实**。「// BR: 头不可动」按 AGENTS.md 自身分层属 L0 硬约束，Phase 1 改为 L0 追加而非 L1 路由；KNOWN_STALE 例子撤换（`docs/verification-gauntlet.md:178`：该豁免随票 18（2026-10-09）清账归零、机制移除——留格例证换为现存的 `scripts/ci-verify.mjs:244` 判据节标题） |
| M1' | 业界来源缺口 | **部分吸收**。Linux kernel coding style ch.8 一手核实（kernel.org）；Ousterhout ch.13 章节标题经课程 TOC 核实（正文引文系二手，如实分层）；Code Complete 实证综述未核实原文（如实标注）。§1.5「未见学术实证研究」断言修正为分层表述 |
| M2' | 注释形态覆盖 | **吸收**。M1 四条正则确只匹配 `//` 形态。实测 JSX `{/* */}` 3 处（全部为 why/回链类留格）、非 JSDoc 块注释 `/* */` 15 处（全部为空 catch 说明类留格）、JSDoc 208 处。M1 拦截范围如实收窄：blocking 仅限 `//` 行注释，JSX/块注释形态入 advisory |
| M3' | 扫描范围/豁免面未定义 | **吸收（含一处驳回，见下）**。范围定为六目录（与统计口径一致）；`public/sw.js` 系 tracked 源文件非生成物（头注释为 PWA why+P3 回链，`scripts/sw-bust.mjs` prebuild 仅原地注入 CACHE_NAME，anti-patterns.md:211），不在六目录故不扫 |
| M4' | BR 头 13 vs 10 差集对账 | **吸收**。本轮跑通双向对账（命令见 §七）：10 登记、3 未登记；3 个裁决选项入 rollout |
| M5' | AGENTS.md 写作侧缺位 | **吸收**。Phase 1 补动作：AGENTS.md 项目块写入两条写作纪律（对齐 Anthropic 官方模板）|

### 驳回（2 处事实断言，其余意见不驳回）

1. **「components/ui/（shadcn 系）属外部模板组件，删其注释下次同步全部复活」——事实不成立**。本轮实查：`rg "radix|class-variance-authority|cva\(|shadcn|from '@/lib/utils'" components/ui` 零命中；`git ls-files components/ui` 列出的 10 个文件（Alert/BoardGrid/Button/Card/Cell/StatsCard/StatsGrid/StatusBar＋2 个 test）均为本仓自写组件（Alert.tsx 头部为 `'use client'` + `ReactNode` import，无任何模板痕迹）。故 components/ui **不豁免**、照常参与分诊与 R8 扫描。但「扫描范围/豁免面未定义」的批评本身成立，已按 M3' 吸收。
2. **eslint-disable 计数**：审读员称「7 处 set-state-in-effect ＋ 1 处 disable-line」（8 处），本轮实扫为 6 处 set-state-in-effect next-line ＋ 1 处 no-unused-vars disable-line＝**7 处**。不影响任何结论（7 处无一带 ` -- ` 描述），论证全部照收，仅数字以本轮实测为准。

### 本轮新增核验（初稿之外）

另有一项审读未提、本轮发现的中间事实：`scripts/verify-all.mjs:270-271` 第⑤层已接 `node tests/qa/commit-audit.mjs --range origin/main..HEAD`，且 R6 在 branch/range 分支无条件执行（commit-audit.mjs:377-382 ref 解析、:433 调用）——即 **R6 是六层门禁⑤层手动流程（verify-all）内的检测器，非孤立命令；但 verify-all 本身无自动触发点**（CI 与 hook 均不调它），「无自动触发」结论不变，R6 的真实画像更准确了。

---

## 〇、结论先行

1. **本仓注释成色反常识地好**。149 个 ts/tsx/mjs 文件共 6178 行注释（初稿逐目录复现：app 384 / components 1579 / lib 1161 / db 39 / scripts 268 / tests 2747），教科书式清理对象几乎为零：注释掉的死代码唯一模式命中是假阳性（`lib/game-net.ts:22`，句子换行）；TODO 全仓仅 1 处（`lib/store.ts:98`，W2 seam 设计说明）；「复述本行代码」抽样无典型实例。形态分布（本轮实扫）：JSDoc `/**` 208 处、JSX `{/* */}` 3 处（全为 why/回链）、非 JSDoc 块注释 15 处（全为空 catch 说明）。主体是三类高价值注释：BR 头契约、决策编号＋plan 回链、非显然约束解释。
2. **全禁派方案在本仓不可行——但理由与初稿不同**。初稿称「删 BR 头会触发 R6 阻断提交」，经审读与复核**不成立**：R6 只在 branch/range 模式执行（commit-audit.mjs:270-271、:433），commit-msg hook 只走 `--message-file`（`.git/hooks/commit-msg:5`），CI 与 pre-push 均无调用——R6 是**无自动触发点的手动审计**（触发面＝人工 `--branch`/`--range` 或 verify-all ⑤层），且只覆盖探针列登记的 10/13 个 BR 头文件。全禁派的真正不可行理由是：**会摧毁决策编号体系与 plan 回链——本仓核心治理资产恰由注释承载**（pstack 式全禁在自己仓库可行，因其治理信息走技能文件与类型，不走行内注释；本仓走了行内注释，路径依赖已然形成）。
3. **业界无「整体删注释」共识；共识收敛在分诊框架**（Atwood how/why、Henney、Google Style Guide、Linux kernel WHAT-not-HOW、Ousterhout「描述代码不明显之物」）；「冗余复述注释该删」只有口头共识、无机械解——没有任何主流 linter 能判断注释是否复述代码（业界调研结论，初稿后未变）。

---

## 一、立场光谱

### 1.1 删除派（激进）

- **Robert C. Martin《Clean Code》第 4 章**：「The proper use of comments is to compensate for our failure to express ourselves in code」「Comments are always failures」。（HN item 8073620 转引；bugzmanov 批评文核实其「好注释」示例本身有错，证据力被削弱）
- **sarahfim 反 slop 软件工厂**：禁超 3 行注释、考虑全禁；评论区点名 poteto 团队全禁防 agent 抄近路（细节在评论区与剪藏者注记层，视频本体未转录；poteto 立场系观众转述）。（`…/minis-vault/minis-clippings/x-sarahfim-antislop-factory-2108298553823203613.md`）
- **pstack 上游（一手最系统）**：`/no-comments` skill + 只读子代理 Comment Sicko——「注释默认处死，仅五类例外（法律/许可头、无法改造的外部依赖强制行为、`// prettier-ignore`、公共 API 契约 doc comment、解释代码无法表达之约束的 issue/RFC 链接）；存疑即删」。（`…/minis-vault/library/notes/pstack-upstream/agents/comment-sicko.md`）
- **anatomy 项目**：「no comments in code」写进贡献硬规则。（`…/minis-clippings/wechat-bithouniao-anatomy-claude-tujie-src-readme.md`）
- **AI 时代极端变体（HN）**：Taek 删光全部注释省 token、防模型被自己旧注释误导；ninkendo：否定式注释（don't do X）可能诱导后续 agent 去做 X。（https://news.ycombinator.com/item?id=49337050）

### 1.2 保留派

- **Ousterhout《A Philosophy of Software Design》ch.13（本稿新增，审读指出）**：章节标题「Comments Should Describe Things that Aren't Obvious from the Code」；并主张接口注释先于实现写（write the comments first）、注释是设计工具。（章节标题经 Stanford CS190 课程 TOC 核实：https://www.studocu.com/row/document/…/aphilosophyofsoftwaredesign2018-4/84631866；正文引文系二手转述，未逐字核实，如实标注）——保留派最系统的一手著作，权重高于初稿所引 Medium 文。
- **bugzmanov 系统反驳**：注释是思维工具而非失败标记；写注释能帮你理清烂代码；Martin 的「好注释」示例经查证不是 Singleton，「comically bad」。（https://bugzmanov.github.io/cleancode-critique/clean_code_second_edition_review.html）
- **pi-agent-book（agent 实践书笔记，全区反向立场）**：回归测试必带 issue 号注释（事故可追溯锚）、凭据踩坑写进工作流注释、门脚本头部注释即设计宣言（「Entry points are cost contracts」被称「自述即论文」）、魔法数字必须在注释里写构成理由。（`…/minis-vault/library/notes/pi-agent-book/ch04-工程质量与规模化.md`、`research/wpa-check-scripts.md`）
- **Mario Zechner 移植工作流**：文档注释（Javadoc→docstring）是须忠实转移的资产，注释格式记入 conventions 供 agent 遵循。（`…/minis-clippings/mariozechner-prompts-are-code.md`）
- **AI 时代价值上升派**：why 注释帮 AI 理解意图、给下一轮迭代用。（https://medium.com/@iZonex/the-importance-of-code-comments-for-modern-ai-coding-assistants-fbfced948a28；HN 原帖作者自述）

### 1.3 分诊派（业界主流）

- **Jeff Atwood**：「Code tells you how, comments tell you why」；只在代码无法再变易懂处加注释。（https://blog.codinghorror.com/code-tells-you-how-comments-tell-you-why）
- **Kevlin Henney**：「Comment what the code cannot say, not simply what it does not say」；「错误注释价值为零或为负」（引 Kernighan & Plauger）。（https://accu.org/journals/overload/28/157/henney_2796）
- **Google Python Style Guide §3.8（制度化范本）**：公共 API／非平凡规模／非显然逻辑 docstring 强制；行内注释只放 tricky parts 且「never describe the code」。（https://google.github.io/styleguide/pyguide.html）
- **Linux kernel coding style ch.8（本稿新增，一手核实）**：「NEVER try to explain HOW your code works in a comment: it's much better to write the code so that the working is obvious」「Generally, you want your comments to tell WHAT your code does, not HOW」「Comments are good, but there is also a danger of over-commenting」。（https://www.kernel.org/doc/html/latest/process/coding-style.html——注意 kernel 口径是 WHAT-not-HOW，与 Atwood 的 WHY-not-HOW 细别，如实区分不混引）
- **Anthropic 官方提示词模板**：「Don't add docstrings, comments, or type annotations to code you didn't change.」「Only add comments where the logic isn't self-evident.」。（https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices）

### 1.4 主公知识库立场：分诊派、偏删、带三重工程纪律（出处路径，初稿结论经复核维持）

**偏删侧**：`…/minis-vault/archive/bak-pre-ledger-split-playbook-20261003.md` 行 185（「注释级契约＝无牙之门」，修法优先级：结构＞运行时断言＞注释）；行 288/299（2026-09-30 mingli 36 件批量注释清理役既成事实，docstring 误删定性为「伤」）；`…/minis-vault/LEDGER.md` 行 1119（AI 友好代码库手册「禁注释信息搬家表＋结构即约束」）；`…/minis-clippings/note-ai-fomo-trust-scaling-transcript-2026-10-02.md`（lint/门禁替代人肉叮嘱；direction_note 自注系对话转述层，引用前须对一手源核验）。
**留 WHY 侧（同一份 playbook）**：行 306/308（豁免与降级理由必留档）；行 255（改怪异代码前先考古注释/历史）；行 175（非显然顺序依赖写进注释）；行 327（TODO「债有名、有址、有目标版本」）；`LEDGER.md` 行 1591/1604/1613（docstring 活契约）。
**三重工程纪律**：NIH 戒律（行 299，禁手搓行匹配）；沙箱彩排（行 288，/tmp 副本编译＋行为探针全绿才上真树）；测试锚点不得依赖可清理内容（行 196）。

### 1.5 业界共识区 vs 争议区

**共识区（按共识度排序）**：①注释掉的代码必删（SonarQube S125 Major、Airbnb、SE 社区；唯 bugzmanov 留短期例外）；②公共 API doc、算法非显然理由/性能取舍该留（Atwood/Henney/Google/Ousterhout/kernel 五方独立收敛）；③复述代码的注释该删——口头一致，**机械化无解**；④AI slop 注释现象确立，治理呈「上游抑制（提示词）＋下游门禁」双层模式（HN 一手讨论＋Anthropic 官方模板）。

**争议区**：①注释整体存废——规范性争论；②AI 时代 why 注释价值——「删光省 token/防误导」vs「帮 agent 理解意图」，未收敛，按「why 留、how 删」兜底。

**关于实证研究的修正表述（吸收审读 M1'）**：初稿断言「本次调研未见任何学术实证研究」不准确——六路调研确实未检索到，但经审读提醒：Code Complete 的注释/文档章综述过「注释与可理解性」多项实证研究（此条系审读员凭模型知识指出、本轮亦未核实原文，如实标注）；Ousterhout 是保留派最系统的一手著作（章节标题已核实）。正确表述：**业界主流立场几乎全部是规范性论断，实证层存在被教材综述的研究但本方案未逐篇核验，方案不依赖任何实证结论，仅依赖规范层共识与机械可执行性**。

### 1.6 两处真实矛盾（不强行调和，如实并列；初稿结论经复核维持）

**矛盾一：poteto 谱系内部**。剪藏区转述 poteto「全禁」（sarah 帖评论区，间接）；pstack 一手技能文件显示「默认处死＋五类窄例外」；pstack 自带代码 3,661 行 TS 留 23 行注释（0.63%，全为例外清单类型）；pi-agent-book 又把 poteto 系门注释全文引用为「自述即论文」。**采信优先级：一手代码＞一手技能文件＞书笔记＞评论区转述**——poteto 实践实为「删除默认值＋窄白名单」，与「全禁」转述有实质差距。

**矛盾二：Anthropic 双面口径**。就业报告把「加 lint-suppression comment」列为 AI 质量恶化指标；同厂官方模板抑制冗余注释——同向。但 pstack 实践显示带理由的 `@ts-expect-error` 是白名单项。裁决口径：**裸抑制转化，带理由抑制留**（本仓具体形态见 §二.3）。

---

## 二、分诊矩阵

### 2.0 归格规则（本稿新增，解决审读 P8 四处歧义）

1. **粒度：按注释块分诊，不按行**。「注释块」＝连续行注释、单个 JSDoc、单个块注释或单个 JSX 注释。块内取最强归格：承载契约/why/回链 → 整块留；纯 TODO 债务 → 整块转化；混合块（契约 doc 内含 seam/TODO 说明）→ 整块留，块内 TODO 作为债账登记项，**不拆块**。例：`lib/store.ts:94-100` makeMove JSDoc 整块归「留」（跨模块契约 doc），行 98 的 TODO seam 是块内既有说明，保持原样（`rg TODO` 可搜性保留）。
2. **删格判定器修正**：「删了之后 lint 不红、语义与读者所需信息零损失」——lint 抑制类不满足前半句，永不出删格（裸抑制归转化）。
3. **测试注释界线**：文件有 `// BR:` 头、或注释含 BR-N/spec/案N 回链 → 留；否则优先转化为测试名/断言字符串。
4. **变更描述界线**：含决策编号（W-RV/案①②③/A4/D-1/L1-N/票 N）或 `.omo/plans/` 回链 → 留（决策记录）；一次性时态（「本次」「这次改为」）且无编号回链 → 转化 commit message。

### 2.1 删

| 类别 | 判定例子 | 依据 |
|---|---|---|
| 注释掉的死代码 | `// const oldBoard = getBoard();`（代码形状完整） | SonarQube S125（Major）；VCS 存全部历史。**本仓现状≈0**（形状收紧版实测零命中） |
| AI 装饰性/叙述性注释 | `// Phase 1: add cards`（Phase/Step＋数字）、AI 黑话 | pstack poteto-mode SKILL:117-119；Anthropic 官方模板；HN slop 报告 |
| 复述代码的注释 | `i++; // 递增 i`；Google BAD COMMENT 反例 | Atwood / Henney / Google / Linux kernel「NEVER explain HOW」。**本仓现状≈0** |
| 写给 reviewer 的临时说明 | 「reviewer 上轮说要…」一次性沟通 | 归宿 PR/commit message；pstack「叙述性注释让 diff 显得未完成」 |

（初稿删格⑤「裸 lint 抑制」已撤销挪转化格——审读 P4：删了 lint 红，零损失判定器不成立，且系 L0 SSR 模式必然产物。）

### 2.2 留

| 类别 | 判定例子 | 依据与保护现状 |
|---|---|---|
| BR 探针头契约（**保护现状分两档**） | ①受 R6 保护 10 文件（如 `tests/qa/rooms-race-qa.mjs:3`）；②不受保护 3 文件：`lib/view-transition.test.ts:1`（案①）、`components/ui/Alert.test.tsx:1`（案②）、`tests/db/ta-transaction-feasibility.test.ts`（「BR: 无（工程实验，非业务规则探针）」）——三者头内容非 BR-N 格式，系借用 BR 头格式的契约/否定声明，R6 的 parseBrRows 从未关联 | `docs/business-rules.md:31`；R6 现状＝手动触发（见 §三.1）＋覆盖 10/13；差集裁决见 Phase 1 |
| 代码表达不了的约束与 why | `lib/game-net.ts:18-35`（8s 超时同源论证）、`app/layout.tsx:8-16`（Chromium Bug 517439604＋plan 链）、`scripts/sw-bust.mjs:2-13`（SW 竞态） | Atwood / Henney / Google / Ousterhout ch.13。本仓主体存量 |
| 决策编号＋plan 回链 | `db/schema.ts:22-30`（W-RV P3 #9 autoincrement 论证）、`scripts/ci-verify.mjs:244`（「// ---------- 判据 [1] 五必绿＋首跑全绿（L1-33） ----------」，本稿替换已清账的 KNOWN_STALE 例） | 本仓治理资产；playbook 行 306/308 |
| 公开 API / 跨模块契约 doc | `lib/store.ts:94-100` makeMove JSDoc（整块，含行 98 seam 说明） | Google §3.8.3 强制；pstack 例外清单 |
| 空 catch 说明（块注释形态） | `/* page may already be closed */`、`/* module may not have loaded */`（15 处实测） | 解释吞异常理由，代码表达不了 |
| JSX why/回链注释 | `app/result/page.tsx:148`（W-R D-3 决策编号）、`app/layout.tsx:150`（Plan 回链）（3 处实测） | 同决策编号类 |
| 坑修复痕迹标记 | 「此处不用 rmtree 而逐项删，因 symlink 误报」类 | playbook 行 255（rmtree 二次咬实证） |

（初稿「测试探针说明（固定格式）」行撤销：`// 探针（spec 要求）：` 精确格式全仓仅 `components/DeleteRoomButton.test.tsx:97` 一处，该文件无 BR 头、不在探针列，初稿「固定格式/体系一部分/同源保护」均系过度声称。按 §2.0 规则 3，它归「转化候选」——但其「spec 要求」说明确有 why 价值，试点时人工裁决。）

### 2.3 转化

| 从 | 到 | 判定例子 | 依据 |
|---|---|---|---|
| 裸 TODO（独立块） | issue / 债账条目（改什么·为何当时不能改·到期触发器）或 plan 回链 seam | `lib/store.ts:98` 已是 seam 格式且在契约块内——按 §2.0 不拆块，保持原样 | playbook 行 327 |
| 变更说明注释 | commit message | 「本次将 X 改为 Y…」无编号时态 | commit-audit R3 已有 WHAT/WHY/HOW 硬要求（commit 38e4933）——正确载体已在机制里 |
| 测试意图注释（不绑 BR/spec） | 测试名 / 断言字符串 | `assert(ok, 'persisted across restart')` 断言代行文档 | pstack poteto-mode SKILL:119；界线见 §2.0 规则 3 |
| **裸 lint 抑制**（本稿从删格挪入） | 行内 ` -- 理由` 描述（ESLint 官方语法），存量 7 处渐进补齐 | 现状：7 处无一带 ` -- `（`components/SoundToggle.tsx:16-21` 理由在前 5 行散文——机械不认散文，补行内简述可并存；`components/OfflineStatsPanel.tsx:44` 等 6 处无理由） | ESLint 官方文档（https://eslint.org/docs/latest/use/configure/rules：「separated…by two or more consecutive - characters」）；与 L0「SSR 首帧不读 localStorage」模式无冲突（抑制保留，只补理由） |
| 约束声明注释 | 类型 / 运行时断言 / 测试 / lint——**批准后编码，注释照删** | `// start <= end` → `type TimeRange = { start: Date; durationMs: number }` | pstack no-comments SKILL:20-24；runner-prompt「难误用类型＞运行时检查＞散文注释」；playbook 行 185 同优先级 |
| 规则叮嘱（重复教训） | AGENTS.md 条目 / 门禁 | 「你别这么做」→ lint/compile/architecture gate | 主公-元宝对话；pstack encode-lessons-in-structure |

---

## 三、机械化路径（可证伪落地项）

### 3.1 本仓触发面实况（初稿重大修正，审读 P2）

| 触发点 | 跑什么 | R6 是否执行 |
|---|---|---|
| `.git/hooks/commit-msg`（每 commit 自动） | `commit-audit --message-file`（R1–R5、R7） | **否**（明写 skip，commit-audit.mjs:270-271） |
| `.github/workflows/ci.yml`（PR→main 自动） | lint/typecheck/test+property/build/6 Playwright 探针 | 否（无 commit-audit job） |
| `.git/hooks/pre-push`（push 时自动） | push 法令守卫（MASTER_PUSH_DECREE） | 否 |
| `scripts/verify-all.mjs` 第⑤层（**手动**） | `commit-audit --range origin/main..HEAD` | **是**（:433 在 branch/range 分支无条件执行） |
| 人工 `node tests/qa/commit-audit.mjs --branch dev` | 全分支 audit | 是（本轮实跑：total=490 pass=476 skip=14 fail=0） |

**结论**：R6 是「六层门禁⑤层手动流程内的检测器」，无自动触发点；保护面＝探针列登记的 10/13 个 BR 头文件。初稿「R6 是清理役第一道误删防线」修正为：**误删 BR 头不会在提交时被挡，要等下一次 verify-all ⑤层或手动 --branch/--range 才被 R6 抓到**。business-rules.md:33「commit-msg hook 同步阻止提交」与代码不符，列修正动作（Phase 1）。L2-7 批量清理 git 通道纪律同样自陈「无机制→候补池 C12」（anti-patterns.md:215）。

### 3.2 新增项（每项注明拦得住/拦不住/验证法）

**M1 → R8 注释增量门禁（commit-audit 扩展，零新依赖，首选）**——编号 R8（R1–R7 已占满：规则清单见 §六）。
- **扫描范围**：六目录（app/components/lib/db/scripts/tests）＋ ts/tsx/mjs/js/cjs；`public/` 不在范围（`public/sw.js` 系 tracked 源文件、被 prebuild 原地改写 CACHE_NAME，非生成物；不在统计口径内故不扫，如实声明）；components/ui 系自写组件（审读「shadcn vendored」断言已驳回），照常入范围。
- **形态覆盖（如实收窄）**：blocking 子集只检 `//` 行注释（存量验证充分）；JSX `{/* */}` 与块注释 `/* */` 形态入 advisory（本仓实测该两形态 18 处全为留格类，无清理需求）。
- **blocking（三子集，均经存量 dry-run 验证）**：
  - B1 注释掉的代码（代码形状版）：`^\s*//\s*((const|let|var|import|export)\s+\w+.*[;{(]\s*$|console\.\w+\(|return\s+[\w.'"\`]+;\s*$)`——**存量零命中**（本轮实测；`lib/game-net.ts:22` 假阳性被形状要求消除）。
  - B2 阶段叙述（收紧版）：`//\s*(Phase|Step)\s*\d`——**存量零命中**（本轮实测；`store.mutation.test.ts:112`「Phase is still 'won'」不再误伤——Phase 系本仓游戏状态域名词，故必须求数字跟随）。
  - B3 eslint-disable 无 ` -- ` 描述（ESLint 官方语法）：**存量 7 处全部无 ` -- `**——不溯及，只对增量新增行强制；存量走转化格渐进补齐。
  - 实现面：对 `git diff --cached -U0` 的新增行检查（commit-msg hook 的 --message-file 模式**不读 diff**，故 R8 增量检查须挂 pre-commit hook 或并入 verify-all ⑤层对 HEAD~1..HEAD 检查——二选一，Phase 2 定）；`--range` 历史扫描复用现有祖父条款机制（preR7Adoption 模式，commit-audit.mjs:399-404 按作者日期豁免 → preR8Adoption，否则历史 commit 曾新增的 32 处 banner 会全爆）。
- **advisory（只报不拦）**：A1 banner `//\s*(={5,}|-{5,}|\*{5,})`（半角；存量 32 处：含决策编号/判据/票号回链 3 处白名单跳过、纯分隔线 25 处与 ci-verify 判据节标题——**存量不动**，只监控增量新增的无回链 banner）；A2 JSX/块注释形态负面模式（二期）；A3 M3 占比报表（见 M3'）。
- 拦得住：可模式化装饰/叙述/死代码注释的**增量**子集＋抑制无理由（B3 可证伪：`// eslint-disable-next-line no-console -- 理由` 带 ` -- ` 即 pass）。
- 拦不住：复述代码的语义判断（业界结论：无主流 linter 能判）；伪装成 why 的装饰；存量（by design）。
- 可证伪验证（Phase 2，fixture 级）：B1/B2/B3 各注入一条违规 → FAIL；合法形态（BR 头、决策编号、why、带 ` -- ` 抑制）→ PASS；`--range` 对历史 commit 祖父豁免生效；六层门禁全绿。

**M2 ESLint no-warning-comments（customTerms: todo/fixme/xxx，location 保持默认 "start"）**
- 初稿「冲突」系假冲突，撤销：`lib/store.ts:94-100` JSDoc 块文本以「Apply a move」开头（本轮 Read 实证），TODO 在块内第 5 行中部，默认 `location:"start"` 零命中——**无需 override、无需改写**，lib/store.ts:98 保持原样（`rg TODO` 一键找债的可搜索性保留，回应审读 P6 附带取舍）。
- location 参数明确取 "start"（不取 "anywhere"：prose 中含 todo/xxx 字样的合法注释会大面积误报）。
- 拦得住：新增**行首** TODO/FIXME 术语；拦不住：块注释内部 TODO（由 R8/人工兜底）、拆词绕过（「to do」）。
- 可证伪验证：注入行首 `// TODO: x` → lint 报错；存量零报错。**诚实标注**：本轮未实跑 eslint 验证零命中（依据官方文档 location 语义＋块文本起始实证推理），Phase 2 首个动作即实测。

**M3' 无标记注释占比报表（弱化重设计，审读 P5）**
- 初稿「新增注释/新增总行＞25% 报警＋预留收紧」与 §五.7 自相矛盾，撤销。改为：单 commit 剔除「留」格标记行（BR 头、决策编号 `W-R|案[①②③]|L1-\d|D-\d|票 ?\d`、`.omo/plans/` 回链、JSDoc 契约块）后计算**无标记注释占比**，纯 advisory 报表，**无阻断语义、不预留收紧**——它回答的问题是「增量里有多少注释是连分诊标记都挂不上的」，是 slop 趋势观测，不是门。
- 依据：复算存量占比 db/schema.ts 73%、game-net.ts 41%、view-transition.test.ts 33%、rooms-race-qa.mjs 22% 全是留格资产——任何不剔除标记的占比门禁第一类误伤对象就是本仓核心资产。

**M4' L2-7 机械化（补 C12 票）——「拦得住」如实收窄（审读 P7）**
- 机制：批量清理脚本入口断言 `git status --porcelain` 干净否则拒绝运行（tracked 变更先 commit）；untracked/ignored 备份定义：`.omo/backups/<timestamp>-<label>.tar`（沿用 .omx/backups 路径习惯），恢复＝tar 解包，备份系 git 通道外的兜底（L2-7 原文「删 untracked/ignored 内容前先备份」本义如此）。
- 拦得住：**自觉经脚本入口**的批量清理操作的结构化防呆。
- 拦不住：2026-09-12 式未知进程按清单删除（anti-patterns.md:217「被未知进程按清单删除」＋L2-8:223「reflog/index 零记录证明它绕过了 git」——该事故不经任何脚本入口，M4 对其零约束，初稿将其列为「拦得住」例证系错误归类）。

**M5' fresh-eyes 分诊评审（语义层，半机械）**
- 可操作定义（回应审读 P7）：评审员＝**不携带产出 session 上下文的独立只读评审 session**（本仓 agent 开发语境下的「未写它的」），或主公人工；载体＝只读评审＋固定格式报告（分类→blocking/advisory→修复由另一 session/人执行——参照 gajae-code ai-slop-cleaner 报告形态：`/Users/onepisya/node_modules/@gajae-code/coding-agent/src/defaults/gjc/skills/ultragoal/ai-slop-cleaner.md`；本机无 remove-ai-slops 技能，任务所述「6 阶段」未能验证，gajae 版为 7 类 taxonomy，如实保留初稿此结论）。
- 拦得住：机械规则判不了的语义层全部；拦不住（明说）：此层无机械判据、不可证伪，靠清单纪律——这正是业界「复述注释该删」停留在口头共识的原因。

**M6（备选，非首推）**：eslint-plugin-sonarjs no-commented-code——启发式有已证实误报（分号结尾注释）/漏报（TS 对象属性），且属新 dev 依赖；R8-B1 形状版已覆盖主要场景，引入须过依赖审查。

**R6 触发点接入（本稿新增动作，源自审读 P2）**：选项 A）ci.yml 加 job `node tests/qa/commit-audit.mjs --range origin/main..HEAD`（PR→main 级自动，⑤层 CI 化）；选项 B）维持手动＋把「清理役前后各跑一次 verify-all」写进 SOP。注意真实结构：CI 只在 PR→main 触发，dev 直接 commit 只有 commit-msg hook（不跑 R6）＋手动 verify-all——**R8 若只挂 PR 级，dev 直提完全绕过**；故建议 R8 增量检查挂 pre-commit hook（本地、每 commit、与 commit-msg 互补）。二选项供主公裁决。

**工具纪律（存量清理用，若启动）**：禁手搓行匹配（NIH 戒律，playbook 行 299）；TS/JS 须 AST/词法级；批量改写先 /tmp 沙箱跑 typecheck+vitest+探针全绿再上真树（行 288）。**本仓存量可删面极薄，预期无需大规模清理役**（Phase 3/4 验证）。

---

## 四、分阶段落地（Rollout）

**Phase 0 存量盘点（已完成，含审读修正）**
- 产出：注释统计逐目录复现＋形态分布（JSDoc 208/JSX 3/块注释 15）＋BR 头双向对账（10 登记/3 未登记）＋M1 候选正则存量 dry-run（B1/B2 收紧版零命中、banner 32 处、抑制 7 处）＋触发面实况表（§3.1）。
- 验证：本报告所有命令可复跑（§七清单）。

**Phase 1 立规范与对账（文档层，先行）**
- 动作：①`docs/conventions.md` 新增「注释规范」节（§二分诊矩阵＋§2.0 归格规则表格化）；②`docs/anti-patterns.md` 追加「注释分诊」条目（引 L1-27 行为保持前提）；③**AGENTS.md：L0 追加「`// BR:` 头注释（前 20 行内）不可动」**（硬约束入 L0，修正初稿误置 L1）；L1 只加 conventions.md 注释节的路由指针；④**AGENTS.md 项目块写入两条写作纪律（对齐 Anthropic 官方模板）：「不给未改动的代码加注释」「只在 logic 不自明处加注释」**（补初稿工具侧/写作侧只落一条的缺腿）；⑤**business-rules.md:33 文档失真修正**（R6 实际触发点如实改写）；⑥**BR 头 3 文件差集裁决**（供主公选）：案①（view-transition.test.ts）与案②（Alert.test.tsx）若对应 business-rules.md 条目则补登记探针列＋改 BR-N 格式入 R6 保护，否则改头格式为非 `BR:` 前缀（如 `// Contract:`）消除格式混淆；ta-transaction-feasibility 的「BR: 无（工程实验）」否定声明建议改为明确非 BR 前缀——此系业务规则治理，方案只给选项不裁决。
- 验证：commit-audit --message-file 对本次提交 PASS；R6 不受影响；lint 零新报错。

**Phase 2 增量门禁（机制层）**
- 动作：①实现 R8（B1/B2/B3 blocking＋A1 advisory＋M3' 报表）进 commit-audit；挂载点裁决（pre-commit hook vs verify-all ⑤层 vs 双挂——见 §3.2 R6 接入）；preR8Adoption 祖父条款；②M2 ESLint no-warning-comments（location:"start"，lib/store.ts:98 预期零命中——**首个动作即实跑验证初稿推理**）；③M4' L2-7 机械化（C12 票）。
- 验证（分级，修正初稿「存量零误报」空目标）：B1/B2 对 HEAD 全量 dry-run 零命中（已预验，Phase 2 复跑确认）；B3 存量 7 处经祖父/增量豁免不触发；fixture 注入各违规形态 → FAIL、合法形态 → PASS；`--range origin/main..HEAD` 历史祖父豁免生效；advisory 命中清单（banner 等）归档人工复核；六层门禁全绿。

**Phase 3 试点分诊（存量层，小规模）**
- 前置门（L1-27）：先过 business-rules.md 清单对账确认行为保持前提。
- 动作：选 `scripts/`（7 文件 268 行，小而独立）做 M5' fresh-eyes 分诊（独立只读评审 session，不携带产出上下文）；逐注释块判删/留/转化出 blocking/advisory 报告；批量动作走 L2-7 git 通道（tracked 先 commit，untracked 先备份 `.omo/backups/<ts>-<label>.tar`）；涉批量改写先 /tmp 沙箱彩排全绿再上真树。
- 验证：前后六层门禁全绿；探针对照零行为差异；报告数字说话。

**Phase 4 复盘定策（决策层）**
- 动作：按 Phase 3 实收决定——**本方案预判**：可删项极少，止步 Phase 2 即达本仓最优；若发现系统性 slop 类别再评估全量清理役。复盘写 `.omo/plans/` 决策记录＋`.omo/doc-status-map` 登记。（M3' 无阻断语义，无「收紧预留」——审读 P5 修正后此层不再含门禁动作。）
- 验证：决策记录含实收数字与六层门禁证据。

---

## 五、反例与风险（Caveats）

1. **正则/手搓行匹配误伤**（最高风险）：mingli strip v1 教训（playbook 行 299）；S125 启发式有已证实误报/漏报；本稿 M1 初版正则即被审读实扫出 2 处存量误伤（Phase 词汇、banner 判据节标题）——**正则设计必须在存量 dry-run 上先跑再定**，此教训已内化为 Phase 2 验证流程。任何机械清理必须沙箱彩排（行 288）。
2. **测试锚点依赖可清理内容**：mingli `# 历史解读` 节头被删致 find=-1 切片静默取尾巴（playbook 行 196）。清理前先 `rg` 排查代码对注释文本的锚点引用。
3. **docstring/JSDoc 误删＝伤**：mingli 复盘定性＋LEDGER 活契约（行 1591/1604/1613）；本仓 JSDoc 208 处同保护级别。
4. **BR 头契约的真实边界（初稿重写）**：BR 头保护现状＝R6 手动触发（无自动点）＋覆盖 10/13。全禁派与「删 BR 头」的现实冲突不在「挡提交」（不挡），而在**摧毁治理资产且最坏情况下无人察觉**（R6 只在下次手动审计时才发现）——这正是 R6 接入（§3.2）与差集裁决（Phase 1⑥）要补的结构。3 个仿格式头（案①②、「BR: 无」）目前零保护，属「留」格裸奔区。
5. **教学代码/公共库 doc**：复述注释对新手有价值（bugzmanov）；公共 API docstring 是 Google §3.8.3 强制项。本仓 db/schema.ts、lib 公共函数 JSDoc 属后者。
6. **AI 注释双刃**：注释对 agent 是不受信输入（pi-agent-book wpa-docs-36-digest 提示注入面；HN ninkendo 否定式注释诱导违禁）——删装饰注释顺带收缩注入面；why 注释帮下一轮 agent 理解意图（未收敛争议）——按「why 留、how 删」兜底。
7. **存量密度高≠可删面大（与 M3' 对齐后自洽）**：41 行/文件是治理信息密度；**不设任何不剔除分诊标记的密度门禁**（初稿 M3 的 25% 阈值已被复算证伪——73%/41%/33% 全是留格资产）；外部数字（pstack 0.63%）不构成本仓目标。
8. **遗留/怪异代码先考古**：坑修复痕迹当坏味道改回会复活旧坑（playbook 行 255，rmtree 二次咬）。
9. **机械化天花板（诚实声明）**：无 linter 能判注释是否复述代码；语义层永远需要 M5' fresh-eyes。M1–M4 只收窄攻击面。
10. **文档与代码失真的传导风险（本稿新增）**：初稿两处关键错误（R6 挡提交、KNOWN_STALE 现存）都源于**照抄文档未核代码**——business-rules.md:33 与 verification-gauntlet.md:178（票 18 清账）分别是「文档超前于代码」与「文档滞后于代码」的实证。本方案的落地动作必须以代码实跑为准，文档口径随 Phase 1 修正；豁免类注释（KNOWN_STALE 式）有生命周期，清账后机制与注释应同步退役。
11. **lint 抑制的特殊性**：抑制注释是唯一「删了会红」的注释类——与 L0 SSR 模式耦合（6 处 set-state-in-effect 抑制是「先渲染安全默认值+useEffect 同步」的必然产物）；治理动作只能是「补 ` -- ` 理由」不可删，且机械判据（行内 ` -- `）不认前几行散文（SoundToggle 式）——散文与行内简述可并存。
12. **调研材料证据等级**：主公-元宝对话系转述层（direction_note 原注）；poteto「全禁」系评论区转述；Ousterhout 正文引文系二手（章节标题已核实）；Code Complete 实证综述未核实原文。采信按 §1.6 优先级。

---

## 六、与本仓现有契约兼容性对照总表

| 现有契约 | 冲突点 | 兼容方案 |
|---|---|---|
| **commit-audit 规则清单 R1–R7**（R1 :195 / R2 :193 / R3 :227-233 / R4 :238-241 / R5 :244 / R6 :291/:301 / R7 :212/:260） | 初稿 M1 误用「R7」编号（已修正） | 新规则定名 **R8**；祖父条款仿 preR7Adoption（:399-404） |
| `// BR:` 头 + R6（business-rules.md:31；commit-audit.mjs:277） | R6 无自动触发、覆盖 10/13；business-rules.md:33 文档失真 | 「留」格第一项；R6 接入选项 A/B（§3.2）；差集 3 文件裁决（Phase 1⑥）；文档修正（Phase 1⑤） |
| anti-patterns L2-7 批量操作走 git 通道（:213-217；:215 自陈无机制候补池 C12） | 无冲突，纯文档 | M4' 机械化；Phase 3 强制；备份路径定义 `.omo/backups/<ts>-<label>.tar` |
| anti-patterns L1-27 slop 清理前过 business-rules 清单（:271） | 无冲突 | Phase 3 前置门 |
| AGENTS.md L0 不引入新 UI/路由/动画/数据访问/表单库 | eslint-plugin-sonarjs 属新 dev 依赖（不在字面禁列） | 首选零依赖 R8；sonarjs 备选须过依赖审查 |
| AGENTS.md L0「SSR 首帧不读 localStorage」 | 「删裸抑制」会破 L0 模式且 lint 红 | 裸抑制归转化格（补 ` -- `），不删（审读 P4） |
| AGENTS.md 分层（L0 硬约束/L1 路由） | 初稿把「BR 头不可动」误置 L1 | 修正入 L0（Phase 1③） |
| commit-audit R3 WHAT/WHY/HOW 硬要求（38e4933） | 无冲突 | 「变更说明→commit message」转化的现成载体 |
| 验证六层门禁（verification-gauntlet.md；verify-all.mjs ⑤层已含 commit-audit --range） | 无冲突 | 每阶段全跑；R8 挂载点在 pre-commit vs ⑤层间裁决 |

---

## 七、来源引用

### 本轮一手复核（v2 修订时执行；命令可复跑）
- 规则清单：`rg -n '"R[0-9]+"' tests/qa/commit-audit.mjs` → R1–R7 全占（:193/:195/:227-233/:238-241/:244/:260/:291/:301）
- 触发面：`.git/hooks/commit-msg:5`（只调 --message-file）；`.git/hooks/pre-push`（push 法令守卫，无 audit）；`.github/workflows/ci.yml` 全文（六类 job 无 commit-audit）；`scripts/verify-all.mjs:270-271`（⑤层 `--range origin/main..HEAD`）；`commit-audit.mjs:270-271/:377-382/:433`（R6 branch/range-only）
- 实跑：`node tests/qa/commit-audit.mjs --branch dev` → `ref=dev total=490 pass=476 skip=14 fail=0`
- BR 对账：`rg -l "^// BR:" <六目录>` → 13 文件；逐文件 `rg -qF <file> docs/business-rules.md` → 10 REGISTERED / 3 UNREGISTERED（Alert.test.tsx 案②、view-transition.test.ts 案①、ta-transaction-feasibility「BR: 无」）
- 正则存量 dry-run：阶段叙述初版命中 `tests/store/store.mutation.test.ts:112`（误伤）、收紧版 `//\s*(Phase|Step)\s*\d` 零命中；banner `//\s*(={5,}|-{5,}|\*{5,})` 存量 32 处（ci-verify 7 / rooms-race 24 / confetti 1；含回链 3 / 纯分隔 25）；死代码形状版正则零命中；半角 `\*{5,}` banner 零命中
- lint 抑制：`rg -n "eslint-disable" <六目录>` → 7 处（6× set-state-in-effect next-line＋Alert.tsx:36 no-unused-vars line）；`eslint-disable.*-- ` → 零命中；`components/OfflineStatsPanel.tsx:44`（无理由）与 `components/SoundToggle.tsx:16-21`（前 5 行散文）对照实读
- 形态：JSX `{/*` 3 处（app/page.tsx:40 / app/layout.tsx:150 / app/result/page.tsx:148）；非 JSDoc 块注释 15 处（空 catch 说明）；JSDoc `/**` 208 处；`// 探针（spec 要求）：` 精确格式全仓 1 处、`// 探针` 前缀 8 处
- 占比复算：db/schema.ts 39/53=73%、lib/game-net.ts 98/236=41%、lib/view-transition.test.ts 87/256=33%、tests/qa/rooms-race-qa.mjs 205/918=22%、lib/store.ts 195/466=41%
- vendored 驳回：`rg "radix|class-variance-authority|cva\(|shadcn|@/lib/utils" components/ui` → 零命中；`git ls-files components/ui` → 10 自写文件
- `lib/store.ts:90-101`（makeMove JSDoc 块以「Apply a move」起始，TODO 在第 5 行中部）；`docs/verification-gauntlet.md:178`（KNOWN_STALE 随票 18 清账归零、机制移除）；`tests/store/store.mutation.test.ts:110-114`（Phase 误伤行）；`tests/qa/commit-audit.mjs:236-263`（现有 R7）
- 联网核实：Linux kernel coding style ch.8（https://www.kernel.org/doc/html/latest/process/coding-style.html，逐字引文见 §1.3）；ESLint comment descriptions 语法（https://eslint.org/docs/latest/use/configure/rules）；Ousterhout ch.13 标题（Stanford CS190 TOC：https://www.studocu.com/row/document/…/84631866；正文引文二手）

### 未核验事项（如实声明）
- ESLint no-warning-comments 对 lib/store.ts:98 零命中——依据官方 location 语义＋块文本实证推理，**未实跑**，Phase 2 首个动作实测
- Code Complete 注释/文档章的实证研究综述——审读员凭模型知识指出，本轮未核实原文
- Ousterhout 正文引文（「write the comments first」等）——章节标题经 TOC 核实，引文系二手转述
- R8 fixture 级测试——存量 dry-run 已做，fixture 注入测试属 Phase 2
- 学术实证研究（注释密度 vs 缺陷率）——仍未检索到一手研究，方案不依赖实证结论（§1.5 修正表述）

### vault 与业界来源（承初稿，未二次开卷/已由调研一手验证）
- vault：`…/minis-vault/archive/bak-pre-ledger-split-playbook-20261003.md`（行 175/185/196/255/288/299/306/308/327）、`LEDGER.md`（行 1119/1591/1604/1613）、`minis-clippings/`（sarahfim／fomo-transcript／anatomy／anthropic-report／mariozechner／poteto／zeeg 七件）、`library/notes/pi-agent-book/`（ch04、wpa-check-scripts、pi-pidurable-research、wpb-mario-prompts-are-code、wpa-docs-36-digest、review-poteto-lens-v1）、`library/notes/pstack-upstream/`（comment-sicko、no-comments、05-build-and-clean、poteto-mode、runner-prompt、patterns.md、fix-root-causes、encode-lessons-in-structure、interrogate rubric、watch-pr/github.ts）、`/Users/onepisya/node_modules/@gajae-code/coding-agent/src/defaults/gjc/skills/ultragoal/ai-slop-cleaner.md`
- URL：codinghorror.com（Atwood 2006）／Clean Code ch.4（HN 8073620 转引）／bugzmanov 批评文／ACCU Henney／SonarQube S125／Google pyguide §3.8／ESLint no-warning-comments（已 Frozen）／HN 49337050（AI slop 讨论）／Anthropic 官方提示模板／Medium iZonex／kernel.org coding-style（本轮一手）／eslint.org configure/rules（本轮一手）／Studocu CS190 TOC（本轮一手，章节标题层）