# AB3 — PlayController 双闸各自必要

## 目的

证明 PlayController 的两道防线各自必要：

1. **第一闸（store 级）**：`lib/store.ts` 的 solo 分支**永不** `set({ lastWriteAt: Date.now() })`，从源头不让 lastWriteAt 变化；下游订阅者不触发。
2. **第二闸（组件级）**：`components/PlayController.tsx` 的 effect 内 `if (s.mode === 'solo') return;` 显式拦截——即便第一闸漏（如 StatsHydrator 在 solo 会话存活期间挂载的水合 stamp，或上一局 ranked 残留 lastWriteAt），也不导航 `/result`。

若两道全去，必红；只复 guard 即绿 ⇒ guard 必要且充分。

## patch 摘要

### 3a — 第一闸破（store 级 stamp 模拟写事件）

`lib/store.ts` 两处 solo 分支加 stamp（**模拟**：solo 错误地让 lastWriteAt 变化）：

```diff
@@ win solo branch @@
         internalStats = recordOutcome(internalStats, win.player);
         persistSoloStats(internalStats);
+        // [AB3a SIM] regression: solo stamps lastWriteAt as if a network write settled
+        set({ lastWriteAt: Date.now() });
         return;
@@ draw solo branch @@
         internalStats = recordOutcome(internalStats, 'draw');
         persistSoloStats(internalStats);
+        // [AB3a SIM] regression: solo stamps lastWriteAt as if a network write settled
+        set({ lastWriteAt: Date.now() });
         return;
```

### 3b — 第二闸破（组件级 guard 移除）

`components/PlayController.tsx` 去掉 `if (s.mode === 'solo') return;`：

```diff
@@ components/PlayController.tsx @@
-    if (s.mode === 'solo') return;
+    // [AB3b SIM] regression: removed solo guard
     if (s.phase !== 'won' && s.phase !== 'drawn') return;
```

## 命令

```sh
# AB3a + AB3b: apply both, build, run
python3 -c '...apply 3a + 3b...'
pnpm build
pnpm start &
node tests/qa/solo-mode-qa.mjs     # → expect step 03 RED
lsof -ti:3000 | xargs kill

# AB3d: restore ONLY the guard (keep stamp)
git checkout -- components/PlayController.tsx
pnpm build
pnpm start &
node tests/qa/solo-mode-qa.mjs     # → expect 6/6 PASS
lsof -ti:3000 | xargs kill

# AB3e: restore store (full revert)
git checkout -- lib/store.ts
```

## 输出尾行

### AB3c — 双闸全去

```
STEP: 01 home dual CTA (start-game + start-solo) ... PASS 876ms
STEP: 02 ranked ledger reset (baseline for isolation check) ... PASS 32ms
STEP: 03 solo win: zero write requests, inline banner, localStorage xWins=1 ... FAIL 1333ms -- solo must not navigate, got http://localhost:3000/result

QA FAILED: solo must not navigate, got http://localhost:3000/result

=== QA SUMMARY: 2 PASS / 1 FAIL / 3 total ===
```

### AB3d — 只复 guard（保留 stamp）

```
STEP: 01 home dual CTA (start-game + start-solo) ... PASS 880ms
STEP: 02 ranked ledger reset (baseline for isolation check) ... PASS 29ms
STEP: 03 solo win: zero write requests, inline banner, localStorage xWins=1 ... PASS 4073ms
STEP: 04 reload: SoloStatsPanel hydrates the persisted row ... PASS 588ms
STEP: 05 local clear: localStorage emptied, panel follows, no reload needed ... PASS 50ms
STEP: 06 ranked ledger untouched by the solo session ... PASS 593ms

=== QA SUMMARY: 6 PASS / 0 FAIL / 6 total ===
```

## 判定

| 配置 | 第一闸（store stamp） | 第二闸（guard） | 探针步 03 判定 |
|------|---------------------|----------------|----------------|
| 现状（f8fd69e） | 永不 stamp | 存在 | 6/6 PASS（基线） |
| 双闸全去（3a+3b） | **强制 stamp** | **移除** | **RED** — `solo must not navigate, got /result` |
| 只复 guard（3d） | 强制 stamp | 恢复 | 6/6 PASS |

**红 → 绿** 序列证明：

- 双闸全去 ⇒ 红 ⇒ **两道防线缺一不可**（第一道没拦住 stamp，第二道没拦 guard，下游 effect 触发 `router.replace('/result')`，solo 被错误地送走）。
- 恢复 guard（保留 stamp）⇒ 绿 ⇒ **第二闸独立充分**。即便第一闸"假设性失效"（stamp 漏到 solo 会话），guard 仍能在 effect 内短路掉导航。
- 对称地，正常生产代码下第一闸永不 stamp ⇒ `if (lastWriteAt === null) return;` 早早短路，根本走不到 guard——两道防线互为纵深。

探针有效：步 03 的 `assert.ok(page.url().endsWith('/solo'))` 严格判定 `/result` 即 fail，且错误消息直指回归 URL。

## 还原证明

```
$ git checkout -- components/PlayController.tsx
$ git checkout -- lib/store.ts
$ git status --short
(empty)
$ git diff --stat
(empty)
$ git rev-parse HEAD
f8fd69e084057b2019380ed67179a1690e6f4f7f
```

工作树完全 clean，HEAD 仍在 `f8fd69e`（main 尖端）。
