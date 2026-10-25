# Conventions

> 来源：AGENTS.md §约定（行 82–90）

## 项目约束（每会话必读，已在 AGENTS.md L0 内联，下面是展开版）

- 修改路由、handler、类型或生成文件前，先阅读 [AGENTS.md](../AGENTS.md) 中 Next.js 16 自动警告。
- Server Component 是默认；只有交互或浏览器 API 需要时才添加 'use client'。
- 路径别名 `@/*` 指向仓库根目录；规则放 `lib`，schema 放 `db`，UI 组合放 `components`。
- 设计令牌保存在 `app/globals.css` 和 `DESIGN.md`；Tailwind class 引用令牌。

## 提交与文档

- 提交主题和正文可以中文；Conventional 前缀与 lore trailer 键名保持英文。
- 路由命名遵循 W1 御定：`/online` (实时上服) + `/offline` (纯本地) + `/result` (RSC 成绩单)；不引入 `solo` / `ranked` / `singleplayer` / `multiplayer` 词汇（schema.org 词汇表对齐理由见 README「词汇语义说明」节）。
- 领域概念命名以 `CONTEXT.md` 为准：一切产出物（代码、commit 正文、plan、review、探针）使用表内术语、禁用其 `_Avoid_` 别名；概念不在表中勿造新词——先判断是否真缺口，是则按 `.omo/plans/glossary-context-md.md` D3 门槛入 Pending 区，复用后晋升。
- 会话侧数字不入正文：会话内产生、无仓内落档锚点的计数不写入 tracked 文档正文，移 `.omo/evidence/`（gitignored）会话侧证据档存档；vitest 结果引用必须注明运行范围（全量/单文件、passed/skipped 口径）。

## 库与依赖

- 不引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。
- LSP 服务端工具（typescript / yaml / bash language server）走 vp 全局安装，禁止作为项目 npm 依赖。详见 [docs/anti-patterns.md §L2-1](./anti-patterns.md#l2-按需读--agents-md-完全外化)。

## 注释规范（分诊矩阵：删装饰、留契约、转结构）

> 2026-10-25 立。真源：[`.omo/plans/comment-triage-practice-v2-20261024.md`](../.omo/plans/comment-triage-practice-v2-20261024.md) §二（六路调研＋全仓一手复核＋独立审读 14 条逐条核验）。本仓**不适用「一刀切删注释」**：主体注释是三类高价值资产（BR 探针头契约、决策编号＋plan 回链、代码表达不了的约束），存量可删面极薄（复述≈0、死代码≈0、TODO=1），主战场在增量门禁而非存量清理。两条写作纪律（AGENTS.md 项目块）：不给未改动的代码加注释；只在 logic 不自明处加注释。执行台账：`.omo/plans/comment-triage-rollout-20261025.md`。

### 归格规则（四条，先于三格判定）

| # | 规则 | 内容 | 本仓例 |
| --- | --- | --- | --- |
| 1 | **粒度按注释块，不按行** | 「注释块」＝连续行注释、单个 JSDoc、单个块注释或单个 JSX 注释。块内取最强归格：承载契约/why/回链 → 整块留；纯 TODO 债务 → 整块转化；混合块（契约 doc 内含 seam/TODO 说明）→ 整块留，块内 TODO 作债账登记项，**不拆块** | `lib/store.ts` makeMove JSDoc 整块归「留」（跨模块契约 doc）；块内 TODO seam 保持原样（`rg TODO` 可搜性保留） |
| 2 | **删格判定器** | 「删了之后 lint 不红、语义与读者所需信息零损失」两者同时满足才入删格。lint 抑制类不满足前半句——**永不出删格**，裸抑制归转化 | 6 处 `react-hooks/set-state-in-effect` 抑制系 L0「SSR 首帧不读 localStorage」模式的必然产物，删则 `pnpm lint` 红 |
| 3 | **测试注释界线** | 文件有 `// BR:` 头、或注释含 BR-N / spec / 案N 回链 → 留；否则优先转化为测试名 / 断言字符串 | `components/DeleteRoomButton.test.tsx`「// 探针（spec 要求）」属转化候选，但其 why 价值由试点人工裁决 |
| 4 | **变更描述界线** | 含决策编号（W-RV / 案①②③ / A4 / D-1 / L1-N / 票 N）或 `.omo/plans/` 回链 → 留（决策记录）；一次性时态（「本次」「这次改为」）且无编号回链 → 转化为 commit message | `db/schema.ts`「W-RV P3 #9 dismiss」留；「本次将 X 改为 Y」转 commit |

### 删

| 类别 | 判定例子 | 依据 |
| --- | --- | --- |
| 注释掉的死代码 | `// const oldBoard = getBoard();`（代码形状完整：行尾 `;{(` 或 `console.x(`） | SonarQube S125（Major）；VCS 存全部历史。**本仓存量≈0**（形状收紧版正则零命中） |
| AI 装饰性/叙述性注释 | `// Phase 1: add cards`（Phase/Step＋数字；注意 Phase 系本仓游戏状态域名词，判据须求数字跟随） | pstack poteto-mode；Anthropic 官方模板；HN slop 报告 |
| 复述代码的注释 | `i++; // 递增 i` | Atwood / Henney / Google Style Guide / Linux kernel「NEVER explain HOW」。**本仓存量≈0** |
| 写给 reviewer 的临时说明 | 「reviewer 上轮说要…」一次性沟通 | 归宿 PR / commit message；叙述性注释让 diff 显得未完成 |

### 留

| 类别 | 判定例子 | 依据与保护现状 |
| --- | --- | --- |
| BR 探针头契约 | `// BR: BR-1, BR-9`（`components/HomeDialogMount.test.tsx` 首行） | `docs/business-rules.md` 探针列格式约定；R6 双向校验（**仅 branch/range 审计面**，commit-msg hook 不跑 R6）；**头前 20 行不可动＝AGENTS.md L0** |
| 代码表达不了的约束与 why | `lib/game-net.ts`（8 s AbortController 与 store NETWORK_TIMEOUT_MS 同源论证）、`app/layout.tsx`（Chromium Bug 517439604＋plan 链）、`scripts/sw-bust.mjs`（SW 竞态） | Atwood / Henney / Google / Ousterhout ch.13。本仓主体存量 |
| 决策编号＋plan 回链 | `db/schema.ts`（W-RV P3 #9 autoincrement 论证）、`scripts/ci-verify.mjs`「// ---------- 判据 [1] 五必绿＋首跑全绿（L1-33） ----------」 | 本仓治理资产；豁免与降级理由必留档 |
| 公开 API / 跨模块契约 doc | `lib/store.ts` makeMove JSDoc（整块，含 seam 说明） | Google §3.8.3 强制；pstack 例外清单 |
| 空 catch 说明（块注释形态） | `/* page may already be closed */`（tests/qa）、`/* module may not have loaded */`（tests/db） | 解释吞异常理由，代码表达不了 |
| JSX why/回链注释 | `app/result/page.tsx`「{/* W-R (… D-3): 清空入口只在…」、`app/layout.tsx`「{/* Plan: .omo/plans/… */}」 | 同决策编号类 |
| 坑修复痕迹标记 | 「此处不用 rmtree 而逐项删，因 symlink 误报」类 | 改怪异代码前先考古（rmtree 二次咬实证） |

### 转化

| 从 | 到 | 判定例子 | 依据 |
| --- | --- | --- | --- |
| 裸 TODO（独立块） | issue / 债账条目（改什么·为何当时不能改·到期触发器）或 plan 回链 seam | 契约块内既有 TODO 按规则 1 不拆块，保持原样 | 债有名、有址、有目标版本 |
| 变更说明注释 | commit message | 「本次将 X 改为 Y…」无编号时态 | commit-audit R3 已有 WHAT/WHY/HOW 硬要求——正确载体已在机制里 |
| 测试意图注释（不绑 BR/spec） | 测试名 / 断言字符串 | `assert(ok, 'persisted across restart')` 断言代行文档 | 界线见规则 3 |
| **裸 lint 抑制** | 行内 ` -- 理由`（ESLint 官方描述语法：描述与配置间以两个及以上连续 `-` 分隔） | 存量 7 处无一带 ` -- `，渐进补齐；**只补理由不删抑制**；前几行散文（`components/SoundToggle.tsx` 式）与行内简述可并存——机械判据只认行内 | ESLint 官方文档；与 L0 SSR 模式无冲突 |
| 约束声明注释 | 类型 / 运行时断言 / 测试 / lint——**批准后编码，注释照删** | `// start <= end` → `type TimeRange = { start: Date; durationMs: number }` | 难误用类型＞运行时检查＞散文注释 |
| 规则叮嘱（重复教训） | AGENTS.md 条目 / 门禁 | 「你别这么做」→ lint / compile / architecture gate | encode-lessons-in-structure；能探针化的约束不靠记忆（anti-patterns L1-29） |

### 机械化指向（Phase 2，待主公裁决）

- **R8 注释增量门禁**（`tests/qa/commit-audit.mjs` 扩展，零新依赖；R1–R7 已占满故定名 R8）：blocking 仅限 `//` 行注释三子集——B1 死代码形状 / B2 阶段叙述 `(Phase|Step)\s*\d` / B3 `eslint-disable` 无 ` -- ` 描述；banner 分隔线等 advisory 只报不拦；祖父条款仿 preR7Adoption 追加 preR8Adoption 日期锚。
- **M2 ESLint `no-warning-comments`**（customTerms todo/fixme/xxx，`location:"start"`）：将是 `eslint.config.mjs` 首个 rules 条目；`tests/qa/**` 在 globalIgnores 内对 eslint 不可见，该子树的 B3 扫描由 commit-audit 侧正则承担。
- 拦不住（诚实声明）：复述代码的语义判断——无主流 linter 能判；语义层靠 fresh-eyes 分诊评审（不携带产出 session 上下文的独立只读评审）。

## 交叉引用

- 全部硬约束（漏读会破契约）→ [docs/anti-patterns.md §L0](./anti-patterns.md#l0-硬约束--漏则破契约)
- 命令清单与端口约定 → [docs/commands.md](./commands.md)
