import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

// tests/api/player-session.test.ts — route-level coverage for the POST
// /api/player-session handler (ulw-name-login-one-truth W1). Imports the
// route file's exported function directly and stubs out lib/db so we can
// pin the contract — name whitelist (same rules as /api/solo-stats
// derived from lib/player-name.ts), 4xx codes, server-authoritative
// { stats, existed } shape — without touching sqlite. End-to-end
// registration / login integration is covered by tests/db/db.test.ts
// (the upstream primitive) and tests/qa/player-session-qa.mjs (the
// browser surface, scheduled for W3 alongside the home-page identity
// region).

const registerOrLoginNameMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  registerOrLoginName: registerOrLoginNameMock,
}));

const loadRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    registerOrLoginName: registerOrLoginNameMock,
  }));
  return import('@/app/api/player-session/route');
};

beforeEach(() => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), 'unused-' + Math.random() + '.db')}`;
  registerOrLoginNameMock.mockReset();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('app/api/player-session/route', () => {
  describe('POST', () => {
    it('returns 400 on invalid json', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
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
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the body has extra keys besides name (no smuggling stats)', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({
            name: 'alice',
            totalGames: 99,
          }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name is longer than 24 characters', async () => {
      const { POST } = await loadRoute();
      const long = 'a'.repeat(25);
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: long }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name contains a control character', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: 'bad\u0007name' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('returns 422 when the name is empty after trim', async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: '   ' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(422);
    });

    it('trims whitespace before calling registerOrLoginName (the canonical PK)', async () => {
      registerOrLoginNameMock.mockResolvedValue({
        stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        existed: false,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: '  alice  ' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      expect(registerOrLoginNameMock).toHaveBeenCalledWith('alice');
    });

    it('returns 200 with { stats, existed: false } on registration of a fresh name', async () => {
      registerOrLoginNameMock.mockResolvedValue({
        stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        existed: false,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: 'newbie' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        stats: { totalGames: 0, xWins: 0, oWins: 0, draws: 0, currentStreak: 0 },
        existed: false,
      });
    });

    it('returns 200 with { stats, existed: true } on login of an existing name', async () => {
      registerOrLoginNameMock.mockResolvedValue({
        stats: { totalGames: 7, xWins: 4, oWins: 2, draws: 1, currentStreak: -2 },
        existed: true,
      });
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: 'veteran' }),
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

    it('returns 500 when registerOrLoginName throws (db unavailable)', async () => {
      registerOrLoginNameMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadRoute();
      const res = await POST(
        new Request('http://localhost/api/player-session', {
          method: 'POST',
          body: JSON.stringify({ name: 'alice' }),
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(500);
    });
  });
});
