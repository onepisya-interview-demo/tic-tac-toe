import { NextResponse } from 'next/server';
import { normalizePlayerName } from '@/lib/player-name';
import { registerOrLoginName } from '@/lib/db';
import { problemResponse } from '@/lib/api-problem';
import type { GameStats } from '@/lib/game';

// W2 (ulw-one-game-two-versions) thin transport wrapper.
//   POST /api/sessions         →  200 { stats, existed }  (注册/登录 幂等)
//                                400 invalid-json  (problem+json)
//                                422 invalid request shape or player name
//                                500 db-unavailable
//
// Business logic lives in lib/db.ts:registerOrLoginName (race-safe
// read-then-upsert against `name TEXT UNIQUE`). The route is a thin
// parser → service-call → status-mapping shell; it must NOT contain
// any "load → mutate → upsert" of its own. See lib/db.ts top-doc for
// the service / transport-layer separation contract.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body shape: just { name }. Mirrors the prior /api/player-session
 * guard — accepts nothing but the trimmed name key so a future
 * client cannot smuggle a full stats row through this endpoint by
 * mistake (defensive against a caller that might get tempted to
 * put stats in the same payload, which the new RESTful design
 * intentionally forbids: stats writes go through
 * /api/players/{name}/stats:merge or /outcomes, never /api/sessions).
 */
function isSessionBody(v: unknown): v is { name: string } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== 'string') return false;
  for (const k of Object.keys(r)) {
    if (k !== 'name') return false;
  }
  return true;
}

interface SessionResponse {
  stats: GameStats;
  existed: boolean;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse(400, 'invalid-json');
  }
  if (!isSessionBody(body)) {
    return problemResponse(422, 'invalid-request-shape');
  }
  // Single source of truth for the whitelist (lib/player-name.ts:
  // normalizePlayerName — trim → 1–24 chars → reject control chars).
  // DRIFT between server and client guard is the W3 F-flag we are
  // retiring; the route no longer inlines its own validator.
  const name = normalizePlayerName(body.name);
  if (name === null) {
    return problemResponse(422, 'invalid-player-name');
  }
  try {
    const result = await registerOrLoginName(name);
    const payload: SessionResponse = {
      stats: result.stats,
      existed: result.existed,
    };
    return NextResponse.json(payload);
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
