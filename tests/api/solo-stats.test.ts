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
// file is imported in loadRoute(), so the route's `import { loadSoloRecord }
// from '@/lib/db'` resolves to this mock for the lifetime of the test file
// (vi.resetModules inside loadRoute re-imports both the route and @/lib/db,
// but vi.doMock registrations persist across resetModules for the test
// file). ensureSoloRecord was retired in W3 (PUT 405); only loadSoloRecord
// is referenced now.
const loadSoloRecordMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  loadSoloRecord: loadSoloRecordMock,
}));

const loadRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    loadSoloRecord: loadSoloRecordMock,
  }));
  return import('@/app/api/solo-stats/route');
};

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  loadSoloRecordMock.mockReset();
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
  // W3 (ulw-name-login-one-truth) retired the idempotent
  // empty-row-bootstrap PUT. Registration / login now flow
  // exclusively through POST /api/player-session. Any client still
  // calling PUT should see a clear 405 so they can self-correct.
  it('returns 405 method-not-allowed (no body needed)', async () => {
    const { PUT } = await loadRoute();
    const res = await PUT();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method not allowed');
  });

  it('returns 405 even when a legacy body is provided (defensive)', async () => {
    // PUT signature was zero-arg in W4 (F8 cleanup) — the 405 is
    // returned regardless of body, so the call needs no Request.
    const { PUT } = await loadRoute();
    const res = await PUT();
    expect(res.status).toBe(405);
  });
});
