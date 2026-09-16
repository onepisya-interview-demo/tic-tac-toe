import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearSoloStats,
  clearSyncedServerTotal,
  loadSoloStats,
  loadSyncedServerTotal,
  pendingSyncCount,
  persistSoloStats,
  persistSyncedServerTotal,
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

  it('pendingSyncCount = local.totalGames - synced (positive diff)', () => {
    persistSoloStats({ totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 });
    persistSyncedServerTotal(3);
    expect(pendingSyncCount()).toBe(2);
  });

  it('pendingSyncCount clamps to 0 when local <= synced (auto-POST caught up)', () => {
    persistSoloStats({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 });
    persistSyncedServerTotal(1);
    expect(pendingSyncCount()).toBe(0);
  });

  it('pendingSyncCount is 0 on a fresh context (sentinel = 0 + empty local)', () => {
    expect(pendingSyncCount()).toBe(0);
    expect(loadSoloStats().totalGames).toBe(0);
  });

  it('clearSoloStats does NOT touch the sentinel (only clears the local row)', () => {
    persistSoloStats({ totalGames: 2, xWins: 1, oWins: 1, draws: 0, currentStreak: 0 });
    persistSyncedServerTotal(2);
    clearSoloStats();
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();
    expect(window.localStorage.getItem(SOLO_SYNCED_SERVER_KEY)).toBe('2');
  });

  it('persistSyncedServerTotal survives quota errors (fail-soft)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => persistSyncedServerTotal(99)).not.toThrow();
    setItemSpy.mockRestore();
  });
});
