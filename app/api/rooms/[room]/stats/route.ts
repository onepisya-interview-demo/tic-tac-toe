import { NextResponse } from 'next/server';
import { loadRecordByRoom } from '@/lib/db';
import { normalizeRoom } from '@/lib/room-name';
import { problemResponse } from '@/lib/api-problem';

// W1 (ulw-room-migration-home-landing) thin transport wrapper.
//   GET /api/rooms/{room}/stats  →  200 { stats: GameStats }     (row found)
//                                    404 stats-not-found (problem+json)
//                                    422 invalid-player-name
//                                    500 db-unavailable
//
// Read-only display surface. W1 keeps the legacy `invalid-player-name`
// problem slug: the wire vocabulary is intentionally unchanged during
// the migration (plan §2.3 — problem slug 词表保持不变); the slug name
// is stale but the slug itself is what callers (lib/game-net.ts and any
// future caller) match on. A wholesale slug rename would expand the
// PR blast radius for no behavior gain. Pinned in reports/review/V9
// audit trail.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
): Promise<Response> {
  const { room: raw } = await params;
  const room = normalizeRoom(decodeURIComponent(raw));
  if (room === null) {
    return problemResponse(422, 'invalid-player-name');
  }
  try {
    const stats = await loadRecordByRoom(room);
    if (stats === null) {
      return problemResponse(404, 'stats-not-found', `No row for room "${room}".`);
    }
    return NextResponse.json({ stats });
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
