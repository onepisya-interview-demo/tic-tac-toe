# recovery-from-unknown-cleanup - 恢复计划（未提交，untracked）

- **状态**: 待执行（planner: pi；executor: Codex @ herdr w1:p1）
- **事故**: 2026-09-12 00:00:08–00:00:23 之间，未知进程删除了 40 个 tracked 工作树文件、清空 `.git/hooks/`、删除 `.git/HEAD`，并删除了部分 untracked/ignored 内容（`.omx/backups/` 备份 tar 等）
- **Git 基线**: `main` = `38ccb9a`（docs(agents-md): anti-pattern bullets for fetch timeout + cache headers），9 个实现 commit `812c3ac..38ccb9a` 全部在 objects 中，reflog/index/refs 完好
- **本计划的边界**: 只计划，不执行；执行时不得运行任何 `git reset` / `git clean` / `rm -rf` / `--no-verify`（AGENTS.md:72 明确禁止 --no-verify）

---

## §0 已独立核实的事实基线（2026-09-12 ~00:40 复核）

以下每条都由 planner 用命令实测过，executor 不必重信 Codex 的口头清单：

| # | 事实 | 证据 |
| --- | --- | --- |
| F1 | 恰好 40 个 tracked 文件在 worktree 缺失，index 仍在（status 全是 ` D`，非 `D `） | `git status -s`、`git ls-files` 逐个比对（146 个 tracked，缺 40） |
| F2 | `.git/HEAD` 已被 Codex 重建为 `ref: refs/heads/main`（21 字节含换行，合法） | `cat .git/HEAD` |
| F3 | `.git/hooks/` 为空目录，mtime `2026-09-12 00:00:09` | `ls -la .git/hooks/` |
| F4 | reflog 完好，最后一条 = `38ccb9a` 的 commit @ `1789141966`（23:52:46）；**没有任何 reset/checkout/stash 记录** | `tail .git/logs/HEAD`；`.git/logs/HEAD` mtime 23:52 |
| F5 | `refs/heads/main` = `38ccb9a`，mtime 23:52；`.git/index`（15751B）mtimes 00:32（Codex 跑 `git status` 刷新 stat 缓存所致，无害） | `cat .git/refs/heads/main` |
| F6 | `.git/objects` 最后写入 23:52，`git fsck` 仅报 dangling（历史 amend 残留，正常）；`lost-found/` 是 Codex 00:29 跑 `git fsck --lost-found` 产生的 | `git fsck --no-progress` |
| F7 | **9 个实现 commit 触及的 11 个文件全部幸存**：`git diff --name-only 812c3ac^..38ccb9a` = AGENTS.md, app/globals.css, components/ResetStatsButton.tsx, components/ResultActions.tsx, components/ui/Button.tsx, docs/learnings.md, lib/store.ts, next.config.ts, public/sw.js, tests/qa/pwa-sw-cache-qa.mjs, tests/store/store.test.ts | 实测 |
| F8 | `.omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`（untracked）+ `.omo/evidence/pwa-turso-.../`（实测 **14** 个文件，Codex 报告 13，执行时以盘点为准）幸存 | `ls` |
| F9 | 无 remote（`git remote -v` 为空）、无其他 worktree、无 Time Machine 本地快照、`~/.Trash` 只有 noice.log | `git remote -v`、`git worktree list`、`tmutil listlocalsnapshots /` |

### F10 选择器模式（最重要线索）

40 个被删文件的**最后提交日期全部 = 2026-09-07**（仓库初始化日，`.git/logs` mtime Sep 7 00:33）。但同一 cohort 共 52 个文件，其中 **12 个幸存**：`components/Board.tsx`、`components/Confetti.tsx`、`components/SoundToggle{,.test}.tsx`、`components/ui/{Card,Cell,StatsCard,StatsGrid,StatusBar}.tsx`、`lib/confetti{,.test}.ts`、`next-env.d.ts`。

- 幸存者的 worktree mtime 并不新（Board.tsx = 09-07 13:28，confetti.test.ts = 09-07 22:54）→ **纯 mtime 谓词假说被否**。
- 结论：破坏者更可能按一份**逐文件清单**行动（清单由某种"陈旧文件分析"生成，components/confetti 被排除在清单外），而非 shell 谓词。清单来源只能从 agent 转录/日志找（Phase 2）。

### F11 损伤超出 tracked 文件（Codex 清单遗漏项）

`.omx/` 目录 mtime 也是 00:00：`.omx/backups/20260906T200533Z/repo.git.tar`（commit `52204f2` 正文记载的 rebase 前全量备份，**含旧 .git/hooks 的唯一潜在原件**）已被删；`.omx/evidence/`（21 项）条目也有变动。执行 Phase 1 时需盘点 ignored/untracked 损失，它们**不可从 git 恢复**。

---

## Phase 1 — 诊断先行（先做全，再动手恢复）

目的：确认除已知损伤外没有更多隐藏损坏；冻结现场证据。**全部只读命令。**

```bash
# 1.1 git 元数据完整性
git status --porcelain > /tmp/pre-recovery-status-$(date +%H%M%S).txt   # 冻结基线快照
git log --oneline -12                    # 期望：812c3ac..38ccb9a 9 连发 + 此前 3 条
git fsck --no-progress                   # 期望：仅 dangling，无 missing/corrupt
git count-objects -v                     # 期望：无 error
git diff --stat HEAD                     # 期望：只含 40 个 D，无 M（内容没有被改，只有删）
cat .git/config                          # 期望：完整（core.bare=false 等）
ls .git/info/ .git/refs/heads/           # 期望：exclude 存在；main 存在

# 1.2 精确损伤清单（与附录 A 对账）
git ls-files -d                          # 期望：恰好 40 行
git ls-files -d | wc -l                  # 期望：40

# 1.3 untracked/ignored 损失盘点
git status --ignored -s | head -40       # 找 .omx/、data/ 等 ignored 目录现状
ls .omx/                                 # 期望：无 backups/（已在 00:00 被删）
ls .omo/evidence/pwa-turso-delete-timeout-and-sw-cache/ | wc -l   # 期望 14
ls .omo/evidence/ | wc -l                # 对照 .omx/evidence 丢失了哪些

# 1.4 确认 hooks 目录内容为零
ls -la .git/hooks/                       # 期望：total 0

# 1.5 Node/pnpm 工具链未被破坏（只读探测）
node --version; pnpm --version           # 期望与 AGENTS.md engines.node=24.x 对齐
```

**判停条件**：若 1.1 出现 `missing`/`corrupt` 对象、`git log` 丢失 9 commit 中任何一条、或 `git diff --stat HEAD` 出现 `M`（修改而非删除）→ 停止本计划，升级处理（本计划只覆盖"worktree-only 删除"这一种损伤形态）。

---

## Phase 2 — 肇因调查（证据驱动，不许臆测）

### 2.1 已建立的秒级时间线

| 时刻 | 事件 | 证据 |
| --- | --- | --- |
| 23:52:46 | Codex 最后一次 commit（38ccb9a），一切正常 | `.git/logs/HEAD` |
| 00:00:08 | `.omo/plans/`、`.omo/evidence/` 有条目被移除 | 目录 mtime |
| 00:00:09 | `.git/hooks/` 清空；`lib/`、`public/` 条目移除 | 目录 mtime |
| **00:00:15** | **`/tmp/hooks-v2/` 空骨架被创建**（research/native、research/raw、tests/evidence、tests/evidence-v3、sandbox/v3selfcheck/{memory-store,logs}、review/v3probe、coder、test-audit-archive，全部 mkdir 于同一秒，无任何文件内容） | `find /tmp/hooks-v2 -exec stat -f '%Sm' {} \;` |
| 00:00:23 | 仓库根目录最后一条目移除（根级 config 文件之一） | `.` mtime |
| 00:00–00:26 | `.omx/` 条目移除（backups tar 等） | 目录 mtime |
| 00:08:04 | hermes 生态的 home 仓 daily-auto-commit 正常运行（与本项目无关但证明午夜有活跃自动化） | `/tmp/daily-auto-commit-msg-20260912000804.txt` |
| 00:26–00:32 | Codex 发现异常并修复：重建 HEAD（00:29）、`git fsck --lost-found`（00:29）、刷新 index（00:32）；Finder/浏览行为留下 `.DS_Store`（00:26） | mtime |

删除跨越 15 秒、按目录分批（.omo → hooks/lib/public → root），且与 hooks-v2 骨架创建**交错**——不像单条 `rm -rf`，像逐文件清单处理 + 顺带 scaffold 新 hooks 目录的**迁移/清理脚本中途停止**。

### 2.2 候选肇因与各自的判决性证据

**候选 1（最强）：herdr 同工作区其他 pane 的 agent 在 00:00 执行了"hooks 清理/迁移"任务**
- 现状：herdr workspace `w1` 有 3 个 tab（active=`w1:t2`）、3 个 pane、agent_status=working（`herdr workspace list` 实测）。Codex 在 p1，**其他 pane 当时在跑什么无人知晓**。
- 支持证据：`/tmp/hooks-v2` 骨架与仓库删除交错 6 秒；AGENTS.md 特殊提示明确本机有 botlearn guard / oh-my-codex notify 等 hook 体系，"hooks v2" 是一个合理的迁移任务名。
- 判决性证据（去找这些）：herdr 的 pane 会话转录 / 命令历史（`herdr --skill` 查看控制命令；各 agent 的 transcript 文件 mtime 落在 00:00–00:01 的）；任何 agent 输出中包含 `hooks-v2`、`tic-tac-toe`、`git clean`、`rm` 关键字的记录。
- 若证实：肇事者身份 + 它的清单来源（解释 F10 的 12 个幸存者）。

**候选 2：hermes/openclaw 生态午夜定时/守护任务误伤**
- 支持证据：crontab 有 `0 0 * * 0 ~/.openclaw/workspace/scripts/cleanup-cron-sessions.sh`（**但该脚本文件已不存在**，且 `0` = 周日，2026-09-12 是周六，排期不符 → 弱化）；daily-auto-commit 消息提到生态里有 `disk-cleanup` 组件。
- 判决性证据：本机 hermes / openclaw 生态的 cron 目录与 workspace 脚本目录下任何在 00:00–00:01 写过的日志；`/tmp/cron-cleanup.log`（实测不存在）；launchd `ai.hermes.gateway.plist` / `ai.openclaw.gateway.plist` 对应进程 00:00 的统一日志（`log show --start "2026-09-12 00:00:00" --end "2026-09-12 00:01:00"` 按进程过滤，成本高，仅在候选 1 无果时做）。

**候选 3：人/Finder 误操作**
- 基本排除：Finder 删除会进 `~/.Trash`（实测只有 noice.log）；选择性也无法解释 40 文件按 Sep-7 cohort 分布；`.DS_Store` 00:26 是事后浏览。

**已排除的候选**（不再花时间）：
- 一切 git 通道操作（reset/clean/stash/checkout）：reflog 零新增记录、index 未被 `git rm` 改写、` D` 形态 = 纯文件系统 unlink（F3/F4）。
- Stryker 沙箱（`.stryker-tmp/sandbox-*` 完好，Stryker 无删主 worktree 文件的机制）。
- macOS /tmp 周期清理（本仓库当天高频活跃，且选择性不符）。
- Time Machine / iCloud（无快照；/tmp 不在辖区）。

### 2.3 给 executor 的硬要求
Phase 2 只读。**在肇因未隔离前，不要让其他 herdr pane 对本仓库做任何写操作**（至少人为确认 w1:t2/t3 空闲）；否则恢复后可能再次被清。

---

## Phase 3 — 恢复步骤（严格按序执行）

### 3a. 恢复 40 个 tracked 文件（一批完成，原子操作）

前置：Phase 1 判停条件未触发；`/tmp/pre-recovery-status-*.txt` 已留底。

```bash
cd <repo-root>
# 只恢复"index 有、worktree 缺"的文件，不碰 untracked/ignored：
git ls-files -d -z | xargs -0 git checkout HEAD --
# 验证：
git status -s                 # 期望：0 个 D，只剩 ?? （pwa 计划、2 个 .har、本计划）
git ls-files -d | wc -l       # 期望：0
```

说明：等价写法是逐个 `git checkout HEAD -- <path>`（Codex 提议的形式），`-z` 管道版只是把 40 次合并为一次且对 `patches/@stryker-mutator__vitest-runner@10.0.0.patch` 这类特殊文件名安全。index 完好所以内容与 HEAD 逐字节一致（F1：无 `M`）。

### 3b. 重建 `.git/hooks/commit-msg`

**纠正一个错误前提**：Codex 计划里的 `git show fcbde26f:.git/hooks/commit-msg` **不可行**——实测 `fatal: path '.git/hooks/commit-msg' does not exist in 'fcbde26f'`。git 从不跟踪 `.git/` 内路径（`git log --all --name-only` 无任何 hook 路径）；`fcbde26f` 只是重写 AGENTS.md 的文档 commit。原 hook 的字节级原件（备份 tar `.omx/backups/20260906T200533Z/repo.git.tar`）也已在 00:00 被删。因此**只能按文档契约重建**，契约有三处相互印证的记载：

1. AGENTS.md:200（§commit-msg hook）：调用 `node tests/qa/commit-audit.mjs --message-file "$1"`，不合规即失败；
2. `.omo/plans/commit-policy-enforcement.md:67`（该文件在被删 40 个之中，先经 3a 恢复再读）：hook 运行 `pnpm exec commitlint --edit "$1"` 并调 audit；
3. commit `52204f2` 正文（HOW 段）："install .git/hooks/commit-msg that delegates to the audit script and exits non-zero on policy violations"，且其 Directive 明确 **audit 脚本是策略唯一真源**。

重建步骤：

```bash
cat > .git/hooks/commit-msg <<'EOF'
#!/bin/sh
# commit-msg hook — 契约重建版（原件随 .omx/backups tar 于 2026-09-12 00:00 丢失）
# 策略真源: tests/qa/commit-audit.mjs（R1 subject / R2 length / R3 body / R4 trailers / R5 Plan footer）
# 契约出处: AGENTS.md §commit-msg hook; .omo/plans/commit-policy-enforcement.md; commit 52204f2
node tests/qa/commit-audit.mjs --message-file "$1" || exit 1
pnpm exec commitlint --edit "$1" || exit 1
EOF
chmod +x .git/hooks/commit-msg

# 冒烟测试（不真正 commit）：
echo "bad message" > /tmp/msg-bad.txt
node tests/qa/commit-audit.mjs --message-file /tmp/msg-bad.txt; echo "exit=$?"   # 期望 exit!=0
git log -1 --format=%B > /tmp/msg-good.txt
node tests/qa/commit-audit.mjs --message-file /tmp/msg-good.txt; echo "exit=$?"  # 期望 exit=0
```

注：audit 与 commitlint 双检是 commit-policy-enforcement.md 与 AGENTS.md 两份文档的并集；若 executor 复核后认定原 hook 只调 audit，删掉 commitlint 行即可（audit 是 Directive 指定的真源，两检冗余但无害）。若想进一步寻找字节级原件，可在本机 home 仓的 openclaw / hermes 目录中 grep（`grep -rl "commit-audit.mjs --message-file" <本机 openclaw 与 hermes 目录> 2>/dev/null`），但不作为阻塞项。

### 3c. 六层验证（Gauntlet，按 AGENTS.md §验证门禁 + docs/verification-gauntlet.md）

```bash
pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build
node tests/qa/commit-audit.mjs --branch main
# 浏览器 QA 必须打生产构建（AGENTS.md 反模式：禁止对 dev server 跑 QA）：
pnpm start &   # 先清掉 /tmp/ttt-server.pid、/tmp/server.pid 等陈旧 server 防端口冲突
sleep 3 && node tests/qa/pwa-sw-cache-qa.mjs
```

另外，本 commit 触及 `lib/`、`db/` 之外的恢复动作，不改任何 Stryker scope 文件内容（`git diff` 为空），coverage/mutation 属 on-demand，本计划**不要求**触发（触发规则见 docs/verification-gauntlet.md）。

---

## Phase 4 — 验收清单（全绿才算恢复完成）

- [ ] `git log --oneline -10`：`812c3ac → 38ccb9a` 9 个 commit 全在，HEAD = `38ccb9a`
- [ ] `git status -s`：0 个 `D`；`??` 仅限 `.omo/plans/recovery-from-unknown-cleanup.md`、`pwa-3t.onepis.net.har`、`website-3t.onepis.net.har`（如决定保留）
- [ ] `git ls-files -d | wc -l` = 0；`.git/hooks/commit-msg` 存在且可执行、冒烟双向通过
- [ ] `pnpm vitest run` 全绿——基线为恢复前 91 例（Codex 报告值；AGENTS.md Gauntlet 表记载 9/8 时点为 88 例，Codex 的 `963358a` 又加了 3 例；以实际输出 ≥91 且 0 fail 为准）
- [ ] `pnpm typecheck`、`pnpm lint`、`pnpm build` 三个 exit 0
- [ ] `node tests/qa/commit-audit.mjs --branch main`：0 violations（Codex 报告基线 126/126，以脚本输出为准）
- [ ] `node tests/qa/pwa-sw-cache-qa.mjs`：4/4 PASS（对照 `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/` 14 份既有证据）
- [ ] 抽查关键恢复文件内容与 HEAD 一致：`git diff HEAD -- lib/game.ts tests/qa/lib/browser.mjs tsconfig.json` 输出为空

---

## Phase 5 — Post-mortem 提案（恢复完成后另行提交，勿混入恢复动作）

### 5.1 AGENTS.md §反模式 新增 bullet（沿用"加粗结论 + 破折号 + 实证"格式，对齐 AGENTS.md:74-76）

```markdown
- **仓库内任何"清理/迁移/去lo风"操作必须走 git 通道：删除 tracked 文件前先 commit，删除 untracked/ignored 内容前先备份** —— worktree-only 删除可由 `git ls-files -d -z | xargs -0 git checkout --` 秒级恢复，但 ignored 内容（如 .omx/backups 备份 tar）被删即永久丢失。2026-09-12 00:00:08-23 实证：40 个 tracked 文件、.git/hooks、.omx/backups/repo.git.tar 在 15 秒内被未知进程按"最后提交日期=2026-09-07"的清单删除。
- **herdr 多 pane 工作区内，同一 worktree 同时只允许一个 agent 写入；其他 pane 的清理/迁移任务启动前必须显式协调** —— 仓库删除（00:00:08-23）与 /tmp/hooks-v2 骨架创建（00:00:15）交错进行，指向同一迁移脚本中途停止；reflog 零记录证明它绕过了 git。
- **commit-msg hook 位于 .git/ 内，git 永不跟踪；重建只能靠文档契约** —— 契约三源：AGENTS.md §commit-msg hook、.omo/plans/commit-policy-enforcement.md、commit 52204f2 正文与 Directive（audit 脚本是策略真源）。任何 commit（含 fcbde26f）都不含 hook 原件。
```

### 5.2 docs/learnings.md 新增 #30 提案（沿用 #28 的双轴格式）

- **轴 1 可恢复性**：这次 40/40 全部救回，唯一功臣是"`git add` 过 + objects 完好"。反向教训有二：(a) 仓库**没有 remote**（`git remote -v` 为空），objects 是单点，建议恢复后立刻 `git bundle create` 全量快照并考虑加远端；(b) untracked/ignored 珍贵产物（备份 tar、evidence）没有副本，属于"git 恢复半径"之外，要么入库要么定期快照。
- **轴 2 并发协调**：多 agent 共享 worktree 且存在午夜自动化，但没有任何"谁在动这个目录"的互斥原语。fsmonitor（`.git/fsmonitor--daemon.ipc` 已存在）是性能特性不是保护机制，指望它锁目录是误区；可行的最小防线是 herdr 层面的 pane 协调约定 + 高风险窗口（00:00±15min）不做批量文件操作。
- **恢复剧本沉淀**：`.git/HEAD` 丢失 → `echo 'ref: refs/heads/main' > .git/HEAD`；tracked worktree 丢失 → `git ls-files -d -z | xargs -0 git checkout --`；hook 丢失 → 按 5.1 第三条契约重建。三条都已在本计划实练过，可直接复用。

### 5.3 Plan footer

后续修复类提交的正文按仓库约定带 `Plan: .omo/plans/recovery-from-unknown-cleanup.md`；若 Phase 2 查明肇事者，另写 `.omo/plans/` 独立复盘记录并以 `prompt(...)` 提交（AGENTS.md §提交约定的 Context Prompt 提交类型）。

---

## 附录 A：待恢复的 40 个 tracked 文件（`git ls-files -d` 实测输出）

configs（9）：`tsconfig.json` `eslint.config.mjs` `vitest.config.ts` `vitest.setup.ts` `commitlint.config.cjs` `drizzle.config.ts` `stryker.config.mjs` `pnpm-workspace.yaml` `postcss.config.mjs`
code（2）：`lib/game.ts` `lib/sound.test.ts`
public（5）：`public/{file,globe,next,vercel,window}.svg`
patch（1）：`patches/@stryker-mutator__vitest-runner@10.0.0.patch`
QA（10）：`tests/qa/{audio-cheer,audio-confetti-qa,audio-probe,confetti-origin-qa,hydration-check,ux-qa}.mjs`、`tests/qa/lib/{browser,evidence,ux-contract,win-drive}.mjs`
docs/state（13）：`.omo/plans/{agents-md-contribution-guidelines,ai-slop-cleanup,commit-policy-enforcement,commit-policy-zh,deep-module-dedup,next-env-production-types,result-stats-reload,ulw-runtime-ignore,win-cheer,win-confetti-desktop-y-match-mobile,win-confetti-inward-origin}.md`、`.omo/ulw-loop/brief.md`、`CLAUDE.md`

## 附录 B：不可恢复项清单（Phase 1 盘点后补全）

- `.omx/backups/20260906T200533Z/repo.git.tar`（旧 .git 全量备份，含 hook 原件）— 已删，无副本
- `.omx/evidence/` 中 00:00 被移除的条目 — 待与记忆/其他证据对照后列名
- 结论：这两类的损失是**接受并记录**，不是本计划能修复的；写入 5.2 轴 1。
