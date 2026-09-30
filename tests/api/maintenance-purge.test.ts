import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// tests/api/maintenance-purge.test.ts — route-level coverage for
// /api/maintenance/purge (T-N3, ulw-room-lifecycle-20260924 §二 T-N3):
//   POST / GET 同 handler
//   Authorization: Bearer ${CRON_SECRET}
//     → 200 { deletedCount, cutoffDays }
//     → 401 problem+json unauthorized — 缺失 / 不匹配 / 大小写敏感
//
// CRON_SECRET 经 process.env 读取；测试通过设置 env 注入匹配值，
// 并故意不写入 .env.example / .env.local / tracked file（plan 明确
// 禁 CRON_SECRET 入仓入探针）。env 重置在 beforeEach + afterEach。

const purgeStaleRoomsMock = vi.fn();
vi.doMock('@/lib/db', () => ({
  purgeStaleRooms: purgeStaleRoomsMock,
}));

const loadPurgeRoute = async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({
    purgeStaleRooms: purgeStaleRoomsMock,
  }));
  return import('@/app/api/maintenance/purge/route');
};

/** Assert problem+json shape（与 tests/api/rooms-stats.test.ts 同型 helper，
 *  复用约束）。 */
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

const SECRET = 'test-cron-secret-aaaaaaaaaaaaaaaa';

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  purgeStaleRoomsMock.mockReset();
  purgeStaleRoomsMock.mockResolvedValue({ deletedCount: 0, cutoffDays: 30 });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe('app/api/maintenance/purge/route — POST/GET (T-N3 TTL 回收)', () => {
  describe('authentication', () => {
    it('returns 401 problem+json (unauthorized) when Authorization header is missing (POST)', async () => {
      const { POST } = await loadPurgeRoute();
      const res = await POST(
        new Request('http://localhost/api/maintenance/purge', { method: 'POST' }),
      );
      await expectProblemJson(res, 401, 'unauthorized', 'Unauthorized');
      expect(purgeStaleRoomsMock).not.toHaveBeenCalled();
    });

    it('returns 401 problem+json (unauthorized) when Bearer token does not match CRON_SECRET (POST)', async () => {
      const { POST } = await loadPurgeRoute();
      const res = await POST(
        new Request('http://localhost/api/maintenance/purge', {
          method: 'POST',
          headers: { authorization: 'Bearer wrong-secret' },
        }),
      );
      await expectProblemJson(res, 401, 'unauthorized', 'Unauthorized');
      expect(purgeStaleRoomsMock).not.toHaveBeenCalled();
    });

    it('returns 401 problem+json (unauthorized) when Authorization scheme is not Bearer (GET)', async () => {
      const { GET } = await loadPurgeRoute();
      const res = await GET(
        new Request('http://localhost/api/maintenance/purge', {
          method: 'GET',
          headers: { authorization: `Basic ${SECRET}` },
        }),
      );
      await expectProblemJson(res, 401, 'unauthorized', 'Unauthorized');
      expect(purgeStaleRoomsMock).not.toHaveBeenCalled();
    });
  });

  describe('execution', () => {
    it('returns 200 application/json { deletedCount, cutoffDays } when Bearer token matches (POST)', async () => {
      purgeStaleRoomsMock.mockResolvedValue({ deletedCount: 7, cutoffDays: 30 });
      const { POST } = await loadPurgeRoute();
      const res = await POST(
        new Request('http://localhost/api/maintenance/purge', {
          method: 'POST',
          headers: { authorization: `Bearer ${SECRET}` },
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({ deletedCount: 7, cutoffDays: 30 });
      expect(purgeStaleRoomsMock).toHaveBeenCalledWith();
    });

    it('GET shares the same handler (Vercel Cron may use GET on Hobby plan); 200 on auth pass', async () => {
      purgeStaleRoomsMock.mockResolvedValue({ deletedCount: 2, cutoffDays: 30 });
      const { GET } = await loadPurgeRoute();
      const res = await GET(
        new Request('http://localhost/api/maintenance/purge', {
          method: 'GET',
          headers: { authorization: `Bearer ${SECRET}` },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ deletedCount: 2, cutoffDays: 30 });
      expect(purgeStaleRoomsMock).toHaveBeenCalledWith();
    });

    it('returns 500 problem+json (db-unavailable) when purgeStaleRooms throws (POST)', async () => {
      purgeStaleRoomsMock.mockRejectedValue(new Error('boom'));
      const { POST } = await loadPurgeRoute();
      const res = await POST(
        new Request('http://localhost/api/maintenance/purge', {
          method: 'POST',
          headers: { authorization: `Bearer ${SECRET}` },
        }),
      );
      await expectProblemJson(res, 500, 'db-unavailable');
    });
  });
});
