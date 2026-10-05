# Commands

> 来源：AGENTS.md §命令（行 159–170）

## 基础命令

```sh
pnpm dev
pnpm build && pnpm start
pnpm test
pnpm typecheck && pnpm lint
pnpm test:coverage
pnpm test:mutation
node tests/qa/visual-qa.mjs
```

## 端口约定

- **dev 默认端口**：`:3000`（Next.js 16 默认）
- **QA 探针端口**：`:3101`（hermetic 库）
- **dev EMFILE 止血**：见 [docs/anti-patterns.md §L2-5](./anti-patterns.md)（`WATCHPACK_POLLING=true pnpm dev`）

## 浏览器探针启动范式

探针通常用 `:3101` hermetic 库：

```sh
DATABASE_URL=file:/tmp/ulw-og2v/<unique>.db PORT=3101 pnpm start &
BASE_URL=http://localhost:3101 node tests/qa/one-identity-qa.mjs
```

**不要**对 dev server 跑浏览器 QA（生产构建是契约要求，详见 [docs/anti-patterns.md §L0-8](./anti-patterns.md)）。

## 验证六层

每 commit 必跑：

1. `pnpm vitest run`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `node tests/qa/commit-audit.mjs --range origin/main..HEAD`（本波 commit 面，0 violations）
6. 触及浏览器界面时跑 `tests/qa/*.mjs` 探针

层⑤走本波 commit 面（默认 ref=main；可用 `--branch <name>` 走全史或 `--range <git-rev>` 走任意 git ref 表达式）。全史扫描由「历史豁免基线」吸收存量 fail：merge commit（subject `Merge pull request #N from …`）、dependabot 作者（identity-based）、R7 采纳日（2026-09-23）之前的旧账——见 [docs/commit-policy.md §hook 段](./commit-policy.md#commit-msg-hook) 与 [`.omo/plans/ulw-homedialog-flaky-fix-20260926.md` §二 T-B1](../.omo/plans/ulw-homedialog-flaky-fix-20260926.md)。R6 全仓状态检查与 `--message-file` 模式不受豁免，hook 路径仍逐 commit 严格闸门。

**豁免三类本地实测（2026-10-05，D26a 自决票）**：于临时分支 `qa/d26-exemption-test` 用 `git commit-tree` 造 6 个 fixture（不经 hook、不用 --no-verify）实测三层豁免在两层的真实行为，实测后分支即删、dev HEAD 未动：

- **hook 层（`--message-file`）零豁免**：「Merge branch 'feat/demo' into dev」与 dependabot 作者的「Bump next from 15.1.0 to 15.1.1」空提交均被 hook 拒（R1/R7/R3/R4/R5 全报，exit=1）——豁免 opts 在 hook 路径不可达（`checkMessage` 无第三参，`tests/qa/commit-audit.mjs:319`），与上句「hook 路径仍逐 commit 严格闸门」一致。
- **range 层三类豁免全部真实生效**：`SKIP 549619b9 Merge pull request #123 from … (merge commit)`；`SKIP d23fb137 chore(deps): bump next … (dependabot)`；同一条无 CJK subject 消息 author date 2026-09-20 → PASS（pre-R7 豁免 R7），同消息 2026-09-24 → FAIL R7（对照隔离出 R7 单维度）。`ref=22af9e1..qa/d26-exemption-test total=6 pass=1 skip=2 fail=3`（3 个 fail 全是设计内对照组）。
- **边界澄清（实测否证两个想当然）**：① subject 以「Merge branch …」开头**不**豁免（全条 FAIL）——正则是 `/^Merge pull request #\d+ /`（`tests/qa/commit-audit.mjs:121`），只认 GitHub PR-merge bot 形态，本地 `git merge` 默认 subject 不在豁免内；② dependabot 身份豁免不盖 R1/R2——裸「Bump next from …」subject 照样 FAIL R1，`SKIP (dependabot)` 需 subject 先过 R1（如 `chore(deps):` 前缀；R1 在 `botAuthored` 短路之外，`tests/qa/commit-audit.mjs:184`/`:189`）。

on-demand 三层（coverage / mutation / property-based）按改动 scope 触发；触发规则、thresholds、Tested trailer 模板、engines.node 三环境对齐契约，全部以 [docs/verification-gauntlet.md](./verification-gauntlet.md) 为 single source of truth。

## 定期体检（手动，不进 CI 门禁）

- `pnpm qa:audit`：knip 未用文件/导出/依赖审计（仓规配置见 `knip.json`：探针与脚本视为入口）。定期跑，输出为清理票线索而非门禁；探针↔CI 引用的机械对账由测试用例承担（见 [docs/anti-patterns.md §L1-31](./anti-patterns.md)）。

## 提交策略速查

```sh
git commit -m "<type>(<scope>): <subject>"  # 触发 .git/hooks/commit-msg
# 禁 --no-verify（详见 [docs/anti-patterns.md §L0-7](./anti-patterns.md)）
```

完整提交策略：subject ≤ 100 字符 / lore trailer / Plan footer / 中文正文 三例外 → [docs/commit-policy.md](./commit-policy.md)。
