'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import type { GameStats } from '@/lib/game';

/**
 * RSC fetches stats via await loadStats() and passes them as props.
 * StatsHydrator seeds the store's internal stats cache from those props
 * so makeMove's recordOutcome computes newStats from the correct baseline.
 * Without this, the first PUT would overwrite DB with values derived from
 * emptyStats().
 */
export function StatsHydrator({ stats }: { stats: GameStats }) {
  useEffect(() => {
    useGameStore.getState().setInitialStats(stats);
  }, [stats]);
  return null;
}
