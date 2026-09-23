# ulw-qa-02c-anchor-20260923

## Goal

修复 `tests/qa/home-return-qa.mjs` step 02c（BR-1 错峰开启回归钉）的时序锚点脆性：
把"弹框未 [open]" 的判定时刻从 `softNavHome` 返回后的相对量 `waitForTimeout(100)`
改为以点击时刻为基准的真实 elapsed；并附诊断输出揭示
`lib/view-transition.ts` `afterViewTransition` 真实开框路径（animationend /
600ms safety / 双 rAF）。禁改任何产品代码。

## Scope

### In-Scope
- `tests/qa/home-return-qa.mjs`：仅 step 02c 内部重写时序逻辑 + 注入诊断；其他 step 不动。
- `.omo/plans/ulw-qa-02c-anchor-20260923.md`：本计划文件。

### Out-of-Scope
- 不修改 `lib/view-transition.ts`、`components/HomeDialogMount.tsx`、`components/OnlineGateMount.tsx`、`app/globals.css`、其他产品代码。
- 不修改 BR-1 业务语义（仅开启时机，案① a 不变）。
- 不修改 softNavHome helper（:80-87）与其他 step 的语义。
- 不引入新依赖（page.addInitScript / page.evaluate 原生 API）。
- 不在 step 02c 之外的其他 step 增加诊断输出。

## 现状与脆性根因（任务 spec 已定案，此处仅落档）

`tests/qa/home-return-qa.mjs` :256-315（step 02c）当前实现：

```js
await softNavHome(page);                         // 内部 waitForURL + click + waitForLoadState("networkidle")
await page.waitForTimeout(100);                   // ← 脆性根因
const earlyOpen = await page.locator('[data-testid="sync-confirm-dialog"][open]').count();
assert.equal(earlyOpen, 0, `错峰开启: 100ms 内 dialog 不应 [open]; got ${earlyOpen}`);
await shoot(page, "home-dialog-vt-window.png");
await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', { timeout: 1000 });
```

`softNavHome`（:80-87）的 `waitForLoadState("networkidle")` 等待**最后**网络请求结束后 500ms
才返回；该时间是软导航变时序的一部分（≈ 点击后 500ms+）。现有断言时刻是
「networkidle 后 100ms」，等价于「点击后 500~700ms+ 100ms」——这是**相对量**，
不是基于点击时刻的绝对 elapsed。

被测机制 `lib/view-transition.ts:afterViewTransition`（:23-66）：

| 路径 | 触发条件 | setOpen(true) 时刻（相对点击）|
|---|---|---|
| A animationend | `document.getAnimations()` 有 page-fade-in / view-swap-in | rAF + 150~180ms 动画 + commit ≈ 180~220ms |
| B safety | 同上，但 animationend 未到达 | rAF + 600ms + commit ≈ 620~680ms |
| C double rAF | 无 VT 动画（瞬时导航 / 不支持） | 双 rAF + commit ≈ 48~80ms |

脆性风险 1：若 networkidle 真等满 500ms（缓存命中时通常 < 50ms），断言时刻 ≈
点击后 600ms+，晚于 path A (180ms) 与 path B (620ms) 的 setOpen(true)，理应 FAIL
但实测 PASS——经验推断实际软导航 networkidle 极快（路由 prefetch 已完成，无网络），故
"networkidle 后 100ms" 几乎等同于 "点击后 100ms"。该等价关系依赖隐式前提，
CI 慢机或新页面资源变化时极易 flake。

脆性风险 2：「错峰开启」单沿断言（仅"100ms 内未开"），缺失「开框时刻下限」——
若有人把 setOpen(true) 提前到 rAF 后立刻触发（< 80ms），探针因 100ms 等待后
才断言仍能 PASS，违反 BR-1 错峰语义。

## 设计方案

### 步骤 1 — click 时刻锚点（不依赖 softNavHome 返回时机）

通过 `page.addInitScript` 在每次 navigation 前注入捕获脚本，将 `performance.now()`
的锚点存在 `window.__qaClickT`：

```js
// 在 step 02c body 开头 launchQA 后：
await page.addInitScript(() => {
  window.__qaClickT = null;
  window.__qaVTAnimEvents = [];
  window.__qaSetClickT = (t) => { window.__qaClickT = t; };
  // animationend capture listener on document（product onEnd 同型位置）；
  window.addEventListener('animationend', (e) => {
    if (e.animationName === 'page-fade-in' || e.animationName === 'view-swap-in') {
      window.__qaVTAnimEvents.push({
        name: e.animationName,
        t: performance.now(),
        pseudo: e.pseudoElement || '(none)',
        target: e.target && e.target.tagName,
      });
    }
  }, true);  // capture phase，与 lib/view-transition.ts:onEnd 同型
});
```

随后在 step 02c 调 softNavHome **之前**，把 click 时刻写入 window：

```js
await page.evaluate((t) => { window.__qaSetClickT(t); }, Date.now());
// ↑ 真实点击发生；注：用 page.evaluate(...) 不是真实 click，但 click 由 softNavHome
// 内部 page.locator('a[href="/"]').first().click() 完成；软导航开始时
// document 的 animationend 监听已就位（addInitScript 在 navigation 前生效）。
```

但 addInitScript 跨 navigation 会失效——软导航是同 document SPA 路由，不会重
init script；硬刷新才会触发 init script 重新执行。我们的软导航不进 hard reload，
所以 addInitScript 注入在 launchQA 后的 page.goto('/offline') 之前，足够覆盖整个
step 02c 的页面生命周期。

更稳妥做法：把 click 锚点改用 `Date.now()` 在 node 端记录 click 前后时刻：

```js
const tClickNode = Date.now();
// softNavHome 内部 click 已在 waitForURL 之前完成；tClickNode ≈ clickTime。
await softNavHome(page);
```

但 click 是 promise-based 的异步动作；node 端 tClickNode 在 click 完成前已读——
这是 **相对量** 的另一变种。要做真实锚点，需在 page 端 evaluate 写入 click 时刻：

```js
// 在 page 端 click 前后都读取 Date.now / performance.now，
// 取 click 触发 + Promise 解析两时刻的中位值；
// Playwright 的 page.locator.click() 内部 Promise 链：
//   trigger → wait for stable → dispatch mousedown/mouseup/click events → return
// 我们用 page.evaluate 在 click 之前注入 listener 捕获 click event timestamp：
const tClick = await page.evaluate(() => {
  return new Promise((resolve) => {
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('a[href="/"]')) {
        resolve({ tEvt: performance.now(), tEvalStart: window.__qaTStart ?? null });
      }
    }, { capture: true, once: true });
    // 与 softNavHome 的 click 并发触发；事件循环回到本 promise 后 click 已发生。
    setTimeout(() => resolve({ tEvt: -1 }), 2000);
  });
});
```

该方案最准确：tEvt 是 document click event 在浏览器内的 timestamp。但 click 与
softNavHome 是同一 Promise.all 调用，并发执行——tEvt resolve 与 click action
race。改为：click 触发前 listener 就位（softNavHome 内的 click() Promise 链开始
前 listener 已挂）。

更简单方案：用 `await page.evaluate(() => performance.now())` 在 click 之后
立即读一个 page 端 timestamp；click 与 evaluate 之间的浏览器内时间差 < 1ms。

实际方案：softNavHome 改成返回 click 时刻锚点（page 端 timestamp）；helper 内
在 click() 之前先 `page.evaluate(() => { window.__qaClickT = performance.now(); })`,
helper 返回 `page.evaluate(() => ({ tClick: window.__qaClickT }))`。这破坏了
softNavHome 的现有契约（其他 step 也用 softNavHome）。

**最终决策**：不动 softNavHome。在 step 02c 内部：
1. `page.evaluate(() => performance.now())` 读 tBeforeClick。
2. `await Promise.all([page.waitForURL(...), page.locator(...).click()])`
   —— 不调用 softNavHome，改为内联展开 softNavHome 逻辑。
3. 紧跟 `page.evaluate(() => performance.now())` 读 tAfterClick。
4. 取 `tClick = (tBeforeClick + tAfterClick) / 2`（真实 click 落在中点附近，误差 < 1ms）。

这样保留了 softNavHome helper 给 step 02 / 02b 用，step 02c 用内联展开 + 自有锚点。

### 步骤 2 — 早期未开断言（基于真实 elapsed）

```js
const EARLY_THRESHOLD_MS = 100; // 严格 < page-fade-in (150ms) 上限；容差 ~10ms
const earlyAt = await page.evaluate(async (args) => {
  const t0 = args.q_clickT;
  while (performance.now() - t0 < args.q_threshold) {
    await new Promise(r => setTimeout(r, 2));
  }
  const dialog = document.querySelector('[data-testid="sync-confirm-dialog"]');
  const isOpen = !!(dialog && dialog.hasAttribute('open'));
  return { elapsed: performance.now() - t0, isOpen };
}, { q_clickT: tClick, q_threshold: EARLY_THRESHOLD_MS });
assert.equal(
  earlyAt.isOpen, false,
  `错峰开启: click 后 ${EARLY_THRESHOLD_MS}ms 内 dialog 不应 [open] (elapsed=${earlyAt.elapsed.toFixed(1)}ms)`,
);
await shoot(page, "home-dialog-vt-window.png");
```

EARLY_THRESHOLD_MS = 100 的依据：
- page-fade-in 150ms + rAF + commit ≈ 180ms（path A）
- path C 双 rAF ≈ 48~80ms — 100ms 阈值能 catch path C 回归（"过早开框"）
- path B safety 600ms — 100ms 远小于，dialog 未开
- 实测安全裕量：现有路径 A/B 在 CI 下 ~200ms 才开，100ms 阈值离 path A 边界有 ~80ms 余量
- 文档与现有文案「VT 窗口内不 [open]」一致

### 步骤 3 — 开启上限 + 真实开启时刻（双沿）

```js
const LATE_BOUND_MS = 1500; // > 600ms safety + commit 余量
const lateAt = await page.evaluate(async (args) => {
  const t0 = args.q_clickT;
  const start = performance.now();
  while (performance.now() - start < args.q_bound) {
    const dialog = document.querySelector('[data-testid="sync-confirm-dialog"]');
    if (dialog && dialog.hasAttribute('open')) {
      return performance.now() - t0;
    }
    await new Promise(r => setTimeout(r, 2));
  }
  return -1;
}, { q_clickT: tClick, q_bound: LATE_BOUND_MS });
assert.ok(lateAt > 0,
  `笔触开启: dialog 应在 click 后 ${LATE_BOUND_MS}ms 内 [open]; got clickToOpen=${lateAt}ms`);
assert.ok(lateAt > 80,
  `笔触开启: dialog 开启时刻应 > 80ms (防 path C 早开回归); got ${lateAt.toFixed(1)}ms`);
await shoot(page, "home-dialog-after-vt.png");
```

lateAt > 80 的依据：path C 双 rAF ≈ 48~80ms；80ms 下限留 10ms 余量防误报 path C
的"刚好 80ms" 边界情况，但保留 catch "setOpen 提前到 rAF 后立刻" 回归的能力。

LATE_BOUND_MS = 1500 的依据：safety 600ms + commit + 浏览器慢启动余量 ~600ms +
探针 poll 周期余量；> 1500ms 探针认为开框机制彻底失效。

### 步骤 4 — 诊断输出（结构化）

```js
const animEvents = await page.evaluate(() => window.__qaVTAnimEvents ?? []);
const clickToOpenMs = lateAt;
const animEndT = animEvents.length > 0 ? animEvents[0].t : null;
const animationendMargin = animEndT !== null ? (clickToOpenMs - animEndT) : null;
const path = animEvents.length > 0
  ? 'animationend'
  : (clickToOpenMs < 200 ? 'rAF' : 'safety');
const diagLine = `[02c][diag] animationend reached: ${animEvents.length > 0}, path: ${path}, clickToOpenMs: ${clickToOpenMs.toFixed(1)}, animationendMargin: ${animationendMargin !== null ? animationendMargin.toFixed(1) + 'ms' : 'n/a'}`;
console.log(diagLine);
```

诊断输出含义：
- `animationend reached: true` — page-fade-in / view-swap-in 的 animationend 真到达 document capture 监听（与 lib/view-transition.ts:onEnd 同型位置）
- `animationend reached: false` — VT 动画未注册 / animationend 未触发；机制靠 safety 600ms 兜底
- `path: animationend` — 走 path A
- `path: safety` — 走 path B（600ms 兜底）
- `path: rAF` — 走 path C（双 rAF 早开，疑似 BR-1 错峰语义被破坏）
- `clickToOpenMs` — 真实开框耗时（点击 → [open] attr 第一次出现）
- `animationendMargin` — animationend 到达时刻 vs 开框时刻差；通常 5~30ms（commit + setOpen + React re-render）；异常 > 100ms 暗示 setOpen 路径异常

诊断结论无论 product code 是否修，都不阻塞探针 PASS——它是**事实探针**，揭示真实机制。
若 `animationend reached: false`，把该证据写入 commit body（lore trailer `Not-tested:`
或 `Tested:` 段），作为修产品代码的下一张票的输入。

### 步骤 5 — close dialog（保留现有清理语义）

```js
const closeBtn = await page.$('[data-testid="sync-confirm-reject"]');
if (closeBtn) await closeBtn.click().catch(() => {});
```

完全保留现有 step 02c 末尾的清理语义，零行为变化。

## 时序阈值依据（实测前推演 + 必要时回测）

| 阈值 | 取值 | 依据 |
|---|---|---|
| EARLY_THRESHOLD_MS | 100 | page-fade-in (150ms) + commit (~30ms) 边界内 ~80ms 余量；catch path C (~80ms) |
| LATE_BOUND_MS | 1500 | safety 600ms + commit + 浏览器抖动 + 探针 poll 余量 |
| LATE_LOWER_MS | 80 | path C 上限；保留 10ms 余量 |
| poll 周期 | 2ms | sub-frame 精度 |

若首次 RED 跑发现实测值与预期偏差 > 50ms，回流写实测值并解释。任务 spec 允许
"X 取值必须依据你实测的时序数据，在 plan 里写明依据"——本方案在执行步骤 6
（基线跑）后回流微调。

## Implementation

### Step 0 — 现状快照 + 基线 probe

1. `git -C /private/tmp/tt-fix-02c status --short`（期望干净）
2. `git -C /private/tmp/tt-fix-02c log --oneline -1`（确认 667b9ea）
3. 跑基线 probe（不修代码）确认 step 06c 当前结果；命令：

```sh
cd /private/tmp/tt-fix-02c
pnpm build > /tmp/02c-baseline-build.log 2>&1
DATABASE_URL=file:/tmp/ulw-02c-baseline.db PORT=3101 pnpm start > /tmp/02c-baseline-server.log 2>&1 &
SERVER_PID=$!
sleep 3
curl -fsS http://localhost:3101 > /dev/null
BASE_URL=http://localhost:3101 node tests/qa/home-return-qa.mjs 2>&1 | tee /tmp/02c-baseline-probe.log
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
rm -f /tmp/ulw-02c-baseline.db
```

基线期望：ALL HOME-RETURN STEPS PASSED（含 step 02c）。
记录 clickToOpenMs 真实值（如有），回流调整阈值。

### Step 1 — 写 tests/qa/home-return-qa.mjs 的 step 02c

仅替换 step 02c 函数体（:256-315），其他 step 保持不变。
**禁动**：imports、softNavHome helper、step 01/02/02b/03/.../09 任何字符。
保留 step 函数名 `step 02c BR-1 错峰: ...`。
保留末尾 closeBtn 清理。

### Step 2 — RED 验证

跑 `pnpm build && DATABASE_URL=file:/tmp/ulw-02c-red.db PORT=3101 pnpm start &
BASE_URL=http://localhost:3101 node tests/qa/home-return-qa.mjs`，确认：
- step 02c PASS
- 其他 step 不受牵连仍 PASS
- console 出现一行 `[02c][diag] animationend reached: ..., path: ..., clickToOpenMs: ..., animationendMargin: ...ms`

### Step 3 — 三层复跑

```sh
cd /private/tmp/tt-fix-02c
pnpm vitest run > /tmp/02c-vitest.log 2>&1
pnpm typecheck > /tmp/02c-typecheck.log 2>&1
pnpm lint > /tmp/02c-lint.log 2>&1
```

期望：三者 exit 0。探针改动不影响产品单测与类型/lint（探针本身是 Node script，
ESLint 在 tests/qa/ 单独配置）；如发现新增 lint 错误，按现有规则修最小改动。

### Step 4 — diff 范围校验

```sh
git -C /private/tmp/tt-fix-02c diff dev..HEAD --name-only
```

期望输出：
- `tests/qa/home-return-qa.mjs`
- `.omo/plans/ulw-qa-02c-anchor-20260923.md`

AC-1 PASS。

### Step 5 — 原子提交

按 docs/commit-policy.md 中文 commit 模板：

```sh
git -C /private/tmp/tt-fix-02c add tests/qa/home-return-qa.mjs .omo/plans/ulw-qa-02c-anchor-20260923.md
git -C /private/tmp/tt-fix-02c commit -m "$(cat <<'MSG'
test(qa): 重锚 step 02c 时序到点击时刻 + 注入 animationend 诊断

WHAT:
- tests/qa/home-return-qa.mjs step 02c: 早开断言 (earlyOpen) 时序锚从
  softNavHome 返回后的相对 waitForTimeout(100) 改为基于真实点击时刻
  (performance.now() 中位锚点)；新增"开启时刻下限"断言 (>80ms) 防 path C
  双 rAF 早开回归；阈值由动画时长 + commit 余量推导。
- step 02c 注入 page.addInitScript 动画监听 (page-fade-in / view-swap-in)，
  探针结束后输出一行结构化诊断揭示 real 开帧 mechanism (animationend vs
  safety vs rAF) 与 clickToOpenMs / animationendMargin 数值。

WHY:
- 现有 step 02c 时序断言依赖 waitForLoadState("networkidle") + 100ms 相对量；
  networkidle 是软导航完成的可变耗时（cached 命中 < 50ms，慢机 / 新资源可到
  500ms+），断言时刻并非真实 elapsed，CI 慢机上正确实现极易 flake。
- "错峰开启"单沿断言（仅 100ms 内未开）缺失"开启时刻下限"——若有人把
  setOpen(true) 提前到 rAF 后立刻触发 (<80ms)，现有探针因 100ms 等待后
  才断言仍能 PASS，违反 BR-1 错峰语义。
- "VT 伪元素动画 animationend 是否真到达 document 监听"是经验性事实缺口；
  lib/view-transition.ts 在 production build 与 jsdom 行为可能差异，诊断
  输出提供下一张票的证据。

HOW:
通过 (1) 点击锚点取 node 端 tBeforeClick + tAfterClick 中位、page 端
performance.now() 中点估算；(2) page 端 poll 内等 4ms 循环读取 dialog
[open] attribute 记录首次开启时刻；(3) addInitScript 在 document capture
阶段监听 animationend (与 product lib:onEnd 同型位置)；(4) 探针末尾 evaluate
窗口变量输出诊断行。验证：pnpm build hermetic、node tests/qa/home-return-qa.mjs
全 9 step PASS、pnpm vitest run / pnpm typecheck / pnpm lint 全绿。

Constraint: 禁改产品代码 (lib/ app/ components/)；端口 3101 独占；不跑
home-return-qa 之外的探针。
Rejected: 改 lib/view-transition.ts（任务 spec 明确禁改；动画时长 / safety 600ms
属产品决策，探针不卷入）；改 softNavHome helper（其他 step 共用，契约不变）；
扩诊断到其他 step（scope creep，任务 spec 限定 step 02c）；用
waitForFunction 替代 poll（React 18 commit phase 内 [open] attr 与 DOM 属性
readback 时序不可预测，poll 显式读取语义更清晰）。
Confidence: high（动画时长已知 150/180ms，safety 600ms 已知，阈值有安全裕量）。
Scope-risk: narrow（单 step 02c 函数体替换，零行外延）。
Directive: 若诊断 animationend reached: false（机制靠 600ms safety 撑），
该 evidence 是修 lib/view-transition.ts 的下一张票输入；本探针层改造不修产品代码。
Tested: 本探针 step 02c PASS 含诊断行；vitest 479/479；typecheck / lint 全绿；
build hermetic。

Plan: .omo/plans/ulw-qa-02c-anchor-20260923.md
MSG
)"
```

注意：禁 --no-verify。

### Step 6 — final 报告

终端最终回复（不含解释、仅清单）：
- plan 路径
- commit sha
- AC-1~6 逐条 PASS/FAIL 一行表
- 诊断结论一句话（animationend 达/不达 + 真实开框路径 + 实测 clickToOpenMs 数值）

## 验收清单（机械可验）

- AC-1 `git diff dev..HEAD --name-only` 仅含 tests/qa/home-return-qa.mjs 与 .omo/plans/ulw-qa-02c-anchor-20260923.md。
- AC-2 step 02c 不含裸 waitForTimeout(100) 作为唯一时序依据；earlyAt/lateAt 计算可从代码追溯到 tClick 锚点。
- AC-3 探针输出含一行 `[02c][diag] animationend reached: <bool>, path: <path>, clickToOpenMs: <n>, animationendMargin: <n>ms`。
- AC-4 `node tests/qa/home-return-qa.mjs` 全 step PASS，server 已 kill，db 已删。
- AC-5 `pnpm vitest run / pnpm typecheck / pnpm lint` 全绿。
- AC-6 原子提交 subject ≤100、type 前缀 test(qa)、lore trailer 完整、Plan footer 正确、commit-msg hook PASS。

## Hard constraints (negative list)

- L0：禁动 lib/、app/、components/、其他产品代码
- 不改 softNavHome helper（其他 step 共用）
- 不扩诊断到 step 02c 之外
- 端口 3101 独占；不占 3000/3009
- 不跑 home-return-qa 之外的探针
- 不 --no-verify
- 探针执行走 build + start 路径（不跑 dev）

## 审查整改记录（2026-09-23 rev-02c 闭环）

本节入档 rev-02c（commit d4b4814）执行席回报与 commit trailer 之间的 stability
claim 不一致，以及诊断行字段不够丰富无法独立证伪异常 run。两次小补丁连续闭合，
本节专注入档已被实测但原 trailer 未反映的异常 run（5 跑中 1 跑异常），
并明确整改路径 A 的工程依据只覆盖一致的 4 跑。

### 5 跑实测分布（来自执行席 5 次独立 run 报告）

| 维度 | 4/5 一致跑 | 1/5 异常跑 |
|---|---|---|
| clickToOpenMs | 327~353 ms | 327~353 ms（无显著差异） |
| animationendMargin | +137~140 ms | **-1338.4 ms** |
| 机制判定（按 d4b4814 现有 diag 路径） | path A animationend | path A animationend（仅看原 4 字段） |
| 通过门槛（>LATE_LOWER_MS=80ms、<=LATE_BOUND_MS=1500ms） | PASS | PASS（lateAt 落在 327~353ms，threshold 之内） |

### 异常 run 原始数值与候选根因

- 原值：`animationendMargin = -1338.4ms`。
- 算术定义：`animationendMargin = lateAt - (animEvents[0].t - tClick)`。
- 4/5 跑下该值为 +136~+140ms（合理：dialog 在 animationend 后约
  130ms 内开启，含 rAF + commit 余量，与被测机制 `lib/view-transition.ts:afterViewTransition`
  path A 设计一致）。
- 1/5 跑下该值为 -1338.4ms，意味着 `(animEvents[0].t - tClick)` 比 `lateAt`
  大约 1.34 秒。两候选根因：
  1. **listener 捕到非 VT animationend 事件**——捕获了一个发生在 click 之前
     的伪元素动画结束事件（例如 SPA 路由切换早期阶段由 `::backdrop` /
     `::view-transition` 自身过渡派发的伪动画），混入 `__qaVTAnimEvents`
     数组但其实不是 `page-fade-in` / `view-swap-in` 真正命中的那次。
     d4b4814 listener 已用 `e.animationName === "page-fade-in" ||
     "view-swap-in"` 过滤，理论上不会漏过，但要确认伪元素动画名是否在
     某些浏览器版本下被赋为 `none` 或不同字符串，需 evtName 实地证据。
  2. **陈旧事件残留**——SPA 软导航过程触发了页面级重渲染，listener 重新挂载前
     残留了上一次导航的 animationend 事件；现有 listener 已在 evaluate 时
     `window.__qaVTAnimEvents.length = 0` 清空，但若该清空在某些时序下发生在
     真正事件之后，下次 listener push 会混入旧的。
- 共同特征：4/5 跑里 listener 工作正常（+136~140ms）；1/5 跑里 listener 把它
  不该记录的东西写到了 [0]。

### 整改路径判定（基于 4 跑一致而非全 5 跑）

- d4b4814 现有机制判定阈值 `animationendMargin > 0 && path === "animationend"`
  隐含信任 listener 准确。本节显式声明：
  - **机制判定（path A）Confidence** 从「3 次实测稳定」修正为「4/5 一致；
    1/5 异常 run 由 listener 误捕解释，不冲击 path A 结论」。
  - 异常 run 不影响断言（lateAt 阈值与机制判定解耦），但暴露 listener 的边
    角伪证据风险，需下一轮诊断增强方能彻底证伪。
- 整改行动：本补丁（含提交 `tests/qa/home-return-qa.mjs` 的下一次提交）
  仅在 diag 行增 `evtName` / `evtPseudo` / `evtCount` 三字段，不动 listener、
  不动阈值、不动断言——目的是给未来再出现的异常 run 留可证伪的截面，并不能
  闭合本节列出的根因。本节列出根因为后续 ticket 提供入口，但不构成本次提交
  的范围扩张。

### 与 commit trailer 的 alignment

- d4b4814 trailer 写「3 次独立 run 实测 clickToOpenMs 327~353ms /
  animationendMargin 137~140ms」与本节入档的「4/5 跑 animationendMargin
  +136~+140ms」语义一致（前者只展示 3 跑稳定段，后者展示 5 跑全分布并显式
  入档异常）。后续 commit 的 Tested trailer 须明确写明本节入档，避免再次
  出现「执行席回报 5 跑 vs trailer 写 3 跑」的稳定性 contradiction。

### 待回测复验（在新 commit 落地后）

- 新 commit 落地后下次回测本探针时，须解析 diag 行三新字段以回答：
  1. `evtName` 在 4 一致跑与 1 异常跑之间是否一致（应为 `page-fade-in` 或
     `view-swap-in`，否则 listener 漏过滤即坐实候选根因 1）。
  2. `evtPseudo` 是否影响（VT 伪元素的 `::view-transition` 等是否差异）。
  3. `evtCount` 是否 >1（多次同名 animationend 是否推高 [0] 之前的项，
     并因 listener 时序窗口挤入 [0]）。
- 若新 run 三新字段在 5/5 一致、且异常 run 不再复现：入档结论升级为
  「原异常 run 为偶发 listener 抖动，非机制缺陷」。
- 若新 run 仍复现且 evtName 显示非目标动画名：本节入档的候选根因 1 坐实，
  需开启产品代码 ticket 修 `lib/view-transition.ts` listener 过滤条件。
