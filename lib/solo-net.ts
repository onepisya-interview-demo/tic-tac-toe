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
 * POST /api/solo-stats with { name, outcome } → { stats: GameStats }.
 * The handler is server-authoritative, so the value returned is the
 * canonical row after the accumulation — callers adopt it as the new
 * panel state to avoid the client-side double-count bug solo-stats.ts
 * doc comments name.
 */
export async function postSoloOutcome(
  name: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<SoloFetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout('/api/solo-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, outcome }),
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
