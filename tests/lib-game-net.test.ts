import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchRoomStats,
  postMerge,
  postOutcome,
  postResetRoomStats,
  postRoomSession,
} from '@/lib/game-net';

// lib/game-net.ts is the browser-side HTTP wrapper for the per-room
// RESTful surface. These tests pin the { ok, reason } result
// contract — successful 2xx, non-2xx, abort (timeout), and thrown
// network errors all collapse into the same shape so the dialog +
// display code can show their UI without a try/catch at every call
// site. fetchRoomStats additionally maps 404 → { stats: null } so
// display code never inspects status codes.
//
// W2 (ulw-room-migration-home-landing): postSession →
// postRoomSession (POST /api/rooms), fetchPlayerStats →
// fetchRoomStats (GET /api/rooms/{room}/stats), postMerge /
// postOutcome → /api/rooms/{room}/stats/{merge,outcomes}.

describe('lib/game-net / postRoomSession', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/rooms with { room } and returns { stats, existed:false } on fresh room', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 }, existed: false }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postRoomSession('eve');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.existed).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/rooms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ room: 'eve' }),
      }),
    );
  });

  it('returns { existed: true } when the room row already exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 }, existed: true }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postRoomSession('existingroom');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.existed).toBe(true);
      expect(r.value.stats.totalGames).toBe(5);
    }
  });

  it('returns ok:false http-error on 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid room name' }), { status: 422 }),
    );
    const r = await postRoomSession('bad\x00room');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(422);
    }
  });
});

describe('lib/game-net / fetchRoomStats', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('GETs /api/rooms/{room}/stats and returns { stats } on a 200 with a row', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await fetchRoomStats('alice');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stats).toEqual({
        totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1,
      });
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/rooms/alice/stats',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('maps a 404 to { ok: true, value: { stats: null } } so display code branches on null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const r = await fetchRoomStats('ghost');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stats).toBeNull();
  });

  it('returns ok:false http-error on a 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 422, headers: { 'content-type': 'application/problem+json' } }),
    );
    const r = await fetchRoomStats('bad room');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(422);
    }
  });

  it('returns ok:false aborted on a TimeoutError', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new DOMException('aborted', 'TimeoutError');
    });
    const r = await fetchRoomStats('carol');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('aborted');
  });

  it('returns ok:false network-error on a generic thrown error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await fetchRoomStats('dave');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network-error');
  });

  it('URL-encodes the room name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ stats: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await fetchRoomStats('房间 with space');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0];
    expect(typeof url).toBe('string');
    expect(url as string).toContain('/api/rooms/');
    expect(url as string).toContain('%E6%88%BF%E9%97%B4');
    expect(url as string).toContain('%20with%20space');
    expect(url as string).toContain('/stats');
  });
});

describe('lib/game-net / postMerge', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/rooms/{room}/stats/merge with { stats }', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 6, xWins: 4, oWins: 1, draws: 1, currentStreak: 3 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postMerge('alice', {
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stats.totalGames).toBe(6);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/rooms/alice/stats/merge',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          stats: { totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 1 },
        }),
      }),
    );
  });

  it('returns ok:false http-error status=409 when the room row is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 409,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const r = await postMerge('ghost', {
      totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(409);
    }
  });
});

describe('lib/game-net / postOutcome', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/rooms/{room}/stats/outcomes with { outcome }', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postOutcome('alice', 'X');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stats.totalGames).toBe(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/rooms/alice/stats/outcomes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ outcome: 'X' }),
      }),
    );
  });

  it('returns ok:false http-error status=404 when the room row is absent (no silent create)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const r = await postOutcome('ghost', 'draw');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(404);
    }
  });
});

describe('lib/game-net / postResetRoomStats', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/rooms/{room}/stats/reset with no body and returns the zeroed stats', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postResetRoomStats('alice');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stats).toEqual({
        totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
      });
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/rooms/alice/stats/reset',
      expect.objectContaining({ method: 'POST' }),
    );
    // Endpoint contract: no request body (D-2).
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
  });

  it('returns ok:false http-error status=404 when the room row is absent (no silent create)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const r = await postResetRoomStats('ghost');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(404);
    }
  });
});
