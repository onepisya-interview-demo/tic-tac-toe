import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/solo-stats.test.ts — route-level coverage for the GET / PUT
// /api/solo-stats handlers (W-SYNC wave 2 + W2 purification). POST handler
// was removed in W2 because postSoloOutcome had no remaining caller.
// Imports the route file's exported functions directly and stubs out lib/db
// so we can pin the contract — name whitelist, status codes, response shape
// — without touching sqlite. End-to-end DB integration is covered by
// tests/db/db.test.ts (the upstream primitive).

// Mocked once at module scope. The mock is installed before the route
// file is imported in loadRoute(), so the route's `import { loadSoloRecord,
// ensureSoloRecord } from '@/lib/db'` resolves to this mock for the
// lifetime of the test file (vi.resetModules inside loadRoute re-imports
// both the route and @/lib/db, but vi.doMock registrations persist
// across resetModules for the test file).
const loadSoloRecordMock = vi.fn();
const ensureSoloRecordMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  loadSoloRecord: loadSoloRecordMock,
  ensureSoloRecord: ensureSoloRecordMock,
}));

const loadRoute = async () => {
  vi.resetModules();
  // Re-install the mock against the freshly-reset module graph.
  vi.doMock('@/lib/db', () => ({
    loadSoloRecord: loadSoloRecordMock,
    ensureSoloRecord: ensureSoloRecordMock,
  }));
  return import('@/app/api/solo-stats/route');
};

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  loadSoloRecordMock.mockReset();
  ensureSoloRecordMock.mockReset();
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
});

describe('PUT', () => {
  it('returns 400 on invalid json', async () => {
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 when the body has no name field', async () => {
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('returns 422 when the name is too long', async () => {
    const { PUT } = await loadRoute();
    const long = 'a'.repeat(25);
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({ name: long }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('returns 422 when the name contains a control character', async () => {
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({ name: 'badname' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('returns 422 when extra keys are present (defensive against accidental stats PUT)', async () => {
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'alice',
          totalGames: 99,
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('trims whitespace before validating and calls ensureSoloRecord with trimmed name', async () => {
    ensureSoloRecordMock.mockResolvedValue({
      totalGames: 0,
      xWins: 0,
      oWins: 0,
      draws: 0,
      currentStreak: 0,
    });
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({ name: '  alice  ' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    expect(ensureSoloRecordMock).toHaveBeenCalledWith('alice');
  });

  it('returns the empty row from ensureSoloRecord when the name is fresh', async () => {
    ensureSoloRecordMock.mockResolvedValue({
      totalGames: 0,
      xWins: 0,
      oWins: 0,
      draws: 0,
      currentStreak: 0,
    });
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({ name: 'newbie' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      stats: {
        totalGames: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        currentStreak: 0,
      },
    });
  });

  it('returns the existing row from ensureSoloRecord (idempotent: never zeros an existing row)', async () => {
    ensureSoloRecordMock.mockResolvedValue({
      totalGames: 7,
      xWins: 4,
      oWins: 2,
      draws: 1,
      currentStreak: -2,
    });
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({ name: 'veteran' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.totalGames).toBe(7);
    expect(body.stats.currentStreak).toBe(-2);
  });

  it('returns 500 when ensureSoloRecord throws (db unavailable)', async () => {
    ensureSoloRecordMock.mockRejectedValue(new Error('boom'));
    const { PUT } = await loadRoute();
    const res = await PUT(
      new Request('http://localhost/api/solo-stats', {
        method: 'PUT',
        body: JSON.stringify({ name: 'alice' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(500);
  });
});
