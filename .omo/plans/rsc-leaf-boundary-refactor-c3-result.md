# Sub-plan: C3 — result page → RSC + extract `<ResultActions>`

> Master plan: [`.omo/plans/rsc-leaf-boundary-refactor.md`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.md)
> 分支: `refactor/rsc-c3-result`
> 服务于并行子代理 #3（C1 / C2 / C3 / C5 同时启动；C4 串行）
> 工作量估算：S–M（page 改写 + 1 个新组件 + 与 C1 模式相似）

## Intent

把 `app/result/page.tsx` 从 `'use client'` 改为 async Server Component。3 个按钮的 action（startGame / restart / resetAll）抽到新 client 组件 `<ResultActions>`。`stats` 由 RSC `await loadStats()` 拿（与 C1 一致）。`<Confetti />` 保留 client，按现状挂在 headline 下。

## 为什么

- `app/result/page.tsx` 当前是 `'use client'`，subscribe 了 `useGameStore` 的 5 个 hook：phase / winner / lastOutcome / stats / startGame / restart / resetAll。
- 其中 stats 是纯数据走 RSC；actions（startGame / restart / resetAll）必须在 client。
- Confetti 已正确保持 client，page 改 RSC 不影响 Confetti 代码进入 client graph（Confetti 仍由 result page 直接 import，但 page 是 RSC → Confetti 是 client 子树入口）。

## File changes

### 1. `app/result/page.tsx`（改写为 RSC async）

**改前**（'use client'，8 行 import + 7 个 store hook）：
```tsx
'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { Confetti } from '@/components/Confetti';

export default function ResultPage() {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const stats = useGameStore((s) => s.stats);
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);
  const resetAll = useGameStore((s) => s.resetAll);
  // ... JSX 用上述所有 state
}
```

**改后**（async RSC，9 行 import，0 store hook）：
```tsx
import Link from 'next/link';
import { loadStats } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { Confetti } from '@/components/Confetti';
import { ResultActions } from '@/components/ResultActions';
import { ResultState } from '@/components/ResultActions';

export default async function ResultPage() {
  const stats = await loadStats();

  // 胜负判定需要的 phase / winner / lastOutcome 在 client side 算（ResultState 组件）
  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-2 relative">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display font-display font-semibold tracking-tight">本局结束</h1>
          <SoundToggle />
        </div>
        <ResultState>
          {(state) => (
            <>
              <div className="relative">
                <p
                  className={'text-h1 font-display font-medium ' + state.headlineClass}
                  data-testid="result-headline"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  {state.headline}
                </p>
                {state.phase === 'won' ? <Confetti /> : null}
              </div>
              {state.lastOutcome ? (
                <p className="text-small text-text-muted">结果：{state.lastOutcome === 'draw' ? '平局' : `${state.lastOutcome} 胜`}</p>
              ) : null}
            </>
          )}
        </ResultState>
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-display font-medium">战绩</h2>
          <StatsGrid stats={stats} />
        </div>
      </Card>

      <ResultActions />
    </main>
  );
}
```

**关键设计点**：
- `<ResultState>` 是轻量 client 组件，仅订阅 phase / winner / lastOutcome 三个 store 字段，渲染 headline + Confetti 触发条件 + lastOutcome 文案。
- `<ResultActions>` 是封装 3 个按钮 + 3 个 store action 的 client 组件。
- Page 用 `await loadStats()` 拿 stats → `<StatsGrid>`。Phase / winner / lastOutcome 走 client 子树（ResultState）。

### 2. `components/ResultActions.tsx`（新增）

```tsx
'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export type ResultStateSnapshot = {
  phase: 'idle' | 'playing' | 'won' | 'drawn';
  winner: 'X' | 'O' | null;
  lastOutcome: 'X' | 'O' | 'draw' | null;
  headline: string;
  headlineClass: string;
};

export function ResultState({ children }: { children: (state: ResultStateSnapshot) => React.ReactNode }) {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const lastOutcome = useGameStore((s) => s.lastOutcome);

  let headline = '—';
  let headlineClass = 'text-text-muted';
  if (phase === 'won' && winner) {
    headline = `${winner} 获胜`;
    headlineClass = winner === 'X' ? 'text-player-x' : 'text-player-o';
  } else if (phase === 'drawn') {
    headline = '平局';
    headlineClass = 'text-text-secondary';
  }

  return <>{children({ phase, winner, lastOutcome, headline, headlineClass })}</>;
}

export function ResultActions() {
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);
  const resetAll = useGameStore((s) => s.resetAll);

  return (
    <div className="flex flex-col gap-3">
      <Link href="/play" className="w-full" onClick={startGame}>
        <Button variant="primary" className="w-full" data-testid="play-again">
          再来一局
        </Button>
      </Link>
      <Link href="/" className="w-full">
        <Button variant="secondary" className="w-full">
          返回首页
        </Button>
      </Link>
      <Button
        variant="ghost"
        onClick={() => {
          resetAll();
          restart();
        }}
        data-testid="reset-stats-result"
      >
        重置战绩
      </Button>
    </div>
  );
}
```

### 3. 不改动的文件

- `lib/store.ts` / `lib/db.ts` / `lib/game.ts`
- `components/Confetti.tsx`（保持 client，已正确）
- `components/SoundToggle.tsx` / `Board.tsx` / `Cell.tsx` / `ServiceWorkerRegister.tsx`
- `components/ui/*.tsx`

## Acceptance criteria

- `app/result/page.tsx` 不再有 `'use client'` 指令，是 async function。
- `app/result/page.tsx` 不再 import `useGameStore`。
- `stats` 由 `await loadStats()` 提供，传给 `<StatsGrid stats={stats} />`。
- `<ResultState>` + `<ResultActions>` 是新增的 client 组件。
- `data-testid` 全部保留：`result-headline` / `play-again` / `reset-stats-result` / `stat-value` / `sound-toggle` / confetti 节点。
- Confetti 仍挂在 phase === 'won' 时的 headline 旁。

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
node tests/qa/visual-qa.mjs          # snapshot 中 result-headline + stat-value 字段值不变
node tests/qa/hydration-check.mjs    # 无 SSR mismatch
node tests/qa/confetti-probe.mjs     # Confetti 触发条件正确
node tests/qa/audio-probe.mjs        # 音效
kill $SERVER_PID
```

## Evidence 产物

落到 `.omx/evidence/rsc-leaf-boundary-refactor/c3/`：
- `build.log` / `vitest.log` / `typecheck.log` / `lint.log` / `commit-audit.log`
- `visual-qa/qa-log.json` + `visual-qa/*.png`
- `hydration-check.log` / `confetti-probe.log` / `audio-probe.log`
- `view-source-result.html`（首屏 HTML 副本）

## Commit 模板

```
refactor(result): convert result page to RSC + extract ResultActions

WHAT: app/result/page.tsx 改 async RSC；3 个 action 抽到 ResultActions client 组件；phase/winner/lastOutcome 抽到 ResultState client 组件；stats 走 await loadStats()。

WHY: result page 当前 'use client'，subscribe 5 个 store hook；stats 是纯数据走 RSC 更优；actions 和 live state 必须留在 client。

HOW: ResultActions 封装 3 个按钮 + startGame/restart/resetAll；ResultState 提供 render-prop 暴露 phase/winner/lastOutcome/headline 给 headline + Confetti + lastOutcome 文案渲染。Confetti 仍 client（已正确）。

Constraint: data-testid 不变；Confetti 触发条件 phase === 'won' 不变
Rejected: 把 Confetti 改成条件挂载（C3 决策：保留直挂）
Confidence: 高（C1 同模式已验证）
Scope-risk: 低（page 改写 + 1 文件新增；store 行为不变）
Directive: 6 层 Gauntlet + visual-qa + hydration-check + confetti-probe + audio-probe
Tested: typecheck/lint/vitest/build/commit-audit/visual-qa/hydration-check/confetti-probe/audio-probe
Not-tested: 极端 Confetti 动画时序——audio-confetti-qa 已有覆盖

Plan: .omo/plans/rsc-leaf-boundary-refactor.md
Sub-plan: .omo/plans/rsc-leaf-boundary-refactor-c3-result.md
```

## Must NOT have

- 不引入新 npm 依赖。
- 不修改 `lib/store.ts` 行为（C4 才动）。
- 不修改 `<Confetti>` / `<StatsGrid>` / `<Card>` / `<Button>` / `<SoundToggle>` 签名。
- 不删除任何 data-testid。
- 不使用 `git commit --no-verify`。

