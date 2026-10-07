import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitRouteTiming, withRouteTiming } from './api-timing';

// Ticket 8 (trace-minimal) contract tests. The public surface is tiny on
// purpose: one JSON line per request with `route` + `duration` present —
// the exact shape the evidence artifact asserts with
// `jq -e '.route and .duration'` — plus a signature-transparent wrapper
// that must not alter status, body, or thrown errors.

afterEach(() => {
  vi.restoreAllMocks();
});

// Spy on console.log for the duration of `action`, then return the lines
// it produced. Must snapshot AFTER the action ran — console.log fires
// inside the emit call, so reading mock.calls eagerly captures nothing.
async function captureLogLines(
  action: () => unknown | Promise<unknown>,
): Promise<string[]> {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  await action();
  return spy.mock.calls.map((call) => String(call[0]));
}

describe('lib/api-timing (JSON-line route timing, trace-minimal 票 8)', () => {
  describe('emitRouteTiming', () => {
    it('emits a single line that parses as JSON with route and duration', async () => {
      const lines = await captureLogLines(() =>
        emitRouteTiming({
          route: '/api/rooms',
          method: 'POST',
          status: 200,
          duration: 12,
          at: '2026-10-08T00:00:00.000Z',
        }),
      );
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      // Mirrors the acceptance command: jq -e '.route and .duration'.
      expect(parsed.route).toBe('/api/rooms');
      expect(parsed.duration).toBe(12);
    });

    it('carries the full field set (method/status/at) on the JSON line', async () => {
      const lines = await captureLogLines(() =>
        emitRouteTiming({
          route: '/api/rooms/[room]/stats',
          method: 'GET',
          status: 404,
          duration: 3,
          at: '2026-10-08T00:00:00.000Z',
        }),
      );
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(parsed.method).toBe('GET');
      expect(parsed.status).toBe(404);
      expect(parsed.at).toBe('2026-10-08T00:00:00.000Z');
    });
  });

  describe('withRouteTiming', () => {
    it('passes the handler response through untouched and logs one line', async () => {
      const original = new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      let response!: Response;
      const lines = await captureLogLines(async () => {
        const wrapped = withRouteTiming<[Request]>(
          '/api/rooms',
          async () => original,
        );
        response = await wrapped(
          new Request('http://localhost/rooms', { method: 'POST' }),
        );
      });
      expect(response).toBe(original);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('{"ok":true}');
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(parsed.route).toBe('/api/rooms');
      expect(parsed.method).toBe('POST');
      expect(parsed.status).toBe(200);
      expect(typeof parsed.duration).toBe('number');
    });

    it('forwards extra args (dynamic-route { params } context) untouched', async () => {
      const context = { params: Promise.resolve({ room: 'atrium' }) };
      let response!: Response;
      const lines = await captureLogLines(async () => {
        const wrapped = withRouteTiming<
          [Request, { params: Promise<{ room: string }> }]
        >('/api/rooms/[room]', async (_req, ctx) => {
          const { room } = await ctx.params;
          return new Response(JSON.stringify({ room }), { status: 200 });
        });
        response = await wrapped(
          new Request('http://localhost/rooms/atrium', { method: 'DELETE' }),
          context,
        );
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ room: 'atrium' });
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(parsed.method).toBe('DELETE');
    });

    it('reports handler duration as a non-negative millisecond number', async () => {
      const lines = await captureLogLines(async () => {
        const wrapped = withRouteTiming<[Request]>(
          '/api/rooms',
          async () => new Response(null, { status: 204 }),
        );
        await wrapped(new Request('http://localhost/rooms', { method: 'POST' }));
      });
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(typeof parsed.duration).toBe('number');
      expect(parsed.duration as number).toBeGreaterThanOrEqual(0);
    });

    it('rethrows handler errors after emitting a status 500 error line', async () => {
      const lines = await captureLogLines(async () => {
        const wrapped = withRouteTiming<[Request]>('/api/rooms', async () => {
          throw new Error('boom');
        });
        await expect(
          wrapped(new Request('http://localhost/rooms', { method: 'POST' })),
        ).rejects.toThrow('boom');
      });
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(parsed.route).toBe('/api/rooms');
      expect(parsed.status).toBe(500);
      expect(parsed.error).toBe(true);
      expect(typeof parsed.duration).toBe('number');
    });

    it('records unknown method when the first arg is not a Request', async () => {
      const lines = await captureLogLines(async () => {
        const wrapped = withRouteTiming<[Request]>(
          '/api/ping',
          async () => new Response('pong'),
        );
        // Exercise the defensive branch with a non-Request first argument.
        await wrapped(undefined as unknown as Request);
      });
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(parsed.method).toBe('unknown');
    });
  });
});
