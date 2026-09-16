import { NextResponse } from 'next/server';
import { mergeSoloRecord } from '@/lib/db';
import { emptyStats, type GameStats } from '@/lib/game';

// Same Node.js runtime rationale as the parent /api/solo-stats route.
// Edge runtime cannot use @libsql/client's native sqlite module; Turso
// HTTP also travels over the Node runtime in this app.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAME_MAX = 24;
const NAME_MIN = 1;

function isValidPlayerName(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20) return false;
    if (code === 0x7f) return false;
    if (code >= 0x80 && code <= 0x9f) return false;
  }
  return trimmed.length > 0;
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return isValidPlayerName(trimmed) ? trimmed : null;
}

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

function isSyncBody(
  v: unknown,
): v is { name: string; stats: GameStats } {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== 'string') return false;
  if (!isGameStatsShape(r.stats)) return false;
  for (const k of Object.keys(r)) {
    if (k !== 'name' && k !== 'stats') return false;
  }
  return true;
}

/**
 * POST /api/solo-stats/sync — server-authoritative cross-device merge
 * (ulw-solo-sync-rebuild.md B-T2 / B-T4). Body { name, stats } carries
 * the local solo ledger the user just opted to push; the server folds
 * it into the per-name row via mergeSoloRecord (load → accumulate per-
 * field → upsert) and returns the merged row so the client can adopt
 * it as the new panel state and clear its local copy. Reject path
 * (“保留本地”) does NOT touch this endpoint — the dialog only opens
 * the network call after the user picks “合并并清空” so a rejected
 * sync is a guaranteed zero-write for the V7 contract.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isSyncBody(body)) {
    return NextResponse.json(
      { error: 'invalid request shape' },
      { status: 422 },
    );
  }
  const name = normalizeName(body.name);
  if (name === null) {
    return NextResponse.json(
      { error: 'invalid player name' },
      { status: 422 },
    );
  }
  try {
    const stats = await mergeSoloRecord(name, body.stats);
    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({ error: 'db unavailable' }, { status: 500 });
  }
}

// Re-export the empty-stats sentinel so the client can compute the
// “线上 a + 本机 b = 共 c” breakdown without importing from lib.
export { emptyStats };
