import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// tests/api/rooms-delete.test.ts — route-level coverage for
// DELETE /api/rooms/{room} (T-N1, ulw-room-lifecycle-20260924 §二 T-N1):
//   200 { ok: true }          — deleteRoomByRoom returns deleted:true
//   404 room-not-found (新增 slug, problem+json) — deleteRoomByRoom returns not-found
//   422 invalid-room-name     — normalizeRoom rejects (whitelist)
//   500 db-unavailable        — service throws
//
// Imports the route file's exported DELETE function directly and stubs
// out lib/db so we pin the contract (room whitelist, 2xx/4xx codes,
// application/problem+json envelope) without touching sqlite.
// End-to-end DB integration is covered by tests/db/db.test.ts (the
// upstream primitive).

const deleteRoomMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  deleteRoomByRoom: deleteRoomMock,
}));

const loadDeleteRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    deleteRoomByRoom: deleteRoomMock,
  }));
  return import('@/app/api/rooms/[room]/route');
};

/** Assert a problem+json response shape (status, content-type, RFC 9457
 *  §3.1 body fields). Mirrors the helper in tests/api/rooms-stats.test.ts
 *  so suite-wide invariants stay aligned. */
function expectProblemJson(
  res: Response,
  expectedStatus: number,
  expectedSlug: string,
  expectedTitle?: string,
): Promise<{ type: string; title: string; status: number; detail?: string }> {
  expect(res.status).toBe(expectedStatus);
  expect(res.headers.get('content-type')).toBe('application/problem+json');
  return res.json().then(
    (body: { type: string; title: string; status: number; detail?: string }) => {
      expect(body.status).toBe(expectedStatus);
      expect(body.type).toBe(`https://docs.example.com/probs/${expectedSlug}`);
      expect(typeof body.title).toBe('string');
      expect(body.title.length).toBeGreaterThan(0);
      if (expectedTitle !== undefined) {
        expect(body.title).toBe(expectedTitle);
      }
      return body;
    },
  );
}

beforeEach(() => {
  // Route imports lib/db which transitively imports getDb(); keeping a
  // tmpdir DATABASE_URL means an accidental real-DB hit still resolves
  // to a throwaway file. The vi.doMock above prevents the real call.
  deleteRoomMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ctxParams = (room: string): { params: Promise<{ room: string }> } => ({
  params: Promise.resolve({ room }),
});

describe('app/api/rooms/[room]/route — DELETE (T-N1 deleteRoom)', () => {
  describe('room whitelist', () => {
    it('returns 422 problem+json (invalid-room-name) for a room longer than 24 characters', async () => {
      const { DELETE } = await loadDeleteRoute();
      const res = await DELETE(
        new Request(`http://localhost/api/rooms/${'a'.repeat(25)}`, {
          method: 'DELETE',
        }),
        ctxParams('a'.repeat(25)),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
      expect(deleteRoomMock).not.toHaveBeenCalled();
    });

    it('returns 422 problem+json (invalid-room-name) when the room contains a control character', async () => {
      const { DELETE } = await loadDeleteRoute();
      const res = await DELETE(
        new Request('http://localhost/api/rooms/bad%07name', { method: 'DELETE' }),
        ctxParams('bad\x07name'),
      );
      await expectProblemJson(res, 422, 'invalid-room-name', 'Invalid room name');
      expect(deleteRoomMock).not.toHaveBeenCalled();
    });
  });

  describe('row deletion mapping', () => {
    it('returns 404 problem+json (room-not-found) when deleteRoomByRoom returns not-found (防静默建档)', async () => {
      deleteRoomMock.mockResolvedValue({ ok: false, reason: 'not-found' });
      const { DELETE } = await loadDeleteRoute();
      const res = await DELETE(
        new Request('http://localhost/api/rooms/ghost', { method: 'DELETE' }),
        ctxParams('ghost'),
      );
      // T-N1 新增 slug room-not-found（最小新增；plan §一明确写
      // 「room-not-found（复用现役 slug，零新增或最小新增）」）。
      const body = await expectProblemJson(res, 404, 'room-not-found', 'Room not found');
      expect(body.detail).toContain('ghost');
      expect(deleteRoomMock).toHaveBeenCalledWith('ghost');
    });

    it('returns 200 application/json { ok: true } when deleteRoomByRoom returns deleted:true', async () => {
      deleteRoomMock.mockResolvedValue({ ok: true, deleted: true });
      const { DELETE } = await loadDeleteRoute();
      const res = await DELETE(
        new Request('http://localhost/api/rooms/alice', { method: 'DELETE' }),
        ctxParams('alice'),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({ ok: true });
      expect(deleteRoomMock).toHaveBeenCalledWith('alice');
    });

    it('returns 500 problem+json (db-unavailable) when deleteRoomByRoom throws', async () => {
      deleteRoomMock.mockRejectedValue(new Error('boom'));
      const { DELETE } = await loadDeleteRoute();
      const res = await DELETE(
        new Request('http://localhost/api/rooms/carol', { method: 'DELETE' }),
        ctxParams('carol'),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
      expect(deleteRoomMock).toHaveBeenCalledWith('carol');
    });
  });
});
