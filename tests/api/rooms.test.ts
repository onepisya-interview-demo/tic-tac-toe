import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/rooms.test.ts — route-level coverage for the POST
// /api/rooms handler (W1 ulw-room-migration-home-landing). Imports the
// route file's exported function directly and stubs out lib/db so we
// can pin the contract — room whitelist (lib/room-name.ts:
// normalizeRoom is the single source of truth, replacing the
// per-route duplication that AGENTS.md §本项目反模式 flagged),
// 4xx codes, server-authoritative { stats, existed } shape, and the
// application/problem+json envelope — without touching sqlite.
// End-to-end registration / login integration is covered by
// tests/db/db.test.ts (the upstream primitive).

const registerOrLoginRoomMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  registerOrLoginRoom: registerOrLoginRoomMock,
}));

const loadRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    registerOrLoginRoom: registerOrLoginRoomMock,
  }));
  return import('@/app/api/rooms/route');
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
  registerOrLoginRoomMock.mockReset();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('app/api/rooms/route', () => {
  describe('POST', () => {
    it('returns 400 problem+json (invalid-json) on invalid json', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: 'not json',
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 400, 'invalid-json');
    });

    it('returns 422 problem+json (invalid-request-shape) when the body has no room field', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });

    it('returns 422 problem+json (invalid-request-shape) when the body has extra keys besides room', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({
            room: 'alice',
            totalGames: 99,
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 422, 'invalid-request-shape');
    });

    it('returns 422 problem+json (invalid-player-name) when the room is longer than 24 characters', async () => {
      const { POST } = await loadRoute();
      const long = 'a'.repeat(25);
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: long }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('returns 422 problem+json (invalid-player-name) when the room contains a control character', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: 'bad\u0007name' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('returns 422 problem+json (invalid-player-name) when the room is empty after trim', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: '   ' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 422, 'invalid-player-name');
    });

    it('trims whitespace before calling registerOrLoginRoom (the canonical PK)', async () => {
      registerOrLoginRoomMock.mockResolvedValue({
        stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        existed: false,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: '  alice  ' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      expect(registerOrLoginRoomMock).toHaveBeenCalledWith('alice');
    });

    it('returns 200 with { stats, existed: false } on registration of a fresh room (N1)', async () => {
      registerOrLoginRoomMock.mockResolvedValue({
        stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        existed: false,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: 'newbie' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        existed: false,
      });
    });

    it('returns 200 with { stats, existed: true } on login of an existing room (N2)', async () => {
      registerOrLoginRoomMock.mockResolvedValue({
        stats: { totalGames: 7, xWins: 4, oWins: 2, draws: 1, currentStreak: -2 },
        existed: true,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: 'veteran' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 7, xWins: 4, oWins: 2, draws: 1, currentStreak: -2 },
        existed: true,
      });
    });

    it('idempotency: two POSTs with the same fresh room yield existed:false then existed:true (W1 contract)', async () => {
      let existed = false;
      registerOrLoginRoomMock.mockImplementation(async () => {
        const stats = existed
          ? { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 }
          : { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 };
        const out = { stats, existed };
        existed = true;
        return out;
      });
      const { POST } = await loadRoute();
      const first = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      const second = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      const firstBody = await first.json();
      const secondBody = await second.json();
      expect(firstBody.existed).toBe(false);
      expect(secondBody.existed).toBe(true);
      expect(firstBody.stats).toEqual({ totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 });
      expect(secondBody.stats).toEqual({ totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 });
    });

    it('returns 500 problem+json (db-unavailable) when registerOrLoginRoom throws', async () => {
      registerOrLoginRoomMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ room: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
    });
  });
});
