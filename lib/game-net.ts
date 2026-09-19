// Browser-side HTTP helpers for the per-room server-authoritative
// RESTful surface (W1 + W2 ulw-room-migration-home-landing).
//
// Thin transport wrapper. Every helper targets exactly one of the
// four app/api/rooms/* endpoints and preserves the { ok, reason } result
// contract from the prior W3 lib/solo-net.ts:
//
//   { ok: true,  value: T }                            — 2xx, body parsed
//   { ok: false, reason: 'http-error', status: N }     — non-2xx (incl. 404)
//   { ok: false, reason: 'aborted' }                   — AbortController fired
//   { ok: false, reason: 'network-error' }             — fetch threw
//
// The read path (fetchRoomStats) translates a 404 into
// `{ ok: true, value: { stats: null } }` so display code branches on
// a single null sentinel instead of inspecting status codes — the
// route itself stays RFC 9457-pure.
//
// 8 s AbortController mirrors lib/store.ts:NETWORK_TIMEOUT_MS so a
// Turso HTTP hang never freezes the UI for 30 s. The store action
// `apiRecordOutcome` is the sole consumer of `postOutcome`; the home-
// return dialog is the sole consumer of `postMerge` + `postRoomSession`
// (run as a register-then-merge sequence); RoomGateDialog is the sole
// consumer of `postRoomSession`; SyncConfirmDialog uses
// `postRoomSession` + `postMerge` for the merge flow.

import { type GameStats } from './game';

/** 8 s — matches lib/store.ts NETWORK_TIMEOUT_MS; see HAR §P2 evidence. */
const NETWORK_TIMEOUT_MS = 8000;

/** Tagged result for every transport call. Stable contract. */
export type FetchResult<T> =
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

function encodeRoom(room: string): string {
  return encodeURIComponent(room);
}

/**
 * POST /api/rooms { room } → { stats, existed }.
 * Idempotent register-or-enter (lib/db.ts:registerOrLoginRoom):
 *   - existed:false → fresh row created
 *   - existed:true  → existing row returned
 * UNIQUE on game_stats.room makes the room immutable across sessions.
 * 422 problem+json when the room fails the whitelist; 500 on db error.
 */
export async function postRoomSession(
  room: string,
): Promise<FetchResult<{ stats: GameStats; existed: boolean }>> {
  try {
    const r = await withTimeout('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room }),
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
 * GET /api/rooms/{room}/stats → { stats: GameStats | null }.
 * The route emits 404 problem+json when the row is absent; we
 * translate that into `{ stats: null }` so display code never
 * inspects status codes. All other non-2xx surface as
 * `{ ok: false, reason: 'http-error', status }`.
 */
export async function fetchRoomStats(
  room: string,
): Promise<FetchResult<{ stats: GameStats | null }>> {
  try {
    const r = await withTimeout(
      `/api/rooms/${encodeRoom(room)}/stats`,
      { method: 'GET', cache: 'no-store' },
    );
    if (r.status === 404) {
      return { ok: true, value: { stats: null } };
    }
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
 * POST /api/rooms/{room}/stats/merge { stats } → { stats: GameStats }.
 * Server folds client totals into the per-room row via per-field
 * addition (lib/db.ts:mergeRecordByRoom). 409 problem+json when the
 * row is absent (caller must run /api/rooms first); the
 * SyncConfirmDialog's `runMergeSequence` translates 409 into a
 * user-facing "需要先登录该账号" message.
 */
export async function postMerge(
  room: string,
  stats: GameStats,
): Promise<FetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout(
      `/api/rooms/${encodeRoom(room)}/stats/merge`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stats }),
      },
    );
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
 * POST /api/rooms/{room}/stats/outcomes { outcome } → { stats: GameStats }.
 * Server-authoritative per-game accumulator
 * (lib/db.ts:recordOutcomeForRoom: load → recordOutcome → upsert).
 * 404 problem+json when the row is absent — silently upserting an
 * empty row on the first outcome would let an unauthenticated client
 * mint a session; refused by the service contract.
 */
export async function postOutcome(
  room: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<FetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout(
      `/api/rooms/${encodeRoom(room)}/stats/outcomes`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome }),
      },
    );
    if (!r.ok) {
      return { ok: false, reason: 'http-error', status: r.status };
    }
    const value = (await r.json()) as { stats: GameStats };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: reasonFromError(err) };
  }
}
