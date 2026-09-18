import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPlayerStats, postMerge, postOutcome, postSession } from '@/lib/game-net';

// lib/game-net.ts is the browser-side HTTP wrapper for the W2
// RESTful per-player surface. These tests pin the { ok, reason }
// result contract — successful 2xx, non-2xx, abort (timeout), and
// thrown network errors all collapse into the same shape so the
// dialog + online card can show their UI without a try/catch at
// every call site. fetchPlayerStats additionally maps 404 → { stats:
// null } so display code never inspects status codes.

describe('lib/game-net / postSession', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/sessions with { name } and returns { stats, existed:false } on fresh name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 }, existed: false }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postSession('eve');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.existed).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'eve' }),
      }),
    );
  });

  it('returns { existed: true } when the name row already exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 }, existed: true }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postSession('existingname');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.existed).toBe(true);
      expect(r.value.stats.totalGames).toBe(5);
    }
  });

  it('returns ok:false http-error on 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid player name' }), { status: 422 }),
    );
    const r = await postSession('bad\x00name');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(422);
    }
  });
});

describe('lib/game-net / fetchPlayerStats', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('GETs /api/players/{name}/stats and returns { stats } on a 200 with a row', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await fetchPlayerStats('alice');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stats).toEqual({
        totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1,
      });
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/players/alice/stats',
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
    const r = await fetchPlayerStats('ghost');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stats).toBeNull();
  });

  it('returns ok:false http-error on a 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 422, headers: { 'content-type': 'application/problem+json' } }),
    );
    const r = await fetchPlayerStats('bad name');
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
    const r = await fetchPlayerStats('carol');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('aborted');
  });

  it('returns ok:false network-error on a generic thrown error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await fetchPlayerStats('dave');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network-error');
  });

  it('URL-encodes the player name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ stats: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await fetchPlayerStats('名字 with space');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0];
    expect(typeof url).toBe('string');
    expect(url as string).toContain('/api/players/');
    expect(url as string).toContain('%E5%90%8D%E5%AD%97');
    expect(url as string).toContain('%20with%20space');
    expect(url as string).toContain('/stats');
  });
});

describe('lib/game-net / postMerge', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/players/{name}/stats/merge with { stats }', async () => {
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
      '/api/players/alice/stats/merge',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          stats: { totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 1 },
        }),
      }),
    );
  });

  it('returns ok:false http-error status=409 when the name row is absent', async () => {
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

  it('POSTs to /api/players/{name}/stats/outcomes with { outcome }', async () => {
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
      '/api/players/alice/stats/outcomes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ outcome: 'X' }),
      }),
    );
  });

  it('returns ok:false http-error status=404 when the name row is absent (no silent create)', async () => {
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
