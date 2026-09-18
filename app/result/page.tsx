import { ViewTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { loadSoloRecord } from '@/lib/db';
import { normalizePlayerName } from '@/lib/player-name';
import { type GameStats } from '@/lib/game';

export const dynamic = 'force-dynamic';

/**
 * W3 (ulw-one-game-two-versions A5) /result page rendering.
 *
 * Server Component (default). Reads `?name=` from the URL and
 * fetches the per-name row from lib/db.ts:loadSoloRecord at
 * request time. The page is real-time (no client cache; the
 * upstream write goes through POST
 * /api/players/{name}/stats/outcomes which the server applies
 * before the navigator pushes here) so the RSC read sees the
 * post-write row.
 *
 * `dynamic = 'force-dynamic'` is mandatory: Next.js 16 defaults
 * pages to static optimization, which would bake the first request's
 * row into HTML and return stale data on subsequent visits (B-3a).
 * The flag opts the route out of static caching at request time.
 *
 * Three render branches:
 *   1. `name` missing / empty / fails whitelist → fallback view
 *      (引导回首页 + 在线入口). No localStorage read on SSR
 *      (AGENTS.md §本项目反模式: SSR 首帧禁读 localStorage).
 *   2. `name` valid + row absent (no stats yet) → empty state
 *      showing identity + a hint to play one game.
 *   3. `name` valid + row present → StatsGrid with the row, plus
 *      the result actions (再来一局 → /play, 返回首页 → /).
 *
 * ResultActions used to be a 'use client' component that called
 * store.startGame(); W3 retires that — the play-again link is
 * a plain <Link href="/play">; the navigator's startGame fires
 * when /play mounts (PlayController + startGame('online')). The
 * W1 reset chain is gone (the /api/stats retirement). The page
 * therefore ships as a true RSC — only SoundToggle (app/layout.tsx
 * sibling) carries a client boundary.
 */
type SearchParams = Promise<{ name?: string | string[] }>;

function pickName(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  return normalizePlayerName(v);
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const name = pickName(sp.name);

  if (name === null) {
    // Branch 1: no name → fallback view (引导回首页). No
    // localStorage read on the server frame — the user can pick
    // the name on / and return via OnlineStatsCard refetch or
    // the /play CTA which will push here with ?name=<their-name>.
    return (
      <ViewTransition enter="page" exit="page" default="none">
        <main className="page-shell page-fade-in" data-testid="result-page">
          <header className="flex flex-col gap-3">
            <h1 className="text-display font-display font-medium tracking-tight">
              实时成绩单
            </h1>
            <p className="text-body text-text-secondary">
              请先在首页设置名字，再来一局后回到这里查看战绩。
            </p>
          </header>
          <Card>
            <div className="flex flex-col gap-3" data-testid="result-fallback">
              <Link href="/" className="w-full" data-testid="result-back-home">
                <Button variant="primary" className="w-full">
                  返回首页设置名字
                </Button>
              </Link>
            </div>
          </Card>
        </main>
      </ViewTransition>
    );
  }

  // Branches 2 + 3: loadSoloRecord returns null when no row, full
  // GameStats when present. Service-layer pure function; transport
  // mapping is the responsibility of any 4xx problem+json wrapper.
  let stats: GameStats | null;
  let loadError: string | null = null;
  try {
    stats = await loadSoloRecord(name);
  } catch {
    stats = null;
    loadError = '加载失败，请稍后再试。';
  }

  return (
    <ViewTransition enter="page" exit="page" default="none">
      <main className="page-shell page-fade-in" data-testid="result-page">
        <header className="flex flex-col gap-3">
          <h1 className="text-display font-display font-medium tracking-tight">
            实时成绩单
          </h1>
          <p className="text-body text-text-secondary" data-testid="result-name">
            玩家：
            <span className="ml-2 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 font-mono text-text-primary">
              {name}
            </span>
          </p>
        </header>

        {loadError !== null ? (
          <Card>
            <p className="text-body text-text-secondary" data-testid="result-error" role="alert">
              {loadError}
            </p>
          </Card>
        ) : stats === null ? (
          <Card>
            <div className="flex flex-col gap-3" data-testid="result-empty">
              <p className="text-body text-text-secondary">
                尚未记录任何战绩。在线玩一局即可累计。
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-col gap-3" data-testid="result-stats">
              <StatsGrid stats={stats} />
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-3" data-testid="result-actions">
          <Link href="/play" className="w-full" data-testid="play-again">
            <Button variant="primary" className="w-full">
              再来一局
            </Button>
          </Link>
          <Link href="/" className="w-full" data-testid="back-home">
            <Button variant="secondary" className="w-full">
              返回首页
            </Button>
          </Link>
        </div>
      </main>
    </ViewTransition>
  );
}
