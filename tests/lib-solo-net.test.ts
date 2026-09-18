import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSoloStats, postPlayerSession, postSoloSync } from '@/lib/solo-net';

// lib/solo-net.ts is the browser-side HTTP wrapper for the solo /
// player-session server-authoritative surface. These tests pin the
// { ok, reason } result contract — successful 2xx, non-2xx, abort
// (timeout), and thrown network errors all collapse into the same
// shape so the dialog can show the sync button without a try/catch
// at every call site.

describe('lib/solo-net / fetchSoloStats', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { stats } on a 200 with a row', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const r = await fetchSoloStats('alice');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stats).toEqual({
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/solo-stats?name=alice',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('returns { stats: null } on a 200 with no row (fresh player)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ stats: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const r = await fetchSoloStats('bob');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stats).toBeNull();
  });

  it('returns ok:false http-error on a 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid player name' }), { status: 422 }),
    );
    const r = await fetchSoloStats('bad name with control\x00char');
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
    const r = await fetchSoloStats('carol');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('aborted');
  });

  it('returns ok:false network-error on a generic thrown error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await fetchSoloStats('dave');
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
    await fetchSoloStats('名字 with space');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0];
    expect(typeof url).toBe('string');
    expect(url as string).toContain('%E5%90%8D%E5%AD%97');
    expect(url as string).toContain('%20with%20space');
  });
});

describe('lib/solo-net / postPlayerSession', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/player-session with { name } and returns { stats, existed:false } on fresh name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 }, existed: false }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postPlayerSession('eve');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.existed).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/player-session',
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
    const r = await postPlayerSession('existingname');
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
    const r = await postPlayerSession('bad\x00name');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(422);
    }
  });
});

describe('lib/solo-net / postSoloSync', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/solo-stats/sync with { name, stats }', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ stats: { totalGames: 6, xWins: 4, oWins: 1, draws: 1, currentStreak: 3 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await postSoloSync('alice', {
      totalGames: 3,
      xWins: 2,
      oWins: 0,
      draws: 1,
      currentStreak: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stats.totalGames).toBe(6);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/solo-stats/sync',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'alice',
          stats: { totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 1 },
        }),
      }),
    );
  });

  it('returns ok:false http-error status=409 when the name row is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'player session required' }), { status: 409 }),
    );
    const r = await postSoloSync('ghost', {
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('http-error');
      expect(r.status).toBe(409);
    }
  });
});
