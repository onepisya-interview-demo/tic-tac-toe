# sh 门禁波（2026-11-09）——shellcheck 接线＋R8 扩 .sh＋--no-verify 补口

> 规范源：主公 2026-11-09 /workflow 原令（逐字）：「全部补齐……规则更新，门更新，shell 也要检查。使用 shellcheck 之类的东西，或者你知道更好的依赖也可以。」
> 依赖新政令（同日已落档 d7b5c5b）：devDependencies 档豁免自决＋三义务（有效/克制/留痕）。
> 修订记录：2026-11-09 审读/沙箱修复轮——§四 dry-run 数字勘正（189→152）、.sh 祖父锚点改为独立锚点（沙箱第 3 项）、§七 设计档叙述勘正、§九 新增（lockfile 漂移注＋三项观察）。

## 一、目标

1. 三脚本（`scripts/vercel-ignore-build.sh`、`scripts/vercel-ignore-build.test.sh`、`tests/qa/pre-push-guard.sh`——`git ls-files '*.sh'` 恰此三个）纳入机械检查面：lint 层（六层③）＋CI lint job 自动承接。
2. R8 注释增量门禁扫描组扩至 `.sh`（--staged 增量面＋branch/range 面），存量零误报为红线。
3. AGENTS.md L0 的 `--no-verify` 禁令从单指 commit-msg hook 扩为任何钩子（commit-msg／pre-push 等）。

## 二、依赖三义务留痕（政令②档：devDependencies，不进产品包）

- **有效（现有方案/内置能力为何不够）**：R8 只扫注释形态不扫 shell 语义；eslint（flat config）不解析 .sh；CI lint job 只跑 `pnpm lint`＝eslint；三脚本此前零机械检查。shellcheck 是主公点名的候选，实测即用。
- **克制**：只加 shellcheck 一个（wrapper `shellcheck@4.1.0`，内嵌 ShellCheck **0.11.0** 二进制）；不加 shfmt 等排版类（本波是「检查」不是「重排」），不加 shell 语言服务器类。
- **台账**：本卷即留痕。
- **pnpm v10 构建脚本审批**：wrapper 无 install/postinstall 脚本（二进制在首次 `pnpm exec shellcheck` 时惰性下载入 node_modules），pnpm 未拦构建脚本，**无需**动 `pnpm.onlyBuiltDependencies`（该字段保持 better-sqlite3/esbuild 原样）。实测链：`pnpm add -D shellcheck` → `pnpm exec shellcheck --version` 输出 `version: 0.11.0` exit 0 → `pnpm install --frozen-lockfile` 绿。

## 三、lint 接线

- 新增薄 runner `scripts/lint-sh.mjs`：`git ls-files -- '*.sh'` 枚举 tracked 文件逐个送 `pnpm exec shellcheck --format=gcc`（gcc 格式输出自带 SC 码与 file:line:col）；零 .sh 文件时 exit 0；工具级故障（exit>1）与脚本告警（exit=1）都算 FAIL（fail closed）。
- `package.json`：`"lint": "eslint && node scripts/lint-sh.mjs"`，另加独立入口 `"lint:sh"`。六层③层与 CI lint job（ci.yml 已是 `pnpm install --frozen-lockfile` + `pnpm lint`）零改动自动承接。
- 已知盲窗（刻意，审读轮观察②）：runner 只枚举 index 内文件，未 `git add` 的新建 .sh 本地 lint 看不见——add 后即纳入，CI checkout 后必纳入；原令措辞即「枚举 tracked 文件」。

## 四、R8 扩 .sh 取舍（tests/qa/commit-audit.mjs）

- **扫描组**：`R8_SCAN_PATH_RE` 扩 `sh` 后缀（同六目录）。
- **B2 阶段叙述 shell 形态**（`#\s*(Phase|Step)\s*\d`）：**blocking**。dry-run 口径（勘正后）：全历史 .sh **专属**新增行共 **152** 条（3 个触碰 .sh 的 commit 里 .sh 文件的 + 行；第一轮误计 189 系口径错误——把同批 commit 里非 .sh 文件的新增行也计了分母，审读轮独立复扫证实 152），B2 正则零命中。
- **B1 死代码 shell 形态**：**仅 advisory**。取舍理由：含 exit/echo/set 等词的形状，历史上仅有的 4 处命中全部是 `#   exit 0 = cancel deployment (do not build)` 式 **exit 语义契约注释**（83cd3131 引入，至今仍在 vercel 双脚本第 5-6 行）——历史精确率 0/4，blocking 无法构造出存量零误报的形状，落 advisory 只监控。advisory 词表收窄为 `git|pnpm|npm|npx|curl|wget|rm|cp|mv|chmod|chown|sudo|kill`（dry-run 全历史零命中；`安装：cp ...` 前缀形状天然不触发，pre-push-guard.sh:5 不受影响）。
- **A1 banner `#` 形态**（`#\s*(={5,}|-{5,}|\*{5,})`）：advisory，判据/决策编号回链白名单同 JS 版。dry-run 零命中。
- **B3 eslint-disable 对 shell**：**n/a** 明记——shell 注释无 eslint 指令面；shellcheck 有自己的 `# shellcheck disable=SCxxxx` 指令语法，不在本波范围（若将来要管，另立波次裁决）。
- **M3' 报表**：.sh 的行首 `#` 计入注释分母（shebang `#!` 除外），留格标记沿用 R8_RETENTION_RE。
- **分流纪律**：.sh 文件走 `#` 形态族后 `continue`，`//` 族检查结构性不可达——.ts 里的 `#` 与 .sh 里的 `//`（URL/字符串）双向零交叉。
- **祖父锚点（沙箱第 3 项修复，2026-11-09）**：.sh 面独立锚点 `R8_SHELL_ADOPTION_DATE=2026-11-09`，作者日期日级**严格 `<`**（采纳日当日即生效）。与 JS 面 `R8_ADOPTION_DATE=2026-10-25` 的整日祖父 `<=` 刻意不同：JS 面规则当日深夜才落地、当日早些的 commit 无法合规故整日祖父；shell 面随本波当日落地、--staged 面同刻起即强制，branch 面当日不豁免保持两面对称。沙箱伪造边界钉死：作者日期 2026-11-08 的 .sh 违规豁免（exit 0）／2026-11-09（采纳日当日）必罚（exit 1）／2026-10-24 等更早日期同样豁免。锚点前存量（最后一笔 .sh commit fa0d4e9=2026-10-25）整段祖父，扩展对存量零追溯。第一轮曾沿用 JS 面 2026-10-25 共锚——存量面等价（10-26 至今零 .sh commit），但按沙箱裁决改为独立锚点。
- **测试**：commit-audit.test.ts 新增三组 fixture——①staged 违规面（B2 `# Phase 2` FAIL＋字符串内 `// Phase 9` 不触发＋B1-shell 仅 NOTE＋docs/ 出范围不计）；②staged 合法面（exit 语义契约/`# BR:` 头/`W-R D-3` 决策回链/`安装：cp` 指引 PASS，M3' 计数 shebang 除外）；③branch 锚点面（11-08 豁免 PASS／11-09 采纳日必罚 FAIL）。

## 五、验证（2026-11-09 两轮实跑；第二轮含沙箱修复后全量重跑）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| shellcheck 实跑 | `pnpm exec shellcheck <3 个 .sh>` | exit 0 零告警（0.11.0 与上轮评审 clean 基线一致，无新告警） |
| lint | `pnpm lint` | 全绿（eslint 0 告警＋`lint:sh shellcheck PASS files=3`） |
| 测试 | `pnpm vitest run` | 584 passed / 11 skipped / 0 failed（第一轮）；修复轮全量重跑见 §九 |
| R8 存量 dry-run | `node tests/qa/commit-audit.mjs --branch dev` | `total=518 pass=502 skip=16 fail=0` exit 0（.sh 零误报） |
| --message-file 路径 | 合规样例（含六 trailer） | `PASS` exit 0（路径未破） |
| 沙箱同构锚点探针 | /tmp 克隆＋`git commit-tree` 伪造三日 .sh 违规 commit（消息 R1-R5/R7 全合规、numstat 非空），逐笔 `--range <sha>~1..<sha>` | 2026-11-08 → exit 0 豁免；2026-11-09 → exit 1 必罚；2026-10-24 → exit 0 豁免（详见 §九） |

`.sh` 本体与 `.git/hooks/pre-push` 副本零改动（shellcheck 零告警无整改项；源/副本 diff 逐字节一致纪律维持）。

## 六、CI 可行性注（lint job）

CI lint job（ubuntu-latest）走 `pnpm install --frozen-lockfile` + `pnpm lint` 即可承接：shellcheck wrapper 无构建脚本不会被 pnpm v10 拦；但二进制是**首次执行时惰性下载**（GitHub releases，`shellcheck-v0.11.0.linux.x64.tar.xz`），要求 runner 有外网（GitHub hosted runner 天然满足，且 releases.github.com 与 actions 下载域同源）。锁文件已含 wrapper（`pnpm install --frozen-lockfile` 本地实测绿）。若未来 CI 收紧出网，需换 vendored 二进制方案，届时另立波次。

## 七、design 档缺口的补口说明（不改 untracked 原档；叙述已经审读轮勘正）

`.omo/plans/pre-push-guard-decree-20261024.md`（push-guard 设计档，untracked、他人物权，本波不改其一字）**通篇 0 处 `no-verify` 字样**（`grep -c "no-verify"` = 0，审读轮实测）；其『逃生门与局限』节（L21-31）实际覆盖 TTY 启发式、反向漏拦窗口、令牌语义、本地防线边界四题，对 `git push --no-verify` 可绕过 `.git/hooks/pre-push` 这一绕过面**只字未提**（第一轮台账曾误述为「局限节只覆盖 commit-msg hook 的 --no-verify 绕过面」，与档内实况不符，勘正于此）。补口落在两处：AGENTS.md L0 该行扩为『不 `--no-verify` 绕过任何钩子（commit-msg／pre-push 等）』（行为契约面）＋本卷此节（台账面）。设计档本体留待其作者后续修订。

## 八、改动面清单

`package.json`（+shellcheck devDep；lint 接线；lint:sh）｜`pnpm-lock.yaml`（+shellcheck，另含 1 行无关再生漂移见 §九-4）｜`scripts/lint-sh.mjs`（新增）｜`tests/qa/commit-audit.mjs`（R8 扩 .sh＋.sh 独立锚点）｜`tests/qa/commit-audit.test.ts`（+3 组 shell fixture）｜`AGENTS.md`（L26 一行扩展）｜本卷。

## 九、审读/沙箱修复轮（2026-11-09）

1. **沙箱第 3 项（祖父锚点）——已修**：第一轮 .sh 面沿用 JS 面 `R8_ADOPTION_DATE=2026-10-25` 共锚，作者日期 2026-11-08 的伪造 .sh 违规被罚（沙箱预期豁免✗）。修复：新增 `R8_SHELL_ADOPTION_DATE="2026-11-09"`（`tests/qa/commit-audit.mjs`），branch 循环按作者日期日级**严格 `<`** 计算 `preR8ShellAdoption` 传入 `scanR8`，.sh 面整族跳过；`--staged` 面不传此 opt 永不豁免（与 JS 面同构）。锚点语义分歧的裁决依据：沙箱钉死 11-08 豁／11-09 罚，且 shell 面当日落地即当日生效与 staged 面对称。新增 branch 锚点 fixture（§四-测试③）。本仓真实存量两轮锚点下等价（10-26 至今零 .sh commit），`--branch dev` 修复前后均 fail=0。
2. **审读 1（台账 §七 失实）——已勘正**：设计档 grep `no-verify` 计数为 0，第一轮「局限节只覆盖 commit-msg hook 的 --no-verify 绕过面」叙述与档内实况不符（该档四题：TTY/漏拦/令牌/本地边界，均非 --no-verify）。§七 已按实况重写；结论方向（该档未记 push 可被 --no-verify 绕过）不变。
3. **审读 2（dry-run 数字）——已勘正**：`.sh` 专属新增行 152 条（非 189；189 是「触碰 .sh 的 commit 的全部文件新增行」口径错误，我的第一轮 dry-run 脚本按整 commit diff 计数未按文件过滤）。零命中结论不变（审读方独立复扫同为 0 命中）。§四 与 commit-audit.mjs 头注均已改 152。
4. **审读 3（lockfile 夹带 1 行无关删除）——留痕不修**：`pnpm-lock.yaml` diff 唯一删除行 `-    cpu: [x64, arm64, wasm32, arm]`（既有包 libsql@0.5.29 的 os/cpu 元数据行，pnpm 10.10.0 再生漂移，与 shellcheck 无关）。不手工回填 lockfile（手改锁文件比再生漂移更危险）；实测 `pnpm install --frozen-lockfile` exit 0、CI 同版本 pnpm 同结果，不破门禁。
5. **审读 4（三项观察）——留痕**：① CI lint job 名仍叫 `Lint (ESLint)` 而实际已跑 `pnpm lint`（含 lint:sh）——纯命名滞后，ci.yml 不在本波改动面，留待后续波改名；② lint-sh 只枚举 index 内文件（未 add 的新建 .sh 有本地盲窗）——原令即「枚举 tracked 文件」，已在 §三 留痕；③ 本机 node v22.23.1 触发 engines `24.x` WARN——engines 字段非本波改动、先前已存在，与本波无关。
