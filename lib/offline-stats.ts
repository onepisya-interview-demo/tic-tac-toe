// Offline-mode stats persistence on top of browser localStorage.
// Modeled after lib/sound.ts (browser-persisted preference in its own
// module): kept out of store.ts so the store engine stays about game
// lifecycle + API sync, and so consumers that only need the persisted
// baseline (e.g. a future solo stats panel) don't have to import the
// whole store. All reads/writes are guarded and fail soft — private
// browsing mode and quota errors degrade to in-memory stats instead of
// throwing mid-game.

import { emptyStats, type GameStats } from './game';

/** localStorage key for offline-mode stats. Versioned for future shape changes. */
export const OFFLINE_STATS_KEY = 'ttt.offline.stats.v1';

function isGameStats(value: unknown): value is GameStats {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  // Type-checks above only confirm the five known fields are finite
  // numbers; without an explicit key-set check we still accept *extra*
  // properties (`__proto__`, `constructor`, `polluted`, etc.) as part
  // of the GameStats contract. The strict whitelist below closes the
  // contract gap: a parsed JSON object is accepted iff it has exactly
  // the five GameStats keys and nothing else. Persistence path
  // self-heals on the next `recordOutcome` (pure spread), but the
  // load-time contract is now explicit.
  return (
    typeof s.totalGames === 'number' && Number.isFinite(s.totalGames) &&
    typeof s.xWins === 'number' && Number.isFinite(s.xWins) &&
    typeof s.oWins === 'number' && Number.isFinite(s.oWins) &&
    typeof s.draws === 'number' && Number.isFinite(s.draws) &&
    typeof s.currentStreak === 'number' && Number.isFinite(s.currentStreak) &&
    Object.keys(s).sort().join(',') === 'currentStreak,draws,oWins,totalGames,xWins'
  );
}

/**
 * Read the persisted solo baseline. SSR-safe (no window → emptyStats)
 * and corruption-safe: missing key, invalid JSON, or a value whose
 * shape doesn't match GameStats all degrade to emptyStats().
 */
export function loadOfflineStats(): GameStats {
  if (typeof window === 'undefined') return emptyStats();
  try {
    const raw = window.localStorage.getItem(OFFLINE_STATS_KEY);
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
export function persistOfflineStats(stats: GameStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Degrade to in-memory persistence (same contract as sound.ts).
  }
}

/** Remove the persisted offline row. Failure is swallowed for symmetry. */
export function clearOfflineStats(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_STATS_KEY);
  } catch {
    // Nothing to recover — the key may simply not exist.
  }
}

/**
 * @deprecated W4 F1 fix: superseded by OFFLINE_LAST_MERGED_LOCAL_KEY.
 * The old sentinel stored the server’s absolute totalGames, which produced a
 * catch-up window where the dialog text and the actual /sync payload
 * diverged. See OFFLINE_LAST_MERGED_LOCAL_KEY below; new callers must use it.
 * Kept for backward-compat reads (older localStorage values are simply
 * ignored by the new pendingSyncCount) and for the test surface that
 * still asserts the old helpers exist.
 * Written by the store after every successful solo POST (auto or
 * manual merge) and by the manual-sync-confirm handler; read by the
 * panel to compute the unsynced-diff = local.totalGames - synced.
 * Solves the “auto-POST happens for every named game, so local
 * always matches server — manual sync must NOT double-count”
 * contract (ulw-solo-sync-rebuild.md B-T4 step 2 precondition).
 */
export const OFFLINE_SYNCED_SERVER_KEY = 'ttt.offline.server.synced.v1';

/** Read the most-recent server-confirmed totalGames. SSR-safe. */
export function loadSyncedServerTotal(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SYNCED_SERVER_KEY);
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Persist the server-confirmed totalGames. Failures are swallowed. */
export function persistSyncedServerTotal(totalGames: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_SYNCED_SERVER_KEY, String(totalGames));
  } catch {
    // Degrade to in-memory only.
  }
}

/**
 * Baseline sentinel: the local totalGames value AT the most recent
 * successful merge (W4 F1 fix).  Captured right after
 * `clearOfflineStats()` runs — the post-clear local is emptyStats()
 * with totalGames=0, so the canonical post-merge value is `0`.
 * `pendingSyncCount()` now reads THIS sentinel instead of
 * `OFFLINE_SYNCED_SERVER_KEY` so the dialog text “本机 N 局” matches the
 * data that `postSoloSync` actually sends (the entire current
 * `loadOfflineStats()` snapshot, not a server-relative diff).
 *
 * Why not keep the old sentinel: after a merge the server’s absolute
 * totalGames was used as the baseline, so any local games played
 * before the next merge appeared as `local - server = 0` for the
 * entire catch-up window. The dialog either stayed silent (n ≤
 * server) or under-reported the count (n > server). The baseline
 * model — track the post-merge LOCAL count (always 0 after clear)
 * — eliminates the window: `pending = local - 0 = local`, the text
 * always matches the request, and the existing
 * `per-field server accumulation + local clear` invariant
 * (server never double-counts) is unchanged.
 */
export const OFFLINE_LAST_MERGED_LOCAL_KEY = 'ttt.offline.last-merged-local.v1';

/** Read the most-recent post-merge local totalGames (0 on first load). SSR-safe. */
export function loadLastMergedLocal(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(OFFLINE_LAST_MERGED_LOCAL_KEY);
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Persist the post-merge local baseline. Failures are swallowed. */
export function persistLastMergedLocal(totalGames: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_LAST_MERGED_LOCAL_KEY, String(totalGames));
  } catch {
    // Degrade to in-memory only.
  }
}

/** Remove the baseline — used after a successful merge so the next
 *  dialog open sees the canonical post-clear state (baseline = 0).
 *  Equivalent to `persistLastMergedLocal(0)` for the new model, but
 *  removing the key keeps the post-merge localStorage footprint
 *  symmetric (no key + no stats key = same shape as fresh context).
 */
export function clearLastMergedLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_LAST_MERGED_LOCAL_KEY);
  } catch {
    // Nothing to recover.
  }
}

export function clearSyncedServerTotal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_SYNCED_SERVER_KEY);
  } catch {
    // Nothing to recover.
  }
}

/**
 * Compute the unsynced-diff = local.totalGames - lastMergedLocal.
 * Positive = there are unsynced games pending push; zero = local
 * already matches the last successful merge point; negative = the
 * baseline is ahead of local (impossible under the W4 model since
 * baseline is set to 0 right after a merge that also clears local,
 * but the clamp is kept for safety).
 *
 * W4 F1: the dialog now reads this value verbatim as “本机 N 局”
 * (the count the user is about to push). The previous
 * server-absolute sentinel left a catch-up window where the text
 * under-reported the actual payload. The baseline sentinel — the
 * post-merge local totalGames, always 0 right after a clear — makes
 * `pending === local` and the text matches the request.
 */
export function pendingSyncCount(): number {
  const local = loadOfflineStats();
  const baseline = loadLastMergedLocal();
  return Math.max(0, local.totalGames - baseline);
}
