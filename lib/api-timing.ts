// JSON-line route timing for the API transport layer (trace-minimal,
// roadmap ticket 8 — .omo/plans/ulw-verification-infra-roadmap-20261007.md
// §七 票 8). Pure observation: emitRouteTiming logs one JSON object per
// handled request and never touches status codes, bodies, or headers —
// the service/transport separation contract (docs/anti-patterns.md §L0)
// keeps timing as a transport concern, same layer that decides status.
//
// Deliberately dependency-free (no otel/opentelemetry — ticket 8 negative
// assertion ③) and gate-free (not wired into CI — negative assertion ④):
// logs go to stdout, so `pnpm start` local runs and platform logs both
// surface them, and any line survives `jq -e '.route and .duration'`.

export interface RouteTimingEntry {
  /** Route pattern (not the concrete URL), e.g. "/api/rooms/[room]". */
  route: string;
  /** HTTP method of the handled request. */
  method: string;
  /** Response status code the handler resolved with. */
  status: number;
  /** Wall-clock handler duration in milliseconds. */
  duration: number;
  /** ISO timestamp of the log line. */
  at: string;
  /** Present (true) only on the throw-path line emitted before rethrow. */
  error?: boolean;
}

export function emitRouteTiming(entry: RouteTimingEntry): void {
  console.log(JSON.stringify(entry));
}

/**
 * Wrap a route handler with one JSON-line timing log per request.
 *
 * The wrapper is signature-transparent (generic Args), so dynamic-route
 * handlers taking `(request, { params })` pass through unchanged. It
 * resolves with the handler's own Response and rethrows handler errors
 * after emitting a `status: 500, error: true` line — route files keep
 * their `export async function POST` declaration form and simply forward
 * through this helper.
 */
export function withRouteTiming<Args extends unknown[]>(
  route: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const startedAt = Date.now();
    const method = args[0] instanceof Request ? args[0].method : 'unknown';
    try {
      const response = await handler(...args);
      emitRouteTiming({
        route,
        method,
        status: response.status,
        duration: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
      return response;
    } catch (error) {
      emitRouteTiming({
        route,
        method,
        status: 500,
        duration: Date.now() - startedAt,
        at: new Date().toISOString(),
        error: true,
      });
      throw error;
    }
  };
}
