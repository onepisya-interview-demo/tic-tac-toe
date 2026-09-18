import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/solo-stats-sync.test.ts — route-level coverage for the POST
// /api/solo-stats/sync handler (W-SYNC wave 2). Imports the route
// file's exported function directly and stubs out lib/db so we can pin
// the contract — name whitelist, GameStats shape guard, status codes,
// server-authoritative response shape — without touching sqlite. End-
// to-end merge integration is covered by tests/db/db.test.ts (the
// upstream primitive) and tests/qa/merge-sync-qa.mjs (the browser
// surface).

// W3 (ulw-name-login-one-truth) split the handler: it now requires
// the name row to exist (409 otherwise) before merging, so we mock
// both loadSoloRecord (the existence probe) and mergeSoloRecord (the
// per-field accumulator).
const mergeSoloRecordMock = vi.fn();
const loadSoloRecordMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  mergeSoloRecord: mergeSoloRecordMock,
  loadSoloRecord: loadSoloRecordMock,
}));

const loadRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    mergeSoloRecord: mergeSoloRecordMock,
    loadSoloRecord: loadSoloRecordMock,
  }));
  return import('@/app/api/solo-stats/sync/route');
};

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  mergeSoloRecordMock.mockReset();
  loadSoloRecordMock.mockReset();
  // Default: the name row is "present" — every pre-existing test
  // that didn't care about the existence check now succeeds by
  // default. Tests that want the 409 path explicitly mock this to
  // return null.
  loadSoloRecordMock.mockResolvedValue({
    totalGames: 0,
    xWins: 0,
    oWins: 0,
    draws: 0,
    currentStreak: 0,
  });
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('app/api/solo-stats/sync/route', () => {
  describe('POST', () => {
    it('returns 400 on invalid json', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: 'not json',
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 422 when the body has no name field', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the body has no stats field', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({ name: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the stats field has the wrong shape (NaN)', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            stats: { totalGames: 1, xWins: NaN, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the stats field has an extra key (no prototype pollution)', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            stats: {
              totalGames: 1,
              xWins: 1,
              oWins: 0,
              draws: 0,
              currentStreak: 0,
              polluted: true,
            },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 for a 25-character name', async () => {
      const { POST } = await loadRoute();
      const long = 'a'.repeat(25);
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: long,
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name contains a control character', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'bad\u0007name',
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the body has extra keys besides name+stats', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
            method: 'cheat',
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('trims whitespace before validating and calls mergeSoloRecord with trimmed name + raw stats', async () => {
      mergeSoloRecordMock.mockResolvedValue({
        totalGames: 5,
        xWins: 3,
        oWins: 1,
        draws: 1,
        currentStreak: 2,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: '  alice  ',
            stats: { totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 1 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      expect(mergeSoloRecordMock).toHaveBeenCalledWith('alice', {
        totalGames: 3,
        xWins: 2,
        oWins: 0,
        draws: 1,
        currentStreak: 1,
      });
    });

    it('returns the server-authoritative { stats } after merge', async () => {
      mergeSoloRecordMock.mockResolvedValue({
        totalGames: 5,
        xWins: 3,
        oWins: 1,
        draws: 1,
        currentStreak: 1,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        stats: {
          totalGames: 5,
          xWins: 3,
          oWins: 1,
          draws: 1,
          currentStreak: 1,
        },
      });
    });

    it('returns 500 when mergeSoloRecord throws (db unavailable)', async () => {
      mergeSoloRecordMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(500);
    });

    // W3 (ulw-name-login-one-truth) hardening: the merge endpoint
    // refuses to silently re-create a wiped account. The home-return
    // dialog flow guarantees POST /api/player-session fires for the
    // same name first; a 409 here means the row vanished between the
    // two calls (or the caller forged the request) — we surface the
    // error instead of upserting emptyStats() behind the user's back.
    it('returns 409 when the name row does not exist (no silent re-create)', async () => {
      loadSoloRecordMock.mockResolvedValue(null);
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats/sync', {
          method: 'POST',
          body: JSON.stringify({
            name: 'ghost',
            stats: { totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 1 },
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('player session required');
      // And critically, we did NOT call mergeSoloRecord — no write.
      expect(mergeSoloRecordMock).not.toHaveBeenCalled();
    });
  });
});
