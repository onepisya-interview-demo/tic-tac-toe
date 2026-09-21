import { NextResponse } from 'next/server';
import { loadRecordByRoom } from '@/lib/db';
import { normalizeRoom } from '@/lib/room-name';
import { problemResponse } from '@/lib/api-problem';

// W1 (ulw-room-migration-home-landing) thin transport wrapper.
//   GET /api/rooms/{room}/stats  →  200 { stats: GameStats }     (row found)
//                                    404 stats-not-found (problem+json)
//                                    422 invalid-room-name
//                                    500 db-unavailable
//
// Read-only display surface. Slugs speak the W3 room vocabulary
// (CONTEXT.md); W-C (ulw-result-win-celebration D-5b) renamed the W1
// player-era 422 slug to `invalid-room-name` with no compat window —
// callers (lib/game-net.ts and any future caller) branch on status
// codes, not slug strings.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
): Promise<Response> {
  const { room: raw } = await params;
  const room = normalizeRoom(decodeURIComponent(raw));
  if (room === null) {
    return problemResponse(422, 'invalid-room-name');
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
