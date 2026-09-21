import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/rooms-stats.test.ts — route-level coverage for the three
// /api/rooms/{room}/stats/* handlers (W1 ulw-room-migration-home-landing):
//   GET  /api/rooms/{room}/stats          — read-only row lookup
//   POST /api/rooms/{room}/stats/merge    — cross-device fold (per-field add)
//   POST /api/rooms/{room}/stats/outcomes — server-authoritative accumulator
//
// Imports each route file's exported function directly and stubs out
// lib/db so we can pin the contract — room whitelist
// (lib/room-name.ts:normalizeRoom is the single source of
// truth, replacing the per-route duplication that AGENTS.md §本项目反模式
// flagged), GameStats shape guard, 2xx/4xx codes, and the
// application/problem+json envelope — without touching sqlite.
// End-to-end DB integration is covered by tests/db/db.test.ts (the
// upstream primitive).

const loadRecordMock = vi.fn();
const mergeRecordMock = vi.fn();
const recordOutcomeForRoomMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  loadRecordByRoom: loadRecordMock,
  mergeRecordByRoom: mergeRecordMock,
  recordOutcomeForRoom: recordOutcomeForRoomMock,
}));

const loadStatsRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadRecordByRoom: loadRecordMock,
  }));
  return import('@/app/api/rooms/[room]/stats/route');
};
const loadMergeRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadRecordByRoom: loadRecordMock,
    mergeRecordByRoom: mergeRecordMock,
  }));
  return import('@/app/api/rooms/[room]/stats/merge/route');
};
const loadOutcomesRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadRecordByRoom: loadRecordMock,
    recordOutcomeForRoom: recordOutcomeForRoomMock,
  }));
  return import('@/app/api/rooms/[room]/stats/outcomes/route');
};

/** Assert a problem+json response shape: status, content-type, and the
 *  RFC 9457 §3.1 body fields are present and self-consistent. Pass
 *  expectedTitle to pin the exact human-readable title (required for
 *  the W-C slug-migration titles: invalid-room-name / enter-room-
 *  required / stats-not-found). */
function expectProblemJson(res: Response, expectedStatus: number, expectedSlug: string, expectedTitle?: string): Promise<{ type: string; title: string; status: number; detail?: string }> {
  expect(res.status).toBe(expectedStatus);
  expect(res.headers.get('content-type')).toBe('application/problem+json');
  return res.json().then((body: { type: string; title: string; status: number; detail?: string }) => {
    expect(body.status).toBe(expectedStatus);
    expect(body.type).toBe(`https://docs.example.com/probs/${expectedSlug}`);
    expect(typeof body.title).toBe('string');
    expect(body.title.length).toBeGreaterThan(0);
    if (expectedTitle !== undefined) {
      expect(body.title).toBe(expectedTitle);
    }
    return body;
  });
}

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  loadRecordMock.mockReset();
  mergeRecordMock.mockReset();
  recordOutcomeForRoomMock.mockReset();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

const ctxParams = (room: string): { params: Promise<{ room: string }> } => ({
  params: Promise.resolve({ room }),
});

describe('app/api/rooms/[room]/stats/route — GET', () => {
  describe('room whitelist', () => {
    it('returns 422 problem+json (invalid-room-name) for a room longer than 24 characters', async () => {
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request(`http://localhost/api/rooms/${'a'.repeat(25)}/stats`),
        ctxParams('a'.repeat(25)),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
    });

    it('returns 422 problem+json (invalid-room-name) when the room contains a control character', async () => {
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/rooms/bad%07name/stats'),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
    });

    it('returns 422 problem+json (invalid-room-name) when the room is whitespace-only after trim', async () => {
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/rooms/%20%20%20/stats'),
        ctxParams('   '),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
    });
  });

  describe('row lookup', () => {
    it('returns 404 problem+json (stats-not-found) on a fresh room (N4)', async () => {
      loadRecordMock.mockResolvedValue(null);
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/rooms/alice/stats'),
        ctxParams('alice'),
      );
      // W-C (D-5b): slug stays `stats-not-found`, title de-players to
      // 'Room stats not found' — pin both.
      const body = await expectProblemJson(res, 404, 'stats-not-found', 'Room stats not found');
      // The 404 problem+json carries the missing room in `detail` so
      // logs / devs can trace the lookup without a separate trace span.
      expect(body.detail).toContain('alice');
    });

    it('returns 200 application/json { stats } on a known room', async () => {
      loadRecordMock.mockResolvedValue({
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/rooms/bob/stats'),
        ctxParams('bob'),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 4, xWins: 3, oWins: 0, draws: 1, currentStreak: -1 },
      });
    });

    it('returns 500 problem+json (db-unavailable) when loadRecordByRoom throws', async () => {
      loadRecordMock.mockRejectedValue(new Error('boom'));
      const { GET } = await loadStatsRoute();
      const res = await GET(
        new Request('http://localhost/api/rooms/carol/stats'),
        ctxParams('carol'),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
    });
  });
});

describe('app/api/rooms/[room]/stats/merge/route — POST', () => {
  describe('input validation', () => {
    it('returns 422 problem+json (invalid-room-name) for a control char in room', async () => {
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/bad%07name/stats/merge', {
          method: 'POST',
          body: JSON.stringify({ stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 } }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
    });

    it('returns 400 problem+json (invalid-json) on malformed json body', async () => {
      loadRecordMock.mockResolvedValue({
        totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
      });
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/merge', {
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
        new Request('http://localhost/api/rooms/alice/stats/merge', {
          method: 'POST',
          body: JSON.stringify({ room: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('alice'),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });

    it('returns 422 problem+json (invalid-request-shape) when stats has extra keys', async () => {
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/merge', {
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
        new Request('http://localhost/api/rooms/alice/stats/merge', {
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
    it('returns 200 { stats } after mergeRecordByRoom folds client totals into server row', async () => {
      loadRecordMock.mockResolvedValue({
        totalGames: 2, xWins: 1, oWins: 0, draws: 1, currentStreak: 1,
      });
      mergeRecordMock.mockResolvedValue({
        totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 2,
      });
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/merge', {
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
      expect(mergeRecordMock).toHaveBeenCalledWith('alice', {
        totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 0,
      });
    });

    it('returns 409 problem+json (enter-room-required) when the room row is absent (no silent create) (N5)', async () => {
      loadRecordMock.mockResolvedValue(null);
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/ghost/stats/merge', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 1 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('ghost'),
      );
      const body = await expectProblemJson(res, 409, 'enter-room-required', 'Enter room required');
      expect(body.detail).toContain('ghost');
      // The 409 short-circuits before mergeRecordByRoom runs — forged
      // merge requests cannot trigger an upsert behind the user's back.
      expect(mergeRecordMock).not.toHaveBeenCalled();
    });

    it('returns 500 problem+json (db-unavailable) when mergeRecordByRoom throws', async () => {
      loadRecordMock.mockResolvedValue({
        totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0,
      });
      mergeRecordMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadMergeRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/merge', {
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

describe('app/api/rooms/[room]/stats/outcomes/route — POST', () => {
  describe('input validation', () => {
    it('returns 422 problem+json (invalid-room-name) when room has a control char', async () => {
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/bad%07name/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
    });

    it('returns 422 problem+json (invalid-request-shape) when outcome is not X|O|draw', async () => {
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/outcomes', {
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
        new Request('http://localhost/api/rooms/alice/stats/outcomes', {
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
    it('returns 200 { stats } after recordOutcomeForRoom accumulates on an existing row', async () => {
      loadRecordMock.mockResolvedValue({
        totalGames: 2, xWins: 1, oWins: 1, draws: 0, currentStreak: 1,
      });
      recordOutcomeForRoomMock.mockResolvedValue({
        ok: true,
        stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 2 },
      });
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/outcomes', {
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
      expect(recordOutcomeForRoomMock).toHaveBeenCalledWith('alice', 'X');
    });

    it('returns 404 problem+json (stats-not-found) when the room row is absent (no silent create) (N5)', async () => {
      recordOutcomeForRoomMock.mockResolvedValue({ ok: false, reason: 'not-found' });
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/ghost/stats/outcomes', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'draw' }),
          headers: { 'content-type': 'application/json' },
        }),
        ctxParams('ghost'),
      );
      const body = await expectProblemJson(res, 404, 'stats-not-found', 'Room stats not found');
      expect(body.detail).toContain('ghost');
    });

    it('returns 500 problem+json (db-unavailable) when recordOutcomeForRoom throws', async () => {
      recordOutcomeForRoomMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadOutcomesRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms/alice/stats/outcomes', {
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
