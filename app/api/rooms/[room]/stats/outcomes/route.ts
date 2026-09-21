import { NextResponse } from 'next/server';
import { recordOutcomeForRoom } from '@/lib/db';
import { normalizeRoom } from '@/lib/room-name';
import { problemResponse } from '@/lib/api-problem';

// W1 (ulw-room-migration-home-landing) thin transport wrapper.
//   POST /api/rooms/{room}/stats/outcomes
//     body { outcome: 'X' | 'O' | 'draw' }
//       → 200 { stats: GameStats }    (server-authoritative accumulator)
//       → 404 stats-not-found (problem+json, 防静默建档)
//       → 422 invalid-request-shape / invalid-room-name
//       → 500 db-unavailable
//
// The outcome is the per-game child resource of the per-room stats
// row. Server is the authoritative accumulator (lib/db.ts:recordOutcomeForRoom
// does load → recordOutcome → upsert, returning { ok:true, stats }
// | { ok:false, reason:'not-found' }); the route only maps the
// tagged result to a status. A 404 here means the row vanished
// between /api/rooms and this call — same anti-silent-create
// contract as /merge.
//
// Slugs speak the W3 room vocabulary (CONTEXT.md): W-C
// (ulw-result-win-celebration D-5b) renamed the W1 player-era 422
// slug to `invalid-room-name` with no compat window.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isOutcomeValue(v: unknown): v is 'X' | 'O' | 'draw' {
  return v === 'X' || v === 'O' || v === 'draw';
}

function isOutcomeBody(v: unknown): v is { outcome: 'X' | 'O' | 'draw' } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (!isOutcomeValue(r.outcome)) return false;
  for (const k of Object.keys(r)) {
    if (k !== 'outcome') return false;
  }
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ room: string }> },
): Promise<Response> {
  const { room: raw } = await params;
  const room = normalizeRoom(decodeURIComponent(raw));
  if (room === null) {
    return problemResponse(422, 'invalid-room-name');
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse(400, 'invalid-json');
  }
  if (!isOutcomeBody(body)) {
    return problemResponse(422, 'invalid-request-shape');
  }
  try {
    const result = await recordOutcomeForRoom(room, body.outcome);
    if (!result.ok) {
      // 404 防静默建档 — 在线版要求 room, 无名入口拦截先于本调用.
      return problemResponse(
        404,
        'stats-not-found',
        `No row for room "${room}". Enter or create the room before recording outcomes.`,
      );
    }
    return NextResponse.json({ stats: result.stats });
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
