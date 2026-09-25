import { ViewTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { OutcomeErrorBanner } from '@/components/OutcomeErrorBanner';
import { ResultCelebration } from '@/components/ResultCelebration';
import { ResetRoomStatsButton } from '@/components/ResetRoomStatsButton';
import { LeaveRoomButton } from '@/components/LeaveRoomButton';
import { DeleteRoomButton } from '@/components/DeleteRoomButton';
import { loadRecordByRoom } from '@/lib/db';
import { normalizeRoom } from '@/lib/room-name';
import { type GameStats } from '@/lib/game';

export const dynamic = 'force-dynamic';

/**
 * W2 (ulw-room-migration-home-landing §2.6) /result page rendering.
 *
 * Server Component (default). Reads `?room=` from the URL and
 * fetches the per-room row from lib/db.ts:loadRecordByRoom at
 * request time. The page is real-time (no client cache; the
 * upstream write goes through POST
 * /api/rooms/{room}/stats/outcomes which the server applies before
 * the navigator pushes here) so the RSC read sees the post-write
 * row.
 *
 * `dynamic = 'force-dynamic'` is mandatory: Next.js 16 defaults
 * pages to static optimization, which would bake the first request's
 * row into HTML and return stale data on subsequent visits (B-3a).
 * The flag opts the route out of static caching at request time.
 *
 * Three render branches:
 *   1. `room` missing / empty / fails whitelist → fallback view
 *      (引导回首页 + 在线入口). No localStorage read on SSR
 *      (AGENTS.md §本项目反模式: SSR 首帧禁读 localStorage).
 *   2. `room` valid + row absent (no stats yet) → empty state
 *      showing identity + a hint to play one game.
 *   3. `room` valid + row present → StatsGrid with the row, plus
 *      the result actions (再来一局 → /online, 返回首页 → /).
 *
 * 旧书签 `?name=` 按 "无 room" 走 fallback（不做 301 — portfolio
 * 无保留价值；用户书签迁移动机低，fallback 文案引导重新创建房间）。
 *
 * W-A (ulw-result-win-celebration): <ResultCelebration> is mounted in
 * BOTH returns (fallback + branches 2/3). The island renders nothing
 * unless the one-shot sessionStorage sentinel written by
 * ResultNavigator is present, so the three render branches above are
 * structurally unchanged and zero user-visible copy is added. The
 * fallback mount is defensive: the win path always pushes a whitelisted
 * room (branches 2/3), but mounting in both returns guarantees the
 * sentinel is consumed exactly once on every /result load — a stale
 * marker can never leak into a later bookmark visit.
 */
type SearchParams = Promise<{ room?: string | string[]; name?: string | string[] }>;

function pickRoom(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  return normalizeRoom(v);
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const room = pickRoom(sp.room);

  if (room === null) {
    // Branch 1: no room → fallback view (引导回首页). No
    // localStorage read on the server frame — the user can create
    // a room on / via the new RoomGateDialog and return here via
    // the home stats static entry ("查看 <room> 的战绩 →").
    return (
      <ViewTransition enter="page" exit="page" default="none">
        <main className="page-shell page-fade-in" data-testid="result-page">
          <header className="flex flex-col gap-3">
            <h1 className="text-display font-display font-medium tracking-tight">
              实时成绩单
            </h1>
            <p className="text-body text-text-secondary">
              请在首页点「在线房间」创建房间后再来查看战绩。
            </p>
          </header>
          <Card>
            <div className="flex flex-col gap-3" data-testid="result-fallback">
              <Link href="/" className="w-full" data-testid="result-back-home">
                <Button variant="primary" className="w-full">
                  返回首页创建房间
                </Button>
              </Link>
            </div>
          </Card>
          <OutcomeErrorBanner />
          <ResultCelebration />
        </main>
      </ViewTransition>
    );
  }

  // Branches 2 + 3: loadRecordByRoom returns null when no row, full
  // GameStats when present. Service-layer pure function; transport
  // mapping is the responsibility of any 4xx problem+json wrapper.
  let stats: GameStats | null;
  let loadError: string | null = null;
  try {
    stats = await loadRecordByRoom(room);
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
            房间：
            <span className="ml-2 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 font-mono text-text-primary">
              {room}
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
              {/* W-R (ulw-online-reset-and-result-fresh D-3): 清空入口只在
                  有账本的分支 3 — 分支 2 无可清之物不挂，loadError 与
                  fallback 不挂。room 由上方 normalizeRoom 结果传入，
                  SSR 零 localStorage 读。 */}
              <div className="flex justify-end gap-2">
                <ResetRoomStatsButton room={room} />
                <LeaveRoomButton room={room} />
                <DeleteRoomButton room={room} />
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-3" data-testid="result-actions">
          <Link href="/online" className="w-full" data-testid="play-again">
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
        <OutcomeErrorBanner />
        <ResultCelebration />
      </main>
    </ViewTransition>
  );
}
