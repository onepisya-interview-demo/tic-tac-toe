# 验证信任沉淀波五笔提交复验记录（2026-10-01）

> 状态：复验完成，待主公裁决遗留项。
> 复验对象：87ec30f / 86b4089 / 58cc978 / b5a3299 / fff969b（均未推远端）。
> 本档性质：验证证据档。FAIL 与未证实项原样呈现，不美化——这正是主公 reset 的痛点。
> 证据标注约定：〔实测〕= 本会话（2026-10-01 复验会话）实际执行命令并亲见输出；〔转录〕= 复验任务材料所载上游检查记录，本会话未复跑该条（多为 GitHub 侧 API 证据），命令与输出以材料原文在案。

---

## ① 复验缘起

原波提交 6c64261（`docs(omo): 验证信任经验沉淀——13 条经验 + 反模式三条 + 机械化候选 C6-C9`，2026-10-01 02:33:30 +0800）已被主公 reset 回 b8e3e0c（2026-10-01 10:17:02 +0800）。〔实测〕reflog 亲见两事件与时序：

```
6c64261 HEAD@{2026-10-01 02:33:30 +0800}: commit: docs(omo): 验证信任经验沉淀——…
b8e3e0c HEAD@{2026-10-01 10:17:02 +0800}: reset: moving to b8e3e0c470ab37864ef74726d2c374d9915e4205
```

主公撤销理由原话：**「我撤销的原因是这些都经过我们的验证了吗？ 要不要重新验证一下？」**

如实认定：原波提交信息只声称了**事实忠实抽查**（hash 白名单、零删改、主公原话逐字），**六层验证门禁未在提交后的树上实跑过**。主公的疑问成立。其后原提交内容由四笔拆分重新入册（86b4089 / 58cc978 / b5a3299 / fff969b），连同更早入册的 87ec30f 共五笔均未 push。本次复验即对这五笔补跑完整门禁 + 事实保真复核，并将结果（含 FAIL）如实落档为本档。

## ② 变更面与五笔提交清单

〔实测〕`git log --numstat b8e3e0c..HEAD` 恰返回五笔、五文件；`git status` 干净。〔实测〕`git log --oneline origin/dev..HEAD` 恰为这五笔——未推远端，push 保留主公亲手（与 [.omo/research-verification-trust-20260930.md:149](.omo/research-verification-trust-20260930.md)「工作树 push 由主公亲手」的约定一致）。

| 提交 | 时间（+0800） | subject | 文件（+增/−删） |
|---|---|---|---|
| 87ec30f | 10-01 10:56:31 | docs(omo): 规则机械化唤醒裁决材料入档——C1–C9 九候选裁决卡备齐待裁 | `.omo/research-rules-mechanization-awaken-20261001.md`（新文件）291/0 |
| 86b4089 | 10-01 11:06:35 | docs(omo): 验证信任沉淀报告入档——2026-09-30 波 13 条验证经验全录 | `.omo/research-verification-trust-20260930.md`（新文件）149/0 |
| 58cc978 | 10-01 11:06:40 | docs: 反模式新增 L1-32/33/34——触发面盲区、首跑判据、探针期待漂移 | [docs/anti-patterns.md](docs/anti-patterns.md) 24/0 |
| b5a3299 | 10-01 11:06:43 | docs: 验证门禁增补 Gap 6 与 2026-09-30 验证实践补充三条 | [docs/verification-gauntlet.md](docs/verification-gauntlet.md) 13/0 |
| fff969b | 10-01 11:06:50 | docs(omo): 机械化候选增补 C6-C9——待唤醒统一裁决，未裁决不实施 | `.omo/research-rules-mechanization-20260926.md` 6/0 |

**变更面口径出入，如实记录**：任务描述称「六个 markdown」，但任务自枚举（.omo/ 两新档一增补 + [docs/anti-patterns.md](docs/anti-patterns.md) + [docs/verification-gauntlet.md](docs/verification-gauntlet.md)）与 git 实证均为 **5 个文件、全部 .md、零代码零配置**（无 lib/**、db/**、app/**、components/**，无任何配置文件）。无论按 5 还是 6 计均为纯 markdown，不影响第④节任一裁决。

## ③ 机械门禁结果表

六层中可机械执行的四层（①②④⑤）本会话全部实跑；⓪ 由 numstat + patch-id 实证（见第⑥节）；③ FAIL 原样呈现。

| 层 | 命令 | 上游记录 | 本会话实跑 | 判定 |
|---|---|---|---|---|
| ⓪ 纯追加核验 | `git log --numstat b8e3e0c..HEAD` | exit 0，**passed=false**，摘录「含删除行：6 0 …\| 13 0 …\| 24 0 …\| 149 0 …\| 291 0 …」 | exit 0；五笔 numstat 删列**全为 0**（见第⑥节） | **上游 FAIL 标记与内容矛盾**，见下 |
| ① vitest | `pnpm vitest run` | exit 0；540 passed \| 11 skipped (551)；Test Files 45 passed \| 2 skipped (47) | 〔实测〕exit 0；**Tests 540 passed \| 11 skipped (551)，Test Files 45 passed \| 2 skipped (47)**，Duration 7.17s | ✅ PASS |
| ② typecheck | `pnpm typecheck` | exit 0；`tsc --noEmit` | 〔实测〕exit 0（附带 WARN：engines 欲 node 24.x、现 v22.23.1，非本波引入） | ✅ PASS |
| ③ lint | `pnpm lint` | exit **1**；40 problems (1 error, 39 warnings)，warning 样例 dwfrun-*.mjs 172:57/176:86 no-unused-expressions | 〔实测〕exit **1**；✖ 40 problems (**1 error, 39 warnings**) | ❌ **FAIL**（全文见下） |
| ④ build | `pnpm build` | exit 0；8/8 static pages，15 条路由 | 〔实测〕exit 0；✓ Generating static pages (8/8)，路由表与上游逐条一致（/ 、/_not-found、6 个 /api/*、/offline、/online、/result 等） | ✅ PASS |
| ⑤ commit-audit（本波面） | `node tests/qa/commit-audit.mjs --range origin/main..HEAD` | exit 0；total=7 pass=7 skip=0 fail=0 | 〔实测〕exit 0；**ref=origin/main..HEAD total=7 pass=7 skip=0 fail=0**，五笔全部 PASS（87ec30f6/86b40893/58cc978e/b5a32995/fff969b3） | ✅ PASS |
| ⑤ commit-audit（全史+R6） | `node tests/qa/commit-audit.mjs --branch dev` | exit 0；ref=dev total=423 pass=413 skip=10 fail=0 | 〔实测〕exit 0；**ref=dev total=423 pass=413 skip=10 fail=0**，五笔 PASS、历史豁免吸收存量 | ✅ PASS |
| ⑥ 浏览器探针 | 条件层，见第④节 | not-applicable | 条款核对〔实测〕 | ⊘ not-applicable |

### ③-FAIL 全文摘录（层③ lint，〔实测〕）

```
/Users/onepisya/.hermes/skills/job-hunter/portfolio/tic-tac-toe/.zcode/workflow-drafts/五笔未推提交复验六层门禁--事实保真.dwf.ts
  207:7  warning  'written' is assigned a value but never used    @typescript-eslint/no-unused-vars
  221:7  warning  'commitRes' is assigned a value but never used  @typescript-eslint/no-unused-vars
  235:5  error    'commitOk' is never reassigned. Use 'const' instead  prefer-const
…（另 36 条 warning 位于 .zcode/workflow-runs/dwfrun-*.mjs 等，no-unused-expressions 172:57/176:86 等）
✖ 40 problems (1 error, 39 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.
ELIFECYCLE  Command failed with exit code 1.
```

如实认定三点：

1. **error 与全部 warning 均落在 [.zcode/](.zcode) 下**（workflow 运行产物 `dwfrun-*.mjs` 与本复验工作流自身草稿 `五笔未推提交复验六层门禁--事实保真.dwf.ts`），与本波五笔变更面（5 个 .md）**零交集**——五笔未引入任何 lint 问题。
2. 但按六层门禁口径，`pnpm lint` exit 1 即层③ **FAIL**，本会话如实记 FAIL，不以「与变更面无关」抵扣。
3. error 位置是**复验行为自身的观测污染**：本会话实测的 1 error 落在本复验工作流的 draft 文件（:235 prefer-const）；上游记录同为 1 error/39 warnings/exit 1，但其摘录截尾未见 error 具体位置。复验这动作本身会往 lint 里添新的 .zcode 文件——层③在含工作流产物的树上**天然难绿**，此结构性事实需主公裁决处置（见第⑦节）。

### ⓪ 层上游 passed=false 的矛盾，原样呈现

上游检查记录标 ⓪ 层 `passed=false`、摘录前缀「含删除行：」，但其摘录逐项列出五个文件的 numstat 均为「N 0」（删列 0）；本会话实跑同一命令，五笔删列亦全为 0，且 patch-id 证实拆分与被撤销原提交逐字节等价（第⑥节）。**上游 FAIL 标记与其自身摘录内容、与 git 实证均相矛盾**，疑为检查器解析口径问题（如把 commit 头行并入判定）。本档不做裁断，留主公裁决；纯追加的 git 事实本身成立。

## ④ 条件层裁决（探针与 on-demand 三层）

四项裁决均为 **not-applicable**，依据是「条款触发面 ∩ git 实证变更面 = ∅」，未以「文档变更肯定没事」代替条款依据。以下条款原文均经本会话实读核对行号。

**① 浏览器探针 —— not-applicable。** 触发条款 [docs/commands.md:43](docs/commands.md)：「6. 触及浏览器界面时跑 `tests/qa/*.mjs` 探针」——条件为「触及浏览器界面」。本次变更面 5 个 .md 均非浏览器界面文件（未触及 app/**、components/**），条件不命中。

**② on-demand coverage —— not-applicable。** 触发条款 [docs/verification-gauntlet.md:27](docs/verification-gauntlet.md)：「**条件**：commit 修改 `lib/**` 或 `db/**` 下任意文件」。变更面无 lib/** 或 db/** 文件。佐证 [docs/verification-gauntlet.md:15](docs/verification-gauntlet.md)：该层 scope 明示「scope 不覆盖 app/ + tests/qa/ + docs/」——本次改动恰全落在 docs/ 与 .omo/。

**③ on-demand mutation —— not-applicable。** 触发条款 [docs/verification-gauntlet.md:37-38](docs/verification-gauntlet.md)：「**条件**：commit 修改 4 个 Stryker scope 文件任一个：`lib/game.ts` / `lib/db.ts` / `lib/store.ts` / `db/schema.ts`」。git 实证变更面无一命中。佐证 [docs/verification-gauntlet.md:16](docs/verification-gauntlet.md)「scope 不覆盖本次改动」。

**④ on-demand property —— not-applicable。** 触发条款 [docs/verification-gauntlet.md:47](docs/verification-gauntlet.md)：「**条件**：commit 新增 `lib/X.ts` 纯函数（非 React 组件、非副作用模块）」。本次新增两档均为 .omo/ 下研究档 markdown，非 lib/X.ts 纯函数。

三条 on-demand 规则的整体前提见 [docs/verification-gauntlet.md:21-23](docs/verification-gauntlet.md)：「下面三条规则定义『覆盖 scope 之外』的 commit 何时必须跑非默认的三层」——均以文件路径命中为唯一触发依据；[docs/commands.md:47](docs/commands.md) 亦确认 on-demand 三层「按改动 scope 触发」。

## ⑤ 四档事实保真复核

四档受检文档共 **74 条断言**：**confirmed 67（90.5%）、unconfirmed 3、not-in-repo 4**。下游 issues 共 14 条：**high 1、medium 3、low 10**。

| 受检档 | claims | confirmed | unconfirmed | not-in-repo | issues |
|---|---|---|---|---|---|
| [.omo/research-rules-mechanization-awaken-20261001.md](.omo/research-rules-mechanization-awaken-20261001.md)（87ec30f） | 21 | 20 | 0 | 1 | 3（全 low） |
| [.omo/research-verification-trust-20260930.md](.omo/research-verification-trust-20260930.md)（86b4089） | 22 | 19 | 1 | 2 | 4（high 1 / medium 1 / low 2） |
| [docs/anti-patterns.md](docs/anti-patterns.md) L1-32/33/34（58cc978） | 17 | 15 | 1 | 1 | 3（medium 1 / low 2） |
| b5a3299（[Gap 6](docs/verification-gauntlet.md)）+ fff969b（[mech 增补](.omo/research-rules-mechanization-20260926.md)）旁证 | 14 | 13 | 1 | 0 | 4（medium 1 / low 3） |

### ⑤-1 全部非 confirmed 断言清单（原样列出，共 7 条）

**unconfirmed ×3 —— 同一断言：「rooms-race job 自进 CI 起 12 天从未绿过」。三个复核面独立判为 unconfirmed：**

1. **[trust 报告 §一2/§二2]**「rooms-race job 漏传 BASE_URL，自进 CI 起 12 天从未绿过 / bug 沉默 12 天」。复核证据：job 进 CI = e1ea4b1 2026-09-24 17:24:38 +0800〔实测 `git log -1 --date=iso e1ea4b1` 亲见〕，修复 = a2a667d 2026-10-01 00:33:35 +0800〔实测同法〕，窗口 ≈**6.3 天**；a2a667d 提交信息自述「错配沉默六天」；12 天（回推 09-19）无任何仓内锚点。gh run list 显示 09-24~09-28 CI run 全 success（main 侧当时无此 job），该 job 实际首次运行即 PR #18 首跑红〔转录 GitHub 侧〕。
2. **[docs/anti-patterns.md:219](docs/anti-patterns.md)（L1-32 实证段）** 同一 12 天断言。复核证据同上；另注：自 ca7e6ad 移除 push trigger（09-15）至 PR #18 首跑红（09-30T16:14Z）≈15.6 天，也非 12 天；仓内唯一凑出 12 天的窗口是 09-15→09-27 素材窗口起点，疑错配〔转录，窗口起算日 09-27 未独立复核〕。「从未绿过直至修复」本身另由 GitHub API 佐证：dev 分支仅 5 个 CI run，job 进 CI 后首跑即红、rerun×3 仍红〔转录〕。
3. **[docs/verification-gauntlet.md:99](docs/verification-gauntlet.md)（Gap 6）+ [.omo/research-rules-mechanization-20260926.md:85](.omo/research-rules-mechanization-20260926.md)（C6 行）共同断言**同一 12 天。复核证据同上；成立部分：a2a667d 确为单行修复、PR #18 以 37326b9 合流、dev push 零触发均实证。「首跑红」仓内唯一来源是 a2a667d 提交信息自述（CI run 日志在 GitHub 侧不在仓内）。

**该数字扩散共 6 处 4 笔**，全部经本会话 grep 钉实行号：[docs/anti-patterns.md:219](docs/anti-patterns.md)、[docs/verification-gauntlet.md:99](docs/verification-gauntlet.md)、[.omo/research-verification-trust-20260930.md:17](.omo/research-verification-trust-20260930.md)、[.omo/research-verification-trust-20260930.md:38](.omo/research-verification-trust-20260930.md)、[.omo/research-verification-trust-20260930.md:128](.omo/research-verification-trust-20260930.md)、[.omo/research-rules-mechanization-20260926.md:85](.omo/research-rules-mechanization-20260926.md)。**结构性盲区立论本身独立成立**（ca7e6ad 2026-09-15 移除 push trigger〔实测 `git log -1 ca7e6ad` 亲见 subject〕、[.github/workflows/ci.yml:3-5](.github/workflows/ci.yml) 现行 on: 仅 pull_request〔实测〕、dev push 零触发），仅天数数字失实。

**not-in-repo ×4 —— 会话侧事实，仓内不可证，如实标注：**

4. **主公 2026-10-01 点名「规则机械化」**（唤醒条件④触发事件本身；载体唯 [.omo/research-rules-mechanization-awaken-20261001.md:4](.omo/research-rules-mechanization-awaken-20261001.md) 与 [:18](.omo/research-rules-mechanization-awaken-20261001.md) 自述〔实测两行亲见〕；仓内无任何其他文件独立记载该点名；条件④文本本身见 [.omo/research-rules-mechanization-20260926.md:96](.omo/research-rules-mechanization-20260926.md) 可证）。
5. **「273 个裸 hash 逐一 git rev-parse 批验」的数量断言**（[.omo/doc-status-map-20260927.md:203](.omo/doc-status-map-20260927.md) 实际只记「图内全部裸 hash 逐一 `git rev-parse --verify` 批验在档」〔实测亲见全行〕，无数量；唯一含 273 的记录在 .omo/sessions.local.md:291〔实测亲见：「commit-audit.mjs --branch dev 279 / 273-6-0」〕且该文件经 `git check-ignore` 确认 **gitignored**〔实测〕，其 273 系 commit-audit 通过计数，语义不同）。
6. **「vitest 48/48 钉 seam」「vitest 55/55 钉行为」**（trust §二4/§二5/§二13/§五1）——会话时点运行结果无仓内落档、未注明测试范围，口径无法复原；本会话全量实跑为 551 tests（540 passed + 11 skipped），任何可跑口径均非 48/55。
7. **主公亲令「不能让它就这样沉默的通过了」**（anti-patterns L1-32 引）——唯一载体是同会话产出的 trust 报告转录（[.omo/research-verification-trust-20260930.md:17](.omo/research-verification-trust-20260930.md)〔实测亲见〕），无独立仓内证据可证原话逐字性。

**〔2026-10-04 处置注·自治卡 D5〕**：上列第 4-7 条会话侧事实已按主公 2026-10-04 自治指令（解放 CEO）移入 `.omo/evidence/session-side-facts-20261004.md`（gitignored，不入 tracked）存档；其中「273 个裸 hash」数量断言按事实收口——273 实为 commit-audit 通过计数、原载体在 gitignored 会话档（见第 5 条），非裸 hash 批验数量；tracked 正文今后按 [docs/conventions.md](docs/conventions.md) 新增口径执行（会话侧数字不入正文；vitest 结果必须注明运行范围）。

### ⑤-2 confirmed 抽样复证（本会话实测，非全量重跑）

上游 confirmed 67 条未全量重跑；本会话对关键锚点抽样复证，**全部命中**：

- C2 兑现：[tests/api/maintenance-purge.test.ts:114](tests/api/maintenance-purge.test.ts) 与 [:129](tests/api/maintenance-purge.test.ts) 均为 `expect(purgeStaleRoomsMock).toHaveBeenCalledWith();`〔实测逐行亲见〕；翻转提交 2d7709b（2026-09-26「fix(api): 端点删显式实参」）存在〔实测〕。
- CI 触发矩阵：[.github/workflows/ci.yml:3-5](.github/workflows/ci.yml) 仅 `pull_request: branches: [main]`，无 push〔实测〕。
- 生产 URL 漂移（C9 事实列）：[docs/operations.md:179](docs/operations.md) 正文仍写 vercel.app 旧 URL、[:194-196](docs/operations.md) 勘误补注声明 3t.onepis.net、[:198](docs/operations.md) curl 仍打旧 URL〔实测三处亲见〕；[app/layout.tsx:48](app/layout.tsx) metadataBase 钉 vercel.app（[:66](app/layout.tsx) 注释释明有意保留）而 [:69](app/layout.tsx) 与 [lib/home-jsonld.ts:40](lib/home-jsonld.ts) 已用新域〔实测〕。
- 13 条经验计数：`grep -c '^### '` trust 报告 = 13〔实测〕。
- anti-patterns 体量：237 行、`grep -c '^### L'` = 48（L0=8 / L1=27 / L2=13）〔实测〕。
- tag：dev-stable-20260930 → 2bf16637〔实测 `git rev-parse^{commit}`〕；本地 dev-stable tag 恰 3 枚〔实测〕；远端 `git ls-remote --tags origin` 仅 v1.0.0/v2.0.0/v2.0.1，无任何 dev-stable-*〔实测〕。
- 装备事实：[package.json:39](package.json) `"lint": "eslint"`（无 --fix）〔实测〕；[vercel.json:4-9](vercel.json) crons 仅一条 `0 3 * * *`〔实测〕；scripts/ 恰 5 文件〔实测〕；tests/qa/*.mjs 恰 23 枚、无 BASE_URL 的恰 3 枚（commit-audit/merge-sync-qa/sync-qa）〔实测〕；[db/schema.ts:50](db/schema.ts) `updatedAt: integer('updated_at', { mode: 'timestamp_ms' })`〔实测〕。
- 血缘与互引：L1-18@[:111](docs/anti-patterns.md)、L1-31@[:209](docs/anti-patterns.md)、L1-32@[:215](docs/anti-patterns.md)、L1-33@[:223](docs/anti-patterns.md)、L1-34@[:231](docs/anti-patterns.md)〔实测〕；[docs/business-rules.md:11](docs/business-rules.md) BR-1 decree 与 [:20](docs/business-rules.md) BR-10、[:41](docs/business-rules.md) decree 来源标记〔实测〕；[tests/qa/probe-reconciliation.test.ts:18](tests/qa/probe-reconciliation.test.ts)「真源：docs/anti-patterns.md:209 L1-31」〔实测，注：上游引「:17 13→0」实际在 [:16](tests/qa/probe-reconciliation.test.ts)，行号漂 1 行、内容成立〕；[tests/qa/commit-audit.mjs:25](tests/qa/commit-audit.mjs) R7 注与 [:253](tests/qa/commit-audit.mjs) `auditBrProbeBinding`〔实测〕；[docs/learnings.md:242](docs/learnings.md) §32、[docs/dispatcher-playbook.md:52](docs/dispatcher-playbook.md) 机器锚点优先与 [:81](docs/dispatcher-playbook.md) 文件面零交集、[docs/operations.md:277-279](docs/operations.md) TTL 改一处承诺、[docs/requirement-intake.md:236](docs/requirement-intake.md) 建议硬化〔实测〕。
- 裁决材料锚点：九卡 C1–C9 于 awaken [:40/:52/:60/:70/:80/:90/:102/:114/:124](.omo/research-rules-mechanization-awaken-20261001.md)〔实测 grep〕；[.omo/doc-status-map-20260927.md:71](.omo/doc-status-map-20260927.md) Q9 上下文总排序逐字、[:132](.omo/doc-status-map-20260927.md) 决策面清零、[:138](.omo/doc-status-map-20260927.md) 已收尾、[:155](.omo/doc-status-map-20260927.md) C2 归档依据、[:172](.omo/doc-status-map-20260927.md) ok=44/44、[:222](.omo/doc-status-map-20260927.md) 11 卡→3 条〔实测〕；[.omo/alignment-20260926-doc-governance.md:14](.omo/alignment-20260926-doc-governance.md) 过期真源指针与 [:94](.omo/alignment-20260926-doc-governance.md) Q9 批注位〔实测〕；flaky 票 [:3](.omo/plans/ulw-homedialog-flaky-fix-20260926.md) 硬纪律与 [:5](.omo/plans/ulw-homedialog-flaky-fix-20260926.md)「第三处已修 1b80a99」、rooms-race 票 [:4](.omo/plans/ulw-rooms-race-qa-ticket-20260924.md)「自 e1ea4b1 进 CI 起」〔实测——此行同时证实「12 天 vs 六天」两口径实为**同锚**（票面与 a2a667d message 均写「自 e1ea4b1 进 CI 起」），awaken 档 [:92](.omo/research-rules-mechanization-awaken-20261001.md) 将其归因为「锚点不同」有误，见 ⑤-3〕；[docs/branching.md:3](docs/branching.md) Trunk-Based 定案、[docs/agent-workflow.md:63](docs/agent-workflow.md) SSOT、mech [:22-26](.omo/research-rules-mechanization-20260926.md) 强制力分级、[:62](.omo/research-rules-mechanization-20260926.md) 三犯法则、[:92](.omo/research-rules-mechanization-20260926.md) 增补注、[:96](.omo/research-rules-mechanization-20260926.md) 唤醒条件④〔实测〕。
- 历史锚点：54045f7/f327646/74e1a56/4ee9fa6/2d7709b/ca7e6ad/e1ea4b1 七 hash 均存在且 subject 相符〔实测逐一 `git log -1`〕；reset 时序见第①节〔实测〕。
- commitlint 双硬规则：node_modules/@commitlint/config-conventional/lib/index.js:8 `footer-max-line-length: [Error, always, 100]`〔实测〕；「subject 禁拉丁开头」系 [tests/qa/commit-audit.mjs:25](tests/qa/commit-audit.mjs) R7 的口语转述，语义方向一致。
- knip 白名单（doc1-issue1 佐证）：[knip.json](knip.json) `ignore` 仅 `public/sw.js`，无探针白名单条目——「knip 白名单 13→0」确系术语混称，13→0 实为 probe-reconciliation 自身 KNOWN_ORPHANS（[:16](tests/qa/probe-reconciliation.test.ts)、[:36](tests/qa/probe-reconciliation.test.ts)〔实测〕）。

### ⑤-3 issues 汇总（14 条，severity 原样）

**high ×1**
- 「12 天」数字失实且扩散 6 处 4 笔（见 ⑤-1 第 1-3 条与扩散行号表）。实际窗口 ≈6.3 天，且 1b80a99 提交信息自证该 job 在 PR #18 前从无 PR 触发（实际零运行，首次运行即首跑红）。

**medium ×3**
- 「273 个裸 hash」数量断言无 tracked 档案锚点，gitignored 会话记录中的 273 语义不同（trust §一1）。
- 「12 天」在 anti-patterns L1-32 实证段的复写（与 high 同源，此处按受检档分开计）；建议更正为「约 6 天」或改锚点为触发面盲区时长。
- Gap 6 所在的 b5a3299/fff969b 受检面：「自进 CI 起 12 天」矛盾波及 gauntlet:98-99、anti-patterns:219、trust:17/:38/:128、mech:85（与上同源）。

**low ×10**
1. awaken 档「knip 白名单 13→0」术语混称（实为 probe-reconciliation 自身 KNOWN_ORPHANS；[knip.json](knip.json) 实证无该白名单）。
2. awaken 档「273 裸 hash…（trust §二.4/§二.10）」节号归属偏移（实载 §二.1；内容均可证）。
   **〔2026-10-04 更正注·验收残留〕**：本条「实载 §二.1」有误——本席实测 trust 档 §一始于 :11、273 唯一命中在 :15（§一.1），awaken 档 :159 节号更正注「实载 §一.1」正确；本行原文错误，特此更正。
3. awaken 档「主图头注明文真源接替」——20260927 主图头注系结构性体现接替，无「真源」明文（grep 仅命中修订记录）。
4. trust §三表与 mech §五表 C6-C9 非逐字同步（C8/C9 时点标注措辞差，语义等价；后继机械对账会报差异）。
5. 「vitest 48/48」「55/55」未注明范围、无仓内落档。
6. 「stale 门」措辞与实际门禁机制不符（实拦 PR #17 的是 required_status_checks 必过上下文缺失 11 项 vs 实跑 6 项〔转录 GitHub 侧〕，非分支过期门；被拦+bypass 合入核心事实成立）。
7. L1 系列历史断档 L1-20..26〔实测 `grep -o '^### L1-'` 亲见 1-19、27-34 连续，断档系此前遗留非 58cc978 引入〕。
8. b5a3299 提交信息自称「同源互链」实际单向（L1-32 指向 Gap 6，Gap 6 不回指）。
9. Gap 6「dev push 不触发任何一层——六层全部静默」与 gauntlet §1 对照表「①②③每 commit 各跑一次（本地）」存在措辞张力（CI 触发面语境下的笼统表述；结构性盲区立论不变）。
10. awaken 档 [:92](.omo/research-rules-mechanization-awaken-20261001.md) 将「12 天 vs 六天」归因两口径锚点不同，但票面 [:4](.omo/plans/ulw-rooms-race-qa-ticket-20260924.md) 与 a2a667d message 均写「自 e1ea4b1 进 CI 起」——实为**同锚数字矛盾**〔实测两处亲见〕。

**上游证据本会话未复跑的清单，如实声明**：gh pr view 16/17/18（mergedAt/review/6 包 lock diff）、gh api actions/runs（PR #18 run 36742717954 failure attempt 3、run 36748001707 success attempt 1）、gh api rulesets/23195249（main-gate bypass 配置）、commits/4c6db68/check-runs（6 项 checks）均为 GitHub 侧 API 证据〔转录〕，命令与输出在复验材料原文在案；本会话复跑的 GitHub 侧命令仅 `git ls-remote --tags origin`（佐证 tag 未推，成立）。

## ⑥ 纯追加核验结果

〔实测〕三条证据链全部成立：

1. **五笔 numstat 零删改**：`git log --numstat b8e3e0c..HEAD` 恰五笔；逐笔 `git show --numstat`：awaken 291/0（新文件）、trust 149/0（新文件）、anti-patterns 24/0、gauntlet 13/0、mech 6/0——删除列全为 0。
2. **拆分与被撤销原提交逐字节等价**：`git show <commit> -- <file> | git patch-id --stable` 四对两两 MATCH〔实测亲见，hash 与上游记录逐字一致〕：
   - 86b4089 ↔ 6c64261：`c2eef0802f38db1a34cfa81e6c4b7338a70cc063`
   - 58cc978 ↔ 6c64261：`15bce4cf7367044b9de3a99cc3562da98e018de2`
   - b5a3299 ↔ 6c64261：`2ace5a6f22b379ed07a76f1701eb7976f94771eb`
   - fff969b ↔ 6c64261：`6cde4e57c53f570fa41e5316b2634050ad1f8f30`

   **〔2026-10-04 存疑注·自治卡 D4〕**：检查脚本系会话侧一次性工具未入仓（grep tests/qa scripts 无命中、git log -S patch-id 仅命中本档入册提交 00ddf95），passed=false 标注无法原地复核，patch-id 四对 MATCH 仍为等价主证。
3. **原提交 6c64261 numstat**〔实测〕：4 文件 6+0 / 149+0 / 24+0 / 13+0，与四笔拆分按文件完全吻合；第 5 笔 87ec30f（awaken 新档 291 行）不在 6c64261 内、系拆分时独立入册的原波第五内容块。

结论：**「纯追加零删改」在 git 层面成立**；上游 ⓪ 层 passed=false 标记与该事实的矛盾原样保留至第⑦节裁决项。

## ⑦ 结论与遗留

### 结论（如实）

1. **机械门禁**：①vitest ②typecheck ④build ⑤commit-audit（双口径）在本会话提交后树上**全部实跑 PASS**；⑥探针与 on-demand 三层（coverage/mutation/property）经条款核对**四项均 not-applicable**。唯 ③lint **exit 1 FAIL**——但 1 error + 39 warnings 全部位于 [.zcode/](.zcode) 工作流自身产物，与本波 5 个 .md 变更面零交集，且 error 系复验行为自身引入的观测污染（本工作流 draft 文件的 prefer-const）。
2. **⓪ 纯追加**：git 实证成立（numstat 全 0 删 + patch-id 四对 MATCH）；上游检查器标 passed=false 与其自身摘录及本会话实证**自相矛盾**，原样呈现、不做裁断。
3. **事实保真**：74 条断言 67 confirmed（90.5%）、3 unconfirmed、4 not-in-repo。**唯一 high 问题**是「沉默 12 天」失实数字（实为 ≈6.3 天），扩散 6 处 4 笔，全部钉实行号；其余为 medium ×3（273 数量断言、12 天复写×2）、low ×10。
4. **拆分忠实**：四笔拆分与被撤销的 6c64261 逐字节等价（patch-id 实证），reset-重入册过程零内容漂移。
5. 主公 reset 的疑问「这些都经过我们的验证了吗」——**当时答案确为否**（六层门禁未在提交后树上实跑）；本档即补跑记录。补跑结果：四层半 PASS、半层带 FAIL（lint，与变更面无关但如实记）、一条 high 级事实错误（12 天）确凿在档——**这波文档入册的内容并非全部可靠，12 天数字需要更正**。

### 遗留与需主公裁决项

| # | 事项 | 性质 | 建议方向 |
|---|---|---|---|
| 1 | 「12 天」失实数字（实为 ≈6.3 天）扩散 [docs/anti-patterns.md:219](docs/anti-patterns.md)、[docs/verification-gauntlet.md:99](docs/verification-gauntlet.md)、[trust:17/:38/:128](.omo/research-verification-trust-20260930.md)、[mech:85](.omo/research-rules-mechanization-20260926.md) 共 6 处 | **high，需裁决**：更正即破坏「纯追加」，须新提交；是原地改还是勘误叠注（本项目 anti-patterns 有勘误补注先例，见 [docs/operations.md:194-196](docs/operations.md)）、措辞改「约 6 天」还是改锚点为「触发面盲区自 09-15 移除 push trigger 起 ≈15.6 天」，均待裁 | 裁决后以一笔更正提交处理，并为 L1-32/Gap 6/C6 行各加归因更正注 |
| 2 | 上游 ⓪ 层检查器 passed=false 与 git 实证（全 0 删）矛盾 | 需澄清 | 检查脚本解析口径核查；若为脚本 bug 应修脚本而非改数据 |
| 3 | 层③ lint FAIL 源在 [.zcode/](.zcode)（工作流产物 + 复验工作流自身草稿），与业务变更面零交集；复验行为本身会持续往里添文件 | 需裁决 | 是否将 `.zcode/**` 纳入 eslint globalIgnores（现 [docs/verification-gauntlet.md:14](docs/verification-gauntlet.md) 载 lint targets 由 eslint.config.mjs + globalIgnores 决定），或门禁口径明文豁免该目录 |
| 4 | 4 条 not-in-repo 会话侧事实（主公点名唤醒、「273」数量、vitest 48/48 与 55/55、主公亲令原话） | **已处置（2026-10-04 自治卡 D5）** | 4 条移入 `.omo/evidence/session-side-facts-20261004.md`（gitignored）存档、tracked 不补落档；vitest 口径与「会话侧数字不入正文」已立规（[docs/conventions.md](docs/conventions.md)） |
| 5 | 任务描述「六个 markdown」与 git 实证 5 个的出入 | 仅记录 | 不影响任何裁决，无需动作 |
| 6 | low ×10（knip 措辞、节号偏移、「真源」明文、两表措辞差、vitest 口径、stale 门措辞、L1 历史断档、互链单向、Gap 6 笼统表述、awaken 归因误） | 随 #1 更正波顺带处理与否待裁 | 均内容可证、仅精度问题，不阻塞本波 |
| 7 | 五笔 push（保留主公亲手，见 [trust:149](.omo/research-verification-trust-20260930.md)） | 待主公 | 建议 #1 裁决后与更正提交一并推 |

---

*复验执行：记录兼提交员，2026-10-01。全部〔实测〕条目均在本会话工作树（HEAD=fff969b，clean）上执行；〔转录〕条目为复验任务材料所载上游记录，未复跑者已逐条声明。本档自身即纯追加新文件，未改动五笔任何内容。*
