# ulw · dev-emfile-watch —— dev 服 EMFILE 风暴文档化 + 构建冻结反模式

- **日期**：2026-09-19
- **状态**：APPROVED（主公 2026-09-19 审定：只写文档不改 script；F2 构建冻结进入；本计划入档即执行）
- **触发**：两事故——① 主公 :3000 `pnpm dev` 冷启即爆 Watchpack EMFILE 风暴 + `.next/dev` deleted 重启循环，服务不可用；② 今夜波次产线 build 删 `.next/dev` 撞死 dev 服
- **基线**：dev @ b49968a
- **执行体**：fresh codex（ulw-fix2，herdr 3t tab）；调度者独立验收（dev 冷启探针已由调度者在调查阶段实证）

---

## 0. 根因（调查结论，证据闭合）

1. Next 16 dev 用 watchpack 递归 watch 整个项目目录（`node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js:864`：`wp.watch({directories:[dir]})`）；本仓含 node_modules/.pnpm 共 **6,495 目录**（.pnpm 占 5,803）。
2. watchpack 原生 `fs.watch` 对这些目录批量 EMFILE（实测 668 次失败 ≈ 成功 ~5,8xx 后撞 macOS FSEvents 每进程流上限）。**非 fd 耗尽**：进程仅开 17 fd、ulimit 1048575 仍复现；纯 node recursive watch 三层（本仓/job-hunter/~/.hermes）正常；fsevents@2.3.3 加载正常——watchpack 逐目录模式专属。
3. watcher 失败 → Turbopack dev 目录变更探测误判 → 「`.next/dev` was deleted」假阳性重启循环（一次 22s 复现 33 次）。
4. **上游已知 bug**：vercel/next.js **#93175**「Turbopack dev on macOS hits Watchpack fs.watch EMFILE on ancestor directories」（2026-04-24 起 OPEN）：报告者实测 ulimit 无效、`--webpack` 也复现；维护者确认系 watchpack 层、机器相关、未修。16.3.4→16.3.5 对比未动任何 watcher 文件。今日上游合入 **#98003**（为 pnpm Global Virtual Store 做跨根 symlink 解析）——pnpm 目录农场 × Turbopack 系上游活跃战区。
5. **止血已实证**：`WATCHPACK_POLLING=true pnpm dev` → 0 EMFILE / 0 deleted / HTTP 200（轮询绕开原生 fs.watch；Turbopack Rust 侧 watcher 无恙）。
6. 为何今日爆发：16.3.4 于 09-10 安装，主公 :3000 系长期未重启老进程；今夜波次十余次 `pnpm build` 删其脚下 `.next/dev` 迫使冷启——冷启即第一次以当前树规模全新建 watcher。

## 1. 已排除项

fd 上限（17 fd 即炸）、fsevents 模块损坏（加载 OK）、`.next` 状态中毒（清空后复现）、next 版本今日变更（09-10 安装）、:3000 HTTP 流量污染（全程 :3101）、残余进程（盘点为零）。

## 2. 修复步骤（文档化，不改任何代码/script）

### F1 dev EMFILE 已知问题文档化
- **AGENTS.md** 反模式节新增条目：dev 冷启 EMFILE 风暴的现象（EMFILE ~670 次 + `.next/dev` deleted 重启循环）、根因（watchpack 逐目录 watch × .pnpm 目录农场 5.8k 撞 macOS FSEvents 每进程流上限；非 fd 问题）、止血 `WATCHPACK_POLLING=true pnpm dev`（实测 0 EMFILE/HTTP 200）、上游 #93175 链接与 OPEN 状态（16.3.5 未修）、摘除条件（上游正式修复版落地后复测 30s 无 EMFILE 即可移除注记）
- **README.md / README.en.md** 开发段补「已知问题」短注：dev 冷启 EMFILE → `WATCHPACK_POLLING=true` 止血 + 上游 issue 链接；双语对齐
- **不改 package.json dev script**（主公裁定）

### F2 构建冻结反模式（并入同一次 AGENTS.md 编辑）
- **AGENTS.md** 反模式节新增条目：**主公 :3000 dev 服在线期间禁止在主 worktree 跑 `pnpm build`**——产线 build 清写 `.next` 连带删除 `.next/dev`，触发 dev 服 deleted 重启环（2026-09-19 实证）；波次构建一律独立 git worktree（沿 ../ttt-wa 模式）或与主公协调构建窗口

## 3. 门禁

- F1/F2 纯文档：`node tests/qa/commit-audit.mjs --branch dev` + `pnpm typecheck` + `pnpm lint` 必跑；vitest/build 免（零代码面，Tested trailer 说明）
- dev 冷启验证：调度者已于调查阶段实证（:3009 轮询对照 0 EMFILE/200），evidence 落档即可
- commit：Conventional + 中文正文（行宽 ≤100，WHY 含因果词）+ lore trailer（英文枚举，footer ≤100 折行）+ Plan footer；建议 `docs(agents+readme): dev EMFILE 已知问题与构建冻结反模式入档`；禁 --no-verify、禁 git add -A、主公侧 .gitignore/next-env.d.ts/glossary-context-md.md 不卷入

## 4. Rejected

- ❌ 改 package.json dev script（主公裁定只写文档）
- ❌ 升级 16.3.5（compare 实证未动 watcher 文件）
- ❌ 追 16.4.0-canary（生产项目不追 canary；watch #93175 等正式修复）
- ❌ node-linker=hoisted / virtual-store-dir 迁移（动全仓依赖布局 + Vercel 部署链重验，风险配不上收益）
- ❌ 重启机器验证（进程内 17 fd 证据表明非 fd 耗尽，大概率无效）

## 5. 沉淀

- `.omo/evidence/ulw/ulw-dev-emfile-watch/`：调查日志摘录（:3005 复现 677 EMFILE、:3009 轮询对照 0/200、watch-targets 空表含解释）
- `.omo/sessions.local.md` 事故段 + 本计划
- 后续：watch 上游 #93175，正式修复版落地后做「摘除轮询注记」后续波
