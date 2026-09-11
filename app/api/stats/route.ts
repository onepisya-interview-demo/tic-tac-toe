import { NextResponse } from 'next/server';
import { loadStats, saveStats, resetStats } from '@/lib/db';
import { type GameStats } from '@/lib/game';

// Run this route on the Vercel Node.js runtime. Earlier exploration tried
// `runtime='edge'` for low-latency global distribution; Next.js 16 deprecates
// the Edge runtime and Vercel's Node runtime already serves from edge nodes
// with comparable UX, so Node wins on simplicity. @libsql/client's native
// sqlite module needs Node built-ins (`node:fs`, `node:path`), which is the
// reason this route stays on Node rather than Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isGameStats(v: unknown): v is GameStats {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.totalGames === 'number' &&
    typeof r.xWins === 'number' &&
    typeof r.oWins === 'number' &&
    typeof r.draws === 'number' &&
    typeof r.currentStreak === 'number'
  );
}

export async function GET() {
  const stats = await loadStats();
  return NextResponse.json(stats);
}

/**
 * @deprecated Clients must NOT call this endpoint. The stats race fix in
 * stats-server-authoritative-delta moves client writes to
 * `POST /api/stats/outcome` (server-authoritative delta). This PUT remains
 * ONLY for QA seed (`tests/qa/ux-qa.mjs:39`), admin tooling, and one-off
 * migrations. Its request/response shape and 4xx/2xx behavior are unchanged.
 */

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isGameStats(body)) {
    return NextResponse.json({ error: 'invalid stats shape' }, { status: 400 });
  }
  await saveStats(body);
  return NextResponse.json(body);
}

export async function DELETE() {
  const zero = await resetStats();
  return NextResponse.json(zero);
}
