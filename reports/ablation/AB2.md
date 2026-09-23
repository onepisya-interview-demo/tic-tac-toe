# AB2 — solo 零写探针的对抗有效性

## 目的

证明 `tests/qa/solo-mode-qa.mjs` 步 03 的 **零写断言**（`soloWriteCount === 0` + `url endsWith '/solo'` + `localStorage xWins=1`）是真实对抗的，不是「为过测试而测试」。如果人为给 solo 注网络写，探针必须红。

## patch 摘要

`lib/store.ts` 两处 solo 分支（win + draw）注入 `await apiRecordOutcome(...)`，模拟回归——solo 不再遵守"零网络写"契约：

```diff
@@ win solo branch @@
         internalStats = recordOutcome(internalStats, win.player);
         persistSoloStats(internalStats);
+        // [AB2 SIM] regression: solo also issues a network write
+        await apiRecordOutcome(win.player);
         return;
@@ draw solo branch @@
         internalStats = recordOutcome(internalStats, 'draw');
         persistSoloStats(internalStats);
+        // [AB2 SIM] regression: solo also issues a network write
+        await apiRecordOutcome('draw');
         return;
```

## 命令

```sh
# worktree 已在 ../ttt-ablation
python3 -c '...apply patch via str.replace...'
pnpm build
pnpm start &
node tests/qa/solo-mode-qa.mjs
lsof -ti:3000 | xargs kill
git checkout -- lib/store.ts
```

## 输出尾行

`pnpm build`：exit 0，路由表不变。

`node tests/qa/solo-mode-qa.mjs`：

```
STEP: 01 home dual CTA (start-game + start-solo) ... PASS 763ms
STEP: 02 ranked ledger reset (baseline for isolation check) ... PASS 24ms
STEP: 03 solo win: zero write requests, inline banner, localStorage xWins=1 ... FAIL 2899ms -- solo issued 1 write request(s); expected 0

1 !== 0


QA FAILED: solo issued 1 write request(s); expected 0

1 !== 0


=== QA SUMMARY: 2 PASS / 1 FAIL / 3 total ===
```

## 判定

**红**——步 03 在写事件计数维度被断言 `assert.equal(soloWriteCount, 0, ...)` 抓到，错误消息 `1 !== 0` 直指回归源。

证据：探针通过 `page.on("request", ...)` 监听 outbound `(POST /api/stats/outcome) | (PUT /api/stats) | (DELETE /api/stats)` 三类写请求并累加 `soloWriteCount`。人为注写使 POST +1，断言秒抓。探针有效。

非零写断言（`soloWriteCount === 0`）与零导航断言（`url endsWith '/solo'`）双管齐下，本轮只触发了前者；后者在 AB3 触发（更严重的失败模式）。

## 还原证明

```
$ git checkout -- lib/store.ts
$ git status --short
(empty)
$ git diff --stat
(empty)
```

工作树 clean，HEAD 仍在 `f8fd69e`。
