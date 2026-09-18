import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSoloStats } from '@/lib/solo-net';

// lib/solo-net.ts is the browser-side HTTP wrapper for /api/solo-stats.
// These tests pin the { ok, reason } result contract — successful 2xx,
// non-2xx, abort (timeout), and thrown network errors all collapse into
// the same shape so the panel can show the sync button without a
// try/catch at every call site.

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
    // Both fetchSpy and the panel call this URL.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0];
    expect(typeof url).toBe('string');
    expect(url as string).toContain('%E5%90%8D%E5%AD%97');
    expect(url as string).toContain('%20with%20space');
  });
});

