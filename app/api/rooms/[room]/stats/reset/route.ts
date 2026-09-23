import { NextResponse } from 'next/server';
import { resetRecordByRoom } from '@/lib/db';
import { normalizeRoom } from '@/lib/room-name';
import { problemResponse } from '@/lib/api-problem';

// W-R (ulw-online-reset-and-result-fresh D-2) thin transport wrapper.
//   POST /api/rooms/{room}/stats/reset
//     no body
//       → 200 { stats: GameStats }    (all-zero row, identity preserved)
//       → 404 stats-not-found (problem+json, 防静默建档)
//       → 422 invalid-room-name
//       → 500 db-unavailable
//
// Action endpoint in the merge/outcomes family — NOT a DELETE resource
// verb: DELETE /stats would read as 「删除房间」, while the frozen
// contract is 清零计数、保留身份 (see lib/db.ts:resetRecordByRoom for
// the rationale). The route only maps the tagged service result to a
// status code (service/transport separation, AGENTS.md
// §本项目反模式); every slug is a pre-existing lib/api-problem.ts
// entry — zero new slugs.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ room: string }> },
): Promise<Response> {
  const { room: raw } = await params;
  const room = normalizeRoom(decodeURIComponent(raw));
  if (room === null) {
    return problemResponse(422, 'invalid-room-name');
  }
  try {
    const result = await resetRecordByRoom(room);
    if (!result.ok) {
      // 404 防静默建档 — reset 一个未进入过的房间不许偷渡成建档。
      return problemResponse(
        404,
        'stats-not-found',
        `No row for room "${room}". Enter or create the room before resetting its stats.`,
      );
    }
    return NextResponse.json({ stats: result.stats });
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
