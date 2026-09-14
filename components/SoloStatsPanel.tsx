'use client';

import { useCallback, useEffect, useState } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadSoloStats } from '@/lib/solo-stats';
import { useGameStore } from '@/lib/store';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';

/**
 * Solo-mode stats surface on /solo. Rendering contract:
 * - SSR / first paint shows emptyStats() — never read localStorage in
 *   the server-rendered frame (repo anti-pattern rule; SoundToggle is
 *   the established hydration-safe precedent).
 * - After mount, hydrate from the persisted baseline (loadSoloStats).
 * - When a game settles (phase flips to won/drawn) re-read: the store's
 *   solo branch persists synchronously inside makeMove before React
 *   observes the phase change, so localStorage is always the freshest
 *   row — no store subscription to internal state needed.
 * - The local clear button lives here (not at page level) because only
 *   this panel knows how to refresh itself: ResetStatsButton(scope=
 *   'local') calls back via onCleared and the panel re-reads instantly.
 */
export function SoloStatsPanel() {
  const phase = useGameStore((s) => s.phase);
  const [stats, setStats] = useState<GameStats>(emptyStats);

  const refresh = useCallback(() => {
    setStats(loadSoloStats());
  }, []);

  useEffect(() => {
    // One-shot hydration from localStorage after mount (SoundToggle
    // precedent): localStorage is pull-only — no push updates, no
    // useSyncExternalStore — so the panel renders the SSR-safe
    // emptyStats default first and reconciles post-mount; React bails
    // out of the re-render when the row is already emptyStats.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (phase !== 'won' && phase !== 'drawn') return;
    // Re-read after a settled game: the store persists synchronously
    // inside makeMove before React observes the phase change, so the
    // fresh row is always in localStorage by the time this runs. Same
    // pull-only-source rationale as the mount hydration above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [phase, refresh]);

  return (
    <div className="flex flex-col gap-4" data-testid="solo-stats">
      <h2 className="text-h2 font-display font-medium">单机战绩</h2>
      <StatsGrid stats={stats} />
      <ResetStatsButton scope="local" onCleared={refresh} />
    </div>
  );
}
