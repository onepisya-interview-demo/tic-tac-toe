// Browser-side HTTP helpers for the solo_stats server-authoritative
// surface. Modeled after the store's withTimeout pattern (lib/store.ts:
// NETWORK_TIMEOUT_MS = 8000 ms) so a Turso HTTP hang past 8 s surfaces
// as { ok: false, reason } instead of freezing the sync-confirm dialog
// for 30 s like the B-2 reset observed on the ranked ledger.
//
// W3 (ulw-name-login-one-truth) collapsed three callers into one:
//  - Registration / login: POST /api/player-session (returns
//    { stats, existed } so the client can branch on 注册 vs 登录).
//  - Read-only online stats display on the home page:
//    GET /api/solo-stats?name=… (response stays in component state
//    only — never written to localStorage or store.solo; ulw A2
//    red-line).
//  - Manual merge from the home-return SyncConfirmDialog:
//    POST /api/solo-stats/sync { name, stats } → server folds the
//    local row into the per-name row, returns the merged row. The
//    client clears local + sentinel after success.
//
// PUT was retired in W3 (idempotent empty-row bootstrap is no longer
// needed: registration is the only entry point, and it goes through
// /api/player-session).

import { type GameStats } from './game';

/** 8 s — matches lib/store.ts NETWORK_TIMEOUT_MS; see HAR §P2 evidence. */
const NETWORK_TIMEOUT_MS = 8000;

export type SoloFetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'aborted' | 'network-error' | 'http-error'; status?: number };

function withTimeout(
  url: string,
  init: RequestInit,
  ms: number = NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('aborted', 'TimeoutError'));
  }, ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function reasonFromError(err: unknown): 'aborted' | 'network-error' {
  return err instanceof DOMException && err.name === 'TimeoutError'
    ? 'aborted'
    : 'network-error';
}

/**
 * GET /api/solo-stats?name=... → { stats: GameStats | null }.
 * `null` is the server's "row absent" answer (fresh name); HTTP errors
 * and aborts collapse into { ok: false, ... } so the caller can show a
 * fallback without a try/catch at every call site.
 *
 * W3 contract: the response lives in component state only. Do NOT
 * write the value to localStorage or store.solo — the online row is
 * display-only (ulw-name-login-one-truth A2 red-line).
 */
export async function fetchSoloStats(
  name: string,
): Promise<SoloFetchResult<{ stats: GameStats | null }>> {
  try {
    const r = await withTimeout(
      `/api/solo-stats?name=${encodeURIComponent(name)}`,
      { method: 'GET', cache: 'no-store' },
    );
    if (!r.ok) {
      return { ok: false, reason: 'http-error', status: r.status };
    }
    const value = (await r.json()) as { stats: GameStats | null };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

/**
 * POST /api/player-session with { name } → { stats, existed }.
 * Server-side register-or-login primitive
 * (ulw-name-login-one-truth W1): a fresh name creates the row and
 * returns existed:false (注册); an existing name returns its row and
 * existed:true (登录). UNIQUE on game_stats.name + the absent rename
 * endpoint together make the name immutable — a returning user who
 * types the same name always lands on the same row.
 *
 * Used by PlayerNameForm on the home page and by the SyncConfirmDialog
 * name-input flow (when the user has no name yet and tries to merge).
 */
export async function postPlayerSession(
  name: string,
): Promise<SoloFetchResult<{ stats: GameStats; existed: boolean }>> {
  try {
    const r = await withTimeout('/api/player-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) {
      return { ok: false, reason: 'http-error', status: r.status };
    }
    const value = (await r.json()) as { stats: GameStats; existed: boolean };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}

/**
 * POST /api/solo-stats/sync with { name, stats } → { stats: GameStats }.
 * Server folds client totals into the per-name row via accumulate per-
 * field addition. Caller (the home-return SyncConfirmDialog flow) only
 * fires this AFTER a successful postPlayerSession(name) — the server
 * answers 409 if the name row is absent (defensive against a forged
 * merge). On 2xx the caller clears local + sentinel and adopts the
 * returned row as the displayed online stats.
 */
export async function postSoloSync(
  name: string,
  stats: GameStats,
): Promise<SoloFetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout('/api/solo-stats/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, stats }),
    });
    if (!r.ok) {
      return { ok: false, reason: 'http-error', status: r.status };
    }
    const value = (await r.json()) as { stats: GameStats };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}
