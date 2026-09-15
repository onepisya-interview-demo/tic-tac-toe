import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/solo-stats.test.ts — route-level coverage for the GET / POST
// /api/solo-stats handlers (W-SYNC wave 2). Imports the route file's
// exported functions directly and stubs out lib/db so we can pin the
// contract — name whitelist, status codes, response shape — without
// touching sqlite. End-to-end DB integration is covered by tests/db/db.test.ts
// (the upstream primitive) and tests/qa/sync-qa.mjs (the browser surface).

// Mocked once at module scope. The mock is installed before the route
// file is imported in loadRoute(), so the route's `import { loadSoloRecord,
// accumulateSoloRecord } from '@/lib/db'` resolves to this mock for the
// lifetime of the test file (vi.resetModules inside loadRoute re-imports
// both the route and @/lib/db, but vi.doMock registrations persist
// across resetModules for the test file).
const loadSoloRecordMock = vi.fn();
const accumulateSoloRecordMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  loadSoloRecord: loadSoloRecordMock,
  accumulateSoloRecord: accumulateSoloRecordMock,
}));

const loadRoute = async () => {
  vi.resetModules();
  // Re-install the mock against the freshly-reset module graph.
  vi.doMock('@/lib/db', () => ({
    loadSoloRecord: loadSoloRecordMock,
    accumulateSoloRecord: accumulateSoloRecordMock,
  }));
  return import('@/app/api/solo-stats/route');
};

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  loadSoloRecordMock.mockReset();
  accumulateSoloRecordMock.mockReset();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('app/api/solo-stats/route', () => {
  describe('GET', () => {
    it('returns 422 when the name query is missing', async () => {
      const { GET } = await loadRoute();
      const res = await GET(new Request('http://localhost/api/solo-stats'));
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('invalid player name');
    });

    it('returns 422 for an empty name (whitespace only)', async () => {
      const { GET } = await loadRoute();
      const res = await GET(
        new Request('http://localhost/api/solo-stats?name=%20%20%20'),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name is longer than 24 characters', async () => {
      const { GET } = await loadRoute();
      const long = 'a'.repeat(25);
      const res = await GET(
        new Request(`http://localhost/api/solo-stats?name=${long}`),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name contains a control character', async () => {
      const { GET } = await loadRoute();
      const res = await GET(
        new Request('http://localhost/api/solo-stats?name=bad%07name'),
      );
      expect(res.status).toBe(422);
    });

    it('returns { stats: null } on a fresh name', async () => {
      loadSoloRecordMock.mockResolvedValue(null);
      const { GET } = await loadRoute();
      const res = await GET(
        new Request('http://localhost/api/solo-stats?name=alice'),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ stats: null });
    });

    it('returns { stats } on a known name', async () => {
      loadSoloRecordMock.mockResolvedValue({
        totalGames: 4,
        xWins: 3,
        oWins: 0,
        draws: 1,
        currentStreak: -1,
      });
      const { GET } = await loadRoute();
      const res = await GET(
        new Request('http://localhost/api/solo-stats?name=bob'),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        stats: {
          totalGames: 4,
          xWins: 3,
          oWins: 0,
          draws: 1,
          currentStreak: -1,
        },
      });
    });

    it('returns 500 when loadSoloRecord throws (db unavailable)', async () => {
      loadSoloRecordMock.mockRejectedValue(new Error('boom'));
      const { GET } = await loadRoute();
      const res = await GET(
        new Request('http://localhost/api/solo-stats?name=carol'),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('db unavailable');
    });
  });

  describe('POST', () => {
    it('returns 400 on invalid json', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
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
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the outcome is not X/O/draw', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ name: 'alice', outcome: 'Z' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 for a 25-character name', async () => {
      const { POST } = await loadRoute();
      const long = 'a'.repeat(25);
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ name: long, outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name contains a control character', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ name: 'bad\x07name', outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('trims whitespace before validating and accumulates the trimmed name', async () => {
      accumulateSoloRecordMock.mockResolvedValue({
        totalGames: 1,
        xWins: 1,
        oWins: 0,
        draws: 0,
        currentStreak: 1,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ name: '  alice  ', outcome: 'X' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      expect(accumulateSoloRecordMock).toHaveBeenCalledWith('alice', 'X');
    });

    it('returns the server-authoritative { stats } after accumulation', async () => {
      accumulateSoloRecordMock.mockResolvedValue({
        totalGames: 5,
        xWins: 3,
        oWins: 1,
        draws: 1,
        currentStreak: 2,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ name: 'alice', outcome: 'X' }),
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
          currentStreak: 2,
        },
      });
    });

    it('returns 500 when accumulateSoloRecord throws (db unavailable)', async () => {
      accumulateSoloRecordMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/solo-stats', {
          method: 'POST',
          body: JSON.stringify({ name: 'alice', outcome: 'draw' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(500);
    });

    it('accepts all three outcome values (X, O, draw)', async () => {
      accumulateSoloRecordMock.mockImplementation(
        async (_name: string, outcome: 'X' | 'O' | 'draw') => ({
          totalGames: 1,
          xWins: outcome === 'X' ? 1 : 0,
          oWins: outcome === 'O' ? 1 : 0,
          draws: outcome === 'draw' ? 1 : 0,
          currentStreak: 0,
        }),
      );
      const { POST } = await loadRoute();
      for (const outcome of ['X', 'O', 'draw'] as const) {
        const res = await POST(
          new Request('http://localhost/api/solo-stats', {
            method: 'POST',
            body: JSON.stringify({ name: 'bob', outcome }),
            headers: { 'content-type': 'application/json' },
          }),
        );
        expect(res.status).toBe(200);
      }
      expect(accumulateSoloRecordMock).toHaveBeenNthCalledWith(1, 'bob', 'X');
      expect(accumulateSoloRecordMock).toHaveBeenNthCalledWith(2, 'bob', 'O');
      expect(accumulateSoloRecordMock).toHaveBeenNthCalledWith(3, 'bob', 'draw');
    });
  });
});
