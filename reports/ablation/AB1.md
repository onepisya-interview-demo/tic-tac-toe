# AB1 — VT 接线可安全回退（降级路径成立）

## 目的

证明 `feat(app): 四页接线 React 19 <ViewTransition>`（commit `f45ddbf`）在生产构建 + 关键探针（hydration-check / stats-race）下是**纯 addon**——摘除不影响契约。回退路径若全绿，VT 接线就不属于功能关键，可视为优化层。

## patch 摘要

`git revert --no-commit f45ddbf` 后 git 状态：

```
M  DESIGN.md
M  app/page.tsx
M  app/play/page.tsx
M  app/result/page.tsx
M  app/solo/page.tsx
```

`git diff --cached --stat`：

```
 DESIGN.md           | 2 --
 app/page.tsx        | 3 ---
 app/play/page.tsx   | 3 ---
 app/result/page.tsx | 3 ---
 app/solo/page.tsx   | 3 ---
 5 files changed, 14 deletions(-)
```

仅移除每个 page.tsx 的 `<ViewTransition>` wrapper 与 DESIGN.md §5 表新增的一行 VT 说明。**0 字节触及核心逻辑**（lib/store.ts / lib/db.ts / components/** / app/api/** 全部未动）。

## 命令

```sh
git worktree add -b ablation/exp ../ttt-ablation main
cd ../ttt-ablation
git revert --no-commit f45ddbf
pnpm install --frozen-lockfile
pnpm build
pnpm start &
SERVER_PID=$!
# 等 readiness
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s --max-time 1 http://127.0.0.1:3000/api/stats >/dev/null 2>&1; then
    echo "READY after ${i}s"; break
  fi
  sleep 1
done
node tests/qa/hydration-check.mjs
node tests/qa/stats-race-qa.mjs
lsof -ti:3000 | xargs kill
git revert --abort
```

## 输出尾行

`pnpm build`：

```
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 3.1s
  Finished TypeScript in 2.0s
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/stats
├ ƒ /api/stats/outcome
├ ○ /apple-icon
├ ○ /icon.svg
├ ○ /manifest.webmanifest
├ ○ /play
├ ƒ /result
└ ○ /solo
```

`node tests/qa/hydration-check.mjs`：

```
first player who won: X
console errors (non-hydration): 1
hydration warnings: 0
HYDRATION CHECK PASS
EXIT=0
```

`node tests/qa/stats-race-qa.mjs`：

```
STEP: 01 reset via DELETE (pre-setup) ... PASS 114ms
STEP: 02 SW-only intercepts GET (A1, B-1 regression) ... PASS 2477ms
STEP: 03 event-driven nav (no setTimeout — B-2 regression) ... PASS 1366ms
STEP: 04 RSC reads DB on every nav (B-3a regression) ... PASS 2165ms
STEP: 05 resetAll awaited + refresh (B-3b regression) ... PASS 623ms
STEP: 06 multi-POST {outcome} ordering under slow DB (D4) ... PASS 237ms
STEP: 07 cross-mount no leaked state (D5) ... PASS 1682ms
STEP: 08 manual nav race (D3) ... PASS 2188ms
STEP: 09 SW activation race (E1) ... PASS 2377ms
STEP: 10 reset button on / refreshes (B-3b path 2) ... PASS 606ms
STEP: 11 cross-session persistence (close + reopen) ... PASS 2915ms
STEP: 12 SW skip-api equivalent (POST count = 1) ... PASS 2246ms
STEP: 13 StatsGrid not subscribed to store (D6) ... PASS 555ms
STEP: 14 DOM === API after every nav (B-1+B-2+B-3 combo) ... PASS 5697ms

=== QA SUMMARY: 14 PASS / 0 FAIL / 14 total ===
```

## 判定

**绿**——hydration-check 0 hydration warning；stats-race 14/14 PASS。

VT 接线在生产构建 + 关键探针下可安全摘除，回退路径不破坏任何契约。降级矩阵：page-fade-in CSS 动画（@supports 块内）在旧浏览器降级；`<main>` 仍带 `page-shell page-fade-in`；TypeScript 严格性未变；路由结构（4 页面 + 2 API）未变。VT 是纯视觉增强。

## 还原证明

```
$ git revert --abort
$ git status --short
(empty)
$ git rev-parse HEAD
f8fd69e084057b2019380ed67179a1690e6f4f7f
$ git diff --stat
(empty)
```

工作树恢复 commit `f8fd69e`（main 尖端），worktree 内 0 增量。
