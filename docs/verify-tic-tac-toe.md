# verify-tic-tac-toe

> **五节验证技能**：对这个仓库做一次完整验证的固化流程——起环境、体检、跑验证、留证据、清现场。来源：验证基建路线图票 12（Plan: `.omo/plans/ulw-verification-infra-roadmap-20261007.md` §七 票 12），固化的是票 2 走查（`scripts/verify-all.mjs`）、票 5 证据通道（`tests/qa/lib/browser.mjs` 统一捕获）、票 8 performance 时序的既有设施，零新机制。
> 命令真源：[docs/commands.md](./commands.md)（六层与探针范式）；门禁语义真源：[docs/verification-gauntlet.md](./verification-gauntlet.md)；功能→探针对照：[docs/features.md](./features.md)。

## Launch

起 hermetic 验证环境（生产构建＋隔离库，绝不对 dev server 跑 QA——契约见 [docs/anti-patterns.md](./anti-patterns.md) L0-8）。

```sh
# 0) 前置：依赖与浏览器二进制（一次性）
pnpm install
pnpm exec playwright install chromium

# 1) 生产构建
NEXT_TELEMETRY_DISABLED=1 pnpm build

# 2) 起隔离库 server（:3101 hermetic 范式，库放临时目录——绝不碰真实库）
DB_DIR=$(mktemp -d /tmp/verify-skill.XXXXXX)
DATABASE_URL="file:$DB_DIR/hermetic.db" PORT=3101 NEXT_TELEMETRY_DISABLED=1 pnpm start &
SERVER_PID=$!
echo "DB_DIR=$DB_DIR SERVER_PID=$SERVER_PID"   # Cleanup 节要用，先记下

# 3) 等 ready（首 200 即就绪；30s 未就绪视为失败去 Doctor 节分诊）
curl -sf --max-time 30 http://localhost:3101/ >/dev/null && echo READY
```

- 全链自动模式（推荐，含 Launch→Cleanup 全程）：`node scripts/verify-all.mjs`——六层＋on-demand 三层＋20 探针一条命令，exit 0＝全绿；本节手动模式用于单点复跑/分诊。
- 端口约定：探针走 `:3101`（dev 是 `:3000`，别混）。`VERIFY_ALL_PORT` 可改 port，手动模式对应改 `PORT` 与 `BASE_URL`。

## Doctor

环境体检——Launch 或 Drive 出红时先过这里，分清「环境问题」还是「被测物问题」。

```sh
node -v && pnpm -v                       # 工具链在场
test -d node_modules && echo deps-ok     # 依赖已装
pnpm exec playwright --version           # Playwright 在场
curl -sf http://localhost:3101/ >/dev/null && echo up || echo down   # server 状态
lsof -i :3101 -sTCP:LISTEN || echo port-free   # 端口占用（被占→先清现场再 Launch）
```

分诊路径（按序）：

1. **探针红 ≠ 一定是你改红的**：KNOWN_STALE 存量基线已随 2026-10-09 票 18 清账归零（七支存量红全修复、零退役，豁免机制随之移除——探针任一 FAIL 即 exit 1）——今日之红无存量豁免可对照，直接进下条共库污染排查，分清「环境红」还是「改红」。
2. **共库污染排查**：换全新临时库＋全新 server 独立复跑一次——仍红＝与本波无关的确定性红；转绿＝库/状态污染，回 Launch 用干净库。
3. **抖动排查**：同环境跑两轮，逐条对比结果集——两轮同集＝确定性红；结果集漂移＝抖动，查时序断言（[tests/qa/AGENTS.md](../tests/qa/AGENTS.md) 时序敏感断言节）。
4. **六层单层红**：看该层命令 stderr 首个报错定位；层① vitest 失败文件即最小复跑单元：`pnpm vitest run <文件>`。

## Drive

跑验证——按目的选档：

- **一条命令全链**（发版波/完整走查）：`node scripts/verify-all.mjs`（慢层可 `--skip-mutation`；不起 server 场景 `--skip-probes`）。
- **六层逐层**（每 commit 必跑，命令真源 docs/commands.md）：①`pnpm vitest run` ②`pnpm typecheck` ③`pnpm lint` ④`pnpm build` ⑤`node tests/qa/commit-audit.mjs --range origin/main..HEAD` ⑥触及浏览器界面时跑探针。
- **单探针**（按 [docs/features.md](./features.md) 功能地图定位，或直接跑对应文件）：

```sh
BASE_URL=http://localhost:3101 node tests/qa/home-return-qa.mjs
# rooms-race-qa 额外要 DATABASE_URL（step 5 libsql 子进程直删通道由此派生 RR_DB_PATH，
# 探针头注与 verify-all.mjs 同款传递）：
DATABASE_URL="file:$DB_DIR/hermetic.db" BASE_URL=http://localhost:3101 node tests/qa/rooms-race-qa.mjs
```

- 探针清单＝`tests/qa/*.mjs` 全集减 4：`commit-audit.mjs`（层⑤工具非探针）＋`merge-sync-qa.mjs`/`sync-qa.mjs`（头注 DISABLED 退役面）＋`prod-smoke.mjs`（生产专用只读冒烟，直连 3t.onepis.net，不进本地 hermetic 循环）；清单真源在 `scripts/verify-all.mjs` 的 `PROBES` 数组，新增探针须同步。
- 功能面验证入口速查：离线局 `offline-qa`/`offline-mode-qa`；身份与首页 `home-return-qa`/`online-direct-qa`/`one-identity-qa`；账本竞态与销户 `rooms-race-qa`；重置 `room-reset-qa`；路由全流程 `visual-qa`——BR 对照见 features.md。

## Evidence

留证据——无证据件＝验证未发生（走查/审计类票结论只报 clean/changed/blocked 三值，禁「看起来对了」）。

- 证据落 `.omo/evidence/`（gitignored 不入仓），文件名带日期与票号：`<yyyymmdd>-ticket<N>-<slug>.md`。
- 证据件必含：结论首行（三值之一）；逐探针一行 `探针名: PASS|FAIL`；关键验收命令与实际输出（grep 计数、exit code）。
- 探针自动证据（无需手做）：票 5 统一捕获通道——每个经 `launchQA()` 启动的探针自动落 console/pageerror 捕获 JSON（落点优先级 `QA_CONSOLE_CAPTURE_DIR` → `EVIDENCE_DIR` → `.omo/evidence/console-captures/`）；票 8 performance 时序——捕获件内 `performance.timingSnapshots` 段（mark/measure/navigation/paint 四类 entries）。人工证据件里引用这些自动件的文件名即可。
- 提交前 `git status` 确认 `.omo/evidence/` 内容没被误 add（.gitignored 应天然挡住，双确认）。

## Cleanup

清现场——server、临时库、后台进程三件全清，防污染下一轮。

```sh
kill $SERVER_PID            # Launch 节记下的 pid；失联用 lsof -t -i :3101 | xargs kill
rm -rf "$DB_DIR"            # 临时 sqlite 库目录
curl -sf --max-time 2 http://localhost:3101/ >/dev/null && echo STILL-UP || echo cleaned
```

- 判据：末条命令输出 `cleaned`（端口已释放）；`git status` 里除预期改动外无新增未跟踪文件（临时库/证据件都在 gitignored 区）。
- `verify-all.mjs` 自动模式自起自清（server 随脚本退出关闭、临时库用后即删），只有手动模式需要本节。
- 证据件**不清**——`.omo/evidence/` 是留档，不是垃圾。
