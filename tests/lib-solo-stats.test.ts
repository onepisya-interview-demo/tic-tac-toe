import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearLastMergedLocal,
  clearSoloStats,
  clearSyncedServerTotal,
  loadLastMergedLocal,
  loadSoloStats,
  loadSyncedServerTotal,
  pendingSyncCount,
  persistLastMergedLocal,
  persistSoloStats,
  persistSyncedServerTotal,
  SOLO_LAST_MERGED_LOCAL_KEY,
  SOLO_STATS_KEY,
  SOLO_SYNCED_SERVER_KEY,
} from '@/lib/solo-stats';

// Browser-persisted preference tests for lib/solo-stats.ts. Covers
// the B-T4 sync-sentinel helpers that solve the “manual sync must
// NOT double-count after a successful auto-POST” contract. jsdom
// provides a real localStorage so these tests use it directly.

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lib/solo-stats sync sentinel', () => {
  it('loadSyncedServerTotal returns 0 when nothing is persisted', () => {
    expect(loadSyncedServerTotal()).toBe(0);
  });

  it('persistSyncedServerTotal + load roundtrip', () => {
    persistSyncedServerTotal(7);
    expect(loadSyncedServerTotal()).toBe(7);
    expect(window.localStorage.getItem(SOLO_SYNCED_SERVER_KEY)).toBe('7');
  });

  it('clearSyncedServerTotal removes the sentinel', () => {
    persistSyncedServerTotal(3);
    clearSyncedServerTotal();
    expect(loadSyncedServerTotal()).toBe(0);
    expect(window.localStorage.getItem(SOLO_SYNCED_SERVER_KEY)).toBeNull();
  });

  it('loadSyncedServerTotal coerces non-finite values to 0', () => {
    window.localStorage.setItem(SOLO_SYNCED_SERVER_KEY, 'not-a-number');
    expect(loadSyncedServerTotal()).toBe(0);
    window.localStorage.setItem(SOLO_SYNCED_SERVER_KEY, '-5');
    expect(loadSyncedServerTotal()).toBe(0);
  });

  it('pendingSyncCount = local.totalGames - lastMergedLocal (positive diff)', () => {
    // F1 fix: the diff is now against the baseline (post-merge local),
    // not the server-absolute totalGames.
    persistSoloStats({ totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 });
    persistLastMergedLocal(3);
    expect(pendingSyncCount()).toBe(2);
  });

  it('pendingSyncCount clamps to 0 when local <= baseline (nothing new since last merge)', () => {
    // F1: the post-merge baseline is the local count captured right
    // after clearSoloStats() (= 0). If local has not advanced past
    // that point, the dialog must stay silent.
    persistSoloStats({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 });
    persistLastMergedLocal(1);
    expect(pendingSyncCount()).toBe(0);
  });

  it('pendingSyncCount is 0 on a fresh context (sentinel = 0 + empty local)', () => {
    expect(pendingSyncCount()).toBe(0);
    expect(loadSoloStats().totalGames).toBe(0);
  });

  it('clearSoloStats does NOT touch the baseline sentinel (only clears the local row)', () => {
    // F1: the new contract still keeps the baseline independent of
    // the stats row. The producer (HomeDialogMount) writes the
    // baseline explicitly via persistLastMergedLocal(0) right after
    // clearSoloStats(); the test asserts the helper itself doesn't
    // collapse both into one operation.
    persistSoloStats({ totalGames: 2, xWins: 1, oWins: 1, draws: 0, currentStreak: 0 });
    persistLastMergedLocal(2);
    clearSoloStats();
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();
    expect(window.localStorage.getItem(SOLO_LAST_MERGED_LOCAL_KEY)).toBe('2');
  });

  it('persistSyncedServerTotal survives quota errors (fail-soft)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => persistSyncedServerTotal(99)).not.toThrow();
    setItemSpy.mockRestore();
  });

  // ── F1: new baseline sentinel (W4) ───────────────────────────────
  it('loadLastMergedLocal returns 0 when nothing is persisted', () => {
    expect(loadLastMergedLocal()).toBe(0);
  });

  it('persistLastMergedLocal + load roundtrip', () => {
    persistLastMergedLocal(7);
    expect(loadLastMergedLocal()).toBe(7);
    expect(window.localStorage.getItem(SOLO_LAST_MERGED_LOCAL_KEY)).toBe('7');
  });

  it('clearLastMergedLocal removes the baseline sentinel', () => {
    persistLastMergedLocal(3);
    clearLastMergedLocal();
    expect(loadLastMergedLocal()).toBe(0);
    expect(window.localStorage.getItem(SOLO_LAST_MERGED_LOCAL_KEY)).toBeNull();
  });

  it('loadLastMergedLocal coerces non-finite values to 0', () => {
    window.localStorage.setItem(SOLO_LAST_MERGED_LOCAL_KEY, 'not-a-number');
    expect(loadLastMergedLocal()).toBe(0);
    window.localStorage.setItem(SOLO_LAST_MERGED_LOCAL_KEY, '-5');
    expect(loadLastMergedLocal()).toBe(0);
  });

  it('pendingSyncCount = local when baseline is 0 (post-merge fresh state)', () => {
    // F1: canonical post-merge state is baseline=0 + local=0
    // (clearSoloStats already ran). After 3 new games, pending = 3.
    persistSoloStats({ totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 2 });
    expect(pendingSyncCount()).toBe(3);
  });

  it('persistLastMergedLocal survives quota errors (fail-soft)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => persistLastMergedLocal(99)).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('F1 catch-up window fix: pending reflects FULL local snapshot, not server diff', () => {
    // Scenario V4 MINOR-F1 flagged:
    //   pre-merge: server=3, local=3 (post-clear=0)
    //   play 4 games locally: local=4, server still 3
    //   old model: pending = max(0, 4 - 3) = 1 (under-report; 4 will actually be sent)
    //   new model: pending = max(0, 4 - 0) = 4 (text matches payload)
    persistSoloStats({ totalGames: 4, xWins: 3, oWins: 0, draws: 1, currentStreak: 3 });
    // Old sentinel (server-absolute) is left set to 3 to prove it is
    // no longer the source of truth.
    persistSyncedServerTotal(3);
    expect(pendingSyncCount()).toBe(4);
  });
});
