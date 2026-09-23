import { NextResponse } from 'next/server';
import { normalizeRoom } from '@/lib/room-name';
import { registerOrLoginRoom } from '@/lib/db';
import { problemResponse } from '@/lib/api-problem';
import type { GameStats } from '@/lib/game';

// W1 (ulw-room-migration-home-landing) thin transport wrapper.
//   POST /api/rooms            →  200 { stats, existed }  (register-or-enter 幂等)
//                                400 invalid-json  (problem+json)
//                                422 invalid request shape or room name
//                                500 db-unavailable
//
// Business logic lives in lib/db.ts:registerOrLoginRoom (race-safe
// read-then-upsert against `room TEXT UNIQUE`). The route is a thin
// parser → service-call → status-mapping shell; it must NOT contain
// any "load → mutate → upsert" of its own. See lib/db.ts top-doc for
// the service / transport-layer separation contract.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body shape: just { room }. Mirrors the prior /api/sessions guard —
 * accepts nothing but the trimmed room key so a future client cannot
 * smuggle a full stats row through this endpoint by mistake
 * (defensive against a caller that might get tempted to put stats in
 * the same payload, which the new RESTful design intentionally
 * forbids: stats writes go through
 * /api/rooms/{room}/stats/merge or /outcomes, never /api/rooms).
 */
function isRoomBody(v: unknown): v is { room: string } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.room !== 'string') return false;
  for (const k of Object.keys(r)) {
    if (k !== 'room') return false;
  }
  return true;
}

interface RoomResponse {
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
  if (!isRoomBody(body)) {
    return problemResponse(422, 'invalid-request-shape');
  }
  // Single source of truth for the whitelist (lib/room-name.ts:
  // normalizeRoom — trim → 1–24 chars → reject control chars).
  // DRIFT between server and client guard is the W3 F-flag we are
  // retiring; the route no longer inlines its own validator.
  const room = normalizeRoom(body.room);
  if (room === null) {
    return problemResponse(422, 'invalid-room-name');
  }
  try {
    const result = await registerOrLoginRoom(room);
    const payload: RoomResponse = {
      stats: result.stats,
      existed: result.existed,
    };
    return NextResponse.json(payload);
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
