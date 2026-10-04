# T-B1 Seat Plan: commit-audit 层⑤口径收窄 + 历史豁免基线

> 席别：herdr codex 单席；范围：仅 §二 T-B1。T-F1 (`74e1a56`) / T-F2 (`4ee9fa6`) 已交付，禁动。Q-B 已决 a+b 并施；本计划仅承接执行落档。审批权前置授予（主公 /workflow）。

## 一、机制诊断（事实链）

| # | 事实 | 证据 |
|---|---|---|
| 1 | 层⑤承诺「每个 commit 必跑 `commit-audit.mjs --branch main`（0 violations）」与现状冲突：`--branch` 默认拿**今天的全部规则**回扫**整条分支的全部历史**，每新增/收紧一条规则，旧 commit 会被 retroactive 标红 | `docs/commands.md:42`；基线 audit 主线 |
| 2 | 2026-09-27T03:58 现查：branch=dev total=405 pass=234 skip=7 **fail=164**；branch=main total=362 pass=191 skip=7 **fail=164** | `/tmp/audit-dev-baseline.log`；`/tmp/audit-main-baseline.log` |
| 3 | 164 笔 fail 的规则分布（dev）：R7=294 findings（subject 或 trailer 自由文本缺 CJK）、R4=6、R5=3、R3=3、R1=3（全为 merge commit）、R2=1 | `grep + uniq -c` on `/tmp/audit-dev-baseline.log` |
| 4 | 9 个 merge commit 落在 dev：3 条 GitHub 自动 merge commit（subject `Merge pull request #N from …`）现以 R1 标红——机器生成，本就无法满足 Conventional 前缀 | `git log --grep='^Merge' dev` |
| 5 | 7 条 dependabot squash merge 现已 SKIP（ae02a33 先例，identity-based R3-R5 豁免）；R7 在 botAuthored 短路下不检，所以不算入 164 | `commit-audit.mjs:115-117` |
| 6 | R7 自 2026-09-23 入档（commit `3068b22a`）；R6 同日入档（`373ec964`）；R7 之前的所有 commit 主体写英文 subject，无法事后合规 | `git log --format="%aI %s" 3068b22a` |
| 7 | `.github/` 零引用 `commit-audit.mjs`，CI 兼容面无虞 | `grep -rE "commit-audit\.mjs" .github/` |
| 8 | `commit-audit.test.ts` 现有 fixture commit 创建于 test runtime（post-R7），pre-R7 豁免不影响；dependabot fixture 走 `botAuthored` 短路不变 | `commit-audit.test.ts:101-208` |

**机制结论（一句话）**：「0 violations」承诺恒成立与「规则会生长」在全史回扫口径下逻辑上不能同时成立；层⑤的语义必须是「本波合规」——hook 路径逐 commit 闸门已经守住了闸口，层⑤只需复跑本波确认。

## 二、a) 口径收窄方案：shell 循环 + `--message-file` vs 新增 `--range` 参数

**选项 A：新增 `--range <git-range>` 参数**
- `git log --reverse --format=… <range>` 替换 `<branch>` 位置，默认仍为 `main`。
- 例：`node tests/qa/commit-audit.mjs --range origin/main..HEAD`（本波面）。
- 工具内一并复用主闸门禁（merge / dependabot / pre-R7 豁免）。
- 与 `--branch` 复用同一 `main()` 后段，分支模式区分仅在 ref 变量。

**选项 B：shell 循环 + 逐 commit `--message-file`**
- 例：`for sha in $(git rev-list origin/main..HEAD); do git log -1 --format=%B $sha > /tmp/msg && node tests/qa/commit-audit.mjs --message-file /tmp/msg; done`
- 零工具改动；hook 路径不变。
- 缺点：① 串行执行慢（每 commit 一次 commitlint spawn）；② 计数语义与 `--branch` 不同（无 R6、无 SKIP/pass/fail 分项）；③ 输出不易聚合。

**裁决**：选 **A**。
- 性能：单次 git log（毫秒级）vs N 次 commitlint spawn（秒级）。
- 语义：复用 `--branch` 计数（total/pass/skip/fail），文档和门禁期望对齐简单。
- 可维护性：单点改动；shell 循环会散落到 CI / docs / 工具使用者三方，难对齐。
- `--range` 同时支持任意 git ref 表达式，扩展性更好。

**新参数 CLI 用法**：
```sh
node tests/qa/commit-audit.mjs --range origin/main..HEAD   # 本波 commit 面
node tests/qa/commit-audit.mjs --range HEAD~5..HEAD        # 最近 5 个 commit
node tests/qa/commit-audit.mjs --range main                # 显式等价 --branch main
```

## 三、b) 豁免基线设计

**沿用 ae02a33 先例（identity-based → SKIP 行 + 单列计数）扩展为三类**：

| 类 | 维度 | 实现 | 覆盖 fail 子集 |
|---|---|---|---|
| 1. Merge commit | subject pattern `^Merge pull request #\d+ ` | `MERGE_COMMIT_RE.test(subject)` → 短路返回 empty findings + `mergeCommit=true`；输出 SKIP 行 | R1×3（3 merge commits），其余 merge 缺的 R3/R4/R5 一并消化 |
| 2. Dependabot | author identity（`dependabot[bot]`） | 沿用 `botAuthored` → 现有 R3-R5/R7 豁免短路 | 已 SKIP 7 条 |
| 3. Pre-rule-adoption debt | author date < `2026-09-23`（R7 入档日） | `preR7Adoption` opt → 跳过 R7 subject 与 trailer CJK 检查 | R7 大头（294 findings / ~145 commits） |

**判别维度各异，避免单 token 多义**：
- merge → subject 模式（构造性，机器生成）。
- dependabot → author identity（先例沿用）。
- pre-R7 → author date（历史时间锚点）。

**配置落仓形式：工具内常量 + 注释**（理由：`ae02a33` 已用同模式；规则与策略紧耦合，外置 JSON 会引入 load+parse+match 复杂度；规则演化时只改常量与注释，单源审查）。

**关键不变量**：
- `--message-file` 模式（hook 入口）**完全不接入豁免**——人类提交入口必须严格，豁免只在 branch/range 模式生效。
- R6 全仓状态检查行为零变化（既不动 R6 也不被 R6 影响）。
- R1/R2（subject length / prefix）merge 豁免；其余 commit 仍走 R1/R2 全检。

**存量 fail 吸收预估**：164 笔 fail 中：
- 3 merge commits → SKIP（merge 豁免）。
- 7 dependabot squash → 已在 SKIP（既有豁免）。
- ~145 pre-R7 era English subject commits → pre-R7 豁免跳过 R7 后自然转 PASS。
- 残留 R4/R5/R3 旧债若落在 pre-R7 era → pre-R7 仅豁免 R7，R4/R5 仍要过；预期落入 PASS（如 commit 含 trailers）或 FAIL（存量真违规，R4/R5 不豁免）。

## 四、AC 映射

> 交付回填：T-B1 已由 d9f8a36（2026-09-27 chore(qa)）交付、2f11c36（2026-09-27 docs(plans)）入档总档；下表「实际」列为 2026-09-27 复跑结果（HEAD=2f11c369）。

| AC | 验证 | 期望 | 实际（自验时填） |
|---|---|---|---|
| ① dev 全史 fail=0 | `node tests/qa/commit-audit.mjs --branch dev` | `fail=0` | ✅ fail=0（ref=dev total=407 pass=397 skip=10） |
| ①' main 全史 fail=0 | `node tests/qa/commit-audit.mjs --branch main` | `fail=0` | ✅ fail=0（ref=main total=362 pass=352 skip=10） |
| ② 本波面 0 violations | `node tests/qa/commit-audit.mjs --range origin/dev..HEAD` | `fail=0` | ✅ 交付波面 `74e1a56^..d9f8a36` total=4 pass=4 fail=0；现 `origin/dev..HEAD` 已随 push 清空（total=0） |
| ③ hook 回归 PASS | `node tests/qa/commit-audit.mjs --message-file <(git log -1 --format=%B HEAD)` | exit 0 / PASS | ✅ PASS，exit=0（HEAD=2f11c369 message） |
| ④ docs 新口径落档 | grep `docs/commands.md` 层⑤；grep `docs/commit-policy.md` §hook | 见 §五 | ✅ commands.md:42 新口径 + :45 豁免说明；commit-policy.md:102-108 三类豁免条款，与 §五 一致 |
| ⑤ 文件面 + typecheck/lint/vitest | grep + `pnpm typecheck` + `pnpm lint` + `pnpm vitest run` | typecheck/lint 0 错；vitest 540 passed/11 skipped 基线 | ✅ typecheck exit 0；lint 0 错（28 warnings 既有）；vitest 540 passed / 11 skipped |
| 副作用：R6 零变化 | `--branch main` 输出 R6 行 diff | 仅豁免逻辑新增；R6 段相同 | ✅ R6 逻辑未动（`auditBrProbeBinding` 照常调用）；`--branch main` 无 R6 违例行 |
| 副作用：--message-file 零变化 | 现有 commit-audit.test.ts 全过 | exit codes 与 PASS/FAIL 行一致 | ✅ commit-audit.test.ts 随全量 vitest 通过（540 绿） |

## 五、文档变更要点

### `docs/commands.md` 层⑤（约 :42）

旧：
```
5. `node tests/qa/commit-audit.mjs --branch main`（0 violations）
```
新：
```
5. `node tests/qa/commit-audit.mjs --range origin/main..HEAD`（本波 commit 面，0 violations）
```
补充：扫本波面（默认 ref=main；可指定 `--branch` 走全史或 `--range <git-rev>` 走任意 ref 表达式）。全史扫描受规则化豁免基线约束（merge commit / dependabot / pre-R7 旧账豁免）。

### `docs/commit-policy.md` §hook 段（约 :102）

合并 commit 豁免条款入档：在原有 dependabot 豁免段后追加 merge commit 豁免描述；统一表述「`--branch` / `--range` 模式对机器生成 commit 与 pre-rule-adoption 旧账做规则化豁免；`--message-file` 模式不受豁免」。

## 六、验证清单

> 结果回填（2026-09-27 复跑，HEAD=2f11c369；交付 commit d9f8a36）：1-7 全过。

1. `pnpm typecheck` → 0 errors。——✅ exit 0。
2. `pnpm lint` → 0 errors。——✅ 0 errors（28 warnings 为既有，exit 0）。
3. `pnpm vitest run` → 540 passed / 11 skipped（防意外回归）。——✅ 540 passed / 11 skipped。
4. `node tests/qa/commit-audit.mjs --branch dev` → fail=0。——✅ fail=0（total=407 pass=397 skip=10）。
5. `node tests/qa/commit-audit.mjs --branch main` → fail=0。——✅ fail=0（total=362 pass=352 skip=10）。
6. `node tests/qa/commit-audit.mjs --range origin/dev..HEAD` → fail=0（本波 4 commit）。——✅ 交付波面 `74e1a56^..d9f8a36` 4 commit 全 PASS；现 `origin/dev..HEAD` 已随 push 清空（total=0，fail=0）。
7. `git log -1 --format=%B HEAD > /tmp/head-msg.txt && node tests/qa/commit-audit.mjs --message-file /tmp/head-msg.txt` → exit 0 / PASS。——✅ PASS（exit=0）。

## 七、不改项（再确认）

- R6 逻辑（`auditBrProbeBinding` + R6 计数）。
- `.git/hooks/commit-msg` 内容（仍调 `--message-file`，豁免不影响）。
- `commitlint.config.cjs`（R7 单源关系保持）。
- 业务代码（`app/` `lib/`）。
- `docs/business-rules.md`（R6 输入面）。
- `tests/qa/` 下其他探针（仅本席范围内的 commit-audit 工具与 test.ts）。
- `.github/`（CI 无 audit 引用，已 grep 坐实）。
- `next-env.d.ts`（dev/build 翻转噪声）。
- `components/HomeDialogMount.test.tsx` / `tests/db/db.test.ts`（T-F1/T-F2 范围）。

## 八、commit 契约

- subject：`chore(qa): audit 口径收窄本波面 + 历史豁免基线——层⑤恢复信号`
- WHAT / WHY / HOW 排版（token 独占行、内容每行 ≤72 字符）。
- Trailer：`Confidence: high` / `Scope-risk: narrow` / `Plan: .omo/plans/ulw-homedialog-flaky-fix-20260926.md`
  - 【2026-10-04 注（D25 卫生票）】Plan: 指向 homedialog 总档系本计划自身规定（T-B1 为其席位子票，交付 `d9f8a36` 即按此 footer 落地，亲证在案），属设计决定、非漂移。
- 禁 `--no-verify`。
- 单原子 commit，含本席位 plan 文件。
