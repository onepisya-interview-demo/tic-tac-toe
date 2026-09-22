# ulw-modal-collision-and-error-alerts-20260923

## Goal
修复 tic-tac-toe 仓库的两个 UX 缺陷：(1) 三弹框在 React `<ViewTransition>` 路由过渡期间 `showModal()` 导致「穿模」；(2) 网络超时/错误行用 `text-small text-text-secondary` 灰文本不醒目。BR-1 业务语义保持不变。

## Scope

### In-Scope
- `app/globals.css`：新增 danger 配色 token；::backdrop 选器泛化到三弹框
- `DESIGN.md` §1 Color Tokens：新增 danger 行
- `components/ui/Alert.tsx`：新增（danger 变体，内联 SVG 图标，role=alert）
- `components/RoomGateDialog.tsx`：错误行 → Alert（data-testid 保持 `room-gate-error`）
- `components/SyncConfirmDialog.tsx`：错误行 → Alert（data-testid 保持 `sync-confirm-error`）
- `components/ResetRoomStatsButton.tsx`：错误行 → Alert（data-testid 保持 `reset-room-error`）；超时独立文案
- `lib/store.ts`：新增 `outcomeError: { reason, at } | null` 状态 + setOutcomeError action；online 记局失败时填入，restart / startGame / setOutcomeError(null) 时清
- `components/OutcomeErrorBanner.tsx`：新增（client，读 store；render Alert + 关闭按钮）
- `app/online/page.tsx`：挂载 OutcomeErrorBanner（在线对战可能触发出错）
- `app/result/page.tsx`：挂载 OutcomeErrorBanner（结果页也能看到战报保存状态）
- `lib/view-transition.ts`：新增 `afterViewTransition(callback)` 工具（监听 animationend of `page-fade-in`/`view-swap-in`，600ms 安全上限）
- `components/HomeDialogMount.tsx`：挂载 effect 的 `setOpen(true)` 走 afterViewTransition（仅设置 React state 推迟，对话框 mount 内 effect 仍按 open=true 走 showModal，但多挂一次 frame-after-VT 守卫）
- `components/OnlineGateMount.tsx`：同上
- `tests/qa/home-return-qa.mjs`：新增 step 02c「穿模错峰回归探针」——断言 t=100ms 内 dialog 不 [open]、t=350ms 后 [open]
- `tests/store/store.test.ts`：新增 outcomeError 翻转断言
- `components/ResetRoomStatsButton.test.tsx`：新增 R4-aborted 分支（mock aborted → 断言独立 timeout 文案）

### Out-of-Scope
- 不引入任何第三方库（AGENTS §L0-5）；Alert 用自有 Tailwind + 内联 SVG
- 不改路由命名（`/online`/`/offline`/`/result` 保留）
- 不改 BR-1 业务语义——只改触发时机
- 不动 9fe08aa 路由确认弹框（ResetRoomStatsButton 在 /result 点击触发，不在 VT 同窗）
- 不做可选 @starting-style（案① d 不强制）
- 不动 SSR 首帧渲染策略
- 不引入新水合触发点

## Hard constraints (negative list)
- L0：service/transport 分离契约不变；SSR 首帧禁读 localStorage；Server Component 默认
- L0：不引入新 UI/路由/动画/数据访问/表单库
- 不引入 div onClick、emoji 图标、组件级 focus ring
- 不 `--no-verify`；commit 走 commit-msg hook
- 探针保持向后兼容——保留旧 testid 与 role

## Implementation

### Step 1 — globals.css 配色与 ::backdrop 泛化
**文件**：`app/globals.css`
**WHY**：
- 案② a：@theme 新增 danger 配色，正文色对比度 ≥4.5:1 on bg-elevated #141414
- 案① c：选器泛化让三个弹框共享 figure-ground 底色
**HOW**：
```css
/* 加在 @theme 块内： */
--color-danger: #F87171;            /* text/foreground: rgb(248,113,113) — 对比度 ≈8.55:1 vs bg-elevated #141414，远超 4.5:1 */
--color-danger-strong: #FCA5A5;     /* 强调色，更亮一档 */
--color-danger-surface: rgba(248, 113, 113, 0.12);  /* 背景低饱和 */
--color-danger-border: rgba(248, 113, 113, 0.35);   /* 边框 */

/* 替换原 dialog[data-testid="sync-confirm-dialog"]::backdrop 为： */
dialog[data-testid="sync-confirm-dialog"]::backdrop,
dialog[data-testid="room-gate-dialog"]::backdrop,
dialog[data-testid="reset-room-dialog"]::backdrop {
  background-color: color-mix(in oklab, var(--color-bg-base) 70%, transparent);
}
```
**VERIFY**：`pnpm typecheck && pnpm lint` 0 error；`grep 'color-danger' app/globals.css` 4 行

### Step 2 — DESIGN.md 色表同步
**文件**：`DESIGN.md` §1 Color Tokens
**WHY**：与 globals.css 同步，避免设计 / 实现漂移
**HOW**：在表内新增行：
```
| `danger` | `#F87171` (red-400) | 错误提示文字、边框（dark-bg 对比度 ≥4.5:1） |
| `danger-strong` | `#FCA5A5` (red-300) | 错误强调 |
| `danger-surface` | `rgba(248,113,113,0.12)` | 错误块背景 |
| `danger-border` | `rgba(248,113,113,0.35)` | 错误块边框 |
```
**VERIFY**：`grep danger DESIGN.md | wc -l` ≥4

### Step 3 — 新建 components/ui/Alert.tsx
**WHY**：统一错误块 UI 契约；三处错误行同源同型。
**HOW**：
```tsx
'use client';

import type { ReactNode } from 'react';

type Variant = 'danger';

export interface AlertProps {
  variant?: Variant;
  /** 可见标题；省略则不渲染 title 行 */
  title?: string;
  /** 可见正文 */
  children: ReactNode;
  /** ARIA role；默认 'alert'（同步错误）；'status'（异步 / 背景事件） */
  role?: 'alert' | 'status';
  /** QA 选择器；不传则用 'ui-alert' */
  'data-testid'?: string;
  className?: string;
}

export function Alert({
  variant = 'danger',
  title,
  children,
  role = 'alert',
  className,
  ...rest
}: AlertProps) {
  const testId = rest['data-testid'] ?? 'ui-alert';
  return (
    <div
      role={role}
      data-testid={testId}
      className={[
        'rounded-md border px-4 py-3 flex items-start gap-3',
        'bg-danger-surface border-danger-border text-danger',
        className ?? '',
      ].join(' ').trim()}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="mt-0.5 h-4 w-4 flex-shrink-0"
      >
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 011 1v4a1 1 0 11-2 0V5a1 1 0 011-1zm0 8a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
      <div className="flex-1 min-w-0">
        {title ? <p className="font-medium mb-1">{title}</p> : null}
        <div className="text-small leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
```
**VERIFY**：`pnpm typecheck` 0 error

### Step 4 — 三弹框错误行升级为 Alert
**WHY**：统一错误块 UI；保留 data-testid 与 role="alert" 兼容旧探针。
**HOW**（RoomGateDialog、SyncConfirmDialog、ResetRoomStatsButton 三处同型替换）：
- import `Alert from '@/components/ui/Alert'`
- 替换 `<p className="text-small text-text-secondary mb-4" data-testid="..." role="alert">...</p>`
- 为 `<Alert data-testid="...">{...}</Alert>`（mb-4 移除，Alert 自带 spacing）
- ResetRoomStatsButton 额外：error 解析分支化
  ```ts
  if (r.reason === 'http-error' && r.status === 404) {
    setError('房间不存在，无法清空。');
  } else if (r.reason === 'aborted') {
    setError('清空请求超时，请稍后重试');
  } else {
    setError('清空失败，请稍后再试。');
  }
  ```
**VERIFY**：vitest 三组件测试全 PASS；data-testid 不变

### Step 5 — store.ts outcomeError 状态 + banner
**WHY**：在线记局失败（超时/网络）当前静默吞掉，用户不知战报未上服；任务案② c 要求可见提醒。
**HOW**：
- lib/store.ts：
  - GameState 加 `outcomeError: { reason: string; at: number } | null`
  - GameActions 加 `setOutcomeError: (e: { reason: string; at: number } | null) => void`
  - initial 加 `outcomeError: null`
  - startGame / restart 时 `set({ outcomeError: null })`
  - makeMove online 分支：`if (!r.ok) { set({ outcomeError: { reason: r.reason, at: Date.now() } }); return; }`
- 新建 components/OutcomeErrorBanner.tsx（client）：
  - useGameStore 读 outcomeError
  - 当非空时 render Alert（title="战报未上服"，body 按 reason 映射文案）
  - 内嵌关闭按钮调 setOutcomeError(null)
- app/online/page.tsx / app/result/page.tsx 挂载 OutcomeErrorBanner
**VERIFY**：`tests/store/store.test.ts` 加用例断言 outcomeError 翻转；manual QA / vitest PASS

### Step 6 — lib/view-transition.ts 工具
**WHY**：统一处理 VT 动画完成的检测；不同浏览器支持度不同，要兜底。
**HOW**：
```ts
/**
 * Wait for any active View Transition animations to finish before
 * running `callback`. Used by HomeDialogMount / OnlineGateMount to
 * defer dialog showModal() out of the 150ms / 250ms transition
 * window so the dialog+backdrop don't get baked into the VT
 * snapshot (the "穿模" defect).
 *
 * Strategy: probe document.getAnimations() after one frame for
 * page-fade-in / view-swap-in animations; if present, wait on
 * animationend. Hard 600ms safety so a stalled browser still
 * resolves (VT max duration is .page 150ms + root 250ms ≈ 400ms).
 *
 * No-ops on SSR or in browsers without VT support.
 */
export function afterViewTransition(callback: () => void): void {
  if (typeof document === 'undefined') { callback(); return; }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    document.removeEventListener('animationend', onEnd);
    clearTimeout(safety);
    callback();
  };
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName === 'page-fade-in' || e.animationName === 'view-swap-in') {
      finish();
    }
  };
  const safety = window.setTimeout(finish, 600);
  window.requestAnimationFrame(() => {
    document.addEventListener('animationend', onEnd, true);
    const anims = document.getAnimations();
    const hasVT = anims.some(a => {
      const name = (a as CSSAnimation).animationName ?? '';
      return name === 'page-fade-in' || name === 'view-swap-in';
    });
    if (!hasVT) {
      // No VT animations registered (instant nav or unsupported browser).
      // Resolve after one extra frame to let paint settle.
      window.requestAnimationFrame(() => finish());
    }
  });
}
```
**VERIFY**：`pnpm typecheck` 0 error；manual 单测覆盖 hasVT=true/false 两条路径

### Step 7 — HomeDialogMount 错峰接入
**WHY**：案① a 治本——挂载 effect 的 setOpen(true) 与 VT 同窗。
**HOW**：
- import `afterViewTransition from '@/lib/view-transition'`
- 在 useEffect 里替换：
  ```ts
  if (consumeNavPrev() !== '/offline') return;
  const pending = pendingSyncCount();
  const declined = loadDeclinedPending();
  if (pending > declined && pending > 0) {
    const roomName = useGameStore.getState().roomName ?? '';
    setPendingSnapshot(pending);
    setInitialName(roomName);
    afterViewTransition(() => setOpen(true));
  }
  ```
- SyncConfirmDialog 内 [open] effect 仍按当前 open=true 走 showModal（不改动）
**VERIFY**：BR-1 触发条件不变（仍「软导航 + pending>declined>0」）；home-return-qa step 02 仍 PASS

### Step 8 — OnlineGateMount 错峰接入
**WHY**：案① b 同病同修。
**HOW**：与 Step 7 同型——无房间名分支的 `setOpen(true)` 包进 `afterViewTransition(() => setOpen(true))`。
**VERIFY**：online-direct-qa PASS；探针 step 02c 同型覆盖

### Step 9 — 探针 home-return-qa.mjs 加 step 02c
**WHY**：钉穿模回归——「离线→首页软导航后 dialog 不应在 VT 窗口内 [open]」。
**HOW**：新 step：
```js
await step("step 02c BR-1 错峰：dialog 在 VT 窗口内不 [open]，之后才 [open]", async () => {
  // ...种子 A 设备离线 1 局 + 设 room key（与 step 02 一致）...
  await softNavHome(page);
  // 100ms 内：dialog 仍未 [open]
  await page.waitForTimeout(100);
  const earlyOpen = await page.locator('[data-testid="sync-confirm-dialog"][open]').count();
  assert.equal(earlyOpen, 0, `VT 窗口内 dialog 不应 [open]；got ${earlyOpen}`);
  await shoot(page, "home-dialog-vt-window.png");
  // 350ms 后：dialog 已 [open]
  await page.waitForSelector('[data-testid="sync-confirm-dialog"][open]', { timeout: 1000 });
  await shoot(page, "home-dialog-after-vt.png");
});
```
**VERIFY**：probe PASS

### Step 10 — store.test 补 outcomeError
**WHY**：锁定 store 状态翻转契约。
**HOW**：在 tests/store/store.test.ts 加 describe：makeMove online 分支 mock postOutcome 返回 ok:false → 断言 useGameStore.getState().outcomeError !== null；startGame 后断言 outcomeError === null。
**VERIFY**：vitest PASS

### Step 11 — ResetRoomStatsButton.test 补 R4-aborted
**WHY**：锁定 timeout 独立文案。
**HOW**：mock fetch 返回 `new Response('', { status: 599 })`（或抛 AbortError）；断言 error 文案为「清空请求超时，请稍后重试」。
**VERIFY**：vitest PASS

## Final verification wave
1. `pnpm vitest run` — 全测通过（含新 step 02c、R4-aborted、outcomeError 断言）
2. `pnpm typecheck` — 0 error
3. `pnpm lint` — 0 violation
4. `pnpm build` — 0 error（先 `lsof -ti :3000 :3009 :3101` 确认端口空闲）
5. `node tests/qa/commit-audit.mjs --branch dev` — 0 violation
6. 浏览器探针：
   - `DATABASE_URL=file:/tmp/ulw-mcea-$(date +%s).db PORT=3101 pnpm start &`
   - `BASE_URL=http://localhost:3101 node tests/qa/home-return-qa.mjs`
   - `BASE_URL=http://localhost:3101 node tests/qa/online-direct-qa.mjs`
   - `BASE_URL=http://localhost:3101 node tests/qa/visual-qa.mjs`
   - 探针 PASS 后 kill server pid（cleanup receipt）

## Commit plan
两个原子 commit（按案切分；案② 先收口再 案① 修复；subject ≤100 字符；含 lore trailer + Plan footer）：
- `feat(ui): 新增 danger Alert 组件 + outcome error banner + 三弹框错误行升级 + ResetRoomStatsButton timeout 独立文案`
  - 覆盖 Step 1-5 + Step 10-11
- `fix(modal): 错峰开启避免 VT 同窗 + ::backdrop 选器泛化 + 穿模回归探针`
  - 覆盖 Step 6-9

每个 commit 独立 build+test 绿。

## Risks
- `afterViewTransition` 的 hasVT 探测可能在 React commit 与浏览器动画注册之间有时序差——600ms safety 兜底。
- Alert 组件颜色 token 在 Tailwind v4 中需通过 @theme 声明，@theme 块已存在，新增 token 自动加入 Tailwind 类谱——无新构建配置。
- postOutcome 失败的 reason 字符串目前是 'aborted' / 'network-error' / 'http-error' / 'not-found'，banner 文案需覆盖至少前三个；not-found 情况罕见（房间突然消失），文案「战报失败 (http-error)，请稍后重试」统一兜底。
- 探针 step 02c 用 page.waitForTimeout(100) 断言早期未 [open]，该断言依赖 showModal 的延迟至少 100ms——afterViewTransition 双 rAF + 600ms 安全窗给到足够余量；若实测不足，调高阈值。

## Reference
- 调查报告：`/tmp/pi-invest-modal-20260923.md`
- DESIGN.md §1 / §3 图底关系 / §5 motion contract
- AGENTS.md §L0 硬约束 / §commit 契约 / §验证六层
- docs/business-rules.md BR-1 / BR-9
- docs/anti-patterns.md L0-1（service/transport 分离）/ L0-5（不引入新库）/ L0-7（不 --no-verify）/ L1-8（首页零 API）/ L1-13（awaitOutcomeWrite）/ L1-17（弹框初焦）
