import { NextResponse } from 'next/server';
import { loadRecordByName } from '@/lib/db';
import { normalizePlayerName } from '@/lib/player-name';
import { problemResponse } from '@/lib/api-problem';

// W2 (ulw-one-game-two-versions) thin transport wrapper.
//   GET /api/players/{name}/stats  →  200 { stats: GameStats }     (row found)
//                                     404 stats-not-found (problem+json)
//                                     422 invalid-player-name
//                                     500 db-unavailable
//
// Read-only display surface. The OnlineStatsCard on the home page
// uses this; the 404 → { stats: null } translation lives in the
// client wrapper (lib/game-net.ts:fetchPlayerStats) so the route
// stays RFC-9457-pure and the display code branches on a single
// null sentinel instead of status codes.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name: raw } = await params;
  const name = normalizePlayerName(decodeURIComponent(raw));
  if (name === null) {
    return problemResponse(422, 'invalid-player-name');
  }
  try {
    const stats = await loadRecordByName(name);
    if (stats === null) {
      return problemResponse(404, 'stats-not-found', `No row for name "${name}".`);
    }
    return NextResponse.json({ stats });
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
