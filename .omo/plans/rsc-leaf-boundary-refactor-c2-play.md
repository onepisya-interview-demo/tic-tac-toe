# Sub-plan: C2 — play page → RSC + extract `<PlayController>`

> Master plan: [`.omo/plans/rsc-leaf-boundary-refactor.md`](<repo-root>/.omo/plans/rsc-leaf-boundary-refactor.md)
> 分支: `refactor/rsc-c2-play`
> 服务于并行子代理 #2（C1 / C2 / C3 / C5 同时启动；C4 串行）
> 工作量估算：M（page 改写 + 新组件 + useEffect 顺序论证）

## Intent

把 `app/play/page.tsx` 从 `'use client'` 改为 async Server Component。3 处 `useEffect` 和 1 处 `useRouter` 抽到新的 client 组件 `<PlayController>`，由它包裹 `<Board>`。`<Board>` 维持 client（已正确）。

## 为什么

- `app/play/page.tsx` 是项目里唯一含 `useEffect` 的页面，且 `useEffect` 用于：①auto-start game；②setTimeout → `router.replace('/result')`；③cleanup。这些都是 client-only 副作用，必须在 client component 里跑。
- 当前整个 page 是 client，意味着 `next/navigation` 的 router glue + `useEffect` 的 React effect glue 都被 page import 拖进 client bundle。
- 把 effect/router 抽到 `<PlayController>` 后，page 不再 import `next/navigation` 也不再有 useEffect → page 可作 RSC，client graph 只剩 `<PlayController>` 和 `<Board>` 两个叶子组件。

## File changes

### 1. `app/play/page.tsx`（改写为 RSC async）

**改前**（'use client'，7 行 import + 3 个 useEffect hook）：
```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Board } from '@/components/Board';
import { StatusBar } from '@/components/ui/StatusBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SoundToggle } from '@/components/SoundToggle';

export default function PlayPage() {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const winner = useGameStore((s) => s.winner);
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);

  useEffect(() => {
    if (phase === 'idle') startGame();
  }, [phase, startGame]);

  useEffect(() => {
    if (phase === 'won' || phase === 'drawn') {
      const t = setTimeout(() => router.replace('/result'), 700);
      return () => clearTimeout(t);
    }
    return;
  }, [phase, router]);
  // ... JSX 用 phase / currentPlayer / winner / restart
}
```

**改后**（async RSC，6 行 import，0 hook）：
```tsx
import Link from 'next/link';
import { Board } from '@/components/Board';
import { StatusBar } from '@/components/ui/StatusBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SoundToggle } from '@/components/SoundToggle';
import { PlayController } from '@/components/PlayController';

export default function PlayPage() {
  // 不再是 async：本页不需要 await 数据（RSC 也允许 sync RSC）
  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1 font-display font-semibold">游戏中</h1>
          <SoundToggle />
        </div>
        <PlayController>
          {/* PlayController 暴露 phase / currentPlayer / winner via children pattern */}
          {(state) => <StatusBar phase={state.phase} currentPlayer={state.currentPlayer} winner={state.winner} />}
        </PlayController>
      </header>

      <Card>
        <PlayController>
          <Board />
        </PlayController>
      </Card>

      <div className="flex flex-row gap-3">
        <Link href="/" className="flex-1">
          <Button variant="secondary" className="w-full">
            返回首页
          </Button>
        </Link>
        <PlayController>
          {(state) => (
            <Button variant="ghost" onClick={state.restart} data-testid="restart">
              重新开局
            </Button>
          )}
        </PlayController>
      </div>
    </main>
  );
}
```

**关键设计点**：
- Page 不用 `useGameStore` / `useRouter` / `useEffect` → 可以是 RSC。
- `<PlayController>` 是唯一承载副作用的 client 组件。它提供两种使用方式：①默认 children 渲染（Board 用）；②render-prop（StatusBar / restart button 用，因为这些子组件需要从 store 读 phase / currentPlayer / winner / restart）。
- 这种"controller as children + render-prop"模式让 client 子树最小化。

### 2. `components/PlayController.tsx`（新增）

```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';

type State = {
  phase: 'idle' | 'playing' | 'won' | 'drawn';
  currentPlayer: 'X' | 'O' | null;
  winner: 'X' | 'O' | null;
  restart: () => void;
};

type Props = {
  children: ReactNode | ((state: State) => ReactNode);
};

export function PlayController({ children }: Props) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const winner = useGameStore((s) => s.winner);
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);

  // 副作用 1: auto-start on idle
  useEffect(() => {
    if (phase === 'idle') startGame();
  }, [phase, startGame]);

  // 副作用 2: 700ms 后跳 /result
  useEffect(() => {
    if (phase === 'won' || phase === 'drawn') {
      const t = setTimeout(() => router.replace('/result'), 700);
      return () => clearTimeout(t);
    }
    return;
  }, [phase, router]);

  const state: State = { phase, currentPlayer, winner, restart };
  return typeof children === 'function' ? children(state) : <>{children}</>;
}
```

### 3. 不改动的文件

- `lib/store.ts` / `lib/db.ts` / `lib/game.ts`
- `components/Board.tsx`（保持 client，已正确）
- `components/SoundToggle.tsx` / `Confetti.tsx` / `ServiceWorkerRegister.tsx`
- `components/ui/*.tsx`

## Acceptance criteria

- `app/play/page.tsx` 不再有 `'use client'` 指令，没有 `useEffect` / `useRouter` / `useGameStore` import。
- 渲染结构与改前视觉一致：`<main>` → `<header>`（含 SoundToggle + StatusBar + h1）→ `<Card>`（含 Board）→ 底部按钮组（返回首页 / 重新开局）。
- `<PlayController>` 维护原 useEffect 顺序（先 auto-start effect 注册，后跳转 effect 注册；cleanup 顺序由 React 保证）。
- `data-testid` 全部保留：`board` / `cell-N` / `cell-N-mark` / `status-bar` / `sound-toggle` / `restart`。

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
node tests/qa/commit-audit.mjs --branch main
pnpm start &
SERVER_PID=$!
sleep 5
node tests/qa/win-flow.mjs            # 全自动赢局流（auto-start → 落子 → 700ms 后跳 /result）
node tests/qa/keyboard-roving.mjs     # 键盘交互
node tests/qa/audio-probe.mjs         # 音效
node tests/qa/hydration-check.mjs     # 无 SSR mismatch
kill $SERVER_PID
```

## Evidence 产物

落到 `.omx/evidence/rsc-leaf-boundary-refactor/c2/`：
- `build.log`
- `vitest.log`
- `typecheck.log`
- `lint.log`
- `commit-audit.log`
- `win-flow.log`
- `keyboard-roving.log`
- `audio-probe.log`
- `hydration-check.log`

## Commit 模板

```
refactor(play): convert play page to RSC + extract PlayController

WHAT: app/play/page.tsx 改 RSC；3 处 useEffect + useRouter 抽到新 client 组件 PlayController；Board 维持 client。

WHY: play page 是项目里唯一 useEffect 页面，整页 client 把 next/navigation router glue + React effect glue 拖进首屏。3 处副作用都是 client-only，封装到 PlayController 后 page 可作 RSC。

HOW: PlayController 提供 children + render-prop 两种 API，承载 auto-start / 700ms 跳转 / restart 三个动作；page 用 PlayController 包裹 Board，StatusBar / restart button 通过 render-prop 拿 state。useEffect 顺序保持原样。

Constraint: PlayController 内 useEffect 顺序必须与原 page 一致；cleanup 由 React useEffect 返回机制保证
Rejected: 把 PlayController 拆成两个更小的 client 组件（会引入 client 子树碎片，反而扩大 client graph）
Confidence: 中（render-prop 模式首次使用；如有 vitest 单测需求，单独补）
Scope-risk: 中（PlayController 是新组件；Board 与 StatusBar 调用方变化需论证）
Directive: 6 层 Gauntlet + win-flow + keyboard-roving
Tested: typecheck/lint/vitest/build/commit-audit/win-flow/keyboard-roving/audio-probe/hydration-check
Not-tested: 极端 timing（700ms 内刷新页面、tab 切回前后台）—— 浏览器 QA 之外需用 chrome-devtools-axi 验证（留给 T6/T7）

Plan: .omo/plans/rsc-leaf-boundary-refactor.md
Sub-plan: .omo/plans/rsc-leaf-boundary-refactor-c2-play.md
```

## Must NOT have

- 不引入新 npm 依赖。
- 不修改 `lib/store.ts` 行为（C4 才动）。
- 不修改 `<Board>` 内部实现。
- 不修改 `<StatusBar>` / `<Button>` / `<Card>` / `<SoundToggle>` 签名。
- 不删除任何 data-testid。
- 不使用 `git commit --no-verify`。

