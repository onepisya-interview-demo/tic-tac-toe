import { NextResponse } from 'next/server';
import { loadSoloRecord, mergeSoloRecord } from '@/lib/db';
import { normalizePlayerName } from '@/lib/player-name';
import { problemResponse } from '@/lib/api-problem';
import { type GameStats } from '@/lib/game';

// W2 (ulw-one-game-two-versions) thin transport wrapper.
//   POST /api/players/{name}/stats/merge
//     body { stats: GameStats }
//       → 200 { stats: GameStats }   (server-authoritative per-field sum)
//       → 409 player-session-required (problem+json, 防静默建档)
//       → 422 invalid-request-shape / invalid-player-name
//       → 500 db-unavailable
//
// Pre-condition: caller must have just hit POST /api/sessions for the
// same name (the SyncConfirmDialog flow enforces this — the dialog
// opens only after postPlayerSession already returned a row). A 409
// here means the row vanished in between (admin delete, forged request,
// concurrent wipe); we refuse to silently upsert emptyStats() so a
// forged merge cannot resurrect a wiped account (B-T2 contract carried
// over from W3, now under the RESTful surface).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isGameStatsShape(v: unknown): v is GameStats {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.totalGames === 'number' && Number.isFinite(s.totalGames) &&
    typeof s.xWins === 'number' && Number.isFinite(s.xWins) &&
    typeof s.oWins === 'number' && Number.isFinite(s.oWins) &&
    typeof s.draws === 'number' && Number.isFinite(s.draws) &&
    typeof s.currentStreak === 'number' && Number.isFinite(s.currentStreak) &&
    Object.keys(s).sort().join(',') === 'currentStreak,draws,oWins,totalGames,xWins'
  );
}

function isMergeBody(v: unknown): v is { stats: GameStats } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (!isGameStatsShape(r.stats)) return false;
  for (const k of Object.keys(r)) {
    if (k !== 'stats') return false;
  }
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name: raw } = await params;
  const name = normalizePlayerName(decodeURIComponent(raw));
  if (name === null) {
    return problemResponse(422, 'invalid-player-name');
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse(400, 'invalid-json');
  }
  if (!isMergeBody(body)) {
    return problemResponse(422, 'invalid-request-shape');
  }
  try {
    const existing = await loadSoloRecord(name);
    if (!existing) {
      // 409 防静默建档 — caller must run /api/sessions first.
      return problemResponse(
        409,
        'player-session-required',
        `No row for name "${name}". Register or log in before merging.`,
      );
    }
    const stats = await mergeSoloRecord(name, body.stats);
    return NextResponse.json({ stats });
  } catch {
    return problemResponse(500, 'db-unavailable');
  }
}
