import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/players-stats.test.ts — route-level coverage for the three
// /api/players/{name}/stats/* handlers (W2 ulw-one-game-two-versions):
//   GET  /api/players/{name}/stats          — read-only row lookup
//   POST /api/players/{name}/stats/merge    — cross-device fold (per-field add)
//   POST /api/players/{name}/stats/outcomes — server-authoritative accumulator
//
// Imports each route file's exported function directly and stubs out
// lib/db so we can pin the contract — name whitelist
// (lib/player-name.ts:normalizePlayerName is the single source of
// truth, replacing the per-route duplication that AGENTS.md §本项目反模式
// flagged), GameStats shape guard, 2xx/4xx codes, and the
// application/problem+json envelope — without touching sqlite.
// End-to-end DB integration is covered by tests/db/db.test.ts (the
// upstream primitive).

const loadSoloRecordMock = vi.fn();
const mergeSoloRecordMock = vi.fn();
const recordOutcomeForNameMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  loadSoloRecord: loadSoloRecordMock,
  mergeSoloRecord: mergeSoloRecordMock,
  recordOutcomeForName: recordOutcomeForNameMock,
}));

const loadStatsRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadSoloRecord: loadSoloRecordMock,
  }));
  return import('@/app/api/players/[name]/stats/route');
};
const loadMergeRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadSoloRecord: loadSoloRecordMock,
    mergeSoloRecord: mergeSoloRecordMock,
  }));
  return import('@/app/api/players/[name]/stats/merge/route');
};
const loadOutcomesRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadSoloRecord: loadSoloRecordMock,
    recordOutcomeForName: recordOutcomeForNameMock,
  }));
  return import('@/app/api/players/[name]/stats/outcomes/route');
};

/** Assert a problem+json response shape: status, content-type, and the
 *  RFC 9457 §3.1 body fields are present and self-consistent. */
function expectProblemJson(res: Response, expectedStatus: number, expectedSlug: string): Promise<{ type: string; title: string; status: number; detail?: string }> {
  expect(res.status).toBe(expectedStatus);
  expect(res.headers.get('content-type')).toBe('application/problem+json');
  return res.json().then((body: { type: string; title: string; status: number; detail?: string }) => {
    expect(body.status).toBe(expectedStatus);
    expect(body.type).toBe(`https://docs.example.com/probs/${expectedSlug}`);
    expect(typeof body.title).toBe('string');
    expect(body.title.length).toBeGreaterThan(0);
    return body;
  });
}

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  loadSoloRecordMock.mockReset();
  mergeSoloRecordMock.mockReset();
  recordOutcomeForNameMock.mockReset();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

const ctxParams = (name: string): { params: Promise<{ name: string }> } => ({
  params: Promise.resolve({ name }),
});

describe('app/api/players/[name]/stats/route — GET', () => {
  describe('name whitelist', () => {
    it('returns 422 problem+json (invalid-player-name) for a name longer than 24 characters', async () => {
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request(`http://localhost/api/players/${'a'.repeat(25)}/stats`),
        ctxParams('a'.repeat(25)),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('returns 422 problem+json (invalid-player-name) when the name contains a control character', async () => {
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/players/bad%07name/stats'),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('returns 422 problem+json (invalid-player-name) when the name is whitespace-only after trim', async () => {
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/players/%20%20%20/stats'),
        ctxParams('   '),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });
  });

  describe('row lookup', () => {
    it('returns 404 problem+json (stats-not-found) on a fresh name', async () => {
      loadSoloRecordMock.mockResolvedValue(null);
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/players/alice/stats'),
        ctxParams('alice'),
      );
      const body = await expectProblemJson(res, 404, 'stats-not-found');
      // The 404 problem+json carries the missing name in `detail` so
      // logs / devs can trace the lookup without a separate trace span.
      expect(body.detail).toContain('alice');
    });

    it('returns 200 application/json { stats } on a known name', async () => {
      loadSoloRecordMock.mockResolvedValue({
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/players/bob/stats'),
        ctxParams('bob'),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 4, xWins: 3, oWins: 0, draws: 1, currentStreak: -1 },
      });
    });

    it('returns 500 problem+json (db-unavailable) when loadSoloRecord throws', async () => {
      loadSoloRecordMock.mockRejectedValue(new Error('boom'));
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/players/carol/stats'),
        ctxParams('carol'),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
    });
  });
});

describe('app/api/players/[name]/stats/merge/route — POST', () => {
  describe('input validation', () => {
    it('returns 422 problem+json (invalid-player-name) for a control char in name', async () => {
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/bad%07name/stats/merge', {
          method: 'POST',
          body: JSON.stringify({ stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 } }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('returns 400 problem+json (invalid-json) on malformed json body', async () => {
      loadSoloRecordMock.mockResolvedValue({
        totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
      });
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/merge', {
          method: 'POST',
          body: 'not json',
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 400, 'invalid-json');
    });

    it('returns 422 problem+json (invalid-request-shape) when stats is missing', async () => {
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/merge', {
          method: 'POST',
          body: JSON.stringify({ name: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });

    it('returns 422 problem+json (invalid-request-shape) when stats has extra keys', async () => {
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/merge', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0, polluted: true },
          }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });

    it('returns 422 problem+json (invalid-request-shape) when stats contains a NaN', async () => {
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/merge', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 1, xWins: NaN, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });
  });

  describe('merge behaviour', () => {
    it('returns 200 { stats } after mergeSoloRecord folds client totals into server row', async () => {
      loadSoloRecordMock.mockResolvedValue({
        totalGames: 2, xWins: 1, oWins: 0, draws: 1, currentStreak: 1,
      });
      mergeSoloRecordMock.mockResolvedValue({
        totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2,
      });
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/merge', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2 },
      });
      expect(mergeSoloRecordMock).toHaveBeenCalledWith('alice', {
        totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 0,
      });
    });

    it('returns 409 problem+json (player-session-required) when the name row is absent (no silent create)', async () => {
      loadSoloRecordMock.mockResolvedValue(null);
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/ghost/stats/merge', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 1 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('ghost'),
      );
      const body = await expectProblemJson(res, 409, 'player-session-required');
      expect(body.detail).toContain('ghost');
      // The 409 short-circuits before mergeSoloRecord runs — forged
      // merge requests cannot trigger an upsert behind the user's back.
      expect(mergeSoloRecordMock).not.toHaveBeenCalled();
    });

    it('returns 500 problem+json (db-unavailable) when mergeSoloRecord throws', async () => {
      loadSoloRecordMock.mockResolvedValue({
        totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
      });
      mergeSoloRecordMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/merge', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
    });
  });
});

describe('app/api/players/[name]/stats/outcomes/route — POST', () => {
  describe('input validation', () => {
    it('returns 422 problem+json (invalid-player-name) when name has a control char', async () => {
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/players/bad%07name/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('returns 422 problem+json (invalid-request-shape) when outcome is not X|O|draw', async () => {
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'Z' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });

    it('returns 422 problem+json (invalid-request-shape) when body has extra keys', async () => {
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'X', extra: 1 }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });
  });

  describe('outcome accumulation', () => {
    it('returns 200 { stats } after recordOutcomeForName accumulates on an existing row', async () => {
      loadSoloRecordMock.mockResolvedValue({
        totalGames: 2, xWins: 1, oWins: 1, draws: 0, currentStreak: 1,
      });
      recordOutcomeForNameMock.mockResolvedValue({
        ok: true,
        stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 2 },
      });
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 2 },
      });
      expect(recordOutcomeForNameMock).toHaveBeenCalledWith('alice', 'X');
    });

    it('returns 404 problem+json (stats-not-found) when the name row is absent (no silent create)', async () => {
      recordOutcomeForNameMock.mockResolvedValue({ ok: false, reason: 'not-found' });
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/players/ghost/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'draw' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('ghost'),
      );
      const body = await expectProblemJson(res, 404, 'stats-not-found');
      expect(body.detail).toContain('ghost');
    });

    it('returns 500 problem+json (db-unavailable) when recordOutcomeForName throws', async () => {
      recordOutcomeForNameMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/players/alice/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
    });
  });
});
