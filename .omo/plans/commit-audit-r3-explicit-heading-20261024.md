# commit-audit R3 严格化：正文显式 WHAT/WHY/HOW token 硬要求（2026-10-24）

> Plan: .omo/plans/commit-audit-r3-explicit-heading-20261024.md
> 波：R3 散文体正文过门漏洞治理（票16 先红后绿序列：笔1 红测试笔 → 笔2 修复笔）
> 状态：executing（笔1 红侧实录见 §七；笔2 落地后回绿）

## §一 背景与诊断

### rootCause

`tests/qa/commit-audit.mjs` R3 段（修复前 :205-211）把显式 WHAT/WHY/HOW 结构当**可选捷径**：
`hasExplicitHeading` 为真时直接放行；缺位时退化到 `WHY_RE` / `HOW_RE` 关键词匹配。而
`CJK_WHY_KEYPHRASES` / `CJK_HOW_KEYPHRASES` 词表合计 50+ 个日常词（「验证」「测试」「修复」
「对齐」「整理」……），几乎任何 ≥60 字的中文技术散文都会双表命中——R3 对散文体结构性失守。

策略真源 `docs/commit-policy.md` §正文 schema（:29 起）从始至今要求正文使用 WHAT / WHY / HOW
三段结构；R3 本是其机械实现。本漏洞是**脚本弱于文档**的实现缺口，不是策略缺位。

### 漂移实证（五笔锚）

fd8db3f 起五笔提交正文为自由散文体、无显式 `WHAT:` / `WHY:` / `HOW:` token，全部通过门禁：

| commit | subject（截） | 词表命中例 |
| --- | --- | --- |
| fd8db3f | docs(omo): 验证基建终态对账——计划档状态收口… | 「不一致」（WHY）＋「验证」（HOW） |
| 5165933 | docs(omo): 残余过时点补注——调研档 §二勘注… | 「缺失」「问题」（WHY）＋「补上」「整理」（HOW） |
| d9c608b | fix(ci): 探针 job 级 env 误用 runner 上下文… | 「错误」（WHY）＋「触发」「修复」（HOW） |
| c303d8b | fix(scripts): ci-verify stripAnsi 补字面… | 「问题」（WHY）＋「修复」「脚本」（HOW） |
| 35ac680 | docs(gauntlet): ruleset 命名错位修复回执… | 「问题」（WHY）＋「修复」「对齐」（HOW） |

### 词表伪命中实证

- 「不触发」命中 HOW 词「触发」（否定语境被肯定词吸收）；
- 「验证基建」「验证六层」等名词短语命中 HOW 词「验证」；
- `github` / `needs` 等英文残留伪命中 HOW 表（`hook` / `need\w*` 家族）；
- 「修复」一词在 WHY 表与 HOW 表**双表兼任**——单凭一个词同时满足两检。

词表宽度是既有债务，本波不清理（见 §六），但其语义面收窄为「采纳日前旧账专用」。

## §二 方案取舍

**选 R3 严格化（不开 R8 新号）**：`docs/commit-policy.md` :29 的正文 schema（WHAT/WHY/HOW）
一直是策略真源语义，R3 是该 schema 的机械实现——本修正是收敛「脚本弱于文档」的实现缺口，
不新增规则维度。R7 当年开新号是因为引入「中文语言」这个全新维度；本波无新维度，开 R8
反而制造「R3 与 R8 谁管正文」的双源漂移。

**采纳日锚点仿 R7 先例**：`R7_ADOPTION_DATE`（`tests/qa/commit-audit.mjs` :120）＋
`preR7Adoption`（:375，`authorDate.slice(0, 10) <= R7_ADOPTION_DATE`，ISO-8601 日字符串
字典序比较，采纳日整日视为旧账的保守读法）。新增 `R3_STRICT_ADOPTION_DATE = "2026-10-24"`
与 `preR3StrictAdoption`，语义与 R7 完全同构。`--message-file` 路径 `main()` :319 调
`checkMessage(args.messageFile, raw)` 无第三参，`opts.preR3StrictAdoption` 恒 falsy——
钩子路径结构性不可达豁免（与 D26a 实测「hook 层零豁免」先例同构，`docs/commands.md` :49）。

**commitlint 不动（单源纪律）**：R3 严格化真源只活在 audit 脚本，仿 R7 先例；
`commitlint.config.cjs` :5-9 首注释已声明该单源关系。

**效果**：全部既有历史（含 35ac680，author date 2026-10-24T13:36，git log 实测）落在祖父
分支，branch/range 审计结果零变化（基线 62 笔全 PASS，修复后逐位一致）；锚点之后的新提交
在两种模式一律要求显式 token。

## §三 规则语义变更表（八格）

模式 × author date × 显式结构有/无 → 判定（修复后）：

| 模式 | author date | 显式三 token | 判定 |
| --- | --- | --- | --- |
| --message-file | 任意 | 有 | PASS R3 |
| --message-file | 任意 | 无（body ≥60） | **FAIL R3**（finding 列缺失 token 清单） |
| --message-file | 任意 | 无（body <60） | FAIL R3（body too short，消息原文不动） |
| branch/range | ≤ 2026-10-24 | 有 | PASS R3 |
| branch/range | ≤ 2026-10-24 | 无（body ≥60） | PASS/FAIL 按 WHY_RE/HOW_RE 关键词两检（祖父分支，消息原文不动） |
| branch/range | ≤ 2026-10-24 | 无（body <60） | FAIL R3（body too short，消息原文不动） |
| branch/range | > 2026-10-24 | 有 | PASS R3 |
| branch/range | > 2026-10-24 | 无（body ≥60） | **FAIL R3**（同 message-file 新门） |

行文形态：token 同行/独占行均认（`/\bWHAT:\s/` 形态）；行长排版约束仍归「正文排版硬规则」
与 commitlint，audit 只认 token 存在性。bot / merge / prompt 豁免语义零变化；R1/R2/R4/R5/
R6/R7 零改动；R1-R7 编号不动。

## §四 测试计划

新增于 `tests/qa/commit-audit.test.ts`（沿用 `runAudit` 子进程风格 :68 与 `initFixtureRepo`/
`gitIn` fixture 风格 :119-159）：

| 用例 | 模式 | 断言 | 红/绿方向 |
| --- | --- | --- | --- |
| A1 | --message-file | fd8db3f 最小化复刻（散文 ≥60 字、词表命中、无三 token、全 trailer）→ `status !== 0` 且 stderr 匹配 `R3: body lacks explicit WHAT:/WHY:/HOW: tokens \(missing WHAT: WHY: HOW:\)` | 笔1 红（现行 exit 0）→ 笔2 绿 |
| A2 | --message-file | 仅 `WHAT:` token（同行）＋散文（词表命中）→ FAIL 且消息含 `(missing WHY: HOW:)` | 笔1 红（现行关键词命中放行）→ 笔2 绿 |
| A3 | --message-file | 三 token 同行形态、正文 ≥60 字、措辞避开两词表 → exit 0 | 修复前后皆绿（钉死「audit 只认 token 形态、行长归排版规则」） |
| B1 | --branch main | 三笔同型漂移提交，仅 author date 差（2026-10-23 / 10-24 / 10-25，GIT_AUTHOR_DATE/GIT_COMMITTER_DATE 控制，subject 带日期后缀）→ 10-23 与 10-24 行 PASS（日级 `<=` 含当日，R7 同款保守语义）、10-25 行 FAIL 出 R3 显式 token finding、summary `total=3 pass=2 skip=0 fail=1` | 笔1 红（现行三笔全 PASS）→ 笔2 绿 |

绿色侧不新增用例：既有 R7 历史 fixture（29 笔 PASS 正文均带显式 token）与 dependabot fixture
（human 笔 body<60 走 too short 既有分支）修复后必须全绿——由 B1 计数断言＋全套
`pnpm vitest run` 回绿共同钉死。

## §五 提交序列

| 笔 | subject | 文件面 | 每笔验证 |
| --- | --- | --- | --- |
| 笔1（红测试笔） | `test(qa): 复现 R3 散文体正文过门漏洞——显式 token 缺位` | `tests/qa/commit-audit.test.ts` ＋ 本 plan 档（全文） | `pnpm vitest run tests/qa/commit-audit.test.ts` 必红（A1/A2/B1 失败、A3 绿）＝票16 红证据；`pnpm typecheck`；`pnpm lint`。正文带显式 token 独占行——过**现行**钩子（显式 token 两侧皆稳） |
| 笔2（修复笔） | `fix(qa): commit-audit R3 收紧——正文显式 WHAT/WHY/HOW token 硬要求` | `tests/qa/commit-audit.mjs` ＋ `docs/commit-policy.md` ＋ `docs/commands.md` | `pnpm vitest run` 全绿（先红后绿闭环）；`pnpm typecheck`；`pnpm lint`；`node tests/qa/commit-audit.mjs --range origin/main..HEAD` 与基线 `total=62 pass=62 skip=0 fail=0` 逐位一致（笔1 落地后为 63 笔全 PASS）。提交时工作树脚本已是新版、钩子实跑新门——正文带显式 token 过新钩子＝新门禁活体自指证明 |

两笔都走 `.git/hooks/commit-msg` 正常提交（禁 `--no-verify`）；只碰上列文件。

## §六 Must-not-have

- **不 reword 已推提交**：fd8db3f/5165933/d9c608b/c303d8b/35ac680 五笔漂移提交保持原样
  （branch 模式对它们永远走祖父分支，零新 FAIL；force-push 单向门留主公裁定，另行工单）。
- **不动 `commitlint.config.cjs`**（单源纪律：R3 严格化真源只活在 audit，仿 R7 先例）。
- **不改业务代码**：本波只碰门禁脚本、其测试与策略文档。
- **不碰并发会话文件**：每笔提交前核对 `git status`，只认本波文件；`.omo/decisions-20261001.md`
  （untracked）严禁读取、改动、提交（任务令）。
- **R1-R7 编号不动**：本修正是 R3 收紧，不开新号；R1/R2/R4/R5/R6/R7 段零改动。
- **中文词表（WHY_RE/HOW_RE）本波不清理**：词表保留、祖父分支消息原文不动；其语义面已收窄为
  「采纳日前旧账专用」，不再影响任何门禁判定路径；词表瘦身属另票。
- 禁 `--no-verify` / rebase / amend 已有历史 / push（脚本统一推）；禁 `git add -A` / `git add .` /
  `git add -u`，只按精确路径 add。

## §七 验证记录（实施员填）

### 基线（修复前，2026-10-24 实录）

```
$ node tests/qa/commit-audit.mjs --range origin/main..HEAD
ref=origin/main..HEAD total=62 pass=62 skip=0 fail=0
$ git rev-list --count origin/main..HEAD
62
```

### 笔1 红侧实录（2026-10-24，提交前工作树实测）

- `pnpm vitest run tests/qa/commit-audit.test.ts`：A1/A2/B1 三用例失败、A3 绿、既有 16 用例
  全绿，`Tests  3 failed | 16 passed (19)`。红即现行脚本的真实放行行为：

```
× A1 FAILs a keyword-drift prose body that lacks all three explicit tokens 587ms
AssertionError: expected +0 not to be +0 // Object.is equality
    （现行脚本对 fd8db3f 复刻散文正文 exit 0 PASS——词表双命中放行）
× A2 lists only the missing tokens when WHAT: is present but WHY:/HOW: are prose 575ms
AssertionError: expected +0 not to be +0 // Object.is equality
× B1 grandfathers drift bodies authored on or before 2026-10-24 and FAILs the day after 4ms
AssertionError: expected 'PASS  fe2073b4  …' to contain 'FAIL  e2cd02d2  …'
- FAIL  e2cd02d2  docs(omo): 漂移正文锚点边界——2026-10-25 采纳日后
+ PASS  fe2073b4  docs(omo): 漂移正文锚点边界——2026-10-23 采纳日前
+ PASS  de83dc60  docs(omo): 漂移正文锚点边界——2026-10-24 采纳日当日
+ PASS  e2cd02d2  docs(omo): 漂移正文锚点边界——2026-10-25 采纳日后
✓ A3 PASSes same-line tokens with wording outside both keyword tables 605ms
Test Files  1 failed (1)
      Tests  3 failed | 16 passed (19)
```

- `pnpm typecheck`（`tsc --noEmit`）exit 0；`pnpm lint`（`eslint`）exit 0——测试文件在 tsconfig
  include 内，新用例随全仓类型检查与 lint 通过。

### 笔2 绿侧判据（落地前于工作树实测）

- `pnpm vitest run tests/qa/commit-audit.test.ts`：A1/A2/B1/A3 全绿，既有用例（commitlint
  传递、dependabot、R6、R7 fixture）全绿；全套 `pnpm vitest run` 全绿。
- `node tests/qa/commit-audit.mjs --range origin/main..HEAD`：`total=63 pass=63 skip=0 fail=0`
  （62 笔基线逐位一致＋笔1 自身 PASS），漂移五笔被锚点祖父化零新 FAIL。
- `pnpm typecheck` / `pnpm lint` 过。
- 冒烟：`node tests/qa/commit-audit.mjs --range fd8db3f~1..HEAD` 全 PASS；取 fd8db3f 正文写
  /tmp 文件跑 `--message-file` 应 FAIL（新门禁咬人证明）。
- 笔2 提交时钩子已是新代码，该笔正文带显式 token 实跑过门＝新门禁自指活体证明。

### requiresBuild=false 依据

本波只改 QA 脚本（`tests/qa/commit-audit.mjs`）、其测试与文档，零业务代码、零 Next.js 面
（无 app/ components/ lib/ db/ 变更）——`pnpm build` 产物不受影响；按 gauntlet §1 表
（无 build 行）判 `requiresBuild=false`。`docs/commands.md` :41「每 commit 必跑含 build」
与 gauntlet 表的既有张力按任务授权依 gauntlet 处置，依据记入笔2 trailer；波终验
`scripts/verify-all.mjs`（:6 自述六层含 build）天然覆盖。

### 绿侧全量输出归宿

绿侧实录（vitest 全绿输出、range 对照、冒烟输出）在笔2 提交后由波终验统一对账——本 plan
档随笔1 固化，笔2 文件面不含本档（方案 commitSequence 约定），绿侧证据以波终验回执与本波
submit_result 留痕。
