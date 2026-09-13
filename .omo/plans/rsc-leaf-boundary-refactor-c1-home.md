# Sub-plan: C1 — home page → RSC + extract `<StartGameButton>`

> Master plan: [`.omo/plans/rsc-leaf-boundary-refactor.md`](<repo-root>/.omo/plans/rsc-leaf-boundary-refactor.md)
> 分支: `refactor/rsc-c1-home`
> 服务于并行子代理 #1（C1 / C2 / C3 / C5 同时启动；C4 串行）
> 工作量估算：S（单文件改写 + 2 个新组件文件）

## Intent

把 `app/page.tsx` 从 `'use client'` 改为 async Server Component。新增 `<StartGameButton>` 和 `<ResetStatsButton>` 两个 client 组件承接 `useGameStore` 调用。`stats` 数据由 RSC `await loadStats()` 直读 `lib/db.ts`，通过 props 传给 `<StatsGrid>`。

## 为什么

- 当前页面是 `'use client'`，`useGameStore` 的 store instance 被 import 到 page，导致 `lib/store.ts` 整模块进 client bundle。
- Page 里只用 `useGameStore` 三个 hook：`stats` / `startGame` / `resetAll`。其中 `stats` 是纯数据，可走 RSC；`startGame` / `resetAll` 是 action，必须在 client 调用。
- 把两个 action 抽到独立 client 组件后，page 只 import 这些组件，不再 import `useGameStore` → store 不再从 page 进入 client bundle（仅从 `<StartGameButton>` / `<ResetStatsButton>` / C2 的 `<PlayController>` / C3 的 `<ResultActions>` 进入）。

## File changes

### 1. `app/page.tsx`（改写为 RSC async）

**改前**（'use client'，13 行 import + 18 行 JSX）：
```tsx
'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';

export default function HomePage() {
  const stats = useGameStore((s) => s.stats);
  const startGame = useGameStore((s) => s.startGame);
  const resetAll = useGameStore((s) => s.resetAll);
  // ... JSX 用 stats / startGame / resetAll
}
```

**改后**（async RSC，12 行 import + 18 行 JSX）：
```tsx
import Link from 'next/link';
import { loadStats } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { StartGameButton } from '@/components/StartGameButton';
import { ResetStatsButton } from '@/components/ResetStatsButton';

export default async function HomePage() {
  const stats = await loadStats();
  // ... JSX 用 stats（来自 props），StartGameButton / ResetStatsButton 包成 client 组件
}
```

### 2. `components/StartGameButton.tsx`（新增）

```tsx
'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function StartGameButton() {
  const startGame = useGameStore((s) => s.startGame);
  return (
    <Link href="/play" className="flex-1" onClick={startGame}>
      <Button variant="primary" className="w-full" data-testid="start-game">
        开始游戏
      </Button>
    </Link>
  );
}
```

### 3. `components/ResetStatsButton.tsx`（新增）

```tsx
'use client';

import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function ResetStatsButton() {
  const resetAll = useGameStore((s) => s.resetAll);
  return (
    <Button
      variant="ghost"
      onClick={resetAll}
      data-testid="reset-stats"
      aria-label="重置战绩"
    >
      重置战绩
    </Button>
  );
}
```

### 4. 不改动的文件

- `lib/db.ts` / `lib/store.ts` / `lib/game.ts`
- `components/SoundToggle.tsx` / `Board.tsx` / `Cell.tsx` / `Confetti.tsx` / `ServiceWorkerRegister.tsx`
- `components/ui/*.tsx`
- 其他 page 文件

## Acceptance criteria

- `app/page.tsx` 不再有 `'use client'` 指令，是 async function。
- `app/page.tsx` 不再 import `useGameStore`。
- `stats` 由 `await loadStats()` 提供，传给 `<StatsGrid stats={stats} />`。
- `<StartGameButton>` 和 `<ResetStatsButton>` 是新增的 client 组件，各自独立 import `useGameStore`。
- `data-testid` 全部保留：`start-game` / `reset-stats` / `empty-state` / `stat-value` / `sound-toggle`。

## Verification（6 层 Gauntlet 子集）

每条必须 exit 0 / PASS：

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
node tests/qa/commit-audit.mjs --branch main
pnpm start &
SERVER_PID=$!
sleep 5
node tests/qa/visual-qa.mjs          # snapshot 中 stat-value 字段值不变
node tests/qa/hydration-check.mjs    # 无 SSR mismatch
node tests/qa/audio-probe.mjs        # SoundToggle 行为不变
kill $SERVER_PID
```

附加：用 `view-source:http://localhost:3000/` 检查首屏 HTML 中战绩数据已在 HTML 源码里（而非 hydration 后填入）。

## Evidence 产物

落到 `.omx/evidence/rsc-leaf-boundary-refactor/c1/`：
- `build.log`
- `vitest.log`
- `typecheck.log`
- `lint.log`
- `commit-audit.log`
- `visual-qa/qa-log.json` + `visual-qa/*.png`（5 张页面截图）
- `hydration-check.log`
- `audio-probe.log`
- `view-source-home.html`（保存首屏 HTML 副本作为 evidence）

## Commit 模板

```
refactor(home): convert home page to RSC + extract StartGameButton

WHAT: app/page.tsx 改 async RSC；stats 由 await loadStats() 直读；startGame / resetAll 抽到新 client 组件 StartGameButton / ResetStatsButton。

WHY: 当前 page 是 'use client'，useGameStore 整模块被 page import 进 client bundle，触发 Next router glue（160K）和其他 store deps 一并进首屏。page 仅用 stats / startGame / resetAll 三个 hook，stats 是纯数据走 RSC，actions 走叶子 client 组件。

HOW: app/page.tsx 删除 'use client' 与 useGameStore import；新增 await loadStats()；StartGameButton / ResetStatsButton 各新建 .tsx 文件夹住对应的 onClick 逻辑。data-testid 全部保留。

Constraint: 不改 lib/store.ts 行为；C4 才会删 stats 字段
Rejected: 上移 SoundToggle 到 layout（v0.2 用户决策：每 page header 留 slot）
Confidence: 高（已有 ui/* 5 个 RSC 组件做先例；StatsGrid 接收 stats: GameStats props 签名不变）
Scope-risk: 低（page 文件改写 + 2 个新组件；store 行为不变）
Directive: 6 层 Gauntlet 全跑 + view-source HTML 含战绩作为 acceptance
Tested: pnpm typecheck/lint/vitest/build/commit-audit + visual-qa/hydration-check/audio-probe
Not-tested: Performance LCP / Bundle 大小变化（C5 完成后做 T6 bundle 对比）

Plan: .omo/plans/rsc-leaf-boundary-refactor.md
Sub-plan: .omo/plans/rsc-leaf-boundary-refactor-c1-home.md
```

## Cleanup receipt

- 删除 staging 改动：`git checkout --`（如果发生）
- 关闭后台 `pnpm start` 进程（用 kill PID + lsof 二次确认）
- 删除临时 evidence 之外的中间产物

## Must NOT have

- 不引入新 npm 依赖。
- 不修改 `lib/store.ts`（C4 才动）。
- 不修改 `<StatsGrid>` / `<Card>` / `<Button>` / `<SoundToggle>` 签名。
- 不修改 `<Confetti />` / `<Board />` / `<Cell />`。
- 不删除任何 data-testid。
- 不使用 `git commit --no-verify`。

