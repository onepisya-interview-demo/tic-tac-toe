# Plan: 补齐 view-transition + Alert 单测（纯新增测试文件）

- 日期: 2026-09-23
- 状态: 执行中（test/transition-alert-units worktree；基线 667b9ea）
- 触发: 上轮 plan「单测覆盖 hasVT=true/false 两条路径」承诺未交付 → plan→实现漂移；本轮纯补交付物
- Tier: LIGHT（test-only target；行为已正确，无设计决策）

## 一、命题

补两个被忽略的单测覆盖：

1. `lib/view-transition.ts`（63 行）— 弹框错峰核心。已有 tests/qa/home-return-qa.mjs step 02c 一条端到端，但分支覆盖率为 0。
2. `components/ui/Alert.tsx`（70 行）— 4 处消费（RoomGateDialog / SyncConfirmDialog / ResetRoomStatsButton / OutcomeErrorBanner），零测试。

## 二、范围

### In-Scope
- 新建 `lib/view-transition.test.ts` ≥7 用例
- 新建 `components/ui/Alert.test.tsx` 覆盖 7 断言点
- 一条原子 commit 落地两文件 + Plan footer

### Must-NOT-Have
- 不动 `lib/view-transition.ts`、`components/ui/Alert.tsx`
- 不改既有测试文件
- 不改 package.json / lock / 配置
- 不 build、不跑 dev server
- 不引入新测试库

## 三、分支矩阵 ↔ 测试名映射表

来源：lib/view-transition.ts 行级实现 + /tmp/pi-review-fix-20260923.md §3 时序正确性表。

| # | 分支语义 | 源码位置 | 测试名（lib/view-transition.test.ts） |
|---|---------|---------|---------------------------------------|
| 1 | SSR no-op：typeof document === 'undefined' 立即同步 callback | lib/view-transition.ts:24-27 | `runs callback synchronously when document is undefined (SSR no-op)` |
| 2 | hasVT=true + animationend 匹配（page-fade-in）正常到达 → onEnd 命中白名单并调 finish | lib/view-transition.ts:36-43（onEnd 体，含白名单 if :37-40 + finish 调用 :41；listener 安装见 :46） | `fires callback when matching animationend arrives (page-fade-in)` |
| 3 | hasVT=true + 事件不达 → 600ms safety 兜底 | lib/view-transition.ts:44（window.setTimeout(finish, 600)）+ :29-35（finish 体含 done 守门 + cleanup） | `falls back to 600ms safety when animationend never fires` |
| 4 | hasVT=false（animations 为空）→ 双 rAF 后触发 | lib/view-transition.ts:55-61 | `fires after double rAF when no VT animation is registered` |
| 5 | 一次性守卫：多次事件 / safety 到期都只触发一次 | lib/view-transition.ts:29-35（finish 体：done 守门 :30-31 + callback :34） | `guards against duplicate callback across multiple triggers` |
| 6 | cleanup 后无残留监听 / 定时器（removeEventListener + clearTimeout） | lib/view-transition.ts:32-33（finish 体内：removeEventListener :32 + clearTimeout :33） | `cleans up listeners and timer after firing` |
| 7 | 动画名白名单：非匹配 animationName（cell-pop）不触发 | lib/view-transition.ts:36-43（onEnd 体；白名单实际生效 :37-40 的两个等值比较） | `ignores animationend with non-matching animationName` |

补充 case（4b）：hasVT=false + getAnimations 缺失（jsdom / 旧浏览器）→ 同 hasVT=false 双 rAF。

**Footnote**：case 4b 与 case 4 语义同效——spyOnGetAnimations() 在 jsdom 缺 document.getAnimations 时（lib/view-transition.test.ts:58-68）走 `Object.defineProperty` 安装 + 之后用 `mockReturnValue([])` 模拟「getAnimations 缺失」，与 case 4 走「getAnimations() 返回 []」的 source 路径（lib/view-transition.ts:49-50 → `:55-61` 双 rAF）合并为同一分支。**语义同效，并入 case 4 用例，不另测。**

## 四、Alert 测试断言点（components/ui/Alert.test.tsx）

| # | 断言 | 源码契约 |
|---|------|---------|
| 1 | 默认 `role="alert"` | Alert.tsx:39（destructured default `role = 'alert'`）+ :46（JSX `role={role}`） |
| 2 | `role="status"` 透传 | Alert.tsx:29（AlertProps `role?: 'alert' \| 'status'` 类型声明允许）+ :46（JSX `role={role}`） |
| 3 | 默认 `data-testid="ui-alert"` + 自定义 testid 透传 | Alert.tsx:31（AlertProps `'data-testid'?: string` 类型声明）+ :43（`const testId = rest['data-testid'] ?? 'ui-alert'` 默认计算）+ :47（JSX `data-testid={testId}`） |
| 4 | title 有/无的条件渲染 | Alert.tsx:65（`{title ? <p className="font-medium mb-1">{title}</p> : null}`） |
| 5 | 图标 svg `aria-hidden="true"` | Alert.tsx:57（svg `aria-hidden="true"` attr） |
| 6 | children 渲染 | Alert.tsx:66（`<div className="text-small leading-relaxed">{children}</div>`） |
| 7 | className 合并不丢自有类 | Alert.tsx:48-54（className 数组 + `.join(' ').trim()`） |

## 五、策略

### 工具与环境
- vitest 已有（vitest.config.ts）；jsdom 环境，setupFiles=vitest.setup.ts
- 测试库：@testing-library/react（渲染）、@testing-library/jest-dom/vitest（断言扩展，由 setupFile 注入）
- 时间：vi.useFakeTimers + vi.advanceTimersByTime 处理 600ms safety
- rAF：用 vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation 控制帧调度
- 文档探测：jsdom 下 typeof document 永远 truthy；SSR 分支用 vi.stubGlobal('document', undefined) 模拟
- AnimationEvent：jsdom 不原生支持 AnimationEvent，用 Object.assign(new Event('animationend'), { animationName }) 制造匹配事件

### 既有测试样板
- components/ui/BoardGrid.test.tsx：@testing-library/react + render + screen 风格（待仿）
- lib/confetti.test.ts：vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0) 风格（待仿）
- tests/store/store.test.ts：vi.useFakeTimers + vi.advanceTimersByTimeAsync 风格（待仿）

## 六、执行 AC

- AC-1 lib/view-transition.test.ts ≥7 用例覆盖分支矩阵（表 §三 一一对应）
- AC-2 components/ui/Alert.test.tsx 覆盖 7 断言点（表 §四 一一对应）
- AC-3 pnpm vitest run 全绿（479 + 新增），新增用例 < 2s
- AC-4 git diff dev..HEAD --name-only 仅含 2 个新测试文件 + plan 文件
- AC-5 pnpm typecheck / pnpm lint 绿
- AC-6 原子提交（subject ≤100 / type=test 前缀 / lore trailer / Plan footer），禁 --no-verify

## 七、发现（执行期记录）

（待补）
