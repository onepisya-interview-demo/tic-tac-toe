// Browser-side HTTP helpers for the solo_stats server-authoritative
// accumulator at /api/solo-stats (server-authoritative writes go through
// POST; the panel pulls the canonical row with GET). Modeled after the
// store's withTimeout pattern (lib/store.ts:NETWORK_TIMEOUT_MS = 8000
// ms) so a Turso HTTP hang past 8 s surfaces as { ok: false, reason }
// instead of freezing the reset-button / sync-button UI for 30 s like the
// B-2 reset observed on the ranked ledger.

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
 * PUT /api/solo-stats with { name } → { stats: GameStats }. The
 * handler is idempotent: a fresh name returns the just-inserted empty
 * row, an existing name returns the existing row untouched. Mirrors
 * the { ok, value } | { ok, false, reason } contract used by the GET
 * and POST helpers above so the PlayerNameForm caller can fire-and-
 * forget without try/catch — UI stays correct regardless of network
 * outcome, the network write is only a durability aid for the
 * “save name on device A, pick it up on device B” flow.
 */
export async function putSoloName(
  name: string,
): Promise<SoloFetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout('/api/solo-stats', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
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

/**
 * POST /api/solo-stats/sync with { name, stats } → { stats: GameStats }.
 * Server folds client totals into the per-name row via accumulate per-
 * field addition (ulw-solo-sync-rebuild.md B-T2 / B-T4). Caller (the
 * sync-confirm dialog flow) adopts the server's answer as the panel
 * state, then clears local solo stats. Same { ok, value } | { ok, false,
 * reason } contract as putSoloName so the caller can branch on the
 * server's authoritative answer without try/catch.
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
