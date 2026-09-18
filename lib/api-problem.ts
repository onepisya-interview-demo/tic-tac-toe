// RFC 9457 Problem Details for HTTP APIs helper.
// W2 (ulw-one-game-two-versions) — every API error in this app emits
// an `application/problem+json` body so clients can branch on a
// stable type URI instead of scraping free-text error fields. The
// shape mirrors what AIP-136 calls "API error responses" and what
// RFC 9457 §3 calls a "problem details" document:
//
//   { "type": "<URI>", "title": "<short>", "status": <int>, "detail": "..." }
//
// All routes import `problemResponse` and pass it the status code
// and a known ProblemSlug — never the raw message — so the type
// taxonomy stays small, versionable, and machine-readable. Adding
// a new error category is two edits: add a slug here + use it in
// the route. The matching client-side helper in lib/game-net.ts
// collapses 404 responses on the read path back to a "no row"
// answer so display code can branch on `value.stats === null`
// without parsing problem+json.
//
// Single source of truth for the whitelist (lib/player-name.ts:
// normalizePlayerName) is the only consumer of `invalid-player-name`;
// every other problem slug is intentionally generic.

import { NextResponse } from 'next/server';

/** Stable type-URI prefix. AIP-136 §4.2 / RFC 9457 §3.1.1 recommend
 *  a URI the client can dereference for human-readable docs; this
 *  repo points to the human doc site that documents each error. */
const TYPE_BASE = 'https://docs.example.com/probs/';

/**
 * Known problem types. Adding a slug here is the only place to
 * extend the type taxonomy — routes reference the slug, not the
 * raw string, so renaming is a one-line change.
 */
export type ProblemSlug =
  | 'stats-not-found'
  | 'player-session-required'
  | 'invalid-player-name'
  | 'invalid-request-shape'
  | 'invalid-json'
  | 'method-not-allowed'
  | 'db-unavailable';

/**
 * Short human-readable title. Stays constant per slug — clients
 * can show it directly or use it as a fallback when `detail` is
 * absent (RFC 9457 §3.1.2 says `title` is the "short, human-readable
 * summary"; we use the same English string for every instance).
 */
const TITLES: Record<ProblemSlug, string> = {
  'stats-not-found': 'Player stats not found',
  'player-session-required': 'Player session required',
  'invalid-player-name': 'Invalid player name',
  'invalid-request-shape': 'Invalid request shape',
  'invalid-json': 'Invalid JSON body',
  'method-not-allowed': 'Method not allowed',
  'db-unavailable': 'Database unavailable',
};

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

/**
 * Build the problem+json response. Returns a `Response` directly
 * (not `NextResponse.json`) so the Content-Type is hard-pinned to
 * `application/problem+json` — NextResponse.json's default
 * `application/json` would otherwise win the headers race.
 */
export function problemResponse(
  status: number,
  slug: ProblemSlug,
  detail?: string,
): Response {
  const body: ProblemBody = {
    type: TYPE_BASE + slug,
    title: TITLES[slug],
    status,
    ...(detail !== undefined ? { detail } : {}),
  };
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

/** Resolve a problem slug to its full type URI (for tests / docs). */
export function typeUriFor(slug: ProblemSlug): string {
  return TYPE_BASE + slug;
}
