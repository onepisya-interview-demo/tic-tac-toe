// Solo-mode stats persistence on top of browser localStorage.
// Modeled after lib/sound.ts (browser-persisted preference in its own
// module): kept out of store.ts so the store engine stays about game
// lifecycle + API sync, and so consumers that only need the persisted
// baseline (e.g. a future solo stats panel) don't have to import the
// whole store. All reads/writes are guarded and fail soft — private
// browsing mode and quota errors degrade to in-memory stats instead of
// throwing mid-game.

import { emptyStats, type GameStats } from './game';

/** localStorage key for solo-mode stats. Versioned for future shape changes. */
export const SOLO_STATS_KEY = 'ttt.solo.stats.v1';

function isGameStats(value: unknown): value is GameStats {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.totalGames === 'number' && Number.isFinite(s.totalGames) &&
    typeof s.xWins === 'number' && Number.isFinite(s.xWins) &&
    typeof s.oWins === 'number' && Number.isFinite(s.oWins) &&
    typeof s.draws === 'number' && Number.isFinite(s.draws) &&
    typeof s.currentStreak === 'number' && Number.isFinite(s.currentStreak)
  );
}

/**
 * Read the persisted solo baseline. SSR-safe (no window → emptyStats)
 * and corruption-safe: missing key, invalid JSON, or a value whose
 * shape doesn't match GameStats all degrade to emptyStats().
 */
export function loadSoloStats(): GameStats {
  if (typeof window === 'undefined') return emptyStats();
  try {
    const raw = window.localStorage.getItem(SOLO_STATS_KEY);
    if (raw === null) return emptyStats();
    const parsed: unknown = JSON.parse(raw);
    return isGameStats(parsed) ? parsed : emptyStats();
  } catch {
    return emptyStats();
  }
}

/**
 * Persist the solo stats row. Failures (quota, privacy mode) are
 * swallowed: the store's internal cache stays correct in memory, only
 * cross-reload persistence is lost.
 */
export function persistSoloStats(stats: GameStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOLO_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Degrade to in-memory persistence (same contract as sound.ts).
  }
}

/** Remove the persisted solo row. Failure is swallowed for symmetry. */
export function clearSoloStats(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SOLO_STATS_KEY);
  } catch {
    // Nothing to recover — the key may simply not exist.
  }
}
